/**
 * Le fichier projet portable (`.aime.json`) : le document ET ses médias dans un seul fichier.
 * Exporter puis importer redonne un document identique, images comprises.
 *
 * Format `aime/package` v1 (idée reprise de l'archive `.aime` d'AIME-NEXT, src/stockage/archive.ts).
 * L'import accepte aussi un document seul (AIMENEW v1 ou AIME FINAL v2).
 */
import type { AimeDocument } from '../core/types';
import { openDocument } from '../core/migrations';
import { assetsInUse } from '../core/document';

export const PACKAGE_FORMAT = 'aime/package';
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

interface PackageFile {
  format: typeof PACKAGE_FORMAT;
  version: 1;
  document: AimeDocument;
  assets: Record<string, { mime: string; base64: string }>;
}

export type ImportResult =
  | { ok: true; doc: AimeDocument; blobs: Map<string, Blob>; warnings: string[]; from: number }
  | { ok: false; reason: string };

export async function exportPackage(doc: AimeDocument, getAsset: (id: string) => Promise<Blob | undefined>): Promise<string> {
  const assets: PackageFile['assets'] = {};
  for (const id of assetsInUse(doc)) {
    const ref = doc.assets[id];
    const blob = ref ? await getAsset(id) : undefined;
    if (!ref || !blob) throw new Error(`Une image du document est introuvable sur cet appareil (${ref?.name ?? id}).`);
    assets[id] = { mime: ref.mime, base64: await toBase64(blob) };
  }
  const file: PackageFile = { format: PACKAGE_FORMAT, version: 1, document: doc, assets };
  return JSON.stringify(file, null, 2);
}

export function importPackage(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Ce fichier n’est pas un fichier JSON lisible.' };
  }
  const isPackage = !!raw && typeof raw === 'object' && (raw as { format?: unknown }).format === PACKAGE_FORMAT;
  if (isPackage && (raw as { version?: unknown }).version !== 1) return { ok: false, reason: 'Version de fichier projet non prise en charge.' };
  const opened = openDocument(isPackage ? (raw as PackageFile).document : raw);
  if (!opened.ok) return opened;

  const blobs = new Map<string, Blob>();
  const warnings = [...opened.report.warnings];
  if (isPackage) {
    const files = (raw as PackageFile).assets;
    if (!files || typeof files !== 'object') return { ok: false, reason: 'Fichier projet invalide : médias absents.' };
    for (const [id, ref] of Object.entries(opened.doc.assets)) {
      const file = files[id];
      if (!file) continue;
      if (file.mime !== ref.mime || typeof file.base64 !== 'string') return { ok: false, reason: `Fichier projet invalide : média ${ref.name} mal décrit.` };
      if (file.base64.length > (MAX_ASSET_BYTES * 4) / 3 + 4) return { ok: false, reason: `Média trop lourd : ${ref.name}.` };
      try {
        blobs.set(id, fromBase64(file.base64, file.mime));
      } catch {
        return { ok: false, reason: `Fichier projet invalide : média ${ref.name} illisible.` };
      }
    }
  }
  for (const id of assetsInUse(opened.doc)) {
    if (!blobs.has(id) && opened.doc.assets[id]) warnings.push(`L’image ${opened.doc.assets[id].name} n’est pas incluse dans ce fichier.`);
  }
  return { ok: true, doc: opened.doc, blobs, warnings, from: opened.report.from };
}

export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string, mime: string): Blob {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function toDataUrl(blob: Blob, mime: string): Promise<string> {
  return `data:${mime};base64,${await toBase64(blob)}`;
}
