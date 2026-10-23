# Le contrat de document — `aime/document` version 2

**Une matière → un document → une grille → des blocs → plusieurs réalisations.**

Le document est la seule source de vérité. L'écran, la page exportée et, demain, le serveur ou l'Orbe ne font que le lire ou produire un nouveau document. Il ne contient **aucun style** (seulement l'identifiant d'un Design System) et **aucun fichier** (seulement la description des médias).

## Forme

```jsonc
{
  "format": "aime/document",
  "version": 2,
  "id": "doc_3f9a1c22b0",          // stable, jamais recalculé
  "title": "Ma première page",
  "designSystem": "iris",          // la présentation, à part du contenu
  "root": "root",                  // la grille de la page
  "nodes": {                       // tous les blocs, à plat
    "root": {
      "id": "root", "type": "container",
      "props": { "columns": 12, "gap": 20, "rowHeight": 56, "padding": 40, "tone": "none" },
      "place": { "col": 1, "row": 1, "colSpan": 12, "rowSpan": 1 },
      "children": ["t1", "i1"]     // présent = ce bloc est une grille
    },
    "t1": { "id": "t1", "type": "text",  "props": { "text": "Bonjour", "variant": "titre" }, "place": { "col": 1, "row": 1, "colSpan": 6, "rowSpan": 2 } },
    "i1": { "id": "i1", "type": "image", "props": { "src": "asset:img_7c1e", "alt": "Un dégradé" }, "place": { "col": 7, "row": 1, "colSpan": 6, "rowSpan": 5 } }
  },
  "assets": {                      // descriptions des médias ; les fichiers vivent dans le stockage
    "img_7c1e": { "id": "img_7c1e", "name": "photo.png", "mime": "image/png", "size": 41080 }
  },
  "createdAt": "2026-10-23T14:00:00.000Z",
  "updatedAt": "2026-10-23T14:05:00.000Z"
}
```

Exemple complet : [`examples/premiere-page.aime.json`](../examples/premiere-page.aime.json).

## Les quatre couches

| Couche | Où | Règle |
| --- | --- | --- |
| **Document** | `nodes`, `assets`, identifiants | Structuré, versionné, portable. Identifiants stables. |
| **Grille** | `place` + `children` + `props.columns / gap / rowHeight` | Seule « loi physique » : chaque bloc a une position `{col, row, colSpan, rowSpan}` dans la grille de son parent. Une grille se replie en une colonne selon **sa** largeur, dans l'ordre de lecture. |
| **Blocs** | `type` + `props` | Le noyau ne connaît aucun type. Chaque type déclare données par défaut, taille, capacités, actions, rendu édition/lecture (`src/core/registry.ts`). |
| **Présentation** | `designSystem` | Un jeu de tokens CSS (`data-ds`). Changer de Design System ne touche jamais `nodes`. |

## Ce qui est volontairement absent

Pas de propriétaire, de droits ni d'URL de publication dans le document : ce sont des faits **sur** le document, gardés par le stockage et le serveur (voir [PERMISSIONS.md](PERMISSIONS.md)). Pas de styles par bloc (couleurs, polices) : ils viendront comme **variantes de Design System**, pas comme valeurs en dur. Pas de relations entre blocs : elles arriveront en Phase 5 sous une clé `relations` optionnelle, avec une migration.

## Règles de compatibilité

- **Ouvrir = valider + migrer** (`src/core/migrations.ts`). `migrations[n]` fait passer de n à n + 1.
- **Une version plus récente est refusée**, jamais tronquée.
- **Un type de bloc inconnu ne casse rien** : il s'affiche comme emplacement réservé et ses données sont conservées.
- **Les blocs orphelins** (non rattachés à la racine) sont ignorés et signalés.
- **Une référence à un média absent** est signalée ; le bloc affiche « image introuvable sur cet appareil ».
- Les identifiants respectent `[A-Za-z0-9_-]{1,64}` ; 5 000 blocs et 64 niveaux d'imbrication au maximum.

### Historique des versions

| Version | Origine | Changement |
| --- | --- | --- |
| 1 | AIMENEW | Document, grille, blocs. Images en base64 dans `props.src`. |
| 2 | AIME FINAL | Ajout de `assets` (médias référencés par `asset:<id>`) et `createdAt`. Les images base64 des documents v1 restent lisibles. |

## Le fichier projet portable

L'export « projet » produit un `aime/package` v1 : `{ format, version, document, assets: { <id>: { mime, base64 } } }`. Exporter puis importer redonne un document identique, images comprises. L'import accepte aussi un document seul (v1 ou v2) et lui donne un nouvel identifiant, pour qu'un double import n'écrase jamais rien.
