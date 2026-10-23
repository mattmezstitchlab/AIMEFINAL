# Identité et permissions — préparées, pas inventées

AIME FINAL ne crée **pas** de second système de comptes. L'identité et les droits viendront d'AIMESTUDIO en Phase 4, après audit (fait : voir [AUDIT.md](AUDIT.md) §2).

## La séparation, dès la Phase 1

| Responsabilité | Où | Phase 1 | Phase 4 |
| --- | --- | --- | --- |
| **Opérations** sur le document | `src/core/document.ts` (fonctions pures) | Identiques | Identiques — le serveur les rejoue pour valider |
| **Stockage** | `src/store/contract.ts` (`DocumentStore`) | IndexedDB, sur l'appareil | Implémentation distante (`/api/documents`), même contrat, mêmes révisions |
| **Identité** (qui ?) | `src/access/contract.ts` (`Principal`) | `{ kind: 'device' }` | `{ kind: 'user', id }` lu dans la session Better Auth (`personne(req)`), jamais dans le document ni dans le corps d'une requête |
| **Propriété** (à qui ?) | hors du document | L'appareil | Colonne `owner_id` de la table `documents` |
| **Autorisation** (lire, éditer, publier, supprimer) | `AccessPolicy.can()` | Tout permis localement ; `publish` refusé (n'existe pas encore) | Vérifiée **côté serveur** à chaque appel, refus par défaut |

Pourquoi « tout permis » en Phase 1 n'est pas une faille : rien ne quitte le navigateur, il n'y a donc aucune donnée d'un tiers à protéger. Et il n'existe **aucun bouton masqué** « pour la sécurité » : masquer n'est pas protéger.

## Plan de la Phase 4 (proposition)

1. **Brancher, pas copier.** AIME FINAL appelle les fonctions `/api/*` d'AIMESTUDIO (ou les mêmes modules déployés à côté), sur une **branche Neon de préproduction**. Jamais directement sur la base de production.
2. Réutiliser : `api/_auth/auth.mjs` + `api/comptes.mjs` (comptes, lien e-mail, passkey) ; `api/_auth/espaces.mjs` + `space_members` (rôles) ; `synchroview/permissions.js` (règle unique `can(sujet, action, ressource)`), en y ajoutant le type de ressource `aimefinal-document`.
3. Ajouter deux tables : `documents (id, owner_id, space_id?, rev, contenu jsonb, maj_le)` et `publications` (voir [PUBLICATION.md](PUBLICATION.md)).
4. `PUT /api/documents/:id` exige la révision attendue (même règle que le stockage local) → pas d'écrasement entre appareils.
5. Rôles alignés : `owner` (tout), `editor` (lire, éditer, publier), `contributor` (lire, éditer), `viewer` / `guest` (lire).
6. Tests : reprendre ceux d'AIMESTUDIO (`permissions`, `proprietaire`, `comptes-statique`) + un parcours « un viewer ne peut pas enregistrer, même en appelant l'API à la main ».

## À ne pas reprendre

- Les contrôles d'AIMESTUDIO qui ne font que masquer des tuiles côté client (`os/apps.js`, `nav/registre.js`, `/regie/`).
- Les secrets de repli prévisibles de `api/_sv/core.js` et `api/_live/core.js`.
- Aucune variable d'environnement d'AIMESTUDIO n'est copiée dans ce dépôt.
