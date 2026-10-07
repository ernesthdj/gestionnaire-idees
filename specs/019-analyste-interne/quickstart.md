# Quickstart — Analyste interne (spec 019)

Guide de validation. Prérequis : dépôt du Brainstormer à jour, `npm install`, git et Claude Code connectés,
**aucun changement non commité** pour les §4–§6. Toujours sur le **profil démo** (`npm run seed:demo`).

## §1 Sonde (US1)
1. `npm run seed:demo` → Réglages › Analyste → « Désigner le dépôt » → choisir le dossier du dépôt.
   Attendu : « dépôt reconnu, l'app tourne depuis ce dépôt », témoin vert, entrée **Analyste** dans la navigation.
2. Désigner un autre dossier (ex. `Documents`). Attendu : refus avec la raison.
3. Créer 2 idées, ouvrir un chat, déplacer un nœud, annuler. Réglages › Analyste › Observations.
   Attendu : `neuron.create`, `chat.send`, `history.undo`… avec type et moyen ; **aucun texte** de tes idées.
4. Automatique : `npm test -- analyste/probe` (SC-001 : textes du profil démo absents des observations).
5. « Effacer les observations » → confirmer. Attendu : liste vide.

## §2 Analyse (US2)
1. Preuve R1 (une fois, bloquante) : suivre la procédure de `research.md` R1 ; attendu : lecture de `%APPDATA%`
   refusée.
2. Boîte Analyste → « Analyser maintenant » (avec `force` si peu d'observations, ou après chargement de la semaine
   simulée `tests/fixtures/analyste/observations-semaine.json` par le profil démo).
   Attendu : progression dossier → Claude → contrôle ; ≤ 5 fiches, les plus graves d'abord ; preuves qui existent.
3. Automatique : `npm test -- analyste/proposal-check analyste/dossier analyste/cli-args`.

## §3 Tri (US3)
1. Ouvrir une fiche : preuves en phrases, clic sur une preuve de code → explorateur au bon fichier.
2. Refuser (« pas utile ») → onglet Écartées ; relancer l'analyse sans nouvelle activité → la fiche ne revient pas.
3. Carte de structure du Brainstormer (« Lier et cartographier » si absente) → badge sur les éléments visés → clic
   ouvre la fiche.
4. Chronomètre : trier 5 fiches < 2 min (SC-007).

## §4 Appliquer (US4)
1. Modifier un fichier sans commiter → Accepter. Attendu : refus « commite ou range tes changements », rien de créé.
2. Dépôt propre → Accepter une petite proposition. Attendu : `git branch` montre `analyste/…`, `main` inchangé,
   `.analyste/worktrees/<id8>` créé ; conversation ouverte dans la fiche ; une commande demandée par Claude t'est
   présentée.
3. « Terminer » → 4 pastilles ; diff lisible ; « Essayer » → version de la branche lancée sur le **profil d'essai** (`--profile essai`) à côté de l'app ouverte, qui continue de tourner.
4. « Garder » → confirmation « l'app va se recharger » → après rechargement : fiche « Gardée », `git log` montre la
   fusion, `git status` propre, **aucun push** (`git status -sb` : en avance sur `origin`).
5. Autre proposition → « Jeter ». Attendu : branche et worktree supprimés, rien d'autre.
6. Automatique : `npm test -- analyste/update-git` (dépôt temporaire : worktree, commit, fusion, conflit + abort,
   jeter, revert, inspection des commandes : aucun push, reset, rebase, force).

## §5 Annuler (US5)
1. Onglet Gardées → « Annuler cette mise à jour » → confirmer. Attendu : nouveau commit de revert, code revenu à
   l'état d'avant (`git diff <base_sha>` vide sur les fichiers concernés, SC-006).

## §6 Rythme (US6)
1. Réglages : rythme 1 h, seuil 50. Attendu : « Prochaine analyse : … si ≥ 50 événements ».
2. Automatique : `npm test -- analyste/schedule` (horloge simulée : seuil, attente, saut à 10 fiches, rattrapage
   unique).

## §7 App installée
`npm run build` puis lancer l'app empaquetée (si un packaging est disponible) : Réglages › Analyste indique
« indisponible dans l'app installée » ; aucune ligne dans `observations` (SC-002). À défaut, test unitaire
`app.isPackaged = true`.
