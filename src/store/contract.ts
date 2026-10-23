/**
 * Le contrat de stockage : ce que l'éditeur attend d'un lieu où ranger les documents.
 *
 * Phase 1 : une seule implémentation, locale (IndexedDB, `local.ts`) : le contenu reste
 * sur CET appareil et dans CE navigateur. Phase 4 : une implémentation distante branchée
 * sur l'API d'AIMESTUDIO respectera le même contrat (voir docs/PERMISSIONS.md).
 *
 * Règles :
 * - aucune écriture silencieuse par-dessus une version plus récente : `save` exige la révision attendue ;
 * - un enregistrement abîmé n'est jamais écrasé : il est mis de côté (`quarantine`) et signalé ;
 * - remplacer un document (import, nouvelle page) crée d'abord une version de secours.
 */
import type { AimeDocument } from '../core/types';

export interface StoredDocument {
  doc: AimeDocument;
  /** Révision : +1 à chaque enregistrement. Sert à détecter un autre onglet ou appareil. */
  rev: number;
  savedAt: string;
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; record: StoredDocument; warnings: string[] }
  | { kind: 'damaged'; reason: string };

export type SaveResult =
  | { ok: true; rev: number; savedAt: string }
  | { ok: false; conflict: StoredDocument }
  | { ok: false; error: string };

export interface Snapshot {
  id: string;
  docId: string;
  title: string;
  /** Pourquoi cette version existe : « Enregistrement », « Avant import »… */
  label: string;
  at: string;
}

export interface DocumentStore {
  /** Le document ouvert en dernier sur cet appareil. */
  loadCurrent(): Promise<LoadResult>;
  /** Enregistre si la révision stockée est encore `expectedRev` (0 = nouveau document). */
  save(doc: AimeDocument, expectedRev: number): Promise<SaveResult>;
  /** Fait de `doc` le document courant, sans effacer l'ancien. */
  setCurrent(docId: string): Promise<void>;
  /** Révision enregistrée d'un document (0 s'il n'a jamais été enregistré). */
  revisionOf(docId: string): Promise<number>;

  putAsset(id: string, blob: Blob): Promise<void>;
  getAsset(id: string): Promise<Blob | undefined>;

  snapshot(doc: AimeDocument, label: string): Promise<Snapshot>;
  listSnapshots(): Promise<Snapshot[]>;
  readSnapshot(id: string): Promise<AimeDocument | null>;
}
