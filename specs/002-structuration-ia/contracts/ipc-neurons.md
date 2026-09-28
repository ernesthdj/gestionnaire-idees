# Contrat IPC — Moteur de neurones (renderer ↔ main)

Format uniforme `{ success: true, data } | { success: false, error: { code, message } }` ; payloads validés Zod.
Remplace `ipc-structuring.md` (v1).

## Neurones
| Canal | Entrée | Sortie `data` | Erreurs |
|-------|--------|---------------|---------|
| `neuron:create` | `{ text: string(1..2000), nature?: "action"\|"reflection" }` | `RootView` | `VALIDATION` |
| `neuron:list` | `{ state?, nature?, categoryId?, search?: string(≤100), cursor?, limit?: 1..200 }` | `{ items: RootView[], nextCursor }` | `VALIDATION` |
| `neuron:getTree` | `{ rootId }` | `TreeView` (sous-neurones, extensions, dernière jauge, synthèse proposée, plan/synthèse courants) | `NOT_FOUND` |
| `neuron:update` | `{ id, title?, content?, nature?, categoryId?, amountCents?, dueDate? }` | `TreeView` | `NOT_FOUND`, `VALIDATION` |
| `neuron:delete` | `{ id, confirm: true }` (sous-neurone : cascade) | `TreeView` | `NOT_FOUND`, `IS_ROOT` |
| `neuron:archive` | `{ rootId }` | `RootView` | `NOT_FOUND` |

## Croissance & jauge
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `growth:develop` | `{ rootId }` | `TreeView` (≥ 3 extensions ou repli signalé) | `NOT_FOUND`, `AI_*`, `BUDGET_EXCEEDED` |
| `growth:answer` | `{ extensionId, answer: { choice: string } \| { text: string(1..1000) } \| { unknown: true } }` | `TreeView` (nouveau sous-neurone + nouvelles extensions + jauge) | `NOT_FOUND`, `ALREADY_ANSWERED`, `AI_*` |
| `growth:more` | `{ neuronId }` | `TreeView` | `NOT_FOUND`, `DEPTH_LIMIT`, `AI_*` |
| `growth:dismiss` | `{ extensionId }` | `TreeView` | `NOT_FOUND` |
| `growth:addBranch` | `{ parentId, title: string(1..120), content?: string(≤1000) }` | `TreeView` | `NOT_FOUND`, `VALIDATION` |

## Fusion
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `fusion:lock` | `{ rootId, force?: boolean }` | `SynthesisView` (statut `proposed`) | `NOT_FOUND`, `CONTEXT_INSUFFICIENT` (+ `missing`, si `force` absent), `AI_*`, `CYCLE_DETECTED` |
| `fusion:revise` | `{ synthesisId, instruction: string(1..500) }` | `SynthesisView` | `NOT_FOUND`, `STALE`, `AI_*` |
| `fusion:confirm` | `{ synthesisId }` | `{ batchId, root: RootView }` | `NOT_FOUND`, `STALE`, `APPLY_FAILED` |
| `fusion:editProposed` | `{ synthesisId, patch: { ref, title?, amountCents?, dueDate?, text? } }` | `SynthesisView` (revalidée P1–P6/S1) | `NOT_FOUND`, `STALE`, `VALIDATION` — *implémenté par la spec 003 (T031)* |
| `fusion:reject` | `{ synthesisId, reason?: string(≤300) }` | `{ ok }` | `NOT_FOUND` |
| `fusion:reopen` | `{ rootId }` | `TreeView` | `NOT_FOUND`, `NOT_HATCHED` |

## Liens
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `links:list` | `{ status?: "suggested"\|"accepted" }` | `LinkView[]` | — |
| `links:decide` | `{ linkId, accept: boolean }` | `LinkView` | `NOT_FOUND`, `INVALID_STATE` |
| `links:create` | `{ aRootId, bRootId, label: string(1..40) }` | `LinkView` | `VALIDATION`, `DUPLICATE` |
| `links:update` / `links:delete` | `{ linkId, label? }` / `{ linkId }` | `LinkView` / `{ ok }` | `NOT_FOUND` |

## Événements main → renderer
`neuron:thinking { rootId, neuronId, phase: "develop"|"answer"|"synthesis"|"links" }` ·
`neuron:categorized { rootId }` · `synthesis:stale { synthesisId }` · `links:suggested { rootId, count }`.
