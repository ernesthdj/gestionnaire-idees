# Data model — 011 Plan d'attaque

Migration `0022_plan_attaque` (+ `down/0022_plan_attaque.down.sql`).

## `neurons` (colonnes ajoutées)
| Colonne | Type | Règle |
|---|---|---|
| `rank` | integer, null | Étape : rang ≥ 1, unique parmi les frères vivants (non archivés). Null hors étapes. |
| `step_status` | text, null | `a_faire` · `en_cours` · `fait` · `bloque` ; défaut `a_faire` pour une étape. |
| `locked_at` | text, null | Date de verrouillage ; non nul = verrouillé (genesis ou étape). |
| `lock_proposed_at` | text, null | Proposition de verrou en attente (effacée à la décision). |

`kind` gagne la valeur `step`. Une étape : `genesis_id` = genesis de l'arbre, `parent_id` = genesis ou étape,
`depth` = 1..4, `root_id` = genesis. Index : `(parent_id, rank)`.

## `step_dependencies`
| Colonne | Type | Règle |
|---|---|---|
| `step_id` | text, FK neurons | L'étape qui attend. |
| `waits_for_id` | text, FK neurons | L'étape attendue — même parent. |
Clé primaire `(step_id, waits_for_id)`. Aucun cycle ; `rank(waits_for) < rank(step)` toujours.

## `plan_proposals`
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | |
| `parent_id` | text, FK neurons | Genesis ou étape de l'arbre de la conversation. |
| `status` | text | `en_attente` · `decidee` · `remplacee`. Une seule `en_attente` par parent. |
| `created_at` | text | |

## `plan_proposal_items`
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | |
| `proposal_id` | text, FK | |
| `key` | text | Clé locale (pour les dépendances internes à la proposition). |
| `title` | text | 1..120 caractères. |
| `why` | text | 1..300 caractères. |
| `rank` | integer | Ordre proposé, 1..12. |
| `waits_for_json` | text | Clés locales attendues (`[]` par défaut). |
| `status` | text | `en_attente` · `valide` · `refuse`. |
| `born_id` | text, null | Neurone créé à la validation. |

Un item `refuse` sert de mémoire : même titre normalisé, même parent → non reproposé.

## Transitions
- **Proposition** : `en_attente` → (`decidee` quand plus aucun item n'est en attente) ; → `remplacee` si Claude propose
  de nouveau pour le même parent (items en attente → `refuse` implicite, non mémorisé comme refus).
- **Item** : `en_attente` → `valide` (naissance d'une étape, rang = après les frères existants, dans l'ordre proposé)
  ou → `refuse`.
- **Verrou** : `lock_proposed_at` posé → accepté (`locked_at` = maintenant, `lock_proposed_at` = null) ou refusé
  (`lock_proposed_at` = null). Valider des items verrouille d'abord le parent (D6). Déverrouillage : uniquement par
  annulation d'Historique, refusé si le nœud a des enfants vivants hors du lot annulé.
- **Étape** : `a_faire` ↔ `en_cours` ↔ `fait` ↔ `bloque` (toutes transitions permises).

## Historique (`change_log`)
| Entité | Avant / après | Annulation |
|---|---|---|
| `step` | `null` ↔ `{ parentId, rank, title }` | archive / restaure l'étape (et ses descendants via leurs propres entrées) |
| `step_rank` | `{ rank }` | remet le rang |
| `step_status` | `{ status }` | remet le statut |
| `step_dependency` | `null` ↔ `{ waitsFor }` | retire / remet la dépendance |
| `neuron_lock` | `{ locked: boolean }` | déverrouille / reverrouille (garde D6) |
Kinds : `plan` (naissances + verrou, par mentalyas), `manual_edit` (rang, statut par mentalyas), `mcp_write` (statut,
dépendances par Claude). Tous annulables sauf `manual_edit` (comme aujourd'hui) — le rang et le statut se rétablissent
en refaisant le geste.
