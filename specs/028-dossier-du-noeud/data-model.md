# Data model — 028 Le dossier du nœud

Migrations Drizzle (`npm run db:generate`) + `down` écrit à la main : `0047_node_folders` (lot 1 : table `folders`,
colonne `documents.pinned`, reprise des documents) et `0048_folder_entries` (lot 2). Les documents sont une source
**calculée** depuis la table `documents` (research R11).

## `folders` (lot 1)

| Colonne | Type | Règle |
|---|---|---|
| `neuron_id` | text PK, FK `neurons.id` | nœud qui porte le dossier |
| `offset_x`, `offset_y` | real, défaut 0 | décalage par rapport à la place par défaut, bornés ±10 000 |
| `moved` | integer 0/1 | 1 dès un glissement par mentalyas ; « Réorganiser » ne remet que les 0 |
| `seen_at` | text null | dernière ouverture du dossier par mentalyas (« nouveau » : modifié par Claude après) |

## `documents.pinned` (lot 1)

`integer` défaut 0. La migration le met à 1 pour les documents vivants déplacés ou redimensionnés (offset ≠ 0 ou
taille ≠ 360 × 280) : ils restent affichés en cadre de lecture ; les autres passent dans le dossier.

## `folder_entries` (lot 2)

| Colonne | Type | Règle |
|---|---|---|
| `id` | text PK | UUID |
| `neuron_id` | text, FK `neurons.id` | nœud qui porte le dossier (genesis, étape, élément, neurone de conversation Workflow, idée) |
| `root` | text enum `project` \| `profile` | `project` : dossier du projet lié ; `profile` : `documents` du profil (document sans projet) |
| `path` | text | relatif, séparateur `/`, vérifié par `checkProjectPath` ; jamais absolu |
| `path_key` | text | `path` en minuscules (unicité sous Windows) |
| `source` | text enum `manual` \| `conversation` \| `covered` | `covered` : ligne seulement si masqué |
| `hidden` | integer 0/1 | fichier couvert « Ne plus afficher dans le dossier » |
| `added_by` | text enum `user` \| `claude` | |
| `created_at`, `updated_at` | text ISO | `updated_at` change à chaque nouvelle écriture de Claude |
| `deleted_at` | text null | retrait (annulable) |

Contraintes et index : `UNIQUE(neuron_id, root, path_key)` ; `folder_entries_neuron_idx(neuron_id)`.

## Vues (partagées, `src/shared/ipc/folders.ts`)

- `FolderFileView` : `{ path, name, kind: 'doc' | 'code' | 'other', source, documentId?, size, updatedAt, unseen,
  pinned, missing }` — jamais de chemin absolu.
- `FolderView` : `{ neuronId, files, counts: { docs, code, other }, truncated, unseen }`.
- `FolderBadge` (dans `IdeasCanvasView.folders`) : `{ neuronId, count, unseen, preview: FolderFileView[≤ 4], offset,
  moved }`.
- `IdeasCanvasView.documents` ne porte plus que les documents **épinglés**.

## Règles d'état

| Transition | Effet | Historique |
|---|---|---|
| document créé par Claude | ligne `document` + document, même transaction | un lot « par Claude » |
| écriture réussie en conversation | ligne `conversation` créée, ou `updated_at` mis à jour | un lot par tour |
| « + » ou glisser | ligne `manual` | un lot |
| retirer | `deleted_at` (document de Claude : document retiré, spec 012) | un lot |
| masquer (couvert) | ligne `covered` `hidden = 1` | un lot |
| épingler / désépingler | `pinned`, `pin_*` | un lot |
| ouvrir le dossier | `seen_at = now` (pas d'Historique) | — |

Priorité de fusion : `document > manual > conversation > covered` (une ligne par `path_key` à l'affichage). Tri :
documents d'abord, puis `updated_at` décroissant. « Nouveau » : `added_by = 'claude'` et `updated_at > seen_at`.
Plafond : 500 lignes vivantes par dossier.
