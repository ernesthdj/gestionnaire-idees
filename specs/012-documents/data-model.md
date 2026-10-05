# Data model — 012 Documents

Migration `0023_documents` (+ `down/0023_documents.down.sql`).

## `documents`
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | |
| `neuron_id` | text FK neurons | Neurone de rattachement (genesis ou étape). |
| `genesis_id` | text FK neurons | Genesis de l'arbre (choix du dossier, visibilité). |
| `title` | text | 1..120 caractères. |
| `folder` | text | `project` (dossier `docs/brainstormer/` du projet lié) ou `profile` (`documents/` du profil). |
| `file_name` | text | Nom assaini, unique dans son dossier ; jamais de séparateur. |
| `width` / `height` | real | Taille du cadre (bornes 280×160 → 1200×1600). |
| `origin` | text | `user` · `claude`. |
| `current_version_id` | text, null | Version reflétée par le fichier. |
| `created_at` | text | |
| `deleted_at` | text, null | Retiré de la carte (fichier laissé en place, ou mis en corbeille si création annulée). |
Index : `(neuron_id)`, `(genesis_id)`.

## `document_versions`
| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | |
| `document_id` | text FK | |
| `content` | text | Markdown complet, ≤ 500 Ko. |
| `hash` | text | SHA-256 du contenu (détection des modifications extérieures). |
| `author` | text | `user` · `claude` · `externe`. |
| `created_at` | text | |
Index : `(document_id)`.

## Historique (`change_log`)
| Entité | Avant / après | Annulation |
|---|---|---|
| `document` | `null` ↔ `{ title }` | retire le document (fichier → corbeille) / le rétablit (fichier remis ou recréé) |
| `document_version` | `{ versionId }` | réécrit le fichier avec la version visée |
| `document_size` | — | non historisée (comme la place d'un nœud) |
Kind ajouté : `document` (écriture de mentalyas, annulable). Claude : `mcp_write`.

## Transitions
- Création : document + version 1 (`claude` ou `user`) + fichier écrit ; lot annulable.
- Réécriture / ajout : nouvelle version + fichier réécrit ; lot annulable.
- Lecture avec fichier modifié ailleurs : version `externe` (sans lot).
- Retrait par mentalyas : `deleted_at` posé, fichier laissé ; lot annulable.
