# Proposition pour la Phase 2 — ce qu'AIME-NEXT apporte encore

Proposition rédigée le 23/10/2026 par la session qui a construit AIME-NEXT et refondu AIMESTUDIO aujourd'hui. Matt a demandé qu'elle soit transmise ici. C'est une **proposition** : elle n'est pas encore validée.

## Constat

- **AIMENEW est entièrement absorbé** par la Phase 1 (voir `PROVENANCE.md`). Il n'y a plus rien à en reprendre : on peut l'archiver.
- **AIME-NEXT** (`mattmezstitchlab/AIME-NEXT` @ `1218d1f`) a donné ses principes de versions, de stockage, d'archive et de parcours. **Il garde des pièces prêtes et testées** qui ne sont pas encore reprises.
- **AIMESTUDIO** prouve depuis aujourd'hui, avec la Grande Partition (`/`, PR #65), que tous ses moteurs réels se branchent sur **un seul projet** au format `aime-projet` v1 (`contrats/projet.js`). Ce format sépare `contenus`, `medias` et `relations`.

## Priorité 1 : séparer les informations des blocs (sources)

Aujourd'hui, dans AIMEFINAL, le texte vit **dans** les `props` du bloc. Dans AIME-NEXT, un bloc **montre** une information sans la contenir :

- `document.contenus` contient les informations : `texte`, `evenement`, `lieu`, `personne`, `image`.
- Un bloc porte `source: <id de contenu>`. Si la même date apparaît dans trois blocs, elle n'est écrite qu'une fois : la changer met à jour les trois.
- Fichiers : `src/core/modele/schemas.ts` (contenus, vérification des sources orphelines), `src/core/modele/projet.ts` (`contenuDe`, `blocsQuiMontrent`), `src/core/commandes/commandes.ts` (`ajouterContenu`, `remplacerContenu`, `supprimerContenu`, chacun avec son inverse).

**Pourquoi c'est le pivot :**

- c'est l'idée « références vivantes » (BIGDAY) des deux briefs de Matt ;
- c'est le principe du format `aime-projet` v1 et du `DEPS` du moteur de pages d'AIMESTUDIO ;
- avec lui, les sites existants (`aime-site` : `infos` + `listes` + `sections`) et les moteurs d'AIMESTUDIO peuvent se brancher **sans conversion forcée**.

**Suggestion concrète :**

- passer au format v3, avec un champ `contenus` à côté de `nodes`, et `props.source` facultatif sur un bloc ;
- un texte « fixe » reste dans `props` : rien ne casse, et la migration v2 → v3 ne change rien aux documents existants ;
- dans l'interface, un indicateur « fixe / relié à … ». C'est l'onglet Source déjà livré sur AIMESTUDIO `/sites/`.

## Priorité 2 : la forme suit la largeur (paliers)

Un même bloc change de forme selon le nombre de colonnes qu'il occupe :

- date : pastille, compte à rebours, calendrier, frise ;
- lieu : nom, carte, itinéraire ;
- personnes : avatars, équipe, réseau.

- Fichiers : `src/core/grille/grille.ts` (`palierPour`, `formePour`, `hauteurPour`), `src/core/registre/registre.ts` (déclaration des `formes` par bloc).
- Origine : le constructeur `#build` d'AIMESTUDIO (`aime/index.html`, `FORMS`).
- À mettre dans le registre de blocs d'AIMEFINAL comme option du contrat (`formes: [{ des: colonnes, forme }]`), sans que le noyau connaisse les types.

## Ensuite, dans l'ordre

1. **Blocs sans chevauchement.** `grille.ts` : `chevauche`, `placeLibre`, `contraindre`. À décider : interdire le chevauchement ou le permettre volontairement.
2. **L'intention.** `src/app/intention.ts` : saisir un titre et une date crée l'événement et ses blocs. C'est le départ naturel de la Page Zéro.
3. **Les blocs métier déjà faits** : date, lieu, personnes, programme (`src/core/registre/blocs.ts`, `src/rendu/blocs.tsx`). Ils s'appuient sur la priorité 1.
4. **Import des anciens projets.**
   - Le constructeur AIMESTUDIO (`.aime.json`, avec `P`, `blocks`) : `src/core/modele/migrations.ts`, `depuisAimestudio`.
   - Les sites `aime-site` : à écrire, en s'appuyant sur `migrer()` de `vitrine/rendu.js`.
5. **Style.** AIME-NEXT a un seul style complet (sombre et clair, `src/design/systemes.ts`), alors que le brief demande 4 Design Systems. C'est à Matt de trancher avant la Phase 3.

## Ce qu'il ne faut pas reprendre d'AIME-NEXT

React et Zod : le noyau d'AIMEFINAL est volontairement sans dépendance. Reprendre la logique, pas la pile.
