# Provenance des capacités reprises

Pour chaque capacité entrée dans AIME FINAL : d'où elle vient, ce qui a été gardé, adapté ou écarté, comment l'équivalence est vérifiée, et ce qui reste limité. Aucun dépôt n'a été copié en entier ; aucune donnée, aucun secret, aucune variable d'environnement n'a été transféré.

## Phase 1

### Noyau du document, de la grille et des blocs
- **Source** : `mattmezstitchlab/AIMENEW` @ `370f089` (23/10/2026) — `src/core/{types,document,registry,render,geometry,history,ids,dom}.ts`, `src/blocks/*`, `src/styles/{grid,blocks,tokens}.css`.
- **Réutilisé tel quel** : opérations pures (`addBlock`, `updateProps`, `setPlacement`, `moveBlock`, `duplicateBlock`, `removeBlock`), historique avec regroupement, géométrie écran → cellule, grille CSS + container queries, blocs texte et conteneur, tokens Iris/Clair.
- **Adapté** : format v2 (`assets`, `createdAt`) ; `parseDocument` déplacé et durci dans `migrations.ts` (identifiants, profondeur, nombre de blocs, médias) ; registre : `ctx.media()` pour résoudre `asset:<id>` ; rendu : blocs atteignables au clavier (`tabindex`, `role=group`) ; bloc image réécrit autour des médias stockés, `http:` refusé (https seulement), SVG refusé à l'import ; nouvelles opérations `setTitle`, `setDesignSystem`, `addAsset`.
- **Écarté** : barre du haut et barre attachée au bloc (remplacées par la barre flottante et son second niveau) ; stockage `localStorage`.
- **Équivalence** : les 19 tests unitaires d'AIMENEW sont repris et passent ; un document AIMENEW v1 s'ouvre et se migre sans perte (`src/core/migrations.test.ts`).
- **Limites** : les blocs peuvent se chevaucher ; déplacer un bloc d'une grille à l'autre par glisser n'est pas encore exposé (`moveBlock` existe).

### Migrations de version
- **Source** : `mattmezstitchlab/AIME-NEXT` @ `1218d1f` — `src/core/modele/migrations.ts` (`ouvrir`).
- **Réutilisé** : le principe `migrations[n] : n → n+1` et le refus d'une version plus récente.
- **Adapté** : sans Zod (validation écrite à la main pour garder un noyau sans dépendance) ; rapport d'avertissements.
- **Écarté** : l'import des exports du constructeur AIMESTUDIO (`P`/`blocks`) — pourra revenir comme adaptateur en Phase 5.
- **Équivalence** : test « refuse une version plus récente » ; test v1 → v2.

### Stockage local et médias
- **Source** : AIME-NEXT `src/stockage/depot.ts` (IndexedDB, médias en Blob) et `src/stockage/archive.ts` (archive avec médias).
- **Réutilisé** : IndexedDB via `idb`, médias en Blob, archive JSON avec médias en base64.
- **Adapté** : contrat `DocumentStore` (`src/store/contract.ts`) pour brancher un stockage distant plus tard ; **révisions** pour refuser l'écrasement silencieux (autre onglet) ; **quarantaine** d'un enregistrement illisible ; **versions de secours** avant tout remplacement ; stockage en mémoire de secours si IndexedDB est refusé.
- **Équivalence** : `src/store/store.test.ts` (rechargement, conflit, quarantaine, aller-retour d'archive à l'identique) ; parcours navigateur étapes 10–11 et test « aucun écrasement silencieux ».
- **Limites** : un seul document courant visible ; les médias ne sont jamais supprimés (pas de ramasse-miettes en Phase 1) ; rien n'est synchronisé entre appareils.

### Parcours navigateur et CI
- **Source** : AIME-NEXT `tests/navigateur/parcours.cjs`, `.github/workflows/verifier.yml`.
- **Adapté** : réécrit en Playwright Test (`tests/e2e/parcours.spec.ts`), une étape par point du contrat d'acceptation, contrôle axe (WCAG AA) sur l'éditeur et la page exportée, test téléphone, test de conflit, test d'import.

### Noms des Design Systems
- **Source** : AIMESTUDIO @ `f79c078` — `design/catalogue/index.json`.
- **Réutilisé** : les noms « Original Iris » et « Minimal Clair ». Les identifiants `iris` et `clair` restent ceux d'AIMENEW pour la compatibilité des documents v1.
- **Limites** : les jetons ne sont pas encore ceux du catalogue AIMESTUDIO ; l'alignement complet (4 systèmes, validateur, contraste au build d'AIME-COMPOSER) est la Phase 3.
