# Audit des moteurs existants — 23 octobre 2026

Audit fait sur le **code réel** de chaque dépôt (clone superficiel de la branche par défaut), en lecture seule. Aucun dépôt historique n'a été modifié. Quand un test est dit « passe », il a été **exécuté** pendant l'audit.

## 1. Les deux candidats au noyau

| | **AIMENEW** (`370f089`, 23/10) | **AIME-NEXT** (`1218d1f`, 23/10) |
| --- | --- | --- |
| Pile | TypeScript, Vite, **aucune dépendance d'exécution** | React 18, Zod, idb, Vite 5 |
| Taille construite | 30 Ko JS | 349 Ko JS |
| Tests | 19 unitaires — **passent** | 47 unitaires — **passent** ; parcours Playwright de 21 étapes — **tout vert** |
| CI | aucune | GitHub Actions (types, tests, build, parcours) |
| Document | `aime/document` v1 : nœuds à plat, grilles qui listent leurs enfants | `aime-projet` v1 : contenus + supports + pages + blocs |
| **Grille** | **imbriquée sans limite** (bloc Conteneur), 1 à 24 colonnes par grille | **plate**, 12 colonnes fixes, une seule grille par page |
| Responsive | container queries : chaque grille se replie selon **sa** largeur | deux rendus (grille / colonne) choisis par largeur d'écran |
| Blocs | texte, image, conteneur — contrat générique (`defineBlock`) | titre, texte, image, bouton, **date, lieu, personnes, programme** (orientés mariage) |
| Bloc inconnu | affiché comme emplacement réservé, document intact | `exiger()` lève une erreur |
| Opérations | fonctions pures, historique par instantanés + regroupement | commandes inversibles + regroupement (900 ms) |
| Collisions | chevauchement permis | place occupée refusée |
| Validation | `parseDocument` manuel (structure, cycles, doublons) | Zod + migrations versionnées ; **version plus récente refusée** |
| Stockage | `localStorage`, une clé | **IndexedDB** (projets + médias en Blob) |
| Médias | base64 dans le document, **2 Mo max par image**, quota total ~5 Mo | Blob en IndexedDB, référencés par identifiant |
| Export | HTML autonome sans script ; JSON | HTML autonome (2 rendus) ; archive `.aime` avec médias |
| Accessibilité | rôles et libellés sur les barres ; blocs non atteignables au clavier | contrôle axe dans le parcours, AA vérifié |
| Défauts | pas de migrations, pas de test navigateur, médias fragiles | pas d'imbrication, métier codé dans le noyau, poids React |

### Recommandation : **AIMENEW est le noyau**, avec quatre emprunts démontrés à AIME-NEXT

1. **L'imbrication est la promesse centrale** (« une grille universelle ») : AIMENEW la tient déjà, AIME-NEXT ne l'a pas et devrait refondre son modèle pour l'avoir.
2. **Le noyau d'AIMENEW ne connaît aucun type de bloc** ; celui d'AIME-NEXT déclare des blocs de mariage dans le registre central.
3. **Le même rendu sert à l'édition, l'aperçu et l'export**, sans framework : l'export HTML est fidèle par construction.
4. **Petit et lisible** : ~1 300 lignes, zéro dépendance d'exécution.

Là où AIME-NEXT est meilleur — et repris tel quel dans son principe :

| Emprunt | Pourquoi c'est démontrablement mieux | Où dans AIME FINAL |
| --- | --- | --- |
| Migrations versionnées, version future refusée | AIMENEW n'avait aucun chemin de mise à jour ; un fichier v3 ouvert par une app v2 aurait été tronqué | `src/core/migrations.ts` (+ v1 → v2 testée) |
| Médias en Blob dans IndexedDB | AIMENEW plafonne à 2 Mo/image et sature le quota `localStorage` en 2 ou 3 photos | `src/store/local.ts`, `src/store/media.ts` |
| Archive projet avec médias | Un export JSON AIMENEW n'emportait que des images base64 déjà limitées | `src/store/package.ts` |
| Parcours navigateur + CI | AIMENEW n'avait aucune preuve qu'un utilisateur peut aller au bout | `tests/e2e/parcours.spec.ts`, `.github/workflows/verifier.yml` |

Non repris pour l'instant : les collisions (refus d'une place occupée) — utile, mais à trancher avec vous ; les formes adaptatives selon la largeur (« métamorphose ») — Phase 2.

