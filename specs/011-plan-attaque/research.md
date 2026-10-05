# Research — 011 Plan d'attaque

## R1 — Les étapes sont des neurones (`kind = 'step'`)
- **Décision** : une étape est une ligne de `neurons` (`kind = 'step'`, `parent_id`, `depth`, `genesis_id` = genesis de
  l'arbre), avec trois colonnes nouvelles : `rank`, `step_status`, et pour tout neurone `locked_at` / `lock_proposed_at`.
- **Pourquoi** : une étape a déjà tout ce qu'a un neurone (conversation `session_id`, fiche `sheet_json`, modèle,
  historique `neuron_sheet`, place sur la carte). La conversation, la fiche et l'Historique marchent sans rien dupliquer.
- **Conséquence** : `genesis_id` ne signifie plus « élément de structure » ; l'élément se reconnaît à `kind = 'element'`
  (ou `element_type` non nul). À corriger : `ConversationService` (rôle, contexte, modèle, dossier),
  `ElementRepository.list/views` (filtrer `kind = 'element'`), `NeuronTools.treeOf` (inchangé : `genesisId ?? rootId`).
- **Écartées** : table `plan_steps` séparée (doublonne conversation et fiche) ; réutiliser les éléments de spec 009
  (clés de fichiers, statuts et types d'un projet logiciel — autre sémantique).

## R2 — Propositions hors des données de mentalyas
- **Décision** : tables `plan_proposals` (parent, statut) et `plan_proposal_items` (titre, pourquoi, rang, dépendances
  par clé locale, statut). Une nouvelle proposition pour le même parent remplace les items encore en attente.
  Les refus restent en table (titre normalisé) : un item refusé n'est pas reproposé tel quel au même parent.
- **Pourquoi** : constitution II — une proposition n'écrit rien avant acceptation ; l'Historique ne contient que ce que
  mentalyas a accepté.
- **Écartée** : neurones « fantômes » en `state = 'proposed'` (polluent toutes les lectures de neurones).

## R3 — Dépendances
- **Décision** : table `step_dependencies (step_id, waits_for_id)`, entre frères uniquement, refus des cycles (parcours
  en profondeur, pur, dans `domain/plan`).
- **Écartée** : `map_links` avec une relation `attend` — les liens libres sont annulables un par un et dessinables
  n'importe où ; une dépendance est une règle d'ordre, pas un trait libre.

## R4 — Disposition déterministe « arbre gauche → droite »
- **Décision** : fonction pure `planLayout(genesisCenter, steps, ghosts)` côté interface (comme `structureGraph`) :
  colonne = profondeur (`x = genesis.x + 220 + (depth − 1) × 300`), ordre vertical = rang ; chaque sous-arbre occupe la
  hauteur de ses descendants (arbre « tidy ») ; un parent est centré sur ses enfants ; les fantômes sont placés comme
  des enfants supplémentaires, après les existants.
- **Incrémental** : la fonction ne dépend que de l'arbre (pas des positions précédentes) ; ajouter un nœud n'agrandit
  que la hauteur de sa branche, donc seuls les nœuds situés en dessous dans les colonnes concernées bougent (FR-006).
  Le déplacement est animé par une transition CSS de 250 ms sur la position (coupée en « réduire les animations »).
- **Ordre et dépendances** : le rang est la seule source de l'ordre ; toute écriture de rang (proposition, glisser)
  est refusée si elle place une étape avant une étape qu'elle attend (contrôle pur `respectsDependencies`).
- **Coexistence avec la carte de structure (spec 009)** : le plan se place au-dessus de la structure — son bas est
  aligné 48 px au-dessus du haut du bloc de structure du même genesis ; sans structure, il est centré verticalement
  sur le genesis.
- **Avec la physique des idées** : le plan entier compte comme un corps rectangulaire (approché par son cercle
  englobant) relié au genesis par un ressort rigide à décalage fixe ; les autres idées s'écartent, le plan suit son
  genesis.
- **Écartées** : dagre / elk (dépendance externe, non incrémentale par défaut) ; physique pour les étapes (instable,
  contraire à « stable d'une ouverture à l'autre »).

## R5 — Verrou
- **Décision** : `locked_at` (date) ; `lock_proposed_at` posé par l'outil MCP `verrou_proposer`. Garde unique
  `assertUnlocked(neuron)` appelée par : `NeuronTools.writeSheet` / `evaluate`, `MapService` (`noeud_modifier` sur une
  idée ou une étape), `NeuronService.update` (titre, description). Restent permis : position, statut d'avancement,
  catégorie et nature, ajout de sous-nœuds, conversation (D5).
- **D6** : `plan:decide` verrouille le parent dans le même lot que les naissances. L'annulation d'un lot qui
  déverrouillerait un nœud est refusée si ce nœud garde des enfants vivants hors de ce lot (contrôle dans
  `HistoryService.undo`, message « ses sous-nœuds s'appuient sur ce contexte »).
- **D5** : le bloc de contexte du chat dit « nœud verrouillé : n'écris plus dans ce nœud » ; les écritures sont de
  toute façon refusées par la garde (`NON_MODIFIABLE`).

## R6 — Contexte hérité d'une étape
- **Décision** : `contextBlock` reçoit `path: { title, sheet }[]` (genesis → parent) en plus du nœud ; borné par
  `CONTEXT_MAX_CHARS` (troncature des fiches les plus anciennes d'abord, le genesis gardé). Modèle par défaut d'une
  étape : celui des éléments (Sonnet 5.5, spec 010 D3).

## R7 — Visuels
- **Décision** : nouveau nœud React Flow `plan` (carte arrondie : étape 240 × 72, sous-étape 200 × 52) ; tokens
  existants (`--cat` mêlé à `--color-surface` à 35 % / 20 % via `color-mix`), pastille de rang (①…, ①.1 en texte
  pour les niveaux 2+), anneau de statut (couleurs d'état existantes), cadenas SVG inline ; fantôme : bordure
  pointillée, opacité 0,5, boutons ✓ / ✗ de 32 px (Fitts). Le genesis garde l'hexagone ; l'anneau de maturité réutilise
  `contextLevel`. Aucune dépendance nouvelle.
