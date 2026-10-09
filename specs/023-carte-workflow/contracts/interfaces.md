# Contrats — Carte Workflow (spec 023)

## IPC (main, entrées validées par Zod)

| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `workflow:read` | `{ genesisId: uuid }` | `WorkflowView` | `NOT_FOUND` (genesis), `FOLDER_MISSING` (pas de dossier lié ou dossier absent) |
| `workflow:file` | `{ genesisId: uuid, path: ProjectFile }` | `{ path, lang, lines: string[] }` | `NOT_FOUND` (non cité ou absent), `SECRET_FILE`, `TOO_LARGE`, `INVALID_STATE` (binaire) |
| `workflow:anatomy` | `{ genesisId: uuid, path: ProjectFile }` | `WorkflowAnatomyView \| null` (`null` : langage non analysé, panne ou délai) — remplace `workflow:symbols` (R10) | `NOT_FOUND` |
| `workflow:summary` | `{ genesisId: uuid, path: ProjectFile }` | `WorkflowFileSummaryView` (rôle, reçoit, produit, morceaux avec lignes, moteur, modèle) — D15 | `NOT_FOUND`, `AI_UNAVAILABLE`, `AI_FAILED` |
| `workflow:savedSummary` | `{ genesisId: uuid, path: ProjectFile }` | `{ summary: WorkflowFileSummaryView \| null, outdated }` (aucun appel à l'IA) — D18 | `NOT_FOUND` |
| `workflow:chat` | `{ genesisId: uuid, key: WorkflowKey, title: 1–200 }` | `{ neuronId }` (conversation du nœud, créée ou reprise) | `NOT_FOUND` |
| `workflow:setFolded` | `{ genesisId: uuid, key: WorkflowKey, folded: boolean }` | `{ ok: true }` | `NOT_FOUND` |

- `ProjectFile` = schéma existant de `structureHandlers.ts` (relatif, ≤ 500 caractères, sans `..`), déplacé dans un
  module partagé.
- `WorkflowKey` = clé R7 (`wf:<uuid>:<sorte>[:<num>[:<id>]]`, ≤ 160 caractères, caractères `[\w.:-]`).
- `workflow:file` lit un chemin **cité par une tâche** du projet, ou un fichier de méthode (`specs/*/spec.md`,
  `tasks.md`, `plan.md`, `research.md`, `docs/brainstorm/*.md`, `docs/FOUNDATION.md`) ; rien d'autre.

## Interface (renderer)

- `StructureView = 'workflow' | 'progression' | 'architecture'` ; `setStructureView(genesisId, view)` inchangé.
- Barre (`StructureBarNode`) : segments « Workflow | Progression | Architecture » ; présente pour tout genesis
  `linkedProject` ; « Progression » et « Architecture » désactivés tant qu'aucune carte n'est dessinée (titre :
  « Cartographie le projet pour voir sa structure »), « Workflow » toujours actif ; bouton « Relire » en vue Workflow.
- `buildGraph(…, workflows: Readonly<Record<string, WorkflowView>>)` : un genesis en vue Workflow reçoit les nœuds de
  `workflowGraph` (type `workflow`) au lieu de ses éléments.
- Carte de détails : sujet `workflow` (clé R7) ; actions : « Discuter » (tâche, US, L1), « Fichiers » (lecteur),
  module de la structure qui couvre chaque fichier, affiché sur place (D9 révisé le 2026-10-09), repli (« Masquer les tâches (N) »).
- `uiStore.chatDrafts: Record<neuronId, string>` + `seedChatDraft(neuronId, text)` ; `ChatPanel` reprend la consigne au
  montage ou à son changement, puis l'efface du magasin (jamais envoyée sans geste).

## Consignes de « Discuter » (`prompts.ts`, pur)

- Tâche : « Implémente la tâche {id} de la spec {dir} ({dir}/tasks.md) en suivant /speckit-implement : lis la spec et le
  plan, fais la tâche, vérifie (typecheck, lint, tests), puis coche sa case. »
- User story : « Mène les tâches restantes de l'US{n} « {title} » de la spec {dir}, dans l'ordre : {ids}. Coche chaque
  case quand elle est faite. »
- Brainstorm : « Lance /brainstorm à partir de docs/brainstorm/{name} (idée à brainstormer de ce projet). »

## Anatomie d'un fichier (US5, D14)

```ts
interface WorkflowBlockView {
  id: number                 // rang dans le fichier
  parent: number | null      // classe englobante
  kind: 'namespace' | 'class' | 'interface' | 'function' | 'method'
  name: string
  startLine: number; endLine: number
  complexity: number
  exported: boolean          // « offert » (R11)
  maybeUnused: boolean       // ni offert, ni appelé, ni parent d'un bloc utile (R12)
}
interface WorkflowAnatomyView {
  blocks: WorkflowBlockView[]                                    // ≤ 500
  imports: { source: string; names: number; line: number }[]     // ≤ 200, regroupés par source
  calls: { from: number; to: number; line: number; ambiguous: boolean }[]  // internes, ≤ 2 000, dédoublonnés
  truncated: boolean                                             // une borne a coupé
}
```

- Purs (renderer) : `readingPath(anatomy): number[]`, `citedBlocks(texts, blocks): Set<number>`, raccourcis dérivés de
  `blocks` (classes, interfaces, fonctions, méthodes).
- Lecteur : bascule « Code | Schéma » (langage analysé et anatomie non nulle) ; « Parcours » ; ← / → ; clic ou Entrée
  sur un bloc → code surligné. Prop `cited?: readonly string[]` (textes de la tâche ou de l'US qui a ouvert le fichier).
