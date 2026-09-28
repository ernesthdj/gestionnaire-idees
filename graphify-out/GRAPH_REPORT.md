# Graph Report - .  (2026-09-28)

## Corpus Check
- Corpus is ~284 words - fits in a single context window. You may not need a graph.

## Summary
- 21 nodes · 30 edges · 4 communities
- Extraction: 70% EXTRACTED · 23% INFERRED · 7% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.86)
- Token cost: 62,182 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Structure & workflows à venir|Structure & workflows à venir]]
- [[_COMMUNITY_Vision produit idées|Vision produit idées]]
- [[_COMMUNITY_Workspace hub & graphe|Workspace hub & graphe]]
- [[_COMMUNITY_Journal & règles|Journal & règles]]

## God Nodes (most connected - your core abstractions)
1. `Gestionnaire_idées (projet)` - 11 edges
2. `FEAT init — scaffolding initial` - 7 edges
3. `/hub new (scaffolding)` - 4 edges
4. `/brainstorm (brainstorm initial)` - 4 edges
5. `Capture rapide d'idées du quotidien` - 3 edges
6. `Structuration des idées en tâches` - 3 edges
7. `Rappel quotidien` - 3 edges
8. `Journal — Gestionnaire_idées` - 3 edges
9. `Desktop App (type projet)` - 2 edges
10. `Workspace ProjectMaster` - 2 edges

## Surprising Connections (you probably didn't know these)
- `FEAT init — scaffolding initial` --conceptually_related_to--> `Stack (à définir)`  [INFERRED]
  docs/JOURNAL.md → CLAUDE.md
- `Règles apprises (table)` --conceptually_related_to--> `Règles globales ~/.claude/CLAUDE.md`  [AMBIGUOUS]
  docs/JOURNAL.md → CLAUDE.md
- `Gestionnaire_idées (projet)` --references--> `Journal — Gestionnaire_idées`  [EXTRACTED]
  CLAUDE.md → docs/JOURNAL.md
- `FEAT init — scaffolding initial` --references--> `Gestionnaire_idées (projet)`  [EXTRACTED]
  docs/JOURNAL.md → CLAUDE.md
- `FEAT init — scaffolding initial` --references--> `/hub new (scaffolding)`  [EXTRACTED]
  docs/JOURNAL.md → CLAUDE.md

## Hyperedges (group relationships)
- **Flux idée → tâche → rappel quotidien** — claude_quick_idea_capture, claude_task_structuring, claude_daily_reminder [INFERRED 0.85]
- **Cycle de vie projet (hub new → brainstorm → pipeline → hub end)** — claude_hub_new, claude_brainstorm, claude_pipeline, claude_hub_end, claude_graphify_project [INFERRED 0.85]
- **Scaffolding initial coquille vide** — journal_feat_init, claude_src_dir, claude_tests_dir, journal_journal, claude_hub_new [EXTRACTED 1.00]

## Communities (4 total, 0 thin omitted)

### Community 0 - "Structure & workflows à venir"
Cohesion: 0.33
Nodes (7): /brainstorm (brainstorm initial), /pipeline (agents), src/, Stack (à définir), Suivi académique, tests/, FEAT init — scaffolding initial

### Community 1 - "Vision produit idées"
Cohesion: 0.53
Nodes (6): Rappel quotidien, Desktop App (type projet), Gestionnaire_idées (projet), Catégories d'idées (générales, achats, projets, sorties), Capture rapide d'idées du quotidien, Structuration des idées en tâches

### Community 2 - "Workspace hub & graphe"
Cohesion: 0.5
Nodes (4): Graphify projet (graphify-out/), /hub end, /hub new (scaffolding), Workspace ProjectMaster

### Community 3 - "Journal & règles"
Cohesion: 0.5
Nodes (4): Règles globales ~/.claude/CLAUDE.md, Journal — Gestionnaire_idées, Règles apprises (table), SESSION 0 — 2026-09-28

## Ambiguous Edges - Review These
- `Desktop App (type projet)` → `Rappel quotidien`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `Règles globales ~/.claude/CLAUDE.md` → `Règles apprises (table)`  [AMBIGUOUS]
  docs/JOURNAL.md · relation: conceptually_related_to

## Knowledge Gaps
- **4 isolated node(s):** `Catégories d'idées (générales, achats, projets, sorties)`, `/pipeline (agents)`, `/hub end`, `Suivi académique`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Desktop App (type projet)` and `Rappel quotidien`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Règles globales ~/.claude/CLAUDE.md` and `Règles apprises (table)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Gestionnaire_idées (projet)` connect `Vision produit idées` to `Structure & workflows à venir`, `Workspace hub & graphe`, `Journal & règles`?**
  _High betweenness centrality (0.617) - this node is a cross-community bridge._
- **Why does `FEAT init — scaffolding initial` connect `Structure & workflows à venir` to `Vision produit idées`, `Workspace hub & graphe`, `Journal & règles`?**
  _High betweenness centrality (0.403) - this node is a cross-community bridge._
- **Why does `/hub new (scaffolding)` connect `Workspace hub & graphe` to `Structure & workflows à venir`, `Vision produit idées`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `/hub new (scaffolding)` (e.g. with `Graphify projet (graphify-out/)` and `Workspace ProjectMaster`) actually correct?**
  _`/hub new (scaffolding)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `/brainstorm (brainstorm initial)` (e.g. with `Stack (à définir)` and `/pipeline (agents)`) actually correct?**
  _`/brainstorm (brainstorm initial)` has 2 INFERRED edges - model-reasoned connections that need verification._