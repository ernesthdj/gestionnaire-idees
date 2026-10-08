# Interfaces — Nœuds vivants (spec 022)

Format IPC uniforme `{ success, data } | { success: false, error: { code, message } }` ; chaque payload validé par Zod
dans le main (constitution I).

## IPC nouveaux

| Canal | Entrée (Zod) | Sortie | Notes |
|---|---|---|---|
| `plan:setCollapsed` | `{ neuronId: uuid, collapsed: boolean }` | `{ ok: true }` | Étape ou genesis seulement (sinon `NOT_FOUND`) ; non historisé (préférence d'affichage, comme `element:setCollapsed`) |
| `agent:open` (US5) | `{ neuronId: uuid }` | `AgentSessionView` | Crée la session ; rôle `main` s'il n'y a pas de Main actif, sinon `agent` (branche + worktree si dépôt lié) |
| `agent:list` (US5) | `{}` | `AgentSessionView[]` | Sessions `active` |
| `agent:keep` (US5) | `{ sessionId: uuid }` | `{ merged: boolean, commits: number }` | Après affichage commits + diff ; refuse s'il y a un conflit (message clair, rien fusionné) |
| `agent:discard` (US5) | `{ sessionId: uuid }` | `{ ok: true }` | Arrête la conversation, supprime worktree et branche |
| `agent:end` (US5) | `{ sessionId: uuid }` | `{ ok: true }` | Discussion fermée sans décision : session `ended`, worktree conservé |

`AgentSessionView = { id, neuronId, role: 'main' | 'agent', branch: string | null, baseBranch: string | null, status }`
— jamais de chemin absolu personnel affiché hors du dossier choisi par mentalyas.

## IPC modifiés
- Réglages : `theme` accepte `'carbon'`.
- `chat:*` : une conversation d'agent démarre avec le worktree comme dossier de travail (résolu par le main depuis la
  session, jamais fourni par le renderer).

## Composants (renderer)

| Module | Contrat |
|---|---|
| `canvas/living/rhythm.ts` | `rhythm(id: string): Rhythm` — pur, déterministe |
| `canvas/living/LivingNode.tsx` | `<LivingNode id visual>{contenu}</LivingNode>` : couche flottante + taille, couleur de branche, pastille |
| `canvas/living/nodeVisual.ts` | `nodeVisuals(tree): Map<id, NodeVisual>` — pur (profondeur, branche, taille, icône, statut) |
| `canvas/living/icons.ts` | `NODE_ICONS: Record<NodeIconKey, LucideIcon>` |
| `canvas/layout/alternateLayout.ts` | `alternateLayout(tree, sizeOf, spacing, { transposed }): Map<id, Point>` — pur, sans chevauchement |
| `canvas/cards/DetailCard.tsx` | Carte (en-tête déplaçable, jauge, liés, fichiers, actions, étirements) dans le `ViewportPortal` |
| `canvas/cards/cardsStore.ts` | `openCard`, `closeCard`, `activate`, `moveCard`, `setSide`, `toggleSheet`, `closeAll` (règles du data-model) |
| `canvas/useSmoothZoom.ts` | molette et boutons avec amorti ; instantané en animations réduites |
| `canvas/useGlide.ts` | `data-glide` pendant 700 ms après un changement de disposition |
