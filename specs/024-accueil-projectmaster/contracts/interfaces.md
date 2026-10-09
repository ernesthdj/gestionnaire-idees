# Contrats — Accueil ProjectMaster (spec 024)

## IPC (main, entrées validées par Zod)

| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `vault:status` | — | `{ root: string \| null, valid: boolean }` | — |
| `vault:choose` / `vault:create` | — (dialogue natif) | `{ root }` | `FOLDER_REFUSED`, `VALIDATION` |
| `brainstorms:list` | — | `BrainstormListItem[]` (nom, description, emplacement, branche, dernière session, session ouverte, introuvable) | — |
| `brainstorms:open` | `{ id: uuid }` | `{ brainstorm, viewState, anomalies: HubAnomaly[], summary }` | `NOT_FOUND`, `FOLDER_MISSING`, `SESSION_ELSEWHERE` |
| `brainstorms:close` | — | `{ ok }` (état de vue écrit) | — |
| `brainstorms:createScratch` | `{ name, description, type, github: boolean, visibility? }` | `{ id }` | `VALIDATION` (slug), `CONFLICT` |
| `brainstorms:previewExisting` | `{ path }` | `{ writes: string[], hasVault, isRepo, defaultBranch? }` | `FOLDER_REFUSED`, `NOT_WRITABLE` |
| `brainstorms:adoptExisting` | `{ path, role: 'owner' \| 'collaborator' \| 'none', workBranch? }` | `{ id }` | idem |
| `brainstorms:clone` | `{ url, folder }` | progression `clone:progress`, puis `{ id }` | codes de `CloneService` |
| `brainstorms:relink` | `{ id, path }` | `{ ok }` | `VAULT_MISMATCH` |
| `brainstorms:viewState` | `{ id, state: ViewState }` | `{ ok }` (différé côté renderer) | `VALIDATION` |
| `savepoints:list` | `{ brainstormId }` | `SavePointView[]` | — |
| `savepoints:create` | `{ brainstormId, name }` | `SavePointView` | `TOO_LARGE`, `LIMIT` |
| `savepoints:rename` / `savepoints:delete` | `{ id, name? }` | `{ ok }` | `NOT_FOUND` |
| `savepoints:restore` | `{ id }` | `{ undoId }` (point caché) | `NOT_FOUND` |
| `savepoints:undoRestore` | `{ undoId }` | `{ ok }` | `NOT_FOUND` |
| `hub:checkRemote` | `{ brainstormId }` | anomalies mises à jour (`git fetch` sur clic) | `GIT_MISSING` |
| `hub:endPlan` | `{ brainstormId }` | `HubEndStep[]` (étape, cochée par défaut, raison si décochée) | — |
| `hub:endStep` | `{ brainstormId, step }` | `{ status: 'done' \| 'failed' \| 'skipped', detail }` | selon l'étape |

- Chemins : absolus, résolus (`realpath`), refusés s'ils sont dans le profil de l'app, à la racine d'un disque ou dans
  un dossier système ; un dossier non accessible en écriture est refusé avant toute écriture.
- Aucune opération git n'est lancée par ces canaux sans le geste correspondant ; commit, push, switch et PR passent par
  les canaux de la spec 021.

## Interface (renderer)
- Section `home` (Project Manager) : « Reprendre <dernier> », « Charger un brainstorm existant » (liste, recherche),
  « Nouveau brainstorm » (De zéro · Projet en chantier · Depuis un lien Git).
- Barre du canevas : nom du brainstorm, « Points de sauvegarde » (poser, liste, revenir, annuler le retour),
  « Fin de session ».
- Écran de premier lancement : « Choisir mon coffre » / « Créer un coffre ».
