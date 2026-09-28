# Contrat IPC — Interface MVP-1

Format uniforme `{ success: true, data } | { success: false, error: { code, message } }` ; payloads validés Zod.
Les canaux `idea:*` et `structuring:*` (002) et `ai:*` / `context:*` (001) restent inchangés.

## Coquille & réglages
| Canal | Entrée | Sortie `data` | Erreurs |
|-------|--------|---------------|---------|
| `app:getSettings` | — | `AppSettingsView` | — |
| `app:setSettings` | `Partial<{ shortcut, launchAtLogin, theme, questionLimit }>` | `AppSettingsView` | `VALIDATION`, `SHORTCUT_UNAVAILABLE` |
| `app:completeOnboarding` | — | `{ ok: true }` | — |
| `app:openMain` | `{ section?: "ideas"\|"review"\|"map"\|"history", ideaId?, proposalId? }` | `{ ok: true }` | — |

## Capture (fenêtre de capture uniquement)
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `capture:getDraft` | — | `{ text }` | — |
| `capture:saveDraft` | `{ text: string(≤2000) }` | `{ ok }` | `VALIDATION` |
| `capture:submit` | `{ text: string(1..2000), structureNow: boolean }` | `{ ideaId }` | `VALIDATION` |
| `capture:close` | — | `{ ok }` | — |

## Revue & validation
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `review:list` | `{ status?: "pending"\|"archived" }` | `ProposalView[]` | — |
| `review:get` | `{ proposalId }` | `ProposalReviewView` | `NOT_FOUND` |
| `review:accept` | `{ proposalId, selection: { excludedRefs: string[], edits: Array<{ ref, title?, amountCents?, dueDate? }> } }` | `{ batchId, ideaId }` | `NOT_FOUND`, `STALE`, `DEPENDENCY_EXCLUDED`, `VALIDATION`, `APPLY_FAILED` |
| `review:reject` | `{ proposalId, reason?: "not_relevant"\|"wrong"\|"later", note?: string(≤300) }` | `{ ok }` | `NOT_FOUND` |
| `review:correct` | `{ proposalId, instruction: string(1..500) }` | `ProposalView` (nouvelle, l'ancienne `superseded`) | `NOT_FOUND`, `AI_*` |

`DEPENDENCY_EXCLUDED` renvoie `{ blockedRefs }` : l'interface propose d'exclure aussi les dépendantes.

## Organigramme & arbre
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `map:overview` | `{ categoryIds?, statuses?, search?, focusIdeaId? }` | `{ ideas: IdeaCardView[], links: IdeaLinkView[] }` | — |
| `tree:get` | `{ ideaId }` | `TreeView` | `NOT_FOUND` |
| `tree:setNodeStatus` | `{ nodeId, status: "in_progress"\|"done"\|"abandoned"\|"ready" }` | `TreeView` | `NOT_FOUND`, `INVALID_TRANSITION` |
| `tree:chooseBranch` | `{ conditionNodeId, branchNodeId }` | `TreeView` | `NOT_FOUND` |
| `tree:setTrigger` | `{ dependencyId, reached: boolean }` | `TreeView` | `NOT_FOUND` |
| `tree:editNode` | `{ nodeId, title?: string(1..120), amountCents?: int≥0 \| null, dueDate?: date \| null }` | `TreeView` | `NOT_FOUND`, `VALIDATION` |
| `tree:addTask` | `{ ideaId, parentNodeId?, title }` | `TreeView` | `NOT_FOUND`, `DEPTH_EXCEEDED` |
| `tree:savePositions` | `{ ideaId, positions: Array<{ nodeId, x, y }> }` | `{ ok }` | — |

## Historique
| Canal | Entrée | Sortie | Erreurs |
|-------|--------|--------|---------|
| `history:list` | `{ cursor?, limit?: 1..100 }` | `{ items: HistoryEntryView[], nextCursor }` | — |
| `history:undo` | `{ batchId }` | `{ undoBatchId }` | `NOT_FOUND`, `UNDO_CONFLICT` (+ `{ conflicts: string[] }`) |

## Événements main → renderer
`review:countChanged { pending }` · `tree:changed { ideaId }` · `idea:categorized { ideaId, categoryId }` ·
`app:navigate { section, ideaId?, proposalId? }` · `shortcut:unavailable { shortcut }`.
