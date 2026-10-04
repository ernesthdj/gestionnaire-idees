# Quickstart — validation guidée de la spec 007

## Prérequis
- Claude Code installé et connecté (`claude --version`).
- `npm install` fait ; app lancée (`npm run dev`, ou `npm run seed:demo` pour le profil démo).

## 1. Brancher le pont (US5)
1. Réglages › Claude Code : l'état indique « Pont actif — 0 client ».
2. Copier la commande affichée, la lancer dans un terminal (PowerShell ou Git Bash).
3. `claude mcp list` → `brainstormer` apparaît, connecté.
**Attendu** : la commande ne contient aucun secret.

## 2. Lire (US1)
1. Dans un CLI externe (n'importe quel dossier) : « travaillons dans le brainstormer ».
   **Attendu** : Claude cite des idées réellement présentes sur la carte.
2. Sélectionner deux idées dans l'app, puis « regarde ma sélection ». **Attendu** : il parle de ces deux-là.
3. Fermer l'app, redemander. **Attendu** : « Le Brainstormer n'est pas lancé ». Rouvrir : ça remarche sans relancer `claude`.

## 3. Dessiner (US2)
1. « Fais-moi une carte des étapes pour organiser un mariage, dans le brainstormer. »
   **Attendu** : un cadre titré, ~20 notes reliées, dans une zone libre, sans chevauchement, badge « par Claude »,
   toast « Claude : … — Annuler ».
2. `Ctrl+Z` (ou « Annuler »). **Attendu** : tout le lot disparaît d'un coup ; l'Historique montre l'opération.
3. « Ajoute une idée "Réserver le photographe" reliée à l'étape Prestataires. » **Attendu** : une idée brute apparaît
   près de l'étape, reliée ; double-clic → elle se développe comme toute idée.

## 4. Modifier, relier, retirer (US3)
1. « Reformule la note X. » → texte changé ; annuler → il revient.
2. « Retire la branche Y. » → disparaît ; Historique → restaurer.

## 5. Widget (US4)
1. « Pose un compte à rebours relié à l'idée Z. » **Attendu** : widget « À revoir », relié, aucune donnée affichée.
2. Revue → autoriser. **Attendu** : il lit l'idée.

## 6. Sécurité
1. Réglages › Régénérer le secret. **Attendu** : le compteur de clients retombe à 0 ; dans le CLI déjà ouvert, l'appel suivant
   marche quand même (le relais relit le nouveau secret dans le profil) — un programme qui n'aurait que l'ancien secret est refusé (tests).
2. `npm test` : suites `mcp-*` vertes (lots tout-ou-rien, bornes, jeton, annulation, « À revoir »).
