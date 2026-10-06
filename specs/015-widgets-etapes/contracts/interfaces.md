# Contrats — 015 Widgets branchés sur les étapes de plan

Tout est validé par Zod dans le main ; réponses IPC `{ success, data, error }`.

| Canal IPC | Entrée | Changement |
|---|---|---|
| `widgetIo:connect` | `{ blockId, sourceKind: 'idea' \| 'plan_step', sourceId }` | `plan_step` accepté (étape existante, non archivée) ; `step` refusé (`VALIDATION`, « ancienne source ») ; `DUPLICATE` inchangé |
| `widgetIo:setParts` | `{ inputId, parts }` | parties validées selon la nature de la source (`IDEA_PARTS` ou `STEP_PARTS`) ; `step` → `VALIDATION` |
| `widgetIo:state` | inchangé | `WidgetInputView.label` (rang) ajouté |
| `widgetIo:inputs` | inchangé | forme de `WidgetInputData` : voir data-model |

Outil MCP `widget_poser` : description des entrées mise à jour (idée : identité, fiche, plan, annexes ; étape :
identité, fiche, chemin, sous-étapes et annexes ; `truncated`).
