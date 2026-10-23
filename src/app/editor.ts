import type { AimeDocument, NodeId, Placement } from '../core/types';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from '../core/history';
import * as ops from '../core/document';
import { applyPlacement, renderDocument } from '../core/render';
import { getBlock, type Mode, type UpdateOptions } from '../core/registry';
import { cellAt, readMetrics } from '../core/geometry';
import { uid } from '../core/ids';
import type { DocumentStore } from '../store/contract';
import { checkImage } from '../store/media';
import { Persistence } from './persistence';

export type Tool = 'select' | 'move';
export type Device = 'desktop' | 'phone';

/**
 * La surface unique : voir et éditer, c'est le même écran.
 * L'éditeur tient l'historique, la sélection, l'outil et le mode ; tout changement de contenu
 * passe par une opération pure du noyau puis par `apply` (repris d'AIMENEW, app/editor.ts).
 */
export class Editor {
  private history: History<AimeDocument>;
  selected: NodeId | null = null;
  mode: Mode = 'edit';
  tool: Tool = 'select';
  device: Device = 'desktop';
  readonly persistence: Persistence;

  /** Médias de l'appareil → adresses locales du navigateur (blob:). */
  private assetUrls = new Map<string, string>();
  private renderFrame = 0;
  private pendingFocus: NodeId | null = null;
  private listeners = new Set<() => void>();
  private surfaceHost: HTMLElement;

  constructor(
    private host: HTMLElement,
    doc: AimeDocument,
    readonly store: DocumentStore,
    rev: number,
    savedAt: string | null,
    private notify: (message: string, tone?: 'info' | 'error') => void,
  ) {
    this.history = createHistory(doc);
    this.persistence = new Persistence(store, rev, savedAt);
    this.persistence.subscribe(() => this.emit());
    this.surfaceHost = document.createElement('div');
    this.surfaceHost.className = 'aime-frame';
    host.append(this.surfaceHost);
    host.addEventListener('pointerdown', this.onPointerDown);
    host.addEventListener('focusin', this.onFocusIn);
    window.addEventListener('keydown', this.onKeyDown);
  }

  // ─── État ─────────────────────────────────────────────────────────────

