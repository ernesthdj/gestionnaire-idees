# Data Model — Carte Workflow (spec 023)

Aucune table nouvelle. Les entités sont **calculées** à chaque lecture depuis les fichiers du projet lié ; seule la
préférence de repli est stockée (table `settings`).

## WorkflowView (renvoyée par `workflow:read`)
| Champ | Type | Règle |
|---|---|---|
| genesisId | uuid | genesis avec `projectDir` |
| foundation | `{ path, summary } \| null` | `docs/FOUNDATION.md`, premier paragraphe (≤ 600 caractères) |
| specs | SpecView[] | triées par numéro ; ≤ 200 |
| brainstorm | BrainstormDocView[] | `docs/brainstorm/L*.md` ; ≤ 300 |
| folded | `Record<string, boolean>` | écarts au repli par défaut (R6) |
| empty | boolean | ni `specs/` ni `docs/brainstorm/` |
| readAt | ISO | date de lecture |

## SpecView
| Champ | Type | Règle |
|---|---|---|
| number | string (`"022"`) | préfixe numérique du dossier |
| dir | string | `specs/022-noeuds-vivants` |
| title | string | `# …` sinon nom du dossier |
| statusLine | string \| null | ligne `**Status**` brute (texte, ≤ 200) |
| marker | `'delivered' \| 'paused' \| 'abandoned' \| null` | R2 |
| status | `'specified' \| 'planned' \| 'active' \| 'paused' \| 'delivered' \| 'abandoned'` | voir transitions |
| createdAt | string \| null | `**Created**` |
| decisions | number | lignes de tableau `D<n>` |
| stories | StoryView[] | dans l'ordre du numéro |
| socle | TaskView[] | tâches sans `[USn]` |
| done / total | number | cases cochées / toutes |
| leftovers | TaskView[] | tâches non cochées d'une spec marquée livrée ou abandonnée |
| citedDocs | string[] | noms `L*.md` cités dans `spec.md` |
| partial | boolean | fichier trop gros, illisible ou sans structure reconnue |

## StoryView
`number`, `title`, `priority` (1–9 ou null), `described` (présente dans `spec.md`), `tasks: TaskView[]` (restantes et
faites), `done`, `total`, `delivered` (total > 0 et done = total), `files: string[]` (union des chemins cités).

## TaskView
`id` (`T032`), `done`, `story` (number ou null), `text` (description sans étiquettes, ≤ 500), `files: string[]` (≤ 20).

## BrainstormDocView
`name` (`L1j-carte-workflow.md`), `level` (1–4), `title` (`# …`), `family` (nom du L1 de rattachement ou null, D11),
`coveredBy: string[]` (numéros des specs qui le citent ; pour un L1).

## Statut d'une spec (transitions)
```
marker = delivered  → delivered (reliquats = tâches non cochées)
marker = abandoned  → abandoned (rangée sous Livrées, marquée)
marker = paused     → paused
pas de tasks.md     → specified
done = 0            → planned
done = total        → delivered
sinon               → active
```
Branches : `active` → En cours ; `planned`, `specified`, `paused` → À venir ; `delivered`, `abandoned` → Livrées ;
L1 non couverts (hors `L1-fondation.md`) → À brainstormer.

## Préférence de repli (stockée)
`settings.key = workflow.folded.<genesisId>`, `valueJson = { [nodeKey]: boolean }` (≤ 500 entrées, clés R7 validées
par expression régulière) ; ignorée si le genesis n'existe plus.
