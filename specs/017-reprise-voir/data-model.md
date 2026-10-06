# Data model — 017 Reprise — Voir

Migration `0028_reprise_projet` (+ `down` écrit à la main). Chemins **relatifs** au projet, séparateur `/`.

## Tables
| Table | Colonnes | Règles |
|---|---|---|
| `code_projects` | `genesis_id` PK → `neurons.id` · `root_dir` (chemin réel) · `source` (`folder` \| `git`) · `remote_url` null (sans identifiants) · `confidentiality` (`claude` \| `local`) · `confidentiality_changed_at` · `created_at` · `analysis_state` (`idle` \| `running` \| `failed` \| `interrupted`) · `analyzed_at` null | `UNIQUE(root_dir)` ; `confidentiality` NOT NULL |
| `code_modules` | `id` · `genesis_id` · `key` (`npm:@app/core`, `csproj:App.Core`, `dir:app/Billing`) · `name` · `root_path` · `kind` (`package` \| `csproj` \| `folder`) · `summary` null · `analogy` null | `UNIQUE(genesis_id, key)` |
| `code_files` | `id` · `genesis_id` · `module_id` · `path` · `lang` (`ts` \| `tsx` \| `js` \| `cs` \| `php` \| `other`) · `hash` (SHA-256) · `lines` · `status` (`ok` \| `parse_error` \| `unsupported` \| `too_large`) · `error` (≤ 200) | `UNIQUE(genesis_id, path)` ; index `module_id` |
| `code_symbols` | `id` · `file_id` · `parent_id` null · `kind` (`namespace` \| `class` \| `interface` \| `function` \| `method`) · `name` · `qualified_name` · `start_line` · `end_line` · `category` (`domain` \| `orchestration` \| `infrastructure` \| `plumbing`) · `category_source` (`rules` \| `claude` \| `ollama` \| `user`) · `category_reason` null | index `file_id`, `(file_id, qualified_name)` |
| `code_edges` | `id` · `genesis_id` · `from_symbol_id` · `to_symbol_id` null · `raw_target` (≤ 200) · `kind` (`import` \| `call` \| `implements` \| `route` \| `injects`) · `provenance` (`syntax` \| `deduced` \| `uncertain` \| `user`) · `reason` null · `count` | `to_symbol_id` null ⇔ non résolu ; index `from_symbol_id`, `to_symbol_id`, `(genesis_id, provenance)` |
| `code_entry_points` | `symbol_id` PK · `kind` (`http_route` \| `main` \| `cli` \| `event` \| `job`) · `label` (`POST /orders`) | — |
| `code_overrides` | `genesis_id` · `target` (`category:<path>#<qualified>` \| `edge:<path>#<qualified>→<raw>`) · `value` · `created_at` | PK `(genesis_id, target)` — corrections de mentalyas, réappliquées après chaque analyse (FR-018) |
| `code_runs` | `id` · `genesis_id` · `kind` (`analysis` \| `resolution` \| `guide`) · `started_at` · `ended_at` null · `state` · `stats_json` | index `genesis_id` — jamais de code ni de chemin complet |
| `code_layout` | `genesis_id` · `level` · `parent_key` · `node_key` · `x` · `y` | PK `(genesis_id, level, parent_key, node_key)` |
| `code_explorer_state` | `genesis_id` PK · `filters_json` · `last_level` · `last_parent_key` | — |

Le **clone** précède le genesis : il est journalisé dans le journal de l'app (durée, issue, hôte), pas dans `code_runs`.

Fiabilité des liens — libellés de l'interface (spec) ↔ valeurs stockées : sûr = `syntax`, déduit = `deduced`,
incertain = `uncertain`, corrigé par mentalyas = `user`.

Clés de nœud de l'explorateur : `m:<moduleKey>`, `d:<chemin dossier>`, `f:<chemin fichier>`, `s:<symbolId>`.

## Liens avec l'existant
- Le genesis « projet repris » est un neurone `kind = 'root'` avec `project_dir` = `root_dir` (spec 008) ; `code_projects`
  le marque comme repris. Le **guide** est un document du genesis (spec 012, `documents`, versions).
- Aucune donnée du projet n'est copiée hors de la base de l'app (pas de fichier écrit dans le dossier du projet).

## États
- `analysis_state` : `idle` → `running` → `idle` (succès) | `failed` | `interrupted` (app fermée pendant l'analyse,
  corrigé au démarrage).
- Confidentialité : `local` ⇄ `claude` (local → claude confirmé).

## Vues partagées (`src/shared/ipc/reprise.ts`)
- `RepriseProjectView` : `{ genesisId, name, source, confidentiality, analysis: { state, progress?: { done, total },
  stats? }, remote: string | null }`.
- `ImportPreviewView` : `{ previewId, name, languages: { lang, files }[], files, ignored, sensitive, git, tooLarge,
  alreadyLinked: string | null }`.
- `ExplorerView`, `ExplorerNodeView`, `ExplorerEdgeView`, `ExplorerNodeDetailView`, `CodeExcerptView` : voir
  `contracts/interfaces.md`.
