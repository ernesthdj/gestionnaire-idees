# Contrat IPC — Idées & structuration (renderer ↔ main)

Format uniforme `{ success: true, data } | { success: false, error: { code, message } }` ; payloads validés par Zod.

| Canal | Entrée | Sortie `data` | Erreurs |
|-------|--------|---------------|---------|
| `idea:create` | `{ text: string(1..2000), draft?: boolean }` | `IdeaView` | `VALIDATION` |
| `idea:list` | `{ status?, categoryId?, search?: string(≤100), cursor?, limit?: 1..100 }` | `{ items: IdeaView[], nextCursor: string \| null }` | `VALIDATION` |
| `idea:get` | `{ id }` | `IdeaView & { openSession?: SessionView, pendingProposal?: ProposalView }` | `NOT_FOUND` |
| `idea:update` | `{ id, text?, categoryId? }` | `IdeaView` (version +1) | `NOT_FOUND`, `VALIDATION` |
| `structuring:start` | `{ ideaId }` | `{ session: SessionView, question: QuestionView }` | `NOT_FOUND`, `ALREADY_RUNNING`, `AI_UNAVAILABLE`, `BUDGET_EXCEEDED` |
| `structuring:resume` | `{ sessionId }` | `{ session, question?: QuestionView, ready?: true }` | `NOT_FOUND`, `SESSION_CLOSED` |
| `structuring:answer` | `{ sessionId, turnId, answer: { choice?: string } \| { text: string(1..1000) } \| { unknown: true } }` | `{ question: QuestionView } \| { ready: true }` | `NOT_FOUND`, `SESSION_CLOSED`, `ALREADY_ANSWERED`, `AI_*` |
| `structuring:decompose` | `{ sessionId }` | `ProposalView` (status `pending`) | `AI_INVALID_OUTPUT`, `CYCLE_DETECTED`, `DEPTH_EXCEEDED`, `AI_*` |
| `structuring:restructure` | `{ ideaId, change: string(1..1000) }` | `{ session, question }` | `NOT_FOUND`, `NOT_STRUCTURED`, `ALREADY_RUNNING`, `AI_*` |
| `structuring:abandon` | `{ sessionId }` | `{ ok: true }` | `NOT_FOUND` |
| `structuring:degraded` | `{ sessionId, accept: boolean }` | `{ session }` | `NOT_FOUND` |

Événements main → renderer : `structuring:thinking { sessionId, phase: "question"|"decompose" }`,
`proposal:created { proposalId, ideaId }`, `proposal:stale { proposalId }`.

`ALREADY_ANSWERED` n'est pas bloquant côté UI : le renderer affiche la question suivante déjà produite (idempotence).
