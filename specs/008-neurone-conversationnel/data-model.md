# Data Model — Spec 008 (lot A)

Migration `0018_neuron_conversations` (+ down).

## neurons (modifiée)
| Colonne | Type | Règle |
|---------|------|-------|
| `session_id` | text null, unique | Session Claude Code de la conversation du neurone |
| `session_started` | integer (bool) défaut 0 | Vrai après le premier tour réussi : on reprend (`--resume`) au lieu de créer |
| `sheet_json` | text null | Fiche : `{ resume, points_cles[], decisions[], questions_ouvertes[], manques[] }`, ≤ 12 000 car. |

## neuron_messages (nouvelle)
| Colonne | Type | Règle |
|---------|------|-------|
| `id` | text PK | UUID |
| `neuron_id` | text → neurons.id | |
| `role` | `user` \| `assistant` \| `tool` \| `error` | |
| `text` | text | Message ; pour `tool` : libellé lisible (« fiche mise à jour ») |
| `created_at` | text | ISO |
Index `neuron_messages_neuron_idx (neuron_id)`.

## context_assessments (réutilisée)
`maturite_evaluer` y écrit (`level`, `ai_level`, `covered_json` = [], `missing_json`, `answered_count` = 0).

## change_log
Entité `neuron_sheet` (`{ sheet }`) : annulation d'une écriture de fiche.

## Vues
- `CanvasNeuronView` : + `sheetSummary: string | null` (résumé de la fiche).
- `ChatView` : `{ neuronId, title, messages[], sheet, maturity, ready: { ok } | { problem } }`.
