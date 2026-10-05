# Contrat — IPC renderer ↔ main (spec 011)

Format uniforme `{ success, data, error }`, entrées Zod `.strict()`, canaux ajoutés à `MAIN_WINDOW_CHANNELS`.

## Vue de la carte (`canvas:get`) — champs ajoutés à `IdeasCanvasView`
```
steps: StepView[]          // { id, genesisId, parentId, depth, rank, title, status, locked, lockProposed,
                           //   waitsFor: string[], sheetSummary?: string }
proposals: ProposalView[]  // { id, parentId, items: { id, title, why, rank, waitsFor: string[] }[] } (en attente)
```
`CanvasNeuronView` gagne `locked: boolean` et `lockProposed: boolean`.

## Canaux
| Canal | Entrée | Effet |
|---|---|---|
| `plan:decide` | `{ proposalId: uuid, accept: uuid[], reject: uuid[] }` | Verrouille le parent si besoin (D6), fait naître les acceptés, mémorise les refus ; un lot `plan` annulable. Renvoie `{ batchId }`. |
| `plan:reorder` | `{ stepId: uuid, rank: int ≥ 1 }` | Déplace l'étape dans sa colonne ; refus `DEPENDENCY` si l'ordre viole une dépendance. |
| `plan:setStatus` | `{ stepId: uuid, status }` | Statut d'avancement. |
| `lock:decide` | `{ neuronId: uuid, accept: boolean }` | Accepte ou refuse la proposition de verrou ; accepter = lot `plan` annulable. |
| `neuron:remove` | (existant) | Accepte une étape : archive l'étape et ses descendants, renumérote les frères. |

Erreurs nouvelles : `LOCKED` (« Ce nœud est verrouillé : ses sous-nœuds s'appuient sur son contexte. »),
`DEPENDENCY` (« ② attend ① : elle ne peut pas passer avant. »).

## Événements
`map:changed` (existant) après une proposition de Claude (`plan_proposer`, `verrou_proposer`) : la carte se rafraîchit,
le toast dit « Claude propose 3 étapes pour « Studio photo » » (sans bouton Annuler : rien n'est encore écrit).
