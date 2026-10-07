# Contrats — 017 Reprise — Voir

Toutes les entrées validées par Zod dans le main ; l'interface ne reçoit que des chemins relatifs ; un chemin de
projet ne vient jamais de l'interface (`previewId` éphémère, 15 min).

## Canaux IPC
| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `reprise:previewFolder` | — (sélecteur natif) | `ImportPreviewView` \| `null` (annulé) | `FOLDER_REFUSED`, `TOO_LARGE` |
| `reprise:clone` | `{ url: string ≤ 500 }` (+ sélecteur natif du dossier parent) | `{ cloneId }` | `URL_REFUSED`, `GIT_MISSING`, `TARGET_EXISTS`, `BUSY` |
| `reprise:cancelClone` | `{ cloneId }` | `{}` | `NOT_FOUND` |
| `reprise:create` | `{ previewId, confidentiality: 'claude' \| 'local' }` | `{ genesisId }` | `NOT_FOUND`, `ALREADY_LINKED` |
| `reprise:get` | `{ genesisId }` | `RepriseProjectView` | `NOT_FOUND` |
| `reprise:setConfidentiality` | `{ genesisId, level, confirm?: true }` | `{ level }` | `CONFIRM_REQUIRED` |
| `reprise:analyze` | `{ genesisId }` | `{ runId }` | `BUSY`, `FOLDER_MISSING` |
| `reprise:cancelAnalysis` | `{ genesisId }` | `{}` | — |
| `reprise:setCategory` | `{ genesisId, symbolId, category }` | `{}` | `NOT_FOUND` |
| `reprise:setTarget` | `{ genesisId, edgeId, targetSymbolId: string \| null }` | `{}` | `NOT_FOUND` |
| `reprise:resolve` | `{ genesisId }` (lève les ambiguïtés, US6) | `{ runId }` | `BUSY`, `AI_UNAVAILABLE` |
| `reprise:guide` | `{ genesisId }` (produit / régénère le guide) | `{ documentId }` | `BUSY`, `AI_UNAVAILABLE`, `NOT_ANALYZED` |
| `explorer:view` | `{ genesisId, level: 1..4, parentKey?, focusKey?, depth?: 1 \| 2, filters: { categories[], langs[], hideUncertain } }` | `ExplorerView` | `NOT_FOUND`, `NOT_ANALYZED` |
| `explorer:node` | `{ genesisId, nodeKey }` | `ExplorerNodeDetailView` | `NOT_FOUND` |
| `explorer:code` | `{ genesisId, symbolId }` | `CodeExcerptView` | `NOT_FOUND`, `SECRET_FILE` |
| `explorer:search` | `{ genesisId, query: 2..100 }` | `{ results[≤30] }` | — |
| `explorer:savePosition` | `{ genesisId, level, parentKey, nodeKey, x, y }` | `{}` | `NOT_FOUND` |
| `explorer:saveState` | `{ genesisId, filters, level, parentKey }` | `{}` | — |

## Événements
`reprise:cloneProgress` `{ cloneId, phase, percent }` · `reprise:cloneDone` `{ cloneId, previewId }` ·
`reprise:cloneFailed` `{ cloneId, code: 'AUTH_FAILED' | 'NOT_FOUND' | 'NETWORK' | 'CANCELLED' | 'TIMEOUT' | 'FAILED' }` ·
`reprise:analysisProgress` `{ genesisId, phase, done, total }` · `reprise:analysisDone` `{ genesisId, stats }` ·
`reprise:changed` `{ genesisId }`.

## Vues
- `ExplorerView` : `{ level, breadcrumb: { key, title }[], nodes: ExplorerNodeView[≤150], edges: ExplorerEdgeView[≤400],
  grouped: { key, title, count }[], hidden: { plumbingCalls, nodes }, confidentiality, analysis }`.
- `ExplorerNodeView` : `{ key, level, kind, title, category, lang?, childCount, x?, y? }`.
- `ExplorerEdgeView` : `{ from, to, count, provenance: 'syntax' | 'deduced' | 'uncertain' | 'user' }` (la plus faible).
- `ExplorerNodeDetailView` : `{ key, kind, title, path?, category, categorySource, lang?, lines?, summary, analogy,
  callers[≤50], callees[≤50] (chacun `{ key, title, provenance, reason? }`), status?, error? }`.
- `CodeExcerptView` : `{ path, startLine, lines: string[≤200], lang }`.

## Processus d'analyse (main ↔ `analysis-worker`, messages Zod)
- main → worker : `{ type: 'init', grammarsDir }` puis `{ type: 'parse', root, files: { id, path, lang }[] }` ;
  `{ type: 'cancel' }`.
- worker → main : `{ type: 'file', id, hash, lines, symbols[], imports[], calls[], entries[] }` |
  `{ type: 'fileError', id, reason }` | `{ type: 'done' }`.

## Tâches IA (AIGateway)
- `reprise_resolution` : entrée `{ items: { edgeId, call, context ≤ 8 lignes, candidates: { id, label }[] }[≤50] }` →
  `{ items: { edgeId, targetId: string | null, reason ≤ 160 }[] }` (targetId ∈ candidats).
- `reprise_guide` : entrée `{ name, modules, entryPoints, files (arbre), readme, configs }` (borné à ~40 000 caractères)
  → `{ sections: { id, analogy, markdown, sources: string[] }[9], modules: { key, summary, analogy }[] }` (T024 : les
  titres sont fixés par l'app d'après `id` ; l'`analogy` obligatoire garantit l'ouverture de chaque section par une
  analogie, D6). Délai 10 min, contexte local 32 768 jetons ; `localOnly` : Ollama imposé, sans repli ni file.
- Routage : Claude si `claudeAllowed`, sinon Ollama ; indisponible → `AI_UNAVAILABLE`.
