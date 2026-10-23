/**
 * Accueillir un fichier image venu de l'appareil : vérifier son poids, ses VRAIS octets (pas seulement
 * son extension), qu'il se décode, puis lui donner un identifiant stable. Le fichier part dans le
 * stockage ; le document ne garde que sa description (`AssetRef`) et la référence `asset:<id>`.
 */
import type { AssetRef } from '../core/types';
import { uid } from '../core/ids';

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Le SVG est exclu : il peut contenir du code. */
export const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

export type MediaCheck = { ok: true; ref: AssetRef } | { ok: false; reason: string };

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, text: string) => [...text].every((c, i) => b[at + i] === c.charCodeAt(0));

/** Le type réel d'une image d'après ses premiers octets, ou null si ce n'est pas une image acceptée. */
export function sniffImage(b: Uint8Array): string | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return 'image/gif';
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp';
  if (ascii(b, 4, 'ftyp') && (ascii(b, 8, 'avif') || ascii(b, 8, 'avis'))) return 'image/avif';
  return null;
}

export async function checkImage(file: Blob & { name?: string }): Promise<MediaCheck> {
  if (file.size === 0) return { ok: false, reason: 'Ce fichier est vide.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: `Image trop lourde (${Math.round(file.size / 1e6)} Mo). La limite est de 15 Mo.` };
  const mime = sniffImage(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (!mime) return { ok: false, reason: 'Ce fichier n’est pas une image PNG, JPEG, WebP, GIF ou AVIF.' };
  if (typeof createImageBitmap === 'function') {
    try {
      (await createImageBitmap(file)).close();
    } catch {
      return { ok: false, reason: 'Cette image est abîmée : le navigateur ne parvient pas à l’afficher.' };
    }
  }
  return { ok: true, ref: { id: uid('img'), name: (file.name ?? '').slice(0, 200) || 'image', mime, size: file.size } };
}
