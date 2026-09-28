# Research — 003 Interface MVP-1 « Brainstormer » (v2)

> Remplace la recherche v1 (liste / revue / organigramme dagre). S'appuie sur 001 et 002.

## R1 — Fenêtres, raccourci, zone de notification, démarrage (inchangé v1)
- Fenêtre de **capture pré-chargée et cachée** (frameless, alwaysOnTop, écran du curseur) ; fenêtre principale créée à la demande et cachée à la fermeture ; deux preloads distincts (moindre privilège) ; `globalShortcut` ; fermeture `blur()` + `hide()` pour rendre le focus ; `Tray` ; `setLoginItemSettings` + `--hidden` ; instance unique.

## R2 — Rendu de la carte neuronale
- **Décision** : **React Flow** (`@xyflow/react`) comme toile (déplacement, zoom, arêtes, sélection, navigation clavier, rendu limité aux éléments visibles) avec **nœuds personnalisés circulaires** (brut / en développement / éclos / sous-neurone / extension « + ») et **arêtes personnalisées** (libellé, pointillés pour les suggestions).
- **Positions** :
  - Incubateur et réseau : **`d3-force`** (simulation physique douce : répulsion, attraction des liens, contrainte de zone gauche/droite) ; positions stabilisées puis mémorisées (`pos_x/pos_y`, 002) ; la **dérive** des bruts = faible bruit appliqué à la simulation, suspendu pendant l'interaction.
  - Plongée : **disposition radiale** calculée (neurone centré, enfants répartis sur un arc, parent estompé à gauche) — quelques lignes de géométrie, pas de bibliothèque.
- **Rationale** : React Flow apporte l'accessibilité et la performance ; `d3-force` donne l'aspect organique des maquettes (dagre, pensé pour des organigrammes hiérarchiques, est abandonné).
- **Alternatives** : SVG maison + `d3-zoom` (contrôle total mais accessibilité et virtualisation à refaire) ; Cytoscape (lourd, style moins libre).

## R3 — Animations
- **Décision** : **Motion** (`motion`, ex-Framer Motion) pour les animations de nœuds : pousse (échelle + opacité, 250 ms), halo (pulsation), suggestion (150 ms), **fusion** (les sous-neurones interpolent leur position vers le centre du parent + réduction d'échelle, 600–800 ms, puis changement d'aspect) et **migration** (interpolation de la position incubateur → réseau, ~600 ms), plongée (transition de la vue React Flow `setViewport` avec durée 400 ms).
- **Accessibilité** : hook `useReducedMotionPreference()` = préférence système (`prefers-reduced-motion`) **ou** réglage de l'app ; en mode réduit : durées 0 ou fondus ≤ 150 ms, dérive coupée, halo statique. `MotionConfig reducedMotion` positionné globalement.
- **Risque** : animer des positions de nœuds React Flow avec Motion — **spike** en tout début de US4 (T0xx) pour valider l'approche (valeurs Motion → positions de nœuds à chaque frame), avec repli : animation des nœuds en overlay SVG pendant la fusion puis remplacement.

## R4 — État côté interface (inchangé v1)
- TanStack Query pour les données IPC (invalidation sur événements `neuron:*`, `synthesis:*`, `links:*`) ; Zustand pour l'état d'interface (zone, neurone plongé, pile du fil d'Ariane, filtres) ; React Hook Form + Zod pour les formulaires ; navigation par état (pas de routeur).

## R5 — Aperçu de synthèse éditable
- **Décision** : l'aperçu lit `SynthesisView` (002) ; l'édition d'un élément appelle une mise à jour de la synthèse **proposée** (payload modifié côté main, revalidé : contrôles P1–P6 / S1) avant confirmation ; pas d'édition directe des tables de résultat avant `fusion:confirm`.
- **Nouveau canal** : `fusion:editProposed { synthesisId, patch }` (ajout à l'IPC de 002, implémenté ici).

## R6 — Annulation par lot
- **Décision** : `HistoryService` rejoue `change_log` à l'envers par `batch_id` dans une transaction ; contrôle de conflit (état actuel = `after_json` du lot) ; annuler une fusion : racine → `developing`, plan/synthèse du lot → `is_current = 0`, synthèse → `proposed` si l'arbre n'a pas changé, sinon `stale` ; exemple positif retiré (001).

## R7 — Export Markdown
- **Décision** : générateur pur `renderNeuronMarkdown(tree, result, links)` (titres, nature, catégorie, arbre questions/réponses en listes imbriquées, plan en cases à cocher avec conditions et dépendances, ou synthèse en sections, liens) ; écriture **dans le main** après `dialog.showSaveDialog` (le renderer ne touche pas au disque) ; nom de fichier assaini ; UTF-8.
- **Rationale** : lisible par Claude Code, `/brainstorm`, Obsidian, NotebookLM.

## R8 — Tests d'accessibilité
- **Décision** : `@testing-library/react` + `jsdom` + **`axe-core`** appelé directement (petite assertion maison `expectNoAxeViolations`) ; `vitest-axe` écarté (dernière version 0.1, non maintenue).

## Dépendances annoncées (à valider avant installation — T001)
| Paquet | Version | Rôle |
|--------|---------|------|
| `@xyflow/react` | 12.12 | Toile, nœuds, arêtes, zoom, clavier |
| `d3-force` (+ `@types/d3-force`) | 3.0 | Disposition organique incubateur/réseau |
| `motion` | 13.4 | Animations (pousse, fusion, migration, halo) |
| `zustand` | 5.0 | État d'interface |
| `@tanstack/react-query` | 5.104 | Données IPC |
| `react-hook-form` + `@hookform/resolvers` | 7.89 / 5.9 | Formulaires validés Zod |
| `@testing-library/react`, `jsdom`, `axe-core` | 16.3 / 30.1 / 4.13 | Tests de composants et d'accessibilité |
