# Contracts — Analyste interne (spec 019)

Format IPC uniforme : `{ success: true, data } | { success: false, error: { code, message } }` ; chaque entrée validée
par Zod dans le main (`defineRoute`). Toutes les routes répondent `PACKAGED_APP` dans l'app installée et
`PROBE_INACTIVE` tant que le dépôt n'est pas désigné (sauf `analyste:repo:*` et `analyste:settings:get`).

## Sonde
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `analyste:events` | `{ events: ProbeEvent[] (≤ 100) }` | `{ accepted, dropped }` | — (événements fautifs ignorés) |
| `analyste:observations` | `{ family?, from?, to?, cursor?, limit ≤ 200 }` | `{ items: ObservationView[], next?, totals: Record<family, number> }` | — |
| `analyste:observations:export` | `{}` (dialogue natif d'enregistrement dans le main) | `{ count }` | `CANCELLED` |
| `analyste:purge` | `{ confirm: true }` | `{ deleted }` | — |
| `analyste:repo:choose` | `{}` (dialogue natif) | `{ repoPath, active: true }` | `NOT_BRAINSTORMER_REPO`, `NOT_RUNNING_FROM_REPO`, `CANCELLED` |
| `analyste:repo:status` | `{}` | `{ available, active, repoPath?, reason? }` | — |
| `analyste:settings:get` / `:set` | réglages (data-model) | réglages | `INVALID_INPUT` |

`ProbeEvent` (union discriminée sur `event`, catalogue `src/shared/analyste/events.ts`) :
`{ event: 'screen.open', screen }` · `{ event: 'panel.close', screen, durationMs }` ·
`{ event: 'neuron.create' | 'link.create' | 'history.undo' | 'chat.send' | …, subjectKind, subjectRef?, via }` ·
`{ event: 'error.renderer', code, frames }`. L'identifiant `subjectId` transite par l'IPC local mais
n'est **jamais stocké** : le main calcule le pseudonyme (lui seul a la clé) puis jette l'identifiant.

## Analyse et tri
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `analyste:analyze` | `{ force?: boolean }` | `{ analysisId }` | `ANALYSIS_RUNNING`, `UPDATE_CODING`, `NOT_ENOUGH_DATA` (sans `force`) |
| `analyste:cancel` | `{ analysisId }` | `ok` | `NOT_FOUND` |
| `analyste:analyses` | `{ limit ≤ 20 }` | `AnalysisView[]` | — |
| `analyste:proposals` | `{ tab: 'todo' \| 'progress' \| 'kept' \| 'dismissed', category?, cursor?, limit ≤ 50 }` | `{ items: ProposalView[], next?, counts }` | — |
| `analyste:decide` | `{ id, decision: 'accept' \| 'refuse' \| 'postpone' \| 'resume' \| 'applied', reason? ≤ 200 }` | `ProposalView` | `NOT_FOUND`, `INVALID_TRANSITION` |
| `analyste:proposals:clear` | `{ confirm: true }` (D11) | `{ deleted }` | `UPDATE_RUNNING` |
| `analyste:askMore` | `{ id }` | `{ neuronId }` (conversation ouverte avec la fiche) | `NOT_FOUND` |
| `analyste:badges` | `{ genesisId }` | `{ byElement: Record<elementId, number>, onGenesis: number }` | — |

Événements main → renderer : `analyste:progress` `{ analysisId, step: 'dossier' | 'claude' | 'controle' | 'fini' | 'echec', proposals? , errorCode? }` ;
`analyste:changed` `{ counts }` (badge de navigation, toasts du rythme).

## Mises à jour
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `analyste:update:start` | `{ proposalId }` | `UpdateView` | `REPO_DIRTY`, `NOT_ON_BASE`, `UPDATE_CODING`, `INVALID_TRANSITION` |
| `analyste:update:finish` | `{ updateId }` | `UpdateView` (commit + vérifications lancées) | `NOTHING_CHANGED`, `GIT_FAILED` |
| `analyste:update:diff` | `{ updateId }` | `{ files: { path, added, removed }[], patch ≤ 500 Ko, truncated }` | `NOT_FOUND` |
| `analyste:update:installDeps` | `{ updateId, confirm: true }` | `UpdateView` | `NOT_FOUND` |
| `analyste:update:try` | `{ updateId }` | `{ command }` (`npm run seed:demo -- --profile essai` dans le worktree ; affichée, lancée dans le terminal intégré si présent ; research R11) | `NOT_READY` |
| `analyste:update:keep` | `{ updateId, confirm: true }` | `UpdateView` | `CHECKS_NOT_GREEN`, `REPO_DIRTY`, `NOT_ON_BASE`, `MERGE_CONFLICT` |
| `analyste:update:discard` | `{ updateId, confirm: true, reason? }` | `UpdateView` | `NOT_FOUND` |
| `analyste:update:revert` | `{ updateId, confirm: true }` | `UpdateView` | `REPO_DIRTY`, `REVERT_CONFLICT` |

Événement : `analyste:update:progress` `{ updateId, step, check?: { name, status } }`.

## Tâche `analyste` (AIGateway)
- Entrée : dossier balisé (`<dossier version="1">…</dossier>`, ≤ 40 000 caractères), voir `L3-analyste-analyse.md` §3.
- Sortie : schéma Zod fermé `Output` (`L3-analyste-analyse.md` §4) ; puis `proposalCheck.ts`.
- Arguments du CLI : `L3-analyste-analyse.md` §2 ; research R1.

## Commandes git et npm
Liste fermée : `L3-analyste-appliquer.md` §2 ; npm : research R7. Toute autre commande est absente du code (test qui
inspecte les arguments passés à `runGit` / `NpmCli` sur tous les parcours).