  get doc(): AimeDocument {
    return this.history.present;
  }
  get canUndo(): boolean {
    return canUndo(this.history);
  }
  get canRedo(): boolean {
    return canRedo(this.history);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Charge les médias du document en adresses locales, puis affiche. */
  async start(): Promise<void> {
    await this.loadAssets(this.doc);
    this.renderNow();
  }

  /** Point d'entrée unique de toute modification du document. */
  apply(next: AimeDocument, opts: UpdateOptions = {}): void {
    if (next === this.doc) return;
    this.history = commit(this.history, next, { coalesce: opts.coalesce });
    this.afterChange(opts.render !== false);
  }

  undo(): void {
    const prev = undo(this.history);
    if (prev === this.history) return;
    this.history = prev;
    this.afterChange(true);
  }

  redo(): void {
    const next = redo(this.history);
    if (next === this.history) return;
    this.history = next;
    this.afterChange(true);
  }

  /** Remplace tout le document (nouvelle page, import, version) : l'historique repart de zéro. */
  async replace(doc: AimeDocument, rev: number): Promise<void> {
    await this.loadAssets(doc);
    this.history = createHistory(doc);
    this.selected = null;
    this.persistence.reset(rev);
    this.persistence.queue(doc);
    this.renderNow();
    this.emit();
  }

  select(id: NodeId | null): void {
    if (id === this.selected) return;
    this.selected = id;
    this.applySelection();
    this.emit();
  }

  setTool(tool: Tool): void {
    if (tool === this.tool) return;
    this.tool = tool;
    this.host.dataset.tool = tool;
    this.emit();
  }

  setMode(mode: Mode, device: Device = this.device): void {
    if (mode === this.mode && device === this.device) return;
    this.mode = mode;
    this.device = device;
    if (mode === 'view') this.selected = null;
    document.body.classList.toggle('is-previewing', mode === 'view');
    this.host.dataset.device = mode === 'view' ? device : 'desktop';
    this.renderNow();
    this.emit();
  }

  resolveAsset = (id: string): string | undefined => this.assetUrls.get(id);

  // ─── Commandes ────────────────────────────────────────────────────────

  /** Où ajouter : dans la grille sélectionnée, sinon à côté du bloc sélectionné, sinon dans la page. */
  private targetGrid(doc: AimeDocument): NodeId {
    const selected = this.selected ? doc.nodes[this.selected] : undefined;
    if (!selected) return doc.root;
    return ops.isGrid(selected) ? selected.id : (ops.parentOf(doc, selected.id) ?? doc.root);
  }

  private newBlock(doc: AimeDocument, type: string, props?: Record<string, unknown>): { doc: AimeDocument; id: NodeId } | null {
    const def = getBlock(type);
    if (!def) return null;
    const parentId = this.targetGrid(doc);
    const columns = ops.columnsOf(doc.nodes[parentId]);
    const id = uid(type);
    const next = ops.addBlock(doc, parentId, {
      id,
      type,
      props: { ...def.defaults(), ...props },
      place: {
        col: 1,
        row: ops.nextFreeRow(doc, parentId),
        colSpan: Math.min(def.defaultSize.colSpan, columns),
        rowSpan: def.defaultSize.rowSpan,
      },
      ...(def.isContainer ? { children: [] } : {}),
    });
    return { doc: next, id };
  }

  /** Une opération du noyau refusée (imbrication trop profonde…) devient un message, jamais une erreur muette. */
  private attempt<T>(run: () => T): T | null {
    try {
      return run();
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'Action impossible.', 'error');
      return null;
    }
  }

  addBlock(type: string, props?: Record<string, unknown>): NodeId | null {
    const result = this.attempt(() => this.newBlock(this.doc, type, props));
    if (!result) return null;
    this.selected = result.id;
    this.pendingFocus = result.id;
    this.apply(result.doc);
    return result.id;
  }

  /**
   * Une image de l'appareil : le fichier part dans le stockage, le document reçoit sa description.
   * Sans `target`, un nouveau bloc image est créé ; sinon l'image du bloc est remplacée.
   * Ajout du média + bloc = une seule étape d'annulation.
   */
  async addImage(file: File, target?: NodeId): Promise<void> {
    const check = await checkImage(file);
    if (!check.ok) {
      this.notify(check.reason, 'error');
      return;
    }
    try {
      await this.store.putAsset(check.ref.id, file);
    } catch {
      this.notify('Le navigateur a refusé de garder cette image (stockage plein ?).', 'error');
      return;
    }
    this.assetUrls.set(check.ref.id, URL.createObjectURL(file));
    let doc = ops.addAsset(this.doc, check.ref);
    const alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    if (target && doc.nodes[target]) {
      doc = ops.updateProps(doc, target, { src: ops.assetRef(check.ref.id) });
      this.selected = target;
    } else {
      const base = doc;
      const created = this.attempt(() => this.newBlock(base, 'image', { src: ops.assetRef(check.ref.id), alt }));
      if (!created) return;
      doc = created.doc;
      this.selected = created.id;
      this.pendingFocus = created.id;
    }
    this.apply(doc);
  }

  removeSelected(): void {
    const id = this.selected;
    if (!id || id === this.doc.root) return;
    this.selected = null;
    this.apply(ops.removeBlock(this.doc, id));
  }

  duplicateSelected(): void {
    const id = this.selected;
    if (!id || id === this.doc.root) return;
    const result = this.attempt(() => ops.duplicateBlock(this.doc, id));
    if (!result) return;
    this.selected = result.id;
    this.pendingFocus = result.id;
    this.apply(result.doc);
  }

