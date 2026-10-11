# Data model — Conversation en panneau fixe (spec 027)

Aucune table ni migration. Un seul champ persistant : `chatPanelWidth` dans les réglages de l'app (une ligne de plus
dans la table `settings` existante, clé `ui.chatPanelWidth`, validée par Zod comme les autres réglages). Le reste vit dans l'interface, le temps de l'ouverture du canevas.

## SideTab (renderer, `canvas/side/sidePanelStore.ts`)

| Sorte | Champs | Notes |
|-------|--------|-------|
| `chat` | `key` (= `nodeId`), `nodeId`, `neuronId \| null`, `title`, `kindLabel`, `reader: TabReader \| null` | `neuronId` `null` : nœud sans conversation (document, livrable) ouvert pour son lecteur |
| `workflowChat` | `key` (= clé de la tâche), `nodeId`, `genesisId`, `title`, `reader: TabReader \| null` | neurone retrouvé ou créé par `workflow:chat` (requête existante) |
| `repo` | `key` (= `repo:<genesisId>`), `genesisId`, `title` | contenu : `RepoPanel` |

Règles :
- une clé = un onglet (ouvrir une clé déjà là l'affiche, ne la double pas) ;
- l'ordre est celui d'ouverture ; fermer l'onglet affiché affiche son voisin de droite, sinon de gauche ;
- `title` ≤ 200 caractères (affiché comme texte, jamais comme balisage).

## TabReader

`ReaderTarget` existant (`source`, `path`, `tab`) + selon la source : `deliverableNeuronId` (livrable),
`elementId` (élément), `genesisId` (Workflow), `document: DocumentView` (document, instantané de la vue).

## SidePanelState

| Champ | Type | Règle |
|-------|------|-------|
| `tabs` | `readonly SideTab[]` | vide → panneau masqué (FR-010) |
| `shownKey` | `string \| null` | toujours une clé de `tabs` ou `null` |
| `focus` | `{ nodeId, nonce } \| null` | demande « Centrer sur le nœud », consommée par le canevas |

Transitions : `openChat`, `openWorkflowChat`, `openReader`, `closeReader`, `openRepo`, `closeRepo`, `show`, `close`,
`closeMissing(nodeIds)`, `reset`, `requestFocus`. Toutes pures (testées), le magasin les applique.

## AppSettingsView (+1 champ)

| Champ | Type | Défaut | Validation (main) |
|-------|------|--------|-------------------|
| `chatPanelWidth` | entier (pourcentage de la largeur de l'écran Idées) | 38 | `z.number().int().min(25).max(55)` ; une valeur hors bornes lue en base retombe au défaut |
