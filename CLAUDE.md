# AIME FINAL — règles du dépôt

Projet de Matt. Interface, code commenté et documentation en **français**.

## Principes à ne pas casser

- **Une phase = un résultat utilisable.** Inventaire → contrat → implémentation → tests → démonstration → validation → publication. Une livraison est finie quand un utilisateur peut aller au bout de l'action annoncée, pas quand le code compile.
- **Le noyau (`src/core/`) ne connaît aucun type de bloc** et ne touche ni au stockage ni à l'interface. Seule convention partagée : un nœud avec `children` est une grille (`props.columns`, `gap`, `rowHeight`).
- **Le document est la seule source de vérité.** Toute modification passe par une fonction pure de `core/document.ts`, puis par `Editor.apply()`. Jamais de mutation en place.
- **Toute évolution du format** = nouvelle version + migration dans `core/migrations.ts` + test. Une version plus récente est refusée, jamais tronquée.
- **Le contenu ne référence jamais un style.** Couleurs et polices passent par les tokens (`data-ds`).
- **Un nouveau bloc** = un fichier dans `src/blocks/` + un import dans `src/blocks/index.ts`.
- **Les médias ne vont jamais dans le document** : fichier dans le stockage, description dans `assets`, référence `asset:<id>`.
- **La page exportée ne contient aucun script.**
- **Jamais d'écrasement silencieux** : révisions au stockage, version de secours avant tout remplacement.
- **Pas de faux mécanisme de sécurité** : masquer un bouton n'est pas protéger. Les droits réels seront vérifiés côté serveur (Phase 4, AIMESTUDIO).
- **Ne jamais afficher un bouton qui ne fait rien**, ni dire « publié » pour un téléchargement.
- Les dépôts historiques (AIMENEW, AIME-NEXT, AIMESTUDIO…) ne sont jamais modifiés depuis ce projet ; aucune donnée, aucun secret n'en est copié ; aucune connexion aux bases de production d'AIMESTUDIO.

## Vérifier avant de pousser

```bash
npm run verify && npm run e2e
```

**Travail direct en production (décision de Matt, 23/10/2026).** On avance par petits pas : chaque changement validé localement (`verify` + `e2e` verts) est poussé directement sur `main`, que Vercel déploie en production automatiquement. Pas de branche ni de PR par défaut. Une branche + PR reste de mise pour un changement risqué (format du document, stockage, suppression) ou si Matt le demande. Si la CI casse sur `main`, la réparer immédiatement ou annuler le commit (`git revert`).
