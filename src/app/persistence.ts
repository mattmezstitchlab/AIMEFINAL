/**
 * L'enregistrement automatique, honnête : il dit toujours où en est le document,
 * n'écrase jamais une version plus récente et ne perd rien en cas d'erreur.
 */
import type { AimeDocument } from '../core/types';
import type { DocumentStore, StoredDocument } from '../store/contract';

export type SaveState =
  | { kind: 'saved'; at: string }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; theirs: StoredDocument };

const DELAY_MS = 400;
const BACKUP_KEY = 'aimefinal.secours';

/**
 * Copie de secours SYNCHRONE du dernier état : IndexedDB est asynchrone et une fermeture ou un
 * rechargement juste après une frappe peut l'interrompre. Cette copie, elle, est écrite tout de suite.
 */
export function writeBackup(doc: AimeDocument): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(doc));
  } catch {
    /* stockage plein ou refusé : l'enregistrement normal reste la référence */
  }
}

export function readBackup(): unknown {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearBackup(doc?: AimeDocument): void {
  try {
    if (!doc) return localStorage.removeItem(BACKUP_KEY);
    const current = readBackup() as { id?: string; updatedAt?: string } | null;
    if (current?.id === doc.id && current.updatedAt === doc.updatedAt) localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* rien */
  }
}

export class Persistence {
  state: SaveState;
  private timer = 0;
  private running: Promise<void> | null = null;
  private latest: AimeDocument | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private store: DocumentStore,
    private rev: number,
    savedAt: string | null,
  ) {
    this.state = savedAt ? { kind: 'saved', at: savedAt } : { kind: 'pending' };
  }

  get revision(): number {
    return this.rev;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Un changement a eu lieu : on enregistrera bientôt (les frappes rapprochées sont regroupées). */
  queue(doc: AimeDocument): void {
    this.latest = doc;
    writeBackup(doc);
    if (this.state.kind === 'conflict') return; // rien n'est écrit tant que le conflit n'est pas tranché
    this.set({ kind: 'pending' });
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), DELAY_MS);
  }

  /** Enregistre maintenant (bouton « Enregistrer », fermeture de la page). */
  async flush(doc?: AimeDocument): Promise<SaveState> {
    if (doc) this.latest = doc;
    clearTimeout(this.timer);
    while (this.running) await this.running;
    const target = this.latest;
    if (!target || this.state.kind === 'conflict') return this.state;
    this.latest = null;
    this.set({ kind: 'saving' });
    this.running = (async () => {
      const result = await this.store.save(target, this.rev);
      if (result.ok) {
        this.rev = result.rev;
        clearBackup(target);
        this.set(this.latest ? { kind: 'pending' } : { kind: 'saved', at: result.savedAt });
      } else if ('conflict' in result) {
        this.latest = target;
        this.set({ kind: 'conflict', theirs: result.conflict });
      } else {
        this.latest = this.latest ?? target; // on retentera au prochain changement ou au prochain clic
        this.set({ kind: 'error', message: result.error });
      }
    })();
    await this.running;
    this.running = null;
    if (this.latest && this.state.kind === 'pending') return this.flush();
    return this.state;
  }

  /** Conflit tranché : « garder ma version » réécrit par-dessus en connaissance de cause. */
  async keepMine(doc: AimeDocument): Promise<SaveState> {
    if (this.state.kind !== 'conflict') return this.state;
    this.rev = this.state.theirs.rev;
    this.set({ kind: 'pending' });
    return this.flush(doc);
  }

  /** Conflit tranché : « reprendre l'autre version » — l'appelant recharge `theirs`. */
  adopt(theirs: StoredDocument): void {
    this.rev = theirs.rev;
    this.latest = null;
    this.set({ kind: 'saved', at: theirs.savedAt });
  }

  /** Un tout autre document devient le document courant (nouvelle page, import, version). */
  reset(rev: number): void {
    clearTimeout(this.timer);
    this.rev = rev;
    this.latest = null;
    this.set({ kind: 'pending' });
  }

  get hasUnsaved(): boolean {
    return this.latest !== null || this.state.kind === 'pending' || this.state.kind === 'saving' || this.state.kind === 'error' || this.state.kind === 'conflict';
  }

  private set(state: SaveState): void {
    this.state = state;
    this.listeners.forEach((l) => l());
  }
}
