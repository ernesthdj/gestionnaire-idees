# Contrat IPC — Interface MVP-1 « Brainstormer » (v2)

Format uniforme `{ success: true, data } | { success: false, error: { code, message } }` ; payloads validés Zod.
Les canaux `neuron:*`, `growth:*`, `fusion:*`, `links:*` (002) et `ai:*` / `context:*` (001) sont consommés tels quels.

## Coquille & réglages
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `app:getSettings` | — | `AppSettingsView` | — |
| `app:setSettings` | `Partial<{ shortcut, launchAtLogin, theme, motion }>` | `AppSettingsView` | `VALIDATION`, `SHORTCUT_UNAVAILABLE` |
| `app:completeOnboarding` | — | `{ ok }` | — |
| `app:openMain` | `{ section?: "ideas"\|"pending"\|"history", diveRootId? }` | `{ ok }` | — |

## Capture (preload de capture uniquement)
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `capture:getDraft` / `capture:saveDraft` | — / `{ text: string(≤2000) }` | `{ text }` / `{ ok }` | `VALIDATION` |
| `capture:submit` | `{ text: string(1..2000), diveNow: boolean }` | `{ rootId }` | `VALIDATION` |
| `capture:close` | — | `{ ok }` | — |

## Écran Idées & plongée
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `canvas:get` | `{ nature?, categoryId?, search? }` | `IdeasCanvasView` | — |
| `canvas:savePositions` | `{ positions: Array<{ rootId, x, y }> }` | `{ ok }` | `VALIDATION` |
| `dive:get` | `{ rootId, focusNeuronId? }` | `DiveView` | `NOT_FOUND` |
| `fusion:editProposed` | `{ synthesisId, patch: { ref: string, title?, amountCents?: int≥0\|null, dueDate?: date\|null, text? } }` | `SynthesisView` (revalidée) | `NOT_FOUND`, `STALE`, `VALIDATION` |
| `plan:setTaskStatus` | `{ nodeId, status: "ready"\|"in_progress"\|"done"\|"abandoned" }` | `DiveView` | `NOT_FOUND`, `INVALID_TRANSITION` |
| `plan:chooseBranch` | `{ conditionNodeId, branchNodeId }` | `DiveView` | `NOT_FOUND` |
| `plan:setTrigger` | `{ dependencyId, reached: boolean }` | `DiveView` | `NOT_FOUND` |
| `plan:editNode` / `plan:addTask` | `{ nodeId, title?, amountCents?, dueDate? }` / `{ rootId, parentNodeId?, title }` | `DiveView` | `NOT_FOUND`, `VALIDATION`, `DEPTH_EXCEEDED` |

## À valider, historique, export
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `pending:list` | — | `{ links: LinkView[], syntheses: SynthesisView[] }` | — |
| `history:list` | `{ cursor?, limit?: 1..100 }` | `{ items: HistoryEntryView[], nextCursor }` | — |
| `history:undo` | `{ batchId }` | `{ undoBatchId }` | `NOT_FOUND`, `UNDO_CONFLICT` (+ `conflicts`) |
| `export:markdown` | `{ rootId }` | `{ saved: boolean, path?: string }` (dialogue d'enregistrement côté main) | `NOT_FOUND`, `NOT_HATCHED`, `WRITE_FAILED` |

## Événements main → renderer
`pending:countChanged { count }` · `app:navigate { section, diveRootId? }` · `shortcut:unavailable { shortcut }` ·
+ événements de 002 (`neuron:thinking`, `neuron:categorized`, `synthesis:stale`, `links:suggested`).
