# Publier

Deux opérations différentes, à ne jamais confondre :

| | Publier **AIME FINAL** | Publier **une réalisation** |
| --- | --- | --- |
| Quoi | L'application de création elle-même | Le site créé par un utilisateur |
| Où | Vercel, depuis ce dépôt | Une URL publique stable, par réalisation |
| Phase 1 | Aperçu par PR, production après votre accord | **Téléchargement** d'une page HTML autonome — présenté comme tel, jamais comme une mise en ligne |

## Phase 1 : télécharger une page HTML autonome

« Exporter → Télécharger la page HTML » produit un seul fichier :
- aucun script, aucune requête vers l'extérieur (polices système, images intégrées en `data:`) ;
- une politique de sécurité stricte dans la page (`default-src 'none'`) ;
- la mise en page s'adapte à l'écran (chaque grille se replie selon sa largeur) ;
- le texte de confirmation dit explicitement : « Elle n'est pas en ligne ».

Ce fichier peut être ouvert tel quel, envoyé, ou déposé sur n'importe quel hébergement statique.

## Le plus petit chemin sûr vers une URL publique stable

Proposition, à valider — rien n'est construit tant que la Phase 4 (identité) n'est pas livrée.

1. **Un instantané figé, séparé du brouillon.** Publier = rendre le document en HTML (le même `exportHtml`, déjà testé) et stocker ce résultat. Modifier ensuite le brouillon ne change pas la page publiée tant qu'on ne republie pas.
2. **Un emplacement de stockage public en lecture seule** : Vercel Blob (même fournisseur que le déploiement, aucun nouveau compte). Clé : `p/<slug>/<version>.html`.
3. **Une table `publications`** dans la base Neon d'AIMESTUDIO (branche de préproduction d'abord) : `slug` unique (`^[a-z0-9][a-z0-9-]{1,59}$`, la règle déjà utilisée par `/travaux/`), `document_id`, `owner_id`, `version`, `blob_url`, `published_at`, `unpublished_at`.
4. **Une fonction serveur `POST /api/publications`** qui : lit l'identité dans la session Better Auth (jamais dans la requête) ; vérifie le droit `publish` sur le document (même règle que `synchroview/permissions.js`) ; reçoit le document, le **valide** (`openDocument`) et le **rend côté serveur** — on ne publie jamais un HTML fourni par le navigateur ; écrit le Blob puis la ligne.
5. **Une route publique `/p/<slug>`** qui sert la dernière version publiée, avec les en-têtes de sécurité et `Cache-Control` adapté. Dépublier = `unpublished_at` + 410.
6. **Tests avant mise en production** : parcours navigateur « publier → ouvrir l'URL dans une session anonyme → retrouver le contenu → dépublier → 410 », sur un déploiement de préproduction.

Ce qui est volontairement exclu de ce premier chemin : noms de domaine personnalisés, statistiques, publication programmée.

## Déployer AIME FINAL (l'application)

- Configuration : [`vercel.json`](../vercel.json) — `npm ci`, `npm run build`, sortie `dist/`, en-têtes de sécurité.
- Chaque PR vers `main` reçoit un **aperçu Vercel** si le dépôt est relié à un projet Vercel. Le déploiement de production n'a lieu qu'après fusion, **avec votre accord explicite**.
- Avant toute mise en production : `npm run verify` + `npm run e2e` doivent être verts (c'est ce que fait la CI).
