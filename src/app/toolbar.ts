import type { Editor } from './editor';
import { h } from '../core/dom';
import { getBlock, type BlockAction } from '../core/registry';
import { uid } from '../core/ids';
import { icon } from './icons';
import { dialog, notify } from './notify';
import { download, exportHtml, slugify } from './export';
import { exportPackage, importPackage } from '../store/package';
import { startDocument, type StartChoice } from './templates';

export const DESIGN_SYSTEMS: { id: string; label: string; hint: string }[] = [
  { id: 'iris', label: 'Original Iris', hint: 'Sombre, accents irisés' },
  { id: 'clair', label: 'Minimal Clair', hint: 'Clair, sobre, éditorial' },
];

const STORAGE_NOTICE = 'Votre travail est enregistré sur cet appareil, dans ce navigateur uniquement. Exportez le projet (.json) pour le garder ailleurs.';

type ButtonOpts = { label: string; iconName: string; onClick: () => void; title?: string; testid?: string };

function toolButton(o: ButtonOpts): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: 'aime-tool', 'aria-label': o.label, title: o.title ?? o.label, 'data-testid': o.testid, onclick: o.onClick },
    icon(o.iconName),
    h('span', { class: 'aime-tool__label', 'aria-hidden': 'true' }, o.label),
  );
}

/** Un petit panneau qui s'ouvre au-dessus de la barre. Échap ou un clic ailleurs le referme. */
function popover(trigger: HTMLButtonElement, build: (close: () => void) => HTMLElement): void {
  let panel: HTMLElement | null = null;
  const close = () => {
    panel?.remove();
    panel = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', escape, true);
  };
  const outside = (e: Event) => {
    if (panel && !panel.contains(e.target as Node) && !trigger.contains(e.target as Node)) close();
  };
  const escape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      trigger.focus();
    }
  };
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.addEventListener('click', () => {
    if (panel) return close();
    panel = build(close);
    panel.classList.add('aime-popover');
    trigger.closest('.aime-dock-wrap')!.append(panel);
    const tr = trigger.getBoundingClientRect();
    const wrap = trigger.closest('.aime-dock-wrap')!.getBoundingClientRect();
    const width = panel.getBoundingClientRect().width;
    const left = Math.min(Math.max(8, tr.left + tr.width / 2 - width / 2 - wrap.left), wrap.width - width - 8);
    panel.style.left = `${Math.max(0, left)}px`;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    panel.querySelector<HTMLElement>('button, input')?.focus();
  });
}

