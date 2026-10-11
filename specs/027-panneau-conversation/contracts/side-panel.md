# Contrat d'interface — panneau de droite (spec 027)

Contrat interne au renderer : ce que les autres parties de l'interface appellent, et ce que le panneau garantit.
Un seul canal IPC touché : `app:setSettings` (existant), qui accepte en plus `chatPanelWidth`.

## Magasin `sidePanelStore`

| Appel | Effet |
|-------|-------|
| `openChat({ nodeId, neuronId, title, kindLabel })` | ajoute l'onglet `chat` du nœud s'il manque, l'affiche ; s'il a un lecteur ouvert, le garde |
| `openWorkflowChat({ nodeId, genesisId, title })` | idem pour une tâche Workflow (la consigne préparée reste dans `uiStore.chatDrafts[nodeId]`) |
| `openReader(tabInput, reader)` | ouvre (ou affiche) l'onglet du nœud sur ce fichier |
| `closeReader(key)` | revient à la conversation ; un onglet sans conversation se ferme |
| `openRepo(genesisId)` / `closeRepo()` | onglet « ⎇ Dépôt » ; `closeRepo` ferme l'onglet Dépôt ouvert |
| `show(key)` / `close(key)` | affiche / ferme un onglet ; fermer n'interrompt aucun tour |
| `closeMissing(existing: ReadonlySet<string>)` | ferme les onglets `chat` dont le nœud n'existe plus |
| `reset()` | vide le panneau (changement de canevas) |
| `requestFocus(nodeId)` | dépose une demande de centrage (nonce nouveau à chaque appel) |

Sélecteurs utilisés hors du panneau : `shownNodeId` (anneau de `LivingNode`), `focus` (canevas), `repoGenesisId`
(façade `uiStore`).

## Façades conservées (`uiStore`)

`openChat(neuronId)`, `navigate({ diveRootId })`, `openViewer(neuronId, path)`, `openRepo`, `closeRepo`,
`repoGenesisId` gardent leur signature et passent par `sidePanelStore` (titre et sorte lus dans la vue du canevas en
cache ; à défaut « Conversation »).

## Composants

| Composant | Contrat |
|-----------|---------|
| `SidePanel` | `aside` « Panneau de droite » ; rien quand `tabs` est vide ; largeur = `chatPanelWidth` % (surimpression sous 1 100 px) ; poignée `separator` (souris, ←/→ par 2 %) |
| `SideTabs` | `tablist` « Onglets du panneau » ; un `tab` par onglet : titre, « ● Claude écrit », « ⏸ attend ton accord » (texte caché lisible) ; × « Fermer l'onglet « titre » » |
| `ChatTabContent` | en-tête : titre, sorte, « Centrer sur le nœud » ; puis `ChatPanel` (inchangé) ou le lecteur avec « ← Conversation » |
| `WorkflowChatTabContent` | requête `workflow:chat` existante, puis `ChatPanel` avec `draftKey = nodeId` |
| `RepoPanel` | inchangé dans son contenu ; sans enveloppe de largeur ; son ✕ ferme l'onglet |
| `DetailCard` | plus de prop `side` ; « Discuter » appelle `onChat` ; « Discuter » a `aria-pressed` quand l'onglet du nœud est affiché |
| `LivingNode` | `data-chat="true"` quand son nœud (ou `chatId`) est celui de l'onglet affiché |

## Réglages

`AppSettingsView.chatPanelWidth: number` (25–55, défaut 38) ; `AppSettingsPatch` l'accepte ; le main le valide
(`SettingsPatch` Zod) et `AppSettingsRepository` ramène une valeur invalide au défaut.