## 2. AIMESTUDIO (`f79c078`, 23/10) — référence pour l'identité, les droits et les Design Systems

- **Pile** : HTML/JS statique écrit à la main + fonctions serverless Vercel (`api/*.mjs`). 34 Mo de fichiers, surtout des images.
- **Tests** : 431 tests node — **426 passent, 0 échec, 5 ignorés** (ceux qui exigent une vraie base). Parcours Playwright et axe présents en CI (non relancés ici).
- **Identité — fonctionne** : **Better Auth sur Neon PostgreSQL** (pas Supabase), lien e-mail + passkey, `api/_auth/auth.mjs`, fermé par défaut sans secrets. L'utilisateur est lu dans la session (`personne(req)`), jamais dans le corps.
- **Droits — fonctionne côté serveur** : rôles d'espace `owner / editor / contributor / viewer / guest` (`space_members`), règle unique `synchroview/permissions.js` (refus par défaut), relue en base à chaque appel (`api/_auth/espaces.mjs`). Pas de RLS SQL : tout passe par les fonctions `/api`.
- **Contrôles seulement côté client (à ne pas reprendre comme « sécurité »)** : tuiles masquées dans `os/apps.js`, `nav/registre.js`, page `/regie/` accessible (sans écriture serveur), rôles simulés dans `sites/vue`.
- **Publication** : seul mécanisme réel = `/travaux/<slug>/` rendu par `api/travaux.js` depuis `regie/site.json`, **mis à jour par un commit manuel**. Pas de table de publications ni de stockage objet. `publication/?id=` lit le `localStorage` : démonstration.
- **Design Systems** : `design/catalogue/` (4 systèmes : `aime-original` « Original Iris », `aime-minimal`, `aime-editorial`, `aime-pro`) + validateur `design/systemes.js`.
- **Secrets** : aucun en dur. Variables à ne jamais copier : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `AIME_PROPRIETAIRES`…

## 3. Sources complémentaires

