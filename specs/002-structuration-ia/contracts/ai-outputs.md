# Contrat — Sorties IA de la structuration (schémas Zod partagés, `src/shared/ai/structuring.ts`)

Validés par le moteur 001 (`messages.parse` / format Ollama) **puis** par les contrôles métier (R4, R5, R9).

```ts
QuestionOut = {
  kind: "question" | "ready" | "out_of_scope",
  text: string,                    // 1..300
  quickReplies?: string[],         // 0..4, chacune 1..40
  detectedOpportunity?: {
    title: string,                 // 1..120
    amountCents?: number,          // entier ≥ 0
    expectedDate?: string          // YYYY-MM-DD
  }
}

DecompositionOut = {
  nodes: Array<{
    ref: string,                   // /^[a-z][a-z0-9]{0,15}$/, unique dans la proposition
    type: "task" | "condition" | "opportunity",
    title: string,                 // 1..120
    parentRef?: string,            // doit exister ; profondeur ≤ 5
    branchLabel?: string,          // requis si le parent est une condition ; 1..40
    question?: string,             // requis si type = condition ; 1..200
    amountCents?: number,          // soumis au contrôle de provenance R5
    dueDate?: string,              // YYYY-MM-DD, soumis à R5
    toSchedule?: boolean,
    investigation?: boolean
  }>,                              // 1..60 nœuds
  dependencies: Array<{
    fromRef: string, toRef: string,
    kind: "after_done" | "on_trigger",
    triggerLabel?: string          // requis si on_trigger ; 1..80
  }>,
  ideaLinks: Array<{ targetAlias: "I1"|"I2"|"I3"|"I4"|"I5", kind: "finances" | "related" | "blocks" }>,
  gaps: string[]                   // 0..10, chacune ≤ 200
}

// Restructuration : même forme + opérations
RestructureOut = DecompositionOut & {
  operations: Array<{ op: "add" | "update" | "remove", ref?: string, existingNodeId?: string }>
}
```

## Règles de cohérence (post-parsing)
| # | Règle | Échec → |
|---|-------|---------|
| K1 | `ref` uniques ; `parentRef`, `fromRef`, `toRef` existent | `AI_INVALID_OUTPUT` (1 retry) |
| K2 | Enfant d'une condition ⇒ `branchLabel` ; chaque condition a 2..4 branches | `AI_INVALID_OUTPUT` |
| K3 | Profondeur ≤ 5 | `DEPTH_EXCEEDED` |
| K4 | Pas de boucle (Kahn, dépendances existantes ∪ nouvelles) | `CYCLE_DETECTED` (1 retry) |
| K5 | `targetAlias` ∈ candidates fournies | lien retiré |
| K6 | Provenance montants/dates (R5) | valeur retirée + tâche d'investigation ajoutée |
| K7 | `existingNodeId` (restructuration) appartient à l'idée | `AI_INVALID_OUTPUT` |
