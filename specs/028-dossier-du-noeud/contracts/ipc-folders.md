# Contrat IPC — dossiers des nœuds (spec 028)

Format uniforme `{ success, data } | { success: false, error: { code, message } }` ; chaque entrée validée par Zod
stricte dans le main (`src/main/ipc/folderHandlers.ts`) ; chemins relatifs ≤ 512 caractères, revérifiés par
`checkProjectPath` + `realpath` sous la racine avant toute lecture. Le chemin absolu ne quitte jamais le main.

| Canal | Entrée | Sortie | Erreurs |
|---|---|---|---|
| `folder:list` | `{ neuronId: uuid }` | `FolderView` | `NOT_FOUND` |
| `folder:file` | `{ neuronId: uuid, path }` | contenu texte (≤ 1 Mo) + langue, comme `structure:file` | `NOT_FOUND`, `NOT_IN_FOLDER`, `SECRET_FILE`, `TOO_LARGE`, `INVALID_STATE` (binaire) |
| `folder:add` | `{ neuronId: uuid, path }` | `{ batchId: string \| null }` (`null` : déjà rangé) | `VALIDATION` (« Seuls les fichiers du projet peuvent être rangés »), `NO_PROJECT`, `NOT_FOUND` |
| `folder:pickFile` | `{ neuronId: uuid }` | `{ batchId: string \| null } \| null` (sélecteur natif ouvert dans le dossier du projet ; `null` : annulé) | idem `folder:add` |
| `folder:remove` | `{ neuronId, path }` | `{ batchId }` | `NOT_FOUND`, `NOT_IN_FOLDER` |
| `folder:hide` / `folder:unhide` | `{ neuronId, path }` | `{ batchId }` | idem ; fichiers couverts seulement |
| `folder:pin` | `{ neuronId, path, x?, y?, w?, h? }` (bornés) | `{ batchId }` | `NOT_IN_FOLDER` |
| `folder:unpin` | `{ neuronId, path }` | `{ batchId }` | idem |
| `folder:copyTo` | `{ fromNeuronId, toNeuronId, path }` | `{ batchId: string \| null }` | `OTHER_PROJECT`, `NOT_FOUND` |
| `folder:openInEditor` | `{ neuronId, path }` | `{ ok: true }` | mêmes gardes ; éditeur réglé (spec 013 D4) |
| `folder:markSeen` | `{ neuronId }` | `{ ok: true }` | `NOT_FOUND` |
| `folder:move` | `{ neuronId, x, y }` (±10 000) | `{ ok: true }` | `NOT_FOUND` |

Diffusion main → interface : `folder:changed` `{ neuronId }` (liste blanche des évènements de la fenêtre principale).

« Demander à Claude de le compléter » n'a pas de canal : l'interface prépare la consigne dans l'onglet du nœud
(`seedChatDraft`), rien n'est envoyé sans geste (spec 023 D6).

`canvas:get` : `IdeasCanvasView.folders: FolderBadge[]` (nouveau) ; `documents` ne porte plus que les épinglés.
