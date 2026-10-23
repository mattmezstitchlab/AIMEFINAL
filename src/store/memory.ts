/**
 * Stockage de secours, en mémoire, quand le navigateur refuse IndexedDB (certains modes privés).
 * Rien ne survit au rechargement : l'interface le dit clairement.
 */
import type { AimeDocument } from '../core/types';
import { uid } from '../core/ids';
import type { DocumentStore, Snapshot } from './contract';

export function memoryStore(): DocumentStore {
  const docs = new Map<string, { doc: AimeDocument; rev: number; savedAt: string }>();
  const assets = new Map<string, Blob>();
  const snaps: (Snapshot & { doc: AimeDocument })[] = [];
  let current: string | null = null;
  return {
    async loadCurrent() {
      const e = current ? docs.get(current) : undefined;
      return e ? { kind: 'ok', record: e, warnings: [] } : { kind: 'empty' };
    },
    async save(doc, expectedRev) {
      const e = docs.get(doc.id);
      if (e && e.rev !== expectedRev) return { ok: false, conflict: e };
      const savedAt = new Date().toISOString();
      const rev = (e?.rev ?? 0) + 1;
      docs.set(doc.id, { doc, rev, savedAt });
      current = doc.id;
      return { ok: true, rev, savedAt };
    },
    async setCurrent(id) {
      current = id;
    },
    async revisionOf(id) {
      return docs.get(id)?.rev ?? 0;
    },
    async putAsset(id, blob) {
      assets.set(id, blob);
    },
    async getAsset(id) {
      return assets.get(id);
    },
    async snapshot(doc, label) {
      const s = { id: uid('v'), docId: doc.id, title: doc.title, label, at: new Date().toISOString(), doc };
      snaps.push(s);
      const { doc: _d, ...meta } = s;
      return meta;
    },
    async listSnapshots() {
      return [...snaps].reverse().map(({ doc: _d, ...meta }) => meta);
    },
    async readSnapshot(id) {
      return snaps.find((s) => s.id === id)?.doc ?? null;
    },
  };
}
