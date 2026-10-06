# Méthode de travail — Brainstormer

> Comment Claude Code avance sur ce dépôt, étape par étape. Complète [`regles-dev.md`](./regles-dev.md).

## 1. Une fonctionnalité = une spec (Spec Kit)
- Chaque fonctionnalité vit dans `specs/0NN-<nom>/` : `spec.md` (décisions, user stories, exigences), `plan.md`,
  `tasks.md` (tâches `T0NN` cochées au fil de l'eau). Skills : `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`,
  `/speckit-implement`…
- La spec en cours est indiquée dans `CLAUDE.md` (section « Workflows actifs ») et `.specify/feature.json`.
- Un retour de l'utilisateur qui change le comportement attendu : on **amende la spec d'abord** (décision datée),
  puis on code.
- La constitution (`.specify/memory/constitution.md`) fixe les principes non négociables : la relire avant une
  décision d'architecture.

## 2. Un test manuel guidé à chaque étape
Les tests automatiques ne remplacent pas la validation humaine. Après chaque étape visible :
1. tests, typecheck et lint verts ;
2. une **checklist numérotée** pour l'utilisateur : quoi lancer (`npm run dev` ou `npm run seed:demo`), où cliquer,
   ce qu'il doit voir ;
3. **attendre son retour** avant l'étape suivante.

## 3. Ne jamais tester à la place de l'utilisateur sur son poste
Ne jamais simuler de touches ni de clics sur son bureau (raccourcis globaux, `SendKeys`…) sans le lui demander juste
avant : il peut être en train d'utiliser son PC (un jeu en plein écran, une autre application). Préférer les tests
automatiques, ou lui demander de faire l'étape.

## 4. Vérifications avant chaque commit
```bash
npm run typecheck
npm run lint
npx prettier --check src tests
npm test
```
Puis : JOURNAL à jour, tâches cochées, et **demander la confirmation** avant `git commit` / `git push`.

## 5. Journal et doute
- **`/journal`** : chaque modification de code ajoute une entrée à `docs/JOURNAL.md` (quoi, pourquoi, erreur corrigée,
  règle apprise). C'est la mémoire du projet : le lire avant d'agir.
- **`/selfdoubt`** : avant un diagnostic, une décision d'architecture ou la modification d'un code non lu, mesurer ce
  qui est vérifié et ce qui est supposé ; dire l'incertitude plutôt que d'affirmer.

## 6. Penser visuel
Le Brainstormer est une carte : pour expliquer une structure, préférer un schéma (Mermaid, tableau, carte) à un long
texte.
