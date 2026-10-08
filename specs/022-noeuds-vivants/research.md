# Research — Nœuds vivants (spec 022)

## R1 — Où vit la carte de détails
- **Decision** : dans le `ViewportPortal` de React Flow (couche en coordonnées de la carte, transformée par le
  viewport). La carte se place à `nœud.x + demi-largeur + 18 + décalage`, en unités de la carte : elle suit son nœud et
  **subit le zoom** (D16) sans calcul par image. Classes `nodrag nopan nowheel` : glisser, défiler et taper dedans ne
  bougent pas la carte.
- **Rationale** : le prototype positionnait la carte à chaque image en coordonnées écran ; le portail le fait nativement.
- **Alternatives** : un type de nœud React Flow `detailCard` (entre dans la sélection, la physique, `onlyRenderVisibleElements`
  et l'IPC des positions : écarté) ; couche écran recalculée par `requestAnimationFrame` (inutile).

## R2 — Flottaison sans toucher aux positions
- **Decision** : un composant `LivingNode` enveloppe le contenu de chaque nœud (couche intérieure) avec une animation
  CSS (`drift`, `depth`) paramétrée par des variables issues d'un hachage stable de l'identifiant (`rhythm(id)`, pur,
  testé). Pause par l'attribut existant `data-drift` (`driftActive`) étendu : `paused` pendant une interaction ou dès
  qu'une carte est ouverte, `off` en animations réduites.
- **Rationale** : React Flow possède la `transform` du nœud ; l'ondulation sur une couche intérieure ne coûte rien à la
  physique ni au glisser ; 300 nœuds restent fluides (animation composée par le GPU).

## R3 — Glissements de 700 ms
- **Decision** : quand la disposition change (signature de disposition, « Réorganiser », repli), la surface reçoit
  `data-glide="on"` pendant 700 ms : `.react-flow__node { transition: transform 700ms var(--ease-soft) }`, jamais pendant
  un glisser (`.dragging` exclu) ; `off` en animations réduites.
- **Alternatives** : interpoler les positions dans React (setNodes par image : coûteux à 300 nœuds).

## R4 — Disposition en sens alterné pour les plans
- **Decision** : extraire l'algorithme alterné de `structureGraph.ts` (spec 017 D17) dans une fonction pure partagée
  `alternateLayout(tree, sizeOf, spacing)` (boîtes par sous-arbre, niveau pair → enfants en colonne, impair → en ligne,
  poussée des voisins). `planLayout.ts` l'utilise à la place des colonnes de gauche à droite ; les **décalages glissés**
  (spec 011 D7) et les **annexes** (documents sous leur nœud, spec 012 D4) sont conservés ; `structureGraph.ts` l'utilise
  aussi (DRY, deux usages réels). « Réorganiser » transpose (colonne ↔ ligne au premier niveau).
- **Rationale** : c'est l'organisation que mentalyas a montrée (capture de la carte de structure) et validée sur le
  prototype v6.

## R5 — Plusieurs cartes, une conversation par carte
- **Decision** : `uiStore` passe de `chatNeuronId` (un seul) à `cards: OpenCard[]` (identifiant, décalage, parties
  ouvertes, ordre d'empilement) et `activeCardId`. `ChatPanel` est rendu dans chaque carte dont la discussion est
  ouverte. Le main sait déjà mener plusieurs conversations : `ConversationService.live` est une `Map` par neurone
  (vérifié).
- Compatibilité : les appels `openChat(id)` existants (menu, import, Entrée) ouvrent la carte de `id` sur sa discussion ;
  `closeChat` ferme la discussion de la carte active.

## R6 — Main et agents (US5)
- **Decision** : la première discussion ouverte est le Main (dossier lié tel quel, branche courante). Une discussion
  ouverte en même temps sur un neurone **lié à un dépôt git** devient un agent : l'app crée, sur ce geste, la branche
  `agent/<id8>-<slug>` et un worktree `<dépôt>/.brainstormer/agents/<id8>` (même mécanique que l'Analyste :
  `branchName.ts`, `GitCli`, jonction `node_modules`), et la conversation tourne dans ce worktree. Fin : « Garder »
  (fusion dans la branche de base après affichage des commits et du diff) ou « Jeter » (worktree et branche supprimés).
  Neurone sans dépôt : agent « sans branche », signalé tel quel dans la note de rôle.
- **Constitution** : aujourd'hui seul l'Analyste peut créer branche et worktree. **Amendement 4.6.0 (MINOR) requis avant
  US5** : sur l'ouverture d'une discussion supplémentaire par mentalyas, l'app MAY créer une branche `agent/*` et son
  worktree dans le dépôt lié, et la fusionner sur « Garder » ; jamais de push, de réécriture d'historique ni de fusion
  automatique ; les commits dans le worktree sont des actions de Claude Code soumises au mode de permission (II).

## R7 — Style carbone
- **Decision** : nouveau thème **« Carbone »** dans le sélecteur (`THEMES` : `system`, `light`, `dark`, `carbon`) ; il
  n'enlève pas le thème sombre (D23). Jetons dans `tokens.css` (surfaces, liserés argentés, éclat) ; le liseré est un
  pseudo-élément masqué, l'éclat un `conic-gradient` animé par `@property --shine` (géré par Chromium d'Electron) ;
  React Flow reçoit `colorMode="dark"`. Canevas sobre pour tous les thèmes (points discrets, bords assombris).
- **Alternatives** : remplacer le thème sombre (retirerait un choix : contraire à D23).

## R8 — Pictogrammes
- **Decision** : `lucide-react` (ISC, aucune dépendance transitive, imports nommés donc seules les icônes utilisées sont
  embarquées) ; table `NODE_ICONS` (type de nœud → icône) dans un module unique ; icônes `aria-hidden`.

## R9 — Zoom fluide
- **Decision** : `zoomOnScroll={false}` et un hook `useSmoothZoom` : la molette fait évoluer une cible (zoom autour du
  pointeur, borné 0,2–2), une boucle `requestAnimationFrame` rapproche le viewport de la cible (amorti 0,14 par image,
  arrêt sous un seuil) par `setViewport` ; boutons +, −, tout afficher par `zoomTo` / `fitBounds` avec durée ;
  instantané en animations réduites. Le glisser du fond reste celui de React Flow.

## R10 — Hiérarchie visuelle
- **Decision** : `branchTone(tree)` (pur) donne à chaque nœud sa branche (enfant direct de la racine) et sa profondeur ;
  palette de 10 jetons `--branch-1…10` par thème ; tailles `NODE_SIZES` par profondeur (orbe selon maturité, puis 58, 44,
  36, 30) ; pastille de statut avec libellé accessible.

## R11 — Repli des sous-nœuds
- **Decision** (amendée le 2026-10-09) : nouvelle colonne `neurons.plan_folded` (booléen, défaut faux) pour les étapes et
  les genesis, migration `0037_plan_fold` (+ down qui la retire) ; la colonne `collapsed` (éléments de structure, défaut
  vrai) n'est pas réutilisée, pour ne pas réécrire les données existantes. IPC `plan:setCollapsed` (Zod). Arbre de
  skills : la grappe de plugins garde son repli actuel.

## R12 — Lecteur dans la carte
- **Decision** : le lecteur réutilise `FileViewer` (livrables : différence et contenu), `CodeLines` (fichiers liés d'un
  élément) et le rendu Markdown existant (documents, SKILL.md) ; il remplace la discussion dans l'étirement de droite
  (D18). Aucun nouveau canal de lecture de fichier.
