# AIME FINAL

**Une grille. Des blocs. Une source de vérité. Tout le reste vient après.**

AIME FINAL est le socle commun des recherches AIME. On ne fusionne pas toutes les applications d'un coup : on construit un noyau simple, solide et publiable, puis on ajoute les capacités éprouvées une par une, chaque phase livrant quelque chose qui fonctionne réellement.

## Phase 1 — le Canevas Zéro

Une grande surface de création au centre, une barre d'outils flottante en bas.

| Outil | Ce qu'il fait |
| --- | --- |
| Sélectionner (V) | Choisir un bloc, écrire directement dans un texte |
| Déplacer (M) | Attraper un bloc entier pour le déplacer |
| Texte · Image · Grille | Ajouter un texte, une image de l'appareil, une grille imbriquée |
| Apparence | Changer de Design System (Original Iris, Minimal Clair) — le contenu ne bouge pas |
| Annuler · Rétablir | Illimités (Ctrl/⌘ + Z, Ctrl/⌘ + Maj + Z) |
| Aperçu | Ordinateur ou téléphone |
| Enregistrer | Enregistre sur l'appareil et crée une version de secours (Ctrl/⌘ + S) |
| Exporter | Page HTML autonome, projet `.aime.json`, import, nouvelle page, versions |

Quand un bloc est choisi, un **second niveau** apparaît au-dessus de la barre : ses réglages (variante de texte, alignement, image, description, colonnes…), dupliquer, supprimer. Au clavier : Tab pour atteindre un bloc, flèches pour le déplacer, Maj + flèches pour le redimensionner, Entrée pour écrire, Échap pour sortir.

**Où vont vos données ?** Sur cet appareil, dans ce navigateur, uniquement (IndexedDB). L'enregistrement est automatique ; un indicateur dit toujours où il en est. Pour garder votre travail ailleurs : *Exporter → Exporter le projet (.json)*.

**Publier ?** En Phase 1, on **télécharge** une page HTML autonome (aucun script, images intégrées, mise en page adaptée à l'écran). Ce n'est pas une mise en ligne, et l'interface le dit. Le chemin vers une URL publique est décrit dans [docs/PUBLICATION.md](docs/PUBLICATION.md).

## Démarrer

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # tests unitaires (noyau, stockage, export)
npm run build      # types + construction dans dist/
npm run e2e        # parcours d'acceptation dans Chromium (après npm run build)
```

Première fois pour `npm run e2e` : `npx playwright install chromium`.

## Le contrat d'acceptation

[`tests/e2e/parcours.spec.ts`](tests/e2e/parcours.spec.ts) rejoue les 14 étapes du parcours, dans un vrai navigateur : arriver, créer une page vide, ajouter un titre, l'écrire, ajouter une image depuis l'appareil, ajouter un second texte, déplacer et redimensionner, changer de Design System, annuler et rétablir, enregistrer, recharger et tout retrouver, prévisualiser sur ordinateur et téléphone, exporter la page HTML, l'ouvrir et retrouver contenu et mise en page. S'y ajoutent : accessibilité (axe, WCAG AA) de l'éditeur et de la page exportée, barre utilisable sur téléphone, aucun écrasement silencieux entre onglets, import validé.

## Architecture

```
src/
├── core/        le noyau : document, grille, registre, rendu, historique, migrations — aucun type de bloc
├── blocks/      texte, image, conteneur (un fichier par bloc)
├── store/       contrat de stockage, IndexedDB, fichier projet portable, médias
├── access/      contrat d'identité et d'autorisation (préparé pour la Phase 4)
├── app/         l'éditeur : barre flottante, second niveau, aperçu, export, enregistrement
└── styles/      tokens (Design Systems), grille, blocs, interface
```

Quatre couches séparées, non négociables : **le document** (seule source de vérité), **la grille** (seule loi de composition), **les blocs** (un contrat commun), **la présentation** (Design Systems, à part du contenu). Voir [docs/DOCUMENT.md](docs/DOCUMENT.md).

## Documents

- [docs/AUDIT.md](docs/AUDIT.md) — audit des dépôts, choix du noyau, matrice des capacités
- [docs/DOCUMENT.md](docs/DOCUMENT.md) — le contrat de document universel
- [docs/CAPACITES.md](docs/CAPACITES.md) — les phases suivantes et leurs sources
- [docs/PROVENANCE.md](docs/PROVENANCE.md) — ce qui a été repris, adapté, écarté
- [docs/PUBLICATION.md](docs/PUBLICATION.md) — publier l'application, publier une réalisation
- [docs/PERMISSIONS.md](docs/PERMISSIONS.md) — identité et droits, sans second système de comptes
- [CONTRIBUTING.md](CONTRIBUTING.md) — règles de contribution
