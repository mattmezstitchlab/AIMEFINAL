# Contribuer à AIME FINAL

## Le cycle d'une livraison

1. **Inventaire** — ce qui existe déjà (dans ce dépôt ou un dépôt historique), et son statut réel : fonctionne, expérimental, démonstration.
2. **Contrat** — ce que l'utilisateur pourra faire, en une phrase ; les changements du document (et leur migration).
3. **Implémentation** — par petits pas, directement sur `main` (déployée en production par Vercel à chaque push). Branche + PR seulement pour un changement risqué : format du document, stockage, suppression.
4. **Tests** — unitaires (`src/**/*.test.ts`) et parcours navigateur (`tests/e2e/`) de l'action annoncée, de bout en bout.
5. **Démonstration** — la production elle-même, mise à jour à chaque push.
6. **Validation** — par Matt, sur le site en production.
7. **Retour arrière** — `git revert` du commit fautif, ou « Instant Rollback » dans Vercel.

## Checklist avant chaque push

- [ ] `npm run verify` vert (types, tests, build)
- [ ] `npm run e2e` vert (parcours, accessibilité axe, téléphone)
- [ ] Vérifié à 390 px et à 1440 px de large
- [ ] Clavier : chaque nouvelle action est atteignable sans souris
- [ ] Format du document : version et migration si nécessaire, `docs/DOCUMENT.md` à jour
- [ ] Capacité reprise d'un autre dépôt : `docs/PROVENANCE.md` à jour (source, commit, repris, adapté, écarté, tests, limites)
- [ ] Aucun secret, aucune donnée personnelle, aucune variable d'environnement copiée
- [ ] Retour arrière possible (la PR peut être annulée sans casser les documents enregistrés)

## Style

TypeScript strict, pas de framework dans le noyau, noms et commentaires en français. Un fichier par bloc. Les couleurs et polices passent par les tokens.

## Messages de commit

Phrase courte au présent, en français : « Ajoute le bloc citation », « Corrige l'export des images ».
