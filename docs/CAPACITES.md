# Cartographie des capacités futures

Chaque phase est indépendante, livrée par une PR, et ne dépend que de capacités **déjà livrées et testées**. L'ordre peut changer ; les sources indiquées ont été auditées (voir [AUDIT.md](AUDIT.md)).

| Phase | Résultat utilisable | Sources éprouvées à raccorder | Prérequis |
| --- | --- | --- | --- |
| **1 — Canevas Zéro** ✅ (cette PR) | Créer une page, l'éditer, l'enregistrer, la retrouver, la prévisualiser, l'exporter en HTML | AIMENEW (noyau), AIME-NEXT (migrations, IndexedDB, parcours) | — |
| **2 — Composition enrichie** | Plusieurs pages, sections réutilisables, gabarits, calques, inspecteur contextuel, glisser entre grilles | AIMEPROJET `lib/archetypes.ts`, `Inspector.tsx`, `lib/supports.ts` ; AIME-NEXT `grille.ts` (formes selon la largeur, place libre) ; AIMENEW `moveBlock` | Phase 1 |
| **3 — Design Systems** | Original Iris, Minimal Clair, Éditorial Magazine, Pro Atelier ; variantes, comparaison, restauration | AIMESTUDIO `design/catalogue/`, `design/systemes.js` ; AIME-COMPOSER `design-system/src/tokens.mjs` + `build.mjs` (contraste WCAG garanti au build) | Phase 1 |
| **4 — Projet, identité, permissions** | Comptes, propriété, partage, collaborateurs, droits vérifiés côté serveur, synchronisation | AIMESTUDIO `api/_auth/auth.mjs`, `api/comptes.mjs`, `api/_auth/espaces.mjs`, `synchroview/permissions.js`, `db/migrations/2026-10-21-comptes.sql` ; comparaison Aime-Edition `src/lib/access/aimeAccess.js` | Phase 1 ; contrat `DocumentStore` + `AccessPolicy` (déjà en place) ; branche Neon de préproduction |
| **5 — Sources et Point Zéro** | Ajouter des matières (fichiers, URL), provenance, relations, suggestions de composition — Point Zéro ouvre le Canevas | AIME-COMPOSER `point-zero/pz-import.mjs` ; AIME-METAMORPHOSE `api/scan.mjs` ; AIMEPROJET `lib/fragments.ts` (expérimental) ; LE-MONDE-AIME-CANVAS `utils/aimeMatter*.ts` (expérimental) | Phases 1, 4 (pour l'import serveur) |
| **6 — Publication éditoriale** | Magazines, catalogues, portfolios, doubles pages, annotations | AIMESTUDIO `publication/planche.js` (grille 12 × 16, ordre de lecture), `vitrine/rendu.js` | Phases 2, 3 |
| **7 — Orbe et interactions** | Ancrages, guidage, animations, suggestions, comportements réglables, contrôle d'accessibilité | AIME-COMPOSER `loop/src/governance.mjs`, `noema.mjs` ; Aime-Edition `base44/agents/aime_orchestrator.jsonc` (règles de gouvernance) | Phases 2, 4 |
| **8 — Moteurs et métiers** | Broderie, mariage, musique, documents, timeline, Infinity, Cube — chacun via un **adaptateur testé** vers le document ou le projet | AIME-COMPOSER `loop/src/timeline.mjs` ; dépôt AIME STITCH, CANVAS `utils/dmcPalette.ts` ; Aime-Edition `components/aime/causal/*` ; AIME-NEXT blocs date/lieu/personnes | Phases 2, 4 selon le moteur |

## Apport d'AIME STUDIO

L'audit du Studio (aime-studio-mu.vercel.app) et le plan de reprise de ses idées — bibliothèque de 40 sections structurées, cartes, pipeline de réglages, progression nourrie par Point Zéro, audit EAA d'une URL, publication +nom — sont dans [AUDIT-AIME-STUDIO.md](AUDIT-AIME-STUDIO.md).

## Publication d'une réalisation à une URL publique

Prévue entre les Phases 4 et 6 : voir [PUBLICATION.md](PUBLICATION.md). Elle demande une identité vérifiée côté serveur, donc la Phase 4.

## Règle de raccordement d'un moteur

1. Inventaire du moteur (fonctionne / expérimental / démo).
2. Contrat : quel bloc, quelles données dans `props`, quelle migration.
3. Adaptateur pur, testé, entre le format du moteur et le document.
4. Rendu édition et lecture dans le Canevas — pas son interface historique si un bloc suffit.
5. Parcours navigateur de l'action annoncée, de bout en bout.
