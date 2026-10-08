# Data model — Nœuds vivants (spec 022)

## Base (main)

### `neurons.collapsed` (existant, sens étendu)
- Élément de structure : inchangé (repli de ses enfants, défaut `true`).
- **Étape** et **genesis** : repli de leurs sous-étapes / de tout leur plan. Migration `0037_plan_fold` :
  `UPDATE neurons SET collapsed = 0 WHERE kind IN (<genesis>, <étape>)` ; down : remet `1`. Les nouvelles étapes sont
  créées avec `collapsed = false`.

### `agent_sessions` (US5, migration `0038_agent_sessions` + down)
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | uuid |
| `neuron_id` | text → neurons.id | neurone de la discussion |
| `role` | text enum `main` \| `agent` | fixé à l'ouverture |
| `repo_path` | text null | dépôt lié (null = agent sans branche) |
| `branch` | text null | `agent/<id8>-<slug>` (validé par `branchName.ts`) |
| `base_branch` | text null | branche de base au moment de la création |
| `worktree_path` | text null | sous `<dépôt>/.brainstormer/agents/` (vérifié par inclusion) |
| `status` | text enum `active` \| `kept` \| `discarded` \| `ended` | transitions ci-dessous |
| `created_at`, `ended_at` | text ISO | |

Transitions : `active → kept` (« Garder » : fusion réussie) · `active → discarded` (« Jeter ») · `active → ended`
(discussion fermée sans décision : worktree et branche **conservés**, décision possible plus tard). Pas d'autre transition.

## Interface (renderer, non persistée sauf mention)

### `OpenCard` (uiStore)
`{ id: string; offset: { x, y } (unités de la carte); parts: { sheet: boolean; side: 'chat' | 'reader' | null };
reader?: { source: 'deliverable' | 'element' | 'document' | 'skill'; path: string; tab: 'diff' | 'file' }; z: number }`
— `cards: OpenCard[]`, `activeCardId: string | null`. Règles : un identifiant au plus une fois ; ouvrir la discussion ferme
le lecteur et inversement ; fermer la carte active active la plus haute restante.

### `NodeVisual` (pur, calculé)
`{ depth: number; branch: number | null (1–10); size: number; icon: NodeIconKey; status?: 'livre' | 'en_cours' | 'a_faire' }`
— issu de l'arbre (genesis → étapes → sous-étapes ; projet → éléments ; « Toi » → branches → skills).

### `Rhythm` (pur)
`{ dur, delay, ax, ay, rot }` déduits de `hash(id)` : stables d'une ouverture à l'autre.

### Réglage `theme`
`THEMES = ['system', 'light', 'dark', 'carbon']` (Zod, valeur par défaut inchangée `system`).
