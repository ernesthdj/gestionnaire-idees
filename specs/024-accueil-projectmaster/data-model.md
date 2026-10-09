# Data model — Accueil ProjectMaster (spec 024)

Migration `0039_brainstorms` (et son `down` écrit à la main). Requêtes par Drizzle, paramétrées.

## Table `brainstorms`
| Colonne | Type | Règles |
|---|---|---|
| `id` | texte, PK | UUID |
| `name` | texte | 1–120 caractères (nom affiché) |
| `slug` | texte | règles de `/hub new` (`@shared/projects/slug`) ; unique |
| `description` | texte | ≤ 500 |
| `type` | texte | type ProjectMaster (`isProjectType`) |
| `location` | `vault` \| `external` | `vault` : dossier sous `projects/` du coffre ; `external` : ailleurs (D9) |
| `origin` | `scratch` \| `existing` \| `clone` \| `migrated` | B1, B2, B3, ou passage de la carte unique (R10) |
| `folder_path` | texte | chemin réel du dossier (absolu) ; unique |
| `git_role` | `owner` \| `collaborator` \| `none` | D10 ; `none` : pas de dépôt |
| `work_branch` | texte, nul | branche du collaborateur |
| `github` | booléen | dépôt distant créé ou non |
| `view_state_json` | texte | état de vue (R2), schéma `ViewState`, ≤ 256 Ko |
| `created_at`, `last_opened_at` | texte ISO | |
| `archived_at` | texte, nul | retiré de la liste (jamais supprimé de la base) |

## Colonnes ajoutées
- `neurons.brainstorm_id` (texte, nul, index) : renseigné sur les genesis (`kind = 'root'`) ; les descendants suivent
  par `root_id`. Nul seulement avant la migration de données (R10).
- `canvas_blocks.brainstorm_id` (texte, nul, index).

## Table `save_points`
| Colonne | Type | Règles |
|---|---|---|
| `id` | texte, PK | UUID |
| `brainstorm_id` | texte | index |
| `name` | texte | 1–80 caractères |
| `hidden` | booléen | point automatique « avant retour à … » (R3), absent de la liste |
| `snapshot` | blob | JSON gzip : `{ version, neurons[], blocks[], links[], view }` |
| `size_bytes` | entier | ≤ 20 Mo |
| `created_at` | texte ISO | |

Bornes : 50 points visibles par brainstorm (le plus ancien proposé à la suppression au-delà).

## Fichiers du coffre (format inchangé, R5–R6)
- `.hub/registry.json` : entrées existantes intactes ; ajout facultatif `"external": true, "path": "<absolu>"` (R6).
- `.hub/sessions.json` : `active_session`, `sessions[]` (forme du skill `/hub`).
- `.hub/external.json` (transitoire, R6) : `{ version, projects: [{ slug, name, path }] }`.

## Vault d'un projet externe (R7)
- `.brainstormer/brainstorm.json` : `{ version: 1, brainstormId, name, gitRole, workBranch, createdAt }`.
- `.brainstormer/sessions.json` : même forme que `.hub/sessions.json`, pour ce seul projet.

## État de vue `ViewState` (R2)
`{ version: 1, viewport: { x, y, zoom }, structureViews: Record<genesisId, 'workflow' | 'progression' |
'architecture'>, openCards: { id, offset, side, sheet, pinned }[] (≤ 20), activeChat: genesisId | null }`.

## Transitions
- Brainstorm : créé (B1, B2, B3, migration) → ouvert (actif, session ouverte) → fermé (session fermée) → archivé.
- Session : ouverte (`/hub work`) → fermée (`/hub end`, étape « fermeture ») ; une seule ouverte à la fois.
- Point de sauvegarde : posé → (renommé) → retour (pose d'un point caché) → retour annulé (retour au point caché).
