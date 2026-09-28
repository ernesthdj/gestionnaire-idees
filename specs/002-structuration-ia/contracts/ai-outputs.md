# Contrat — Sorties IA du moteur de neurones (schémas Zod partagés, `src/shared/ai/neurons.ts`)

Validés par le moteur 001 **puis** par les contrôles déterministes de l'app.

```ts
CategoriserOut = { categorySlug: "general"|"achat"|"projet"|"sortie"|"photo"|"it", nature: "action"|"reflection" }

EtendreOut = {
  kind: "extensions" | "out_of_scope",
  outOfScopeMessage?: string,                    // 1..300, requis si out_of_scope
  suggestions: Array<{                            // 0..2 — neurones fantômes (US6)
    neuronRef: string,                           // alias sN du neurone de rattachement
    title: string,                               // 1..120
    content: string,                             // 1..500
    webQuery?: string                            // 3..200 — vérification web demandée
  }>,
  extensions: Array<{
    question: string,                            // 1..300
    quickReplies: string[],                      // 0..4, chacune 1..40
    dimension: string,                           // 1..40
    answerKind?: "answer" | "condition" | "opportunity"   // indication pour le sous-neurone
  }>,                                            // ≥ 3 si cible = racine au démarrage ; sinon 0..5
  assessment: {
    level: "insufficient" | "sufficient" | "complete",
    covered: string[],                           // ≤ 12
    missing: string[]                            // ≤ 12
  },
  detectedOpportunity?: { title: string, amountCents?: number, expectedDate?: string }
}

ActionPlanOut = {
  nodes: Array<{ ref, type: "task"|"condition"|"opportunity", title, parentRef?, branchLabel?, question?,
                 amountCents?, dueDate?, toSchedule?, investigation?, sourceRefs: string[] }>,   // 1..60
  dependencies: Array<{ fromRef, toRef, kind: "after_done"|"on_trigger", triggerLabel? }>,
  gaps: string[]
}

ReflectionSummaryOut = {
  keyPoints:     Array<{ text: string, sourceRefs: string[] }>,   // 1..10, text ≤ 300
  decisions:     Array<{ text: string, sourceRefs: string[] }>,   // 0..10
  pros:          Array<{ text: string, sourceRefs: string[] }>,   // 0..10
  cons:          Array<{ text: string, sourceRefs: string[] }>,   // 0..10
  openQuestions: Array<{ text: string }>                          // 0..10
}

SuggererLiensOut = { links: Array<{ targetAlias: "N1"|…|"N10", label: string /*1..40*/, justification: string /*1..200*/ }> } // 0..3
```
`sourceRefs` = alias des sous-neurones (`s1…sN`) fournis dans le contexte ; `ref` = identifiants temporaires du plan.

## Contrôles déterministes
| # | Règle | Échec → |
|---|-------|---------|
| E1 | Démarrage : ≥ 3 extensions | 1 retry, puis repli (extensions reçues + message) |
| E2 | Extension dont la question duplique une extension écartée/répondue (normalisée) | retirée |
| E3 | Profondeur de la cible ≥ 6 | aucune extension demandée ; suggestion « neurone distinct » |
| E4 | Plancher jauge : < 3 réponses → `insufficient` | niveau forcé |
| P1–P5 | Plan : refs existantes, branches 2..4, profondeur plan ≤ 5, sans boucle (Kahn), `sourceRefs` existants | `AI_INVALID_OUTPUT` (1 retry) / `CYCLE_DETECTED` / `DEPTH_EXCEEDED` |
| P6 | Provenance montants/dates (réponses de l'utilisateur uniquement) | valeur retirée + nœud « à trouver » |
| S1 | Réflexion : `sourceRefs` existants, au moins 1 point clé | `AI_INVALID_OUTPUT` (1 retry) |
| S2 | Suggestions : neurone de rattachement existant, pas déjà faite ni identique à un neurone ; une seule vérification web par appel | suggestion retirée / `webQuery` ignorée |
| L1 | Liens : `targetAlias` ∈ candidats, pas d'empreinte refusée | suggestion retirée |
