# Contrats — 012 Documents

## Outils MCP (appelant = conversation d'un neurone ; cible dans son arbre)
### `document_ecrire` (writes : oui — « par Claude », annulable)
```
{ id?: Id,              // neurone de rattachement (défaut : celui de la conversation) — création
  document?: Id,        // document existant de l'arbre — réécriture / ajout
  titre: string(1..120),
  contenu: string(1..500 Ko),
  mode?: 'remplacer' | 'ajouter' }   // défaut 'remplacer' ; 'ajouter' = à la fin, séparé d'une ligne vide
```
Réponse : « Document « Titre » écrit (docs/brainstormer/titre.md) — annulable par mentalyas ». Refus : `INTROUVABLE`,
`NON_MODIFIABLE` (autre arbre, document retiré), `LOT_TROP_GROS` (> 500 Ko), `ERREUR_INTERNE` (dossier inaccessible :
message explicite).

### `document_lire` (writes : non)
```
{ document: Id }   // renvoie titre, emplacement relatif, contenu actuel du fichier
```

### Changements
- `neurone_contexte` : liste « Documents : - « Titre » [id] (docs/brainstormer/x.md) ».
- `MCP_INSTRUCTIONS` + cadre des conversations : « Un document détaillé d'un neurone = `document_ecrire` ; titres
  Markdown, pas de HTML ; ne recopie pas la conversation. »

## IPC renderer ↔ main
| Canal | Entrée | Sortie / effet |
|---|---|---|
| `canvas:get` | (existant) | `documents: DocumentView[]` = `{ id, neuronId, genesisId, title, fileLabel, width, height, origin }` |
| `document:get` | `{ id: uuid }` | `{ id, content, hash, missing: boolean }` (lit le fichier ; version `externe` si changé) |
| `document:save` | `{ id, content ≤ 500 Ko, baseHash, force?: boolean }` | `{ hash }` ou erreur `CONFLICT` `{ details: { content, hash } }` ; lot `document` |
| `document:resize` | `{ id, width, height }` (bornes) | `{ ok: true }` |
| `document:recreate` | `{ id }` | réécrit le fichier depuis la dernière version |
| `document:remove` | `{ id }` | `{ batchId }` ; retire le nœud, laisse le fichier |
| `document:reveal` | `{ id }` | montre le fichier dans l'Explorateur (`shell.showItemInFolder`, chemin résolu par le main) |
Événement : `document:changed` `{ id }` (fichier modifié sur le disque).