| Dépôt | État réel | Tests | Apport possible |
| --- | --- | --- | --- |
| **AIME-COMPOSER** (20/09) | Le plus mûr hors noyau. Design System V1 avec **contrat de contraste WCAG au build** ; studio (2 000 lignes) ; boucle NOEMA (gouvernance, timeline) | **> 300 passent** | Phase 3 (tokens + contraste), 4 (gouvernance « décision avec acteur »), 5 (`point-zero/pz-import.mjs`), timeline |
| **AIMEPROJET** (16/10) | Grille 12×16 avec magnétisme, inspecteur, 25 gabarits, 19 formats, export PNG | aucun ; build OK | Phase 2 (gabarits, inspecteur, formats) ; Phase 5 (modèle `Fragment` + provenance, expérimental) |
| **LE-MONDE-AIME-CANVAS** (28/07, privé) | Positions absolues (pas de grille imbriquée), gestionnaire de projets IndexedDB, publication par slug via Supabase (RLS) | 50 : 46 passent, 4 échecs (tests de texte source obsolètes) | Phase 4/6 (publication par slug, conflits cloud) ; Phase 5 (matières, expérimental) ; broderie, musique (démo). **Risques** : `api/agent.ts` sans authentification, HTML non échappé dans `AIAgent.tsx` |
| **Aime-Edition** (23/07, privé) | Application Base44 (aucun mode local) ; Stripe avec webhook signé | aucun | Phase 4 : `src/lib/access/aimeAccess.js` (niveaux et capacités, logique pure) ; Phase 8 mariage. Garde admin côté client seulement |
| **aime-atlas** (01/10, privé) | Catalogue Base44 des projets | aucun | Inventaire et métadonnées de projets, pas de moteur |
| **AIME-METAMORPHOSE** (15/10) | Petite démo ; `api/scan.mjs` = récupération web **bien protégée** (HTTPS, IP publiques, taille) | aucun | Phase 5 (import d'URL côté serveur) |
| **AIMEDESK** (09/08) | Vide (README d'une ligne) | — | aucun |

Aucun secret en dur trouvé dans les dix dépôts audités.

## 4. Matrice des capacités et provenance

Statut : ✅ fonctionne (vérifié) · 🧪 expérimental · 🎭 démonstration.

| Capacité | Source exacte | Statut | Dans AIME FINAL |
| --- | --- | --- | --- |
| Document JSON unique, nœuds à plat | AIMENEW `src/core/types.ts`, `document.ts` | ✅ | **Phase 1** (repris, v2) |
| Grilles imbriquées + container queries | AIMENEW `src/styles/grid.css`, `src/blocks/container.ts` | ✅ | **Phase 1** (repris) |
| Registre de blocs générique | AIMENEW `src/core/registry.ts` | ✅ | **Phase 1** (repris + `media()`) |
| Historique + regroupement de frappe | AIMENEW `src/core/history.ts` | ✅ | **Phase 1** (repris tel quel) |
| Glisser / redimensionner au pas de grille | AIMENEW `src/core/geometry.ts`, `app/editor.ts` | ✅ | **Phase 1** (repris + outil Déplacer) |
| Export HTML sans script | AIMENEW `src/app/export.ts` | ✅ | **Phase 1** (repris + médias + CSP) |
| Migrations versionnées | AIME-NEXT `src/core/modele/migrations.ts` | ✅ | **Phase 1** (principe repris) |
| Médias en IndexedDB | AIME-NEXT `src/stockage/depot.ts` | ✅ | **Phase 1** (principe repris) |
| Archive projet avec médias | AIME-NEXT `src/stockage/archive.ts` | ✅ | **Phase 1** (principe repris) |
| Parcours navigateur + CI | AIME-NEXT `tests/navigateur/parcours.cjs`, `.github/workflows/verifier.yml` | ✅ | **Phase 1** (réécrit en Playwright Test) |
| Noms des Design Systems | AIMESTUDIO `design/catalogue/index.json` | ✅ | **Phase 1** (2 systèmes) → Phase 3 |
| Formes selon la largeur (métamorphose) | AIME-NEXT `src/core/grille/grille.ts`, AIMESTUDIO `aime/index.html` (FORMS) | ✅ | Phase 2 |
| Collisions / place libre | AIME-NEXT `src/core/grille/grille.ts` | ✅ | Phase 2 (à décider) |
| Gabarits, inspecteur, formats de support | AIMEPROJET `lib/archetypes.ts`, `Inspector.tsx`, `lib/supports.ts` | ✅ | Phase 2 |
| Tokens avec contrat de contraste | AIME-COMPOSER `design-system/src/tokens.mjs`, `build.mjs` | ✅ | Phase 3 |
| Catalogue + validateur de Design Systems | AIMESTUDIO `design/systemes.js`, `design/catalogue/` | ✅ | Phase 3 |
| Comptes (Better Auth, passkey) | AIMESTUDIO `api/_auth/auth.mjs`, `api/comptes.mjs` | ✅ | Phase 4 |
| Rôles d'espace vérifiés serveur | AIMESTUDIO `synchroview/permissions.js`, `api/_auth/espaces.mjs` | ✅ | Phase 4 |
| Niveaux et capacités d'accès | Aime-Edition `src/lib/access/aimeAccess.js` | ✅ (logique) | Phase 4 (comparaison) |
| Gouvernance « décision avec acteur » | AIME-COMPOSER `loop/src/governance.mjs` | ✅ | Phase 4 / 7 |
| Import local ZIP/PDF avec provenance | AIME-COMPOSER `point-zero/pz-import.mjs` | ✅ | Phase 5 |
| Récupération web sûre | AIME-METAMORPHOSE `api/scan.mjs` | ✅ (non testé) | Phase 5 |
| Fragments, matières, provenance | AIMEPROJET `lib/fragments.ts` ; CANVAS `utils/aimeMatter*.ts` | 🧪 | Phase 5 |
| Publication par slug | AIMESTUDIO `api/travaux.js` (commit manuel) ; CANVAS `public/publicationService.ts` (Supabase) | ✅ / ✅ | Phase 4–6 |
| Mode planche magazine (12 × 16) | AIMESTUDIO `publication/planche.js` | 🧪 | Phase 6 |
| Timeline | AIME-COMPOSER `loop/src/timeline.mjs` | ✅ | Phase 8 |
| Broderie (palette DMC) | CANVAS `utils/dmcPalette.ts` ; dépôt AIME STITCH | 🧪 | Phase 8 |
| Mariage (causalité, Stripe) | Aime-Edition `components/aime/causal/*`, `base44/functions/*` | 🧪 / ✅ | Phase 8 |
| Musique | CANVAS `AimeMusicStudio.tsx` | 🎭 | Phase 8 |
