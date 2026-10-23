/**
 * Identifiants : un préfixe lisible + 10 caractères aléatoires, toujours conformes à `ID_PATTERN`.
 * Le préfixe est nettoyé : un type de bloc exotique (« carte.v2 ») ne produit jamais un identifiant
 * que la validation refuserait ensuite au rechargement.
 */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Clés qui détourneraient un objet JavaScript : jamais acceptées comme identifiant. */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf']);

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id) && !RESERVED.has(id);
}

export function uid(prefix = 'b'): string {
  const clean = prefix.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'b';
  const random =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10) ??
    Math.random().toString(36).slice(2, 12);
  return `${clean}_${random}`;
}