  updateProps(id: NodeId, patch: Record<string, unknown>, opts?: UpdateOptions): void {
    if (!this.doc.nodes[id]) return;
    this.apply(ops.updateProps(this.doc, id, patch), opts);
  }

  setPlacement(id: NodeId, place: Placement): void {
    this.apply(ops.setPlacement(this.doc, id, place));
  }

  setDesignSystem(id: string): void {
    this.apply(ops.setDesignSystem(this.doc, id));
  }

  setTitle(title: string): void {
    this.apply(ops.setTitle(this.doc, title));
  }

  /** Flèches : déplacer d'une cellule. Maj + flèches : redimensionner. */
  nudge(dx: number, dy: number, resize: boolean): void {
    const id = this.selected;
    if (!id || id === this.doc.root) return;
    if (this.isCollapsed(id)) return;
    const p = this.doc.nodes[id].place;
    const next: Placement = resize
      ? { ...p, colSpan: p.colSpan + dx, rowSpan: p.rowSpan + dy }
      : { ...p, col: p.col + dx, row: p.row + dy };
    this.pendingFocus = id;
    this.apply(ops.setPlacement(this.doc, id, next), { coalesce: `nudge:${id}` });
  }

  // ─── Rendu ────────────────────────────────────────────────────────────

  private afterChange(render: boolean): void {
    if (this.selected && !this.doc.nodes[this.selected]) this.selected = null;
    if (render) this.scheduleRender();
    this.persistence.queue(this.doc);
    this.emit();
  }

