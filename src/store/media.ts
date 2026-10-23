/**
 * Accueillir un fichier image venu de l'appareil : vérifier son type et son poids,
 * lui donner un identifiant stable. Le fichier part dans le stockage ; le document
 * ne garde que sa description (`AssetRef`) et la référence `asset:<id>`.
 */
import type { AssetRef } from '../core/types';
import { uid } from '../core/ids';

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Le SVG est exclu à l'import : il peut contenir du code. */
export const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

export type MediaCheck = { ok: true; ref: AssetRef } | { ok: false; reason: string };

export function acceptImage(file: { name: string; type: string; size: number }): MediaCheck {
  if (!ACCEPTED_IMAGES.includes(file.type)) return { ok: false, reason: 'Format non pris en charge. Choisissez une image PNG, JPEG, WebP, GIF ou AVIF.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: `Image trop lourde (${Math.round(file.size / 1e6)} Mo). La limite est de 15 Mo.` };
  if (file.size === 0) return { ok: false, reason: 'Ce fichier est vide.' };
  return { ok: true, ref: { id: uid('img'), name: file.name.slice(0, 200) || 'image', mime: file.type, size: file.size } };
}
