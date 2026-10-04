# Data Model — Spec 007 Pont MCP

Migration `0017_map_primitives` (+ `migrations/down/0017_map_primitives.down.sql`).

## canvas_blocks (modifiée)
| Colonne | Type | Règle |
|---------|------|-------|
| `kind` | + `note`, `frame` | `note` : titre + texte ; `frame` : titre, regroupe |
| `title` | text null | ≤ 200 caractères ; requis pour `note` (posée par Claude) et `frame` |
| `parent_block_id` | text null → `canvas_blocks.id` | arbre de notes ; jamais sur un `frame` ; pas de cycle |
| `frame_id` | text null → `canvas_blocks.id` (kind `frame`) | cadre englobant |
| `origin` | text `user` \| `claude`, défaut `user` | affiché « par Claude » |
| `text` | (existante) | ≤ 20 000 caractères pour une note |
Index : `canvas_blocks_parent_idx`, `canvas_blocks_frame_idx`.

## map_links (nouvelle)
| Colonne | Type | Règle |
|---------|------|-------|
| `id` | text PK | UUID |
| `from_kind`, `to_kind` | text `block` \| `idea` | |
| `from_id`, `to_id` | text | élément visible (bloc non supprimé / idée non archivée) |
| `label` | text null | ≤ 80 |
| `origin` | text `user` \| `claude` | |
| `created_at` | text | ISO |
| `deleted_at` | text null | retrait annulable |
Contraintes : pas d'auto-lien ; unicité de la paire non orientée parmi les liens non supprimés (vérifiée par le
service). Index : `map_links_from_idx (from_kind, from_id)`, `map_links_to_idx (to_kind, to_id)`.

## neurons (modifiée)
- `origin` : + `claude` (valeur TS ; colonne texte). Idée créée par `dessiner` : `kind: root`, `state: raw`,
  `pos_x/pos_y` du placement, `pinned: true`.

## change_log (modifiée)
- `actor` text `user` \| `claude`, défaut `user`.
- `kind` : + `mcp_write` (annulable).
- Entités nouvelles : `map_link` (présence, `{label}`), `block_text` (`{title, text}`), `neuron_text`
  (`{title, content}`). `canvas_block` et `neuron` (présence) déjà gérés.

## Vues (shared)
- `BlockView` : + `title`, `parentBlockId`, `frameId`, `origin`.
- `IdeasCanvasView` : + `mapLinks: MapLinkView[]` (`id`, `from {kind,id}`, `to {kind,id}`, `label`, `origin`).
- `CanvasNeuronView` : + `origin`.

## Transitions
- Élément créé par Claude → visible ; `retirer` → archivé/supprimé doux ; annulation → visible à nouveau.
- Lien libre : créé → `deleted_at` posé (retrait, ou extrémité retirée dans le même lot) → restauré par annulation.
- Retirer un cadre retire ses éléments ; retirer un élément retire ses liens libres (même lot).

## Mémoire (non persistée)
- `SelectionStore` : ids sélectionnés (blocs et idées), remplacés à chaque `map:selection`.
