/**
 * Ouvrir un document, quelle que soit sa version : le valider, le migrer, ou le refuser clairement.
 *
 * - Une version plus récente que celle de l'application est REFUSÉE, jamais tronquée.
 * - `migrations[n]` fait passer un document brut de la version n à n + 1.
 * - Rien n'est inventé : ce qui est ignoré (blocs orphelins, médias absents) est listé dans le rapport.
 *
 * Principe repris d'AIME-NEXT (src/core/modele/migrations.ts) ; la validation structurelle
 * vient d'AIMENEW (parseDocument). Pas de dépendance : le noyau reste minuscule.
 */
import { DOCUMENT_FORMAT, DOCUMENT_VERSION, type AimeDocument, type AssetRef, type BlockNode, type NodeId } from './types';
import { uid } from './ids';
import { assetIdOf } from './document';

export type OpenResult =
  | { ok: true; doc: AimeDocument; report: { from: number; warnings: string[] } }
  | { ok: false; reason: string };

type Raw = Record<string, unknown>;

/** v1 (AIMENEW) → v2 : ajout des médias et de la date de création. Les images intégrées (data:) restent lisibles. */
const migrations: Record<number, (raw: Raw) => Raw> = {
  1: (raw) => ({
    ...raw,
    version: 2,
    assets: {},
    createdAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }),
};

const MAX_NODES = 5000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']);

export function openDocument(value: unknown): OpenResult {
  try {
    return { ok: true, ...validate(migrate(value)) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Variante qui lève une erreur : pratique pour les tests et le code interne. */
export function parseDocument(value: unknown): AimeDocument {
  const result = openDocument(value);
  if (!result.ok) throw new Error(result.reason);
  return result.doc;
}

function fail(message: string): never {
  throw new Error(`Document invalide : ${message}`);
}

function migrate(value: unknown): { raw: Raw; from: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('ce n’est pas un objet.');
  let raw = value as Raw;
  if (raw.format !== DOCUMENT_FORMAT) fail('format inconnu.');
  const from = typeof raw.version === 'number' && Number.isInteger(raw.version) ? raw.version : 0;
  if (from > DOCUMENT_VERSION) {
    throw new Error(`Ce document a été créé par une version plus récente d’AIME (version ${from}). Mettez l’application à jour pour l’ouvrir.`);
  }
  let v = from;
  while (v < DOCUMENT_VERSION) {
    const step = migrations[v];
    if (!step) fail(`version ${String(raw.version)} non prise en charge.`);
    raw = step(raw);
    v++;
  }
  return { raw, from };
}

function validate({ raw, from }: { raw: Raw; from: number }): { doc: AimeDocument; report: { from: number; warnings: string[] } } {
  const warnings: string[] = [];
  const root = raw.root;
  const nodes = raw.nodes;
  if (typeof root !== 'string' || !nodes || typeof nodes !== 'object' || Array.isArray(nodes)) fail('racine absente.');
  const all = nodes as Record<string, unknown>;
  if (!all[root]) fail('la racine ne correspond à aucun bloc.');
  if (Object.keys(all).length > MAX_NODES) fail(`trop de blocs (plus de ${MAX_NODES}).`);

  const seen = new Set<NodeId>();
  const clean: Record<NodeId, BlockNode> = {};
  const visit = (id: NodeId, depth: number) => {
    if (depth > 64) fail('imbrication trop profonde.');
    if (seen.has(id)) fail(`le bloc ${id} apparaît deux fois.`);
    seen.add(id);
    const node = all[id] as Partial<BlockNode> | undefined;
    if (!node || typeof node !== 'object') fail(`le bloc ${id} est référencé mais absent.`);
    if (node.id !== id || !ID.test(id) || typeof node.type !== 'string' || !node.type) fail(`le bloc ${id} est mal formé.`);
    if (!node.props || typeof node.props !== 'object' || Array.isArray(node.props)) fail(`le bloc ${id} n’a pas de données.`);
    const p = node.place;
    if (!p || ![p.col, p.row, p.colSpan, p.rowSpan].every((n) => Number.isFinite(n))) fail(`placement du bloc ${id} invalide.`);
    if (node.children !== undefined && (!Array.isArray(node.children) || !node.children.every((c) => typeof c === 'string'))) {
      fail(`les enfants du bloc ${id} sont mal formés.`);
    }
    clean[id] = {
      id,
      type: node.type,
      props: node.props as Record<string, unknown>,
      place: { col: p.col, row: p.row, colSpan: p.colSpan, rowSpan: p.rowSpan },
      ...(node.children ? { children: [...node.children] } : {}),
    };
    node.children?.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
  if (!clean[root].children) fail('la racine doit être une grille.');

  const orphans = Object.keys(all).length - seen.size;
  if (orphans > 0) warnings.push(`${orphans} bloc(s) non rattaché(s) à la page ont été ignorés.`);

  const assets: Record<string, AssetRef> = {};
  const rawAssets = raw.assets && typeof raw.assets === 'object' && !Array.isArray(raw.assets) ? (raw.assets as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(rawAssets)) {
    const a = value as Partial<AssetRef>;
    if (!a || a.id !== key || !ID.test(key) || typeof a.mime !== 'string' || !MIMES.has(a.mime) || typeof a.size !== 'number') {
      fail(`média ${key} mal décrit.`);
    }
    assets[key] = { id: key, name: typeof a.name === 'string' ? a.name.slice(0, 200) : key, mime: a.mime, size: a.size };
  }
  for (const node of Object.values(clean)) {
    for (const value of Object.values(node.props)) {
      const id = assetIdOf(value);
      if (id && !assets[id]) warnings.push(`le bloc ${node.id} montre un média absent (${id}).`);
    }
  }

  const now = new Date().toISOString();
  return {
    doc: {
      format: DOCUMENT_FORMAT,
      version: DOCUMENT_VERSION,
      id: typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : uid('doc'),
      title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : 'Sans titre',
      designSystem: typeof raw.designSystem === 'string' && /^[a-z0-9-]{2,40}$/.test(raw.designSystem) ? raw.designSystem : 'iris',
      root,
      nodes: clean,
      assets,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    },
    report: { from, warnings },
  };
}