  private scheduleRender(): void {
    if (this.renderFrame) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = 0;
      this.renderNow();
    });
  }

  renderNow(): void {
    if (this.renderFrame) cancelAnimationFrame(this.renderFrame);
    this.renderFrame = 0;
    const active = document.activeElement as HTMLElement | null;
    const keepTyping = active?.isContentEditable ? active.closest<HTMLElement>('.aime-cell')?.dataset.id : undefined;

    const surface = renderDocument(this.doc, {
      mode: this.mode,
      onUpdate: (id, patch, opts) => this.updateProps(id, patch, opts),
      resolveAsset: this.resolveAsset,
    });
    this.surfaceHost.replaceChildren(surface);
    document.body.dataset.ds = this.doc.designSystem;
    document.title = `${this.doc.title} — AIME`;
    this.applySelection();

    const focusId = this.pendingFocus ?? keepTyping;
    this.pendingFocus = null;
    if (focusId && this.mode === 'edit') {
      const cell = this.cellOf(focusId);
      cell?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (focusId === keepTyping) cell?.querySelector<HTMLElement>('[contenteditable]')?.focus();
      else cell?.focus({ preventScroll: true });
    }
  }

  private cellOf(id: NodeId): HTMLElement | null {
    return this.surfaceHost.querySelector<HTMLElement>(`.aime-cell[data-id="${CSS.escape(id)}"]`);
  }

  /** La sélection ne reconstruit pas la page : on peut écrire dès le premier clic. */
  private applySelection(): void {
    this.surfaceHost.querySelectorAll('.aime-cell.is-selected').forEach((el) => el.classList.remove('is-selected'));
    if (!this.selected || this.mode !== 'edit') return;
    this.cellOf(this.selected)?.classList.add('is-selected');
  }

  private async loadAssets(doc: AimeDocument): Promise<void> {
    for (const id of ops.assetsInUse(doc)) {
      if (this.assetUrls.has(id)) continue;
      const blob = await this.store.getAsset(id);
      if (blob) this.assetUrls.set(id, URL.createObjectURL(blob));
    }
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ─── Interactions ─────────────────────────────────────────────────────

  private onFocusIn = (event: FocusEvent): void => {
    if (this.mode !== 'edit') return;
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.aime-cell');
    const id = cell?.dataset.id;
    if (id && id !== this.doc.root) this.select(id);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (this.mode !== 'edit' || event.button > 0) return;
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>('.aime-cell');
    const id = cell?.dataset.id ?? null;
    const handle = target.closest<HTMLElement>('[data-handle]');

    if (cell && id && id !== this.doc.root && (handle || this.tool === 'move')) {
      event.preventDefault();
      this.select(id);
      this.startDrag(event, id, handle?.dataset.handle === 'resize' ? 'resize' : 'move', cell);
      return;
    }
    this.select(id && id !== this.doc.root ? id : null);
  };

  /**
   * Une grille étroite (téléphone, petit conteneur) se replie en une colonne : la position n'y est
   * pas visible. On n'y déplace donc rien en silence ; on le dit.
   */
  private isCollapsed(id: NodeId): boolean {
    const cell = this.cellOf(id);
    const grid = cell?.parentElement;
    if (!cell || !grid) return false;
    const collapsed = getComputedStyle(cell).gridColumnStart === '1' && getComputedStyle(cell).gridColumnEnd === '-1';
    if (collapsed) this.notify('Cette grille est repliée en une colonne sur cet écran : élargissez la fenêtre pour placer ce bloc.');
    return collapsed;
  }

  private startDrag(event: PointerEvent, id: NodeId, kind: 'move' | 'resize', cell: HTMLElement): void {
    const grid = cell.parentElement;
    if (!grid?.classList.contains('aime-grid') || !grid.dataset.grid) return;
    if (this.isCollapsed(id)) return;
    const parent = this.doc.nodes[grid.dataset.grid];
    const columns = ops.columnsOf(parent);
    const rowHeight = typeof parent.props.rowHeight === 'number' ? parent.props.rowHeight : 56;

    const start = this.doc.nodes[id].place;
    const origin = cellAt(event.clientX, event.clientY, readMetrics(grid, rowHeight));
    let current = start;

    grid.classList.add('is-guiding');
    cell.classList.add('is-dragging');
    document.body.classList.add('is-dragging');

    const onMove = (ev: PointerEvent) => {
      const at = cellAt(ev.clientX, ev.clientY, readMetrics(grid, rowHeight));
      const raw: Placement =
        kind === 'move'
          ? { ...start, col: start.col + at.col - origin.col, row: start.row + at.row - origin.row }
          : { ...start, colSpan: at.col - start.col + 1, rowSpan: at.row - start.row + 1 };
      const next = ops.clampPlacement(raw, columns);
      if (ops.samePlacement(next, current)) return;
      current = next;
      applyPlacement(cell, next); // aperçu direct, sans re-rendu
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      grid.classList.remove('is-guiding');
      cell.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging');
      if (!ops.samePlacement(current, start)) this.apply(ops.setPlacement(this.doc, id, current));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const target = event.target as HTMLElement | null;
    const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    if (mod && key === 's') {
      event.preventDefault();
      void this.persistence.flush(this.doc);
      return;
    }
    if (mod && key === 'z' && !(typing && target?.tagName === 'INPUT')) {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && key === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }
    if (this.mode !== 'edit') {
      if (event.key === 'Escape') this.setMode('edit');
      return;
    }
    if (typing) {
      if (event.key === 'Escape') {
        const cell = target!.closest<HTMLElement>('.aime-cell');
        target!.blur();
        cell?.focus({ preventScroll: true });
      }
      return;
    }
    if (!this.selected) return;
    if (!target?.closest('.aime-cell') && !target?.closest('.aime-stage') && target !== document.body) return;

    if (mod && key === 'd') {
      event.preventDefault();
      this.duplicateSelected();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.removeSelected();
    } else if (event.key === 'Escape') {
      this.select(null);
    } else if (event.key === 'Enter') {
      const editable = this.cellOf(this.selected)?.querySelector<HTMLElement>('[contenteditable]');
      if (editable) {
        event.preventDefault();
        editable.focus();
      }
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      this.nudge(dx, dy, event.shiftKey);
    }
  };
}
