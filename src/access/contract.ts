/**
 * Identité et autorisations — le contrat, pas encore le système.
 *
 * AIME FINAL n'invente PAS de comptes. En Phase 4, l'identité viendra de la session Better Auth
 * d'AIMESTUDIO (api/_auth/auth.mjs → `personne(req)`), et les droits seront vérifiés CÔTÉ SERVEUR,
 * avec la même règle que synchroview/permissions.js (refus par défaut). Voir docs/PERMISSIONS.md.
 *
 * Ce fichier fixe dès maintenant la séparation des responsabilités :
 *   opérations sur le document (core, pures)  ≠  identité (qui ?)  ≠  propriété (à qui ?)
 *   ≠  autorisation (a-t-il le droit de lire / éditer / publier ?).
 *
 * Phase 1 : un seul cas, l'appareil. Tout est permis localement, parce que tout reste local :
 * aucune donnée ne quitte le navigateur, donc il n'y a rien à protéger d'un tiers. Il n'existe
 * volontairement AUCUN bouton masqué « pour la sécurité » : masquer n'est pas protéger.
 */

/** Qui agit. Jamais lu dans le document ni dans une requête : seulement dans une session vérifiée. */
export type Principal = { kind: 'device' } | { kind: 'user'; id: string; name?: string };

export type Action = 'read' | 'edit' | 'publish' | 'delete';

/** Rôles alignés sur les espaces d'AIMESTUDIO (space_members). */
export type Role = 'owner' | 'editor' | 'contributor' | 'viewer' | 'guest';

export interface Decision {
  allow: boolean;
  reason?: string;
}

export interface AccessPolicy {
  can(who: Principal, action: Action, documentId: string): Promise<Decision>;
}

/**
 * La seule politique de la Phase 1 : l'appareil est propriétaire de ce qu'il crée.
 * La publication à une URL publique n'existe pas encore : elle est refusée, et l'interface
 * propose un téléchargement, présenté comme tel.
 */
export const devicePolicy: AccessPolicy = {
  async can(who, action) {
    if (who.kind !== 'device') return { allow: false, reason: 'Les comptes arrivent en Phase 4.' };
    if (action === 'publish') return { allow: false, reason: 'La publication en ligne arrive dans une phase suivante.' };
    return { allow: true };
  },
};