export function mountChrome(editor: Editor, fileInput: HTMLInputElement): HTMLElement[] {
  // ─── En-tête discret : l'orbe, le titre, l'état d'enregistrement ─────────
  const title = h('input', { class: 'aime-title', type: 'text', 'aria-label': 'Titre de la page', spellcheck: 'false', maxlength: '200' });
  title.addEventListener('change', () => editor.setTitle(title.value));
  title.addEventListener('keydown', (e) => e.key === 'Enter' && title.blur());
  const status = h('span', { class: 'aime-status', 'data-testid': 'save-status', title: STORAGE_NOTICE });
  const header = h(
    'header',
    { class: 'aime-header', 'data-edit-only': '' },
    h('span', { class: 'aime-orb', 'aria-hidden': 'true' }),
    h('span', { class: 'aime-brand' }, 'AIME'),
    title,
    status,
  );

  // ─── Conflit : un autre onglet a enregistré une version plus récente ─────
  const conflict = h('div', { class: 'aime-banner', role: 'alert', hidden: true, 'data-testid': 'conflict' });

  // ─── La barre du bas ─────────────────────────────────────────────────────
  const selectBtn = toolButton({ label: 'Sélectionner', iconName: 'select', onClick: () => editor.setTool('select'), title: 'Sélectionner et écrire (V)' });
  const moveBtn = toolButton({ label: 'Déplacer', iconName: 'move', onClick: () => editor.setTool('move'), title: 'Déplacer les blocs en les attrapant (M)' });
  const textBtn = toolButton({ label: 'Texte', iconName: 'text', onClick: () => editor.addBlock('text'), testid: 'add-text' });
  const imageBtn = toolButton({ label: 'Image', iconName: 'image', onClick: () => ((fileInput.dataset.target = ''), fileInput.click()), title: 'Ajouter une image depuis votre appareil', testid: 'add-image' });
  const gridBtn = toolButton({ label: 'Grille', iconName: 'grid', onClick: () => editor.addBlock('container'), title: 'Ajouter un conteneur : une grille dans la grille', testid: 'add-grid' });
  const styleBtn = toolButton({ label: 'Apparence', iconName: 'style', onClick: () => {}, title: 'Changer de Design System', testid: 'appearance' });
  const undoBtn = toolButton({ label: 'Annuler', iconName: 'undo', onClick: () => editor.undo(), title: 'Annuler (Ctrl/⌘ + Z)', testid: 'undo' });
  const redoBtn = toolButton({ label: 'Rétablir', iconName: 'redo', onClick: () => editor.redo(), title: 'Rétablir (Ctrl/⌘ + Maj + Z)', testid: 'redo' });
  const previewBtn = toolButton({ label: 'Aperçu', iconName: 'preview', onClick: () => editor.setMode('view', 'desktop'), testid: 'preview' });
  const saveBtn = toolButton({ label: 'Enregistrer', iconName: 'save', onClick: () => void saveNow(), title: 'Enregistrer sur cet appareil (Ctrl/⌘ + S)', testid: 'save' });
  const exportBtn = toolButton({ label: 'Exporter', iconName: 'export', onClick: () => {}, title: 'Télécharger, exporter, importer', testid: 'export' });

  popover(styleBtn, (close) =>
    h(
      'div',
      { role: 'group', 'aria-label': 'Design System' },
      h('p', { class: 'aime-popover__title' }, 'Apparence'),
      ...DESIGN_SYSTEMS.map((ds) =>
        h(
          'button',
          {
            type: 'button',
            class: 'aime-choice',
            'aria-pressed': String(editor.doc.designSystem === ds.id),
            'data-ds-option': ds.id,
            onclick: () => (editor.setDesignSystem(ds.id), close()),
          },
          h('span', { class: 'aime-swatch', 'data-ds': ds.id, 'aria-hidden': 'true' }),
          h('span', {}, h('strong', {}, ds.label), h('small', {}, ds.hint)),
        ),
      ),
      h('p', { class: 'aime-popover__note' }, 'Le style change, le contenu ne bouge pas.'),
    ),
  );

  const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'data-testid': 'import-input' });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (file) await importProject(file);
  });

  popover(exportBtn, (close) => {
    const item = (label: string, hint: string, testid: string, run: () => void) =>
      h('button', { type: 'button', class: 'aime-choice', 'data-testid': testid, onclick: () => (close(), run()) }, h('span', {}, h('strong', {}, label), h('small', {}, hint)));
    return h(
      'div',
      { role: 'group', 'aria-label': 'Exporter' },
      h('p', { class: 'aime-popover__title' }, 'Exporter et partager'),
      item('Télécharger la page HTML', 'Un fichier autonome à ouvrir ou héberger. Ce n’est pas une mise en ligne.', 'export-html', () => void downloadHtml()),
      item('Exporter le projet (.json)', 'Le document et ses images, pour le rouvrir ici ou ailleurs.', 'export-json', () => void downloadProject()),
      item('Importer un projet…', 'Remplace la page actuelle ; une version de secours est gardée.', 'import', () => importInput.click()),
      h('hr'),
      item('Nouvelle page…', 'Repartir d’une grille vide ou du modèle minimal.', 'new-page', () => void newPage()),
      item('Pages et versions…', 'Rouvrir une autre page de cet appareil ou revenir à une version.', 'versions', () => void showVersions()),
      h('p', { class: 'aime-popover__note' }, STORAGE_NOTICE),
    );
  });

  const dock = h(
    'nav',
    { class: 'aime-dock', role: 'toolbar', 'aria-label': 'Outils de création' },
    h('div', { class: 'aime-dock__group' }, selectBtn, moveBtn),
    h('div', { class: 'aime-dock__group' }, textBtn, imageBtn, gridBtn),
    h('div', { class: 'aime-dock__group' }, styleBtn),
    h('div', { class: 'aime-dock__group' }, undoBtn, redoBtn),
    h('div', { class: 'aime-dock__group' }, previewBtn, saveBtn, exportBtn),
    importInput,
  );

  // ─── Second niveau : les actions du bloc choisi ─────────────────────────
  const context = h('div', { class: 'aime-context', role: 'toolbar', hidden: true, 'data-testid': 'context-bar' });

  // ─── Aperçu : ordinateur / téléphone ────────────────────────────────────
  const deskBtn = toolButton({ label: 'Ordinateur', iconName: 'desktop', onClick: () => editor.setMode('view', 'desktop'), testid: 'preview-desktop' });
  const phoneBtn = toolButton({ label: 'Téléphone', iconName: 'phone', onClick: () => editor.setMode('view', 'phone'), testid: 'preview-phone' });
  const backBtn = h('button', { type: 'button', class: 'aime-button is-primary', 'data-testid': 'preview-exit', onclick: () => editor.setMode('edit') }, 'Revenir à l’édition');
  const previewBar = h(
    'nav',
    { class: 'aime-dock aime-dock--preview', role: 'toolbar', 'aria-label': 'Aperçu', hidden: true },
    h('span', { class: 'aime-dock__note' }, 'Aperçu'),
    h('div', { class: 'aime-dock__group' }, deskBtn, phoneBtn),
    backBtn,
  );

  const wrap = h('div', { class: 'aime-dock-wrap' }, context, dock, previewBar);

  // ─── Actions ────────────────────────────────────────────────────────────

  async function saveNow(): Promise<void> {
    const state = await editor.persistence.flush(editor.doc);
    if (state.kind === 'saved') {
      await editor.store.snapshot(editor.doc, 'Enregistrement');
      notify('Enregistré sur cet appareil.');
    } else if (state.kind === 'error') notify(state.message, 'error');
  }

  async function downloadHtml(): Promise<void> {
    const { html, missing } = await exportHtml(editor.doc, (id) => editor.store.getAsset(id));
    download(`${slugify(editor.doc.title)}.html`, html, 'text/html;charset=utf-8');
    if (missing) notify(`Page HTML téléchargée, mais ${missing} image(s) introuvable(s) sur cet appareil n’y figurent pas. Remplacez-les puis exportez à nouveau.`, 'error');
    else notify('Page HTML téléchargée. Elle n’est pas en ligne : ouvrez-la ou hébergez-la où vous voulez.');
  }

  async function downloadProject(): Promise<void> {
    try {
      const json = await exportPackage(editor.doc, (id) => editor.store.getAsset(id));
      download(`${slugify(editor.doc.title)}.aime.json`, json, 'application/json');
      notify('Projet exporté (.aime.json).');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export impossible.', 'error');
    }
  }

  async function importProject(file: File): Promise<void> {
    if (file.size > 200 * 1024 * 1024) return notify('Fichier trop lourd pour être importé.', 'error');
    const result = await importPackage(await file.text());
    if (!result.ok) return notify(result.reason, 'error');
    const ok = await dialog({
      title: 'Importer ce projet ?',
      body: [`« ${result.doc.title} » remplacera la page affichée. Une version de secours de la page actuelle est gardée dans « Versions enregistrées ».`, ...result.warnings],
      actions: [
        { label: 'Annuler', value: 'no' },
        { label: 'Importer', value: 'yes', primary: true },
      ],
    });
    if (ok !== 'yes') return;
    await editor.persistence.flush(editor.doc);
    await editor.store.snapshot(editor.doc, 'Avant import');
    for (const [id, blob] of result.blobs) await editor.store.putAsset(id, blob);
    // Nouvel identifiant : importer deux fois le même fichier ne fait jamais écraser l'un par l'autre.
    await editor.replace({ ...result.doc, id: uid('doc') }, 0);
    notify(result.from < 2 ? 'Projet importé et mis à jour vers le format actuel.' : 'Projet importé.');
  }

  async function newPage(): Promise<void> {
    const choice = await dialog({
      title: 'Nouvelle page',
      body: ['La page actuelle est gardée dans « Versions enregistrées ».'],
      actions: [
        { label: 'Annuler', value: 'cancel' },
        { label: 'Modèle minimal', value: 'minimal' },
        { label: 'Grille vide', value: 'empty', primary: true },
      ],
    });
    if (choice !== 'empty' && choice !== 'minimal') return;
    await editor.persistence.flush(editor.doc);
    await editor.store.snapshot(editor.doc, 'Avant nouvelle page');
    await editor.replace(startDocument(choice as StartChoice), 0);
  }

  async function showVersions(): Promise<void> {
    const [snaps, pages, quarantined] = await Promise.all([editor.store.listSnapshots(), editor.store.listDocuments(), editor.store.listQuarantined()]);
    const others = pages.filter((p) => p.id !== editor.doc.id);
    if (!snaps.length && !others.length && !quarantined.length) return notify('Aucune autre page ni version pour l’instant. « Enregistrer » crée une version.');
    const fmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const choice = await dialog({
      title: 'Pages et versions',
      className: 'aime-dialog--list',
      body: [STORAGE_NOTICE],
      actions: [
        ...others.slice(0, 8).map((p) => ({ label: `Ouvrir la page « ${p.title} » · ${fmt.format(new Date(p.savedAt))}`, value: `doc:${p.id}` })),
        ...snaps.slice(0, 12).map((s) => ({ label: `Version : ${s.title} — ${s.label} · ${fmt.format(new Date(s.at))}`, value: `snap:${s.id}` })),
        ...quarantined.map((q) => ({ label: `Télécharger la page illisible mise de côté · ${fmt.format(new Date(q.at))}`, value: `q:${q.id}` })),
        { label: 'Fermer', value: 'close', primary: true },
      ],
    });
    if (!choice || choice === 'close') return;
    if (choice.startsWith('q:')) {
      const q = quarantined.find((x) => `q:${x.id}` === choice);
      if (q) download(`page-mise-de-cote-${q.at.slice(0, 10)}.json`, JSON.stringify(q.raw, null, 2), 'application/json');
      return notify('Page mise de côté téléchargée : elle contient vos données brutes, même si AIME ne peut plus l’ouvrir.');
    }
    await editor.persistence.flush(editor.doc);
    if (choice.startsWith('doc:')) {
      const record = await editor.store.readDocument(choice.slice(4));
      if (!record) return notify('Cette page est illisible.', 'error');
      await editor.store.setCurrent(record.doc.id);
      await editor.replace(record.doc, record.rev);
      return notify(`Page ouverte : ${record.doc.title}.`);
    }
    const doc = await editor.store.readSnapshot(choice.slice(5));
    if (!doc) return notify('Cette version est illisible.', 'error');
    await editor.store.snapshot(editor.doc, 'Avant restauration');
    await editor.replace(doc, await editor.store.revisionOf(doc.id));
    notify(`Version restaurée : ${doc.title}.`);
  }

  function renderConflict(): void {
    const state = editor.persistence.state;
    if (state.kind !== 'conflict') {
      conflict.hidden = true;
      return;
    }
    if (!conflict.hidden) return;
    conflict.replaceChildren(
      h('p', {}, 'Cette page a été enregistrée depuis un autre onglet. Rien n’a été écrasé.'),
      h(
        'button',
        {
          type: 'button',
          class: 'aime-button',
          onclick: async () => {
            // L'autre version n'est jamais perdue : elle devient une version de secours avant d'être remplacée.
            await editor.store.snapshot(state.theirs.doc, 'Version écartée (conflit)');
            await editor.persistence.keepMine(editor.doc);
          },
        },
        'Garder ma version',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'aime-button is-primary',
          onclick: async () => {
            const theirs = state.theirs;
            await editor.store.snapshot(editor.doc, 'Version écartée (conflit)');
            editor.persistence.adopt(theirs);
            await editor.replace(theirs.doc, theirs.rev);
          },
        },
        'Reprendre l’autre version',
      ),
    );
    conflict.hidden = false;
  }

  function renderContext(): void {
    const id = editor.selected;
    const node = id ? editor.doc.nodes[id] : undefined;
    if (!node || editor.mode !== 'edit') {
      context.hidden = true;
      context.replaceChildren();
      return;
    }
    const def = getBlock(node.type);
    const props = def ? { ...def.defaults(), ...node.props } : node.props;
    context.setAttribute('aria-label', `Bloc ${def?.label ?? node.type}`);
    context.replaceChildren(
      h('span', { class: 'aime-context__label' }, def?.label ?? node.type),
      ...(def?.actions?.(props) ?? []).map((a) => renderAction(a, node.id)),
      h('span', { class: 'aime-context__sep', 'aria-hidden': 'true' }),
      h('button', { type: 'button', title: 'Dupliquer (Ctrl/⌘ + D)', 'aria-label': 'Dupliquer', onclick: () => editor.duplicateSelected() }, icon('copy')),
      h('button', { type: 'button', class: 'is-danger', title: 'Supprimer (Suppr)', 'aria-label': 'Supprimer', onclick: () => editor.removeSelected() }, icon('trash')),
    );
    context.hidden = false;
  }

  function renderAction(action: BlockAction, id: string): HTMLElement {
    switch (action.kind) {
      case 'button':
        return h(
          'button',
          { type: 'button', title: action.title, 'aria-pressed': action.active === undefined ? undefined : String(action.active), onclick: () => editor.updateProps(id, action.patch) },
          action.label,
        );
      case 'label':
        return h('span', { class: 'aime-context__static', title: action.title }, action.label);
      case 'input': {
        const input = h('input', { type: 'text', value: action.value, placeholder: action.placeholder, 'aria-label': action.label });
        const commit = () => input.value !== action.value && editor.updateProps(id, { [action.key]: input.value.trim().slice(0, 500) });
        input.addEventListener('change', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
          e.stopPropagation();
        });
        return h('label', { class: 'aime-context__field' }, h('span', {}, action.label), input);
      }
      case 'file':
        return h(
          'button',
          { type: 'button', onclick: () => ((fileInput.dataset.target = id), fileInput.click()) },
          action.label,
        );
    }
  }

  const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const update = () => {
    const previewing = editor.mode === 'view';
    if (document.activeElement !== title) title.value = editor.doc.title;
    undoBtn.disabled = !editor.canUndo;
    redoBtn.disabled = !editor.canRedo;
    selectBtn.setAttribute('aria-pressed', String(editor.tool === 'select'));
    moveBtn.setAttribute('aria-pressed', String(editor.tool === 'move'));
    deskBtn.setAttribute('aria-pressed', String(editor.device === 'desktop'));
    phoneBtn.setAttribute('aria-pressed', String(editor.device === 'phone'));
    dock.hidden = previewing;
    previewBar.hidden = !previewing;

    const s = editor.persistence.state;
    status.dataset.state = s.kind;
    status.textContent =
      s.kind === 'saved'
        ? `Enregistré sur cet appareil · ${fmtTime.format(new Date(s.at))}`
        : s.kind === 'pending' || s.kind === 'saving'
          ? 'Enregistrement…'
          : s.kind === 'error'
            ? `Non enregistré — ${s.message}`
            : 'En attente : conflit avec un autre onglet';
    saveBtn.classList.toggle('has-changes', s.kind !== 'saved');
    renderConflict();
    renderContext();
  };
  editor.subscribe(update);
  update();

  // Raccourcis d'outils (hors saisie).
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    if (e.key === 'v' || e.key === 'V') editor.setTool('select');
    if (e.key === 'm' || e.key === 'M') editor.setTool('move');
  });

  return [header, conflict, wrap];
}
