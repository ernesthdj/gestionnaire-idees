# Feature Specification: Genesis → projet (spec 016)

**Feature Branch**: `main` · **Created**: 2026-10-06 · **Status**: Draft
**Input**: retour de mentalyas (test de la spec 014) : « je veux pouvoir le faire directement depuis l'app depuis un
nœud genesis » ; « un nœud genesis n'est pas forcément un projet de code sous git, ça doit venir après le premier
brainstorm » ; « le dépôt git ne doit pas être obligatoire, un bouton pour en faire un dépôt git n'importe quand » ;
« par la suite connecter mon script ProjectMaster comme tableau de bord principal ».

## Décisions

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Moment | Un genesis reste une idée tant que mentalyas ne le transforme pas : « Faire de ce genesis un projet » est proposé dans son chat (mis en avant dès la maturité « suffisant »), jamais à la création. |
| D2 | Dossier | Le projet est un dossier `<racine>/<slug>/` (comme un coffre Obsidian) : `CLAUDE.md`, `docs/JOURNAL.md`, `README.md` ; `src/` et `tests/` pour un type logiciel. Le genesis y est lié (Claude y travaille, ses documents vont dans `docs/`). |
| D3 | Racine | Réglage « Racine des projets », choisi au sélecteur natif (demandé à la première création, modifiable dans Réglages › Projets). Aucun chemin en dur. |
| D4 | ProjectMaster | Si la racine est le dossier `projects/` d'un workspace ProjectMaster (`../.hub/registry.json` existe), le projet est inscrit au registre au format de `/hub new` : il apparaît dans `pm.bat`. Prépare le futur tableau de bord. |
| D5 | Git | Facultatif. « Initialiser git » est disponible à tout moment sur un genesis-projet qui n'est pas un dépôt : `.gitignore`, `git init -b main`, premier commit. Le clic de mentalyas vaut accord (pas de carte de permission). |
| D6 | Lien existant | « Lier un dossier existant » reste possible (dépôt déjà sur le disque) ; « Délier » disparaît : un projet garde son dossier. |

## User Stories

### US1 — Faire de ce genesis un projet (P1) 🎯
Après le brainstorm, mentalyas clique « Faire de ce genesis un projet », vérifie le nom, le slug, la description
(résumé de la fiche) et le type, et valide : le dossier est créé, rempli, lié au genesis ; le chat l'affiche.

**Acceptance** :
1. **Given** un genesis sans dossier, **When** mentalyas valide le formulaire, **Then** `<racine>/<slug>/` existe avec
   `CLAUDE.md`, `docs/JOURNAL.md`, `README.md` et le chat affiche « Dossier : <slug> ».
2. **Given** aucune racine réglée, **When** il valide, **Then** le sélecteur natif la demande d'abord ; annuler ne crée rien.
3. **Given** un slug invalide, réservé ou un dossier déjà présent, **Then** rien n'est créé et la raison s'affiche.
4. **Given** une racine ProjectMaster, **Then** le registre gagne l'entrée du projet (sans toucher aux autres) ; slug
   déjà inscrit → refus, rien n'est créé.

### US2 — En faire un dépôt git, n'importe quand (P1)
**Acceptance** :
1. **Given** un genesis-projet hors git, **When** mentalyas clique « Initialiser git », **Then** le dossier est un dépôt
   avec un premier commit `chore(<slug>): initial scaffolding via Brainstormer` ; le bouton disparaît.
2. **Given** git absent ou en échec (identité non réglée…), **Then** la raison courte s'affiche ; rien n'est caché.
3. **Given** une racine ProjectMaster, **Then** l'entrée du registre prend `branch: "main"`.

### US3 — Réglages › Projets (P2)
Voir et changer la racine ; savoir si c'est un workspace ProjectMaster.

## Exigences
- **FR-001** : chemins venus uniquement du sélecteur natif ou construits par le main (racine + slug validé) ;
  jamais un chemin envoyé par le renderer (constitution I).
- **FR-002** : slug `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, 2–50 caractères, sans `--`, hors mots réservés du hub.
- **FR-003** : création sans écrasement (dossier absent ou vide) ; fichiers écrits en `wx`.
- **FR-004** : registre réécrit de façon atomique (temporaire + renommage) ; JSON invalide → refus, rien d'écrit ;
  texte assaini (pas de guillemet ni de saut de ligne : le lanceur `pm.bat` lit le registre ligne à ligne).
- **FR-005** : git lancé sans shell, arguments fixes, délai borné.
- **FR-006** : seul un genesis devient projet (pas une étape ni un élément).

## Hors périmètre (suite)
Dépôt GitHub (`gh repo create`), tableau de bord ProjectMaster dans l'app (liste, fetch/pull, sessions), seed graphify.
