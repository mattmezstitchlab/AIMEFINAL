# Audit d'AIME STUDIO (aime-studio-mu.vercel.app) — 23 octobre 2026

Source : dépôt `mattmezstitchlab/Aime-Studio` @ `0d3f665` (22/10/2026), application Base44 (React 18, ~40 dépendances, ~34 000 lignes dans `src/components/bureau` + `src/lib`). Site parcouru dans un vrai navigateur (Chromium), sur ordinateur et téléphone, sans compte.

## Ce qui est intéressant (les idées à garder)

| Idée | Où dans le code | Pourquoi elle compte |
| --- | --- | --- |
| **Les étiquettes de sections** : 40 sections typées en 6 familles (Socle, Événementiel, Commerce, Contenu, Confiance, Action), chacune avec ses besoins et ses mots-clés | `src/lib/bureau/sectionEtiquettes.js` | Un vocabulaire universel de ce qu'un site contient. Fonctionne : glisser « À propos » sur le canevas pose bien la section. |
| **Des structures, pas des pavés** : tarifs en 3 colonnes, FAQ en questions/réponses, équipe en portraits, programme en étapes… | `STRUCTURE_PAR_SECTION`, `STRUCTURES` (même fichier) | Chaque section a une vraie forme et un schéma de données. C'est exactement ce que doit être un **bloc** dans AIME FINAL. |
| **La progression nourrie par les dépôts** : chaque matière déposée au Point Zéro fait monter les sections qu'elle « nourrit » (mot-clé +45, bon dossier +30) jusqu'à « prête » | `progressionEtiquette()` | Le lien concret entre Point Zéro (les matières) et le Canevas (les sections). |
| **Le pipeline de réglages dans l'ordre** : typographie, couleurs, mise en page, structure, visuels, composants, texte absorbé, arborescence, accessibilité, aperçu | `src/components/bureau/capsule/Panneau*.jsx`, `pipeline/` | Une progression lisible pour régler un site sans tout casser. |
| **L'audit EAA d'un site existant** + garde anti-SSRF côté serveur | `src/lib/gallery/eaaAudit.js`, `eaaReferentiel.js`, `base44/functions/scanA11yFaults`, `exploreSite`, `extractSiteContent` | Le référentiel (POUR → critères WCAG 2.1 AA / EN 301 549) et la récupération sûre d'URL sont réutilisables. |
| **« Garder absolument »** : l'utilisateur liste ce qui doit survivre à la refonte | onglet Audit EAA | Le respect de l'existant : « un texte d'origine peut être une preuve ». |
| **Cartes réutilisables** : une section réglée devient une carte, rangée, partageable | `capsule/cartes/` | Les « sections réutilisables » de notre Phase 2. |
| **Publication +nom** : adresse publique, versions, dépublier | `PanneauPublication.jsx`, entité `PublishedSite`, route `/:adresse` | Le bon modèle produit pour publier une réalisation (cf. `docs/PUBLICATION.md`). |
| **Le récit** de la page d'accueil : déposé → audité → régénéré → composé → accessible → publié → transmis | `src/pages/Landing.jsx`, `components/landing/` | Une promesse claire, forte, qui peut devenir la page d'entrée d'AIME. |

## Ce qui ne marche pas aujourd'hui (vérifié)

1. **Aucune fonction serveur ne répond sur la version Vercel.** Toutes les requêtes partent vers `/api/apps/null/...` et renvoient 404 : l'identifiant de l'application Base44 n'est pas configuré sur Vercel. Conséquences observées : Point Zéro reste bloqué sur « Préparation du plan de réponse », « Générer le site » ne génère rien, l'audit EAA répond « L'audit n'a pas abouti », les projets et la publication sont inaccessibles.
2. **Les adresses directes donnent une erreur 404** (`/bureau`, `/carte-unique`, et donc toute adresse `+nom`) : il manque la réécriture vers `index.html` dans la configuration Vercel. On n'y accède qu'en cliquant depuis l'accueil.
3. **Le travail est perdu en fermant l'onglet** : l'état du site en cours vit dans `sessionStorage` (`aime-capsule-site`).
4. **Contrastes défaillants** dans l'onglet Audit EAA : les textes des quatre cartes POUR sont quasi invisibles, le bouton « Identifier » est vide — ironique pour un outil d'accessibilité.
5. **La barre du haut recouvre l'en-tête du Studio** dans le canevas.
6. **Couplage total à Base44** (39 entités, `InvokeLLM`, fichiers) : rien ne fonctionne hors de la plateforme, et la dette du dépôt (mariage, artistes, marketplace, ~60 entités) dépasse de loin le Studio.
7. Pas de tests sur le Studio.

## Refonte proposée dans AIME FINAL

On ne copie pas l'application : on reprend ses **idées éprouvées** comme données et comme blocs, sur notre noyau (document, grille, blocs, stockage) déjà testé.

| Étape | Ce que l'utilisateur pourra faire | Reprise d'AIME STUDIO | Phase |
| --- | --- | --- | --- |
| **1. Bibliothèque de sections** | Ajouter une section typée (À propos, Tarifs, FAQ, Équipe, Programme, Contact…) depuis la barre ; elle arrive avec sa vraie structure, éditable sur place, et se replie bien sur téléphone | `SECTIONS_SITE`, `STRUCTURES` → un registre de blocs « section » sans IA | 2 |
| **2. Cartes réutilisables** | Enregistrer une section réglée comme carte, la reposer dans une autre page | `capsule/cartes/` | 2 |
| **3. Pipeline de réglages** | Régler typographie, couleurs, espacements dans l'ordre, en direct, avec le score de contraste visible | `Panneau*` + tokens AIME-COMPOSER (contraste garanti) | 3 |
| **4. Point Zéro → sections** | Déposer textes, images, liens ; voir quelles sections deviennent « prêtes » ; les poser d'un geste | `progressionEtiquette()` | 5 |
| **5. Audit EAA d'une URL** | Coller l'adresse d'un site, obtenir son audit et récupérer ses textes et images dans le Canevas, en gardant ce qu'on a marqué « à garder » | `eaaReferentiel`, `scanA11yFaults`, `extractSiteContent` (fonctions serveur, garde anti-SSRF) | 5 |
| **6. Publication +nom** | Publier à une adresse publique stable, versionnée, dépubliable | `PublishedSite` → table `publications` (cf. `docs/PUBLICATION.md`) | 4–6 |
| **7. Génération par message** | Décrire son site, l'IA propose des sections déjà remplies, que l'on garde ou non | prompts de `STRUCTURES` (l'IA produit des données, jamais du code) | 7 |

Les étapes 1 à 3 ne demandent ni serveur ni compte : elles peuvent partir en production tout de suite, une par une.

## À corriger côté AIME STUDIO s'il reste en ligne

Indépendamment de la refonte (non modifié depuis ce projet) : renseigner `VITE_BASE44_APP_ID` et `VITE_BASE44_APP_BASE_URL` dans le projet Vercel `aime-studio`, ajouter une réécriture `{"source": "/(.*)", "destination": "/index.html"}`, et corriger les contrastes de l'onglet Audit EAA.
