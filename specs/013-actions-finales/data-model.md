# Data model — 013 Actions finales

Migration `0025_final_actions` (+ `down/0025_final_actions.down.sql` écrit à la main).

## `final_actions` — une ligne par étape proposée ou devenue action finale
| Colonne | Type | Règle |
|---|---|---|
| `neuron_id` | text PK → `neurons.id` | `kind = 'step'`, sans sous-étape active |
| `genesis_id` | text → `neurons.id` | genesis de l'arbre (une exécution à la fois par genesis) |
| `deliverable` | text | livrable annoncé, 1..2 000 caractères |
| `reason` | text | raison, 1..2 000 caractères |
| `state` | text enum | `proposee` → `prete` → (`en_cours` ↔ `a_revoir`) ; `fait` = `neurons.step_status = 'fait'` |
| `proposed_at` / `accepted_at` | text ISO | `accepted_at` null tant que `proposee` |
| `origin` | text | `claude` |

Transitions : `proposee` --accepter--> `prete` ; --refuser--> ligne retirée (`archived_at`) ; `prete|a_revoir`
--exécuter--> `en_cours` --fin de tour--> `a_revoir` ; `a_revoir` --accepter le livrable--> `step_status = 'fait'`
(l'état reste `a_revoir` en base, la vue montre « fait ») ; rétrograder --> `archived_at` (l'étape redevient
ordinaire, le livrable reste lisible dans l'Historique). Colonne `archived_at` text null.

## `executions` — une passe de Claude
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK (uuid) | |
| `neuron_id` | → `final_actions.neuron_id` | |
| `genesis_id` | text | index partiel unique `WHERE ended_at IS NULL` → une seule exécution ouverte par genesis |
| `started_at` / `ended_at` | text ISO | `ended_at` null pendant l'exécution |
| `outcome` | text enum null | `terminee` · `arretee` · `interrompue` · `echouee` |
| `correction` | text null | message de mentalyas (≤ 4 000) |
| `files_written` | integer | ≤ 40 (borne R3) |

## `execution_events` — fil de l'exécution (trace, FR-007)
| Colonne | Type | Règle |
|---|---|---|
| `id` | integer PK | |
| `execution_id` | → `executions.id` | |
| `at` | text ISO | |
| `kind` | text enum | `lecture` (outil Read/Glob/Grep, libellé du flux) · `ecriture` · `refus` · `message` |
| `path` | text null | chemin relatif (jamais absolu) |
| `detail` | text null | motif du refus, libellé ; jamais de contenu de fichier |

## `deliverable_files` — livrable cumulé
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | |
| `neuron_id` | → `final_actions.neuron_id` | unique (`neuron_id`, `path_key`) |
| `path` | text | relatif au projet, `/` |
| `path_key` | text | `path` en minuscules (Windows insensible à la casse) |
| `before_content` | text null | contenu d'avant la **première** écriture ; null = fichier créé |
| `after_content` | text | dernier contenu écrit par Claude |
| `after_hash` | text | SHA-256 de `after_content` (détecter « modifié depuis ») |
| `updated_at` | text ISO | |
| `reverted_at` | text null | retour arrière appliqué |

Contenus en base chiffrée (comme les versions de documents) ; ≤ 1 Mo chacun.

## Vues (shared)
- `StepView` gagne `final: { state, deliverable, reason, proposed: boolean } | null`.
- `DeliverableView` (canvas) : `{ neuronId, files: number, executing: boolean, offset, width, height }` — annexe placée
  par `planLayout` comme un document.
- `DeliverableDetailView` (`deliverable:get`) : fichiers `{ path, status: 'cree'|'modifie', changedSince: boolean,
  before: string|null, after: string, summary?: { beforeBytes, afterBytes } }`, dernières exécutions avec événements.

## Historique
Kinds : `final` (nouveau, annulable). Entités : `final_action` (état), `project_file` (handler externe, fichier du
projet : `{ path, content | null }`), `deliverable_file`, `neuron` (`step_status`).

## D2 bis — migration `0026_approved_commands` (+ down)
`approved_commands` : `genesis_id` → `neurons.id`, `script` (nom), `script_text` (texte approuvé), `approved_at` ;
clé (`genesis_id`, `script`).
`command_runs` : `id`, `execution_id` → `executions.id`, `script`, `exit_code` (null si délai dépassé), `timed_out`,
`duration_ms`, `output` (20 Ko de fin, sans ANSI), `at`. `execution_events.kind` gagne `commande`.
`DeliverableView.runs` : dernier lancement par script `{ script, ok, at }`.

## D5 — migration `0027_test_runs` (+ down)
`test_runs` : `id`, `neuron_id` → `final_actions.neuron_id` (cascade), `files` (JSON des chemins passés),
`ignored` (JSON `{ path, reason }[]`), `exit_code` (null si délai dépassé), `timed_out`, `duration_ms`, `output`
(20 Ko de fin, sans ANSI), `at`. Les 10 derniers par action sont gardés. `DeliverableView.tests` : dernier lancement
`{ ok, running, at } | null`.
Réglage `editor.command` dans la table de réglages existante (texte, pas de secret).
