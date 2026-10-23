/**
 * Stockage local : IndexedDB. Documents, médias (fichiers) et versions de secours survivent
 * au rechargement de la page — sur CET appareil, dans CE navigateur uniquement.
 *
 * Modèle repris d'AIME-NEXT (src/stockage/depot.ts) : médias en Blob, jamais en base64
 * dans le document ; tout document relu repasse par la validation et les migrations.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AimeDocument } from '../core/types';
import { openDocument } from '../core/migrations';
import { uid } from '../core/ids';
import type { DocumentStore, LoadResult, SaveResult, Snapshot, StoredDocument } from './contract';

export const DB_NAME = 'aimefinal';
const DB_VERSION = 1;
const MAX_SNAPSHOTS = 30;

interface Schema extends DBSchema {
  documents: { key: string; value: { id: string; rev: number; savedAt: string; doc: unknown } };
  assets: { key: string; value: { id: string; blob: Blob } };
  snapshots: { key: string; value: Snapshot & { doc: AimeDocument }; indexes: { byAt: string } };
  meta: { key: string; value: { key: string; value: string } };
  quarantine: { key: string; value: { id: string; at: string; reason: string; raw: unknown } };
}

export async function openLocalStore(name = DB_NAME): Promise<DocumentStore & { close(): void }> {
  const db: IDBPDatabase<Schema> = await openDB<Schema>(name, DB_VERSION, {
    upgrade(base) {
      // version 1 : création. Les versions suivantes n'ajoutent que des magasins ou des index.
      base.createObjectStore('documents', { keyPath: 'id' });
      base.createObjectStore('assets', { keyPath: 'id' });
      base.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('byAt', 'at');
      base.createObjectStore('meta', { keyPath: 'key' });
      base.createObjectStore('quarantine', { keyPath: 'id' });
    },
  });

  const store: DocumentStore & { close(): void } = {
    async loadCurrent(): Promise<LoadResult> {
      const current = await db.get('meta', 'current');
      if (!current) return { kind: 'empty' };
      const entry = await db.get('documents', current.value);
      if (!entry) return { kind: 'empty' };
      const opened = openDocument(entry.doc);
      if (!opened.ok) {
        // Jamais écrasé : l'enregistrement abîmé est mis de côté, puis signalé.
        await db.put('quarantine', { id: uid('q'), at: new Date().toISOString(), reason: opened.reason, raw: entry.doc });
        await db.delete('meta', 'current');
        return { kind: 'damaged', reason: opened.reason };
      }
      return { kind: 'ok', record: { doc: opened.doc, rev: entry.rev, savedAt: entry.savedAt }, warnings: opened.report.warnings };
    },

    async save(doc, expectedRev): Promise<SaveResult> {
      try {
        const tx = db.transaction(['documents', 'meta'], 'readwrite');
        const existing = await tx.objectStore('documents').get(doc.id);
        const rev = existing?.rev ?? 0;
        if (rev !== expectedRev && existing) {
          await tx.done;
          const opened = openDocument(existing.doc);
          const conflict: StoredDocument | null = opened.ok ? { doc: opened.doc, rev, savedAt: existing.savedAt } : null;
          return conflict ? { ok: false, conflict } : { ok: false, error: 'La version enregistrée est illisible.' };
        }
        const savedAt = new Date().toISOString();
        await tx.objectStore('documents').put({ id: doc.id, rev: rev + 1, savedAt, doc });
        await tx.objectStore('meta').put({ key: 'current', value: doc.id });
        await tx.done;
        return { ok: true, rev: rev + 1, savedAt };
      } catch (error) {
        const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
        return { ok: false, error: quota ? 'Le stockage du navigateur est plein.' : 'Le navigateur a refusé l’enregistrement.' };
      }
    },

    async setCurrent(docId) {
      await db.put('meta', { key: 'current', value: docId });
    },

    async revisionOf(docId) {
      return (await db.get('documents', docId))?.rev ?? 0;
    },

    async putAsset(id, blob) {
      await db.put('assets', { id, blob });
    },

    async getAsset(id) {
      return (await db.get('assets', id))?.blob;
    },

    async listDocuments() {
      const all = await db.getAll('documents');
      return all
        .map((e) => ({ id: e.id, title: typeof (e.doc as { title?: unknown })?.title === 'string' ? (e.doc as { title: string }).title : e.id, savedAt: e.savedAt }))
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async readDocument(id) {
      const entry = await db.get('documents', id);
      if (!entry) return null;
      const opened = openDocument(entry.doc);
      return opened.ok ? { doc: opened.doc, rev: entry.rev, savedAt: entry.savedAt } : null;
    },

    async listQuarantined() {
      return (await db.getAll('quarantine')).sort((a, b) => b.at.localeCompare(a.at));
    },

    async snapshot(doc, label) {
      const snap = { id: uid('v'), docId: doc.id, title: doc.title, label, at: new Date().toISOString(), doc };
      await db.put('snapshots', snap);
      // On garde les plus récentes ; les médias, eux, ne sont jamais effacés en Phase 1.
      const keys = await db.getAllKeysFromIndex('snapshots', 'byAt');
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_SNAPSHOTS))) await db.delete('snapshots', old);
      const { doc: _doc, ...meta } = snap;
      return meta;
    },

    async listSnapshots() {
      const all = await db.getAllFromIndex('snapshots', 'byAt');
      return all.reverse().map(({ doc: _doc, ...meta }) => meta);
    },

    async readSnapshot(id) {
      const snap = await db.get('snapshots', id);
      if (!snap) return null;
      const opened = openDocument(snap.doc);
      return opened.ok ? opened.doc : null;
    },

    close() {
      db.close();
    },
  };
  return store;
}
