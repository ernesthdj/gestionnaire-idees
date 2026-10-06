# Data model — 015 Widgets branchés sur les étapes de plan

## `widget_inputs` (inchangée en base)
| Colonne | Changement |
|---|---|
| `source_kind` | valeurs : `idea`, `plan_step` (nouveau), `step` (archive, plus créable) |
| `source_id` | idée (genesis) ; **étape** pour `plan_step` ; idée pour `step` |
| `parts_json` | idée : `identity`, `sheet`, `plan`, `annexes` ; étape : `identity`, `sheet`, `path`, `subtree` ; anciennes valeurs d'idée converties à la lecture (research R1) |

## Parties (shared)
- `IDEA_PARTS = ['identity', 'sheet', 'plan', 'annexes']`
- `STEP_PARTS = ['identity', 'sheet', 'path', 'subtree']`

## `WidgetInputData` (ce que reçoit le widget dans `gi.inputs`)
```text
{ kind: 'idea', id, title?, nature?, category?, state?, originalText?,          ← identity
  sheet?: Sheet,                                                             ← sheet
  plan?: [{ id, parentId, rank, label, title, status, final? }],             ← plan
  annexes?: { documents: [{ title, content, missing? }] },                   ← annexes
  truncated? }
{ kind: 'plan_step', id, genesisId,
  title?, rank?, label?, status?, depth?, why?, final?: { deliverable, state }, ← identity
  sheet?: Sheet,                                                             ← sheet
  path?: [{ id, kind: 'genesis'|'step', label, title, sheet }],             ← path (genesis d'abord)
  subtree?: { steps: [{ id, parentId, label, title, status }],
              documents: [{ title, content, missing? }],
              deliverable: [{ path, status }] },                             ← subtree
  truncated? }
{ kind: 'step', ideaId, ideaTitle, text }                                    ← archive
```
`Sheet` = `{ resume, points_cles, decisions, questions_ouvertes, manques }` (spec 010).

## `WidgetInputView` (revue)
Gagne `label: string | null` (rang « 1.2 » pour une étape) ; `title` = titre de l'étape ou de l'idée.
