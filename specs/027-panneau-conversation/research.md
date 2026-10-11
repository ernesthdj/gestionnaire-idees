# Research — Conversation en panneau fixe (spec 027)

Lecture du code existant (2026-10-11) : `canvas/cards/{DetailCard, IdeaCards, cardsStore}.tsx|ts`,
`canvas/workflow/WorkflowCard.tsx`, `pages/IdeasPage.tsx`, `git/RepoPanel.tsx`, `app/{uiStore, useMainEvents}.ts`,
`chat/{ChatPanel, waitingChats}.ts(x)`, `canvas/workflow/runningChats.ts`, `canvas/living/LivingNode.tsx`,
`shared/ipc/app.ts`, `main/ipc/appHandlers.ts`.

## R1 — Où vit le panneau

- **Decision** : un composant `SidePanel` posé dans `IdeasPage`, à côté de la carte, à la place actuelle de
  `RepoPanel` ; son état dans un magasin zustand `sidePanelStore` (renderer).
- **Rationale** : hors de la couche de la carte (FR-001), il survit à la vue de résolution des conflits, qui remplace la
  carte (spec 021 US4, scénario US4.3). `ChatPanel`, `RepoPanel` et les lecteurs sont autonomes (ils lisent leurs
  données par leurs propres requêtes) : aucun ne dépend du contexte React Flow.
- **Alternatives** : portail React depuis `IdeasCanvas` vers un emplacement de la page (garde le contexte React Flow
  pour centrer, mais le panneau disparaîtrait avec la carte pendant une résolution de conflit) ; panneau dans
  `ViewportPortal` à position fixe (resterait soumis au zoom).

## R2 — Modèle d'un onglet

- **Decision** : union `SideTab` à trois sortes, une seule clé par onglet (`nodeId`, id du nœud de la carte, ou
  `repo:<genesisId>`) :
  - `chat` : nœud d'idée, d'étape, d'élément, de livrable… (`nodeId`, `neuronId`, titre, sorte), avec un lecteur
    facultatif (`reader`) ;
  - `workflowChat` : tâche de la vue Workflow (`nodeId` = clé de la tâche, `genesisId`, titre) ; son neurone de
    conversation est retrouvé ou créé par la requête existante `workflow:chat` (clé `['workflow-chat', key]`) ;
  - `repo` : volet Dépôt d'un genesis.
- **Rationale** : reprend tel quel ce que la carte sait aujourd'hui (`IdeaCards` : `neuronIdOf(subject)`,
  `WorkflowCard` : requête `workflow:chat`), sans nouvelle donnée.
- **Alternatives** : onglet = carte ouverte (lierait la vie de l'onglet à celle de la carte, contraire à FR-004).

## R3 — Lecteur de fichiers dans un onglet

- **Decision** : `ReaderTarget` (existant) étendu de ce dont chaque lecteur a besoin : `deliverableNeuronId` pour
  `FileViewer`, `elementId` pour `ElementFileReader`, `genesisId` pour `WorkflowFileReader`, un instantané
  `DocumentView` pour `DocumentReader`. Le lecteur remplace la conversation dans l'onglet ; « ← Conversation » revient.
- **Rationale** : les lecteurs ont déjà ces props ; un nœud sans conversation (document, livrable) ouvre un onglet
  `chat` dont `neuronId` vaut `null` (lecteur seul, onglet fermé au « ✕ » du lecteur).
- **Alternatives** : une sorte d'onglet `reader` à part (doublerait les onglets d'un même nœud, contraire à FR-003).

## R4 — Ce que perd la carte de détails

- **Decision** : `OpenCard.side` et `OpenCard.reader` sont retirés de `cardsStore` ; `DetailCard` perd la prop `side` ;
  « Discuter » et les boutons de lecture appellent `sidePanelStore.openChat(...)` / `openReader(...)`. Les appels qui
  ouvraient une carte sur sa discussion (`uiStore.openChat`, `navigate` « plonger maintenant », `openViewer`,
  `discussWorkflow`, `NewBrainstorm`) ouvrent l'onglet (et la carte du nœud, pour garder son contexte).
- **Rationale** : une seule source de vérité de « quelle conversation est ouverte » (DRY) ; l'épingle ne sert plus qu'à
  garder une carte ouverte (amende spec 022 D28).

## R5 — Centrer sur le nœud (et changer de vue)

- **Decision** : le panneau dépose une demande `focus = { nodeId, nonce }` dans `sidePanelStore` ; `IdeasCanvas` la
  lit (effet) : si le nœud est dans la carte affichée, `flow.setCenter` sur son centre avec la durée `timingFor('dive')`
  (0 si animations réduites) ; sinon, il cherche sa vue (étape : `step.view` ; élément : Progression ; tâche Workflow :
  Workflow), appelle `setStructureView`, puis centre au rendu suivant. Nœud introuvable : notification « Ce nœud
  n'est plus sur la carte ».
- **Rationale** : le panneau reste hors du contexte React Flow (R1) ; le canevas garde la main sur sa vue.
- **Alternatives** : exposer l'instance React Flow dans un magasin global (couplage, fuite d'objet mutable).

## R6 — Anneau « conversation ouverte »

- **Decision** : `LivingNode` lit `sidePanelStore` (`shownNodeId === id`, ou `chatId` pour Workflow) et pose
  `data-chat="true"` sur sa couche ; CSS : anneau `--color-accent` hors du cercle, distinct de l'état « carte ouverte »
  (`data-open`), du statut et de la pastille « ⏸ ».
- **Rationale** : même mécanisme que la pastille « attend ton accord » (audit du 11/10) ; un seul composant pour toutes
  les sortes de nœuds.

## R7 — Indicateurs d'onglet

- **Decision** : « Claude écrit » = `useRunningChats` ; « ⏸ » = `useWaitingChats`. `watchRunningChats()` passe de
  `useWorkflow` à `useMainEvents` (écoute unique pour toute l'app ; aujourd'hui active seulement si une vue Workflow
  est montée).
- **Rationale** : les deux magasins existent et sont testés ; l'écoute globale évite un indicateur muet hors Workflow.

## R8 — Largeur mémorisée

- **Decision** : nouveau réglage `chatPanelWidth` (entier 25–55, défaut 38) dans `AppSettingsView`, écrit par le canal
  existant `app:setSettings` (schéma Zod du main borné), au lâcher de la poignée ou après 400 ms sans touche ←/→.
- **Rationale** : les préférences de l'interface vivent déjà dans les réglages de l'app (thème, animations) ; le
  renderer n'utilise aucun stockage local ; pas de canal nouveau (FR-015).
- **Alternatives** : `localStorage` (deuxième mécanisme de préférences, non validé) ; état de vue du brainstorm (la
  largeur n'est pas propre à un canevas).

## R9 — Échap et focus

- **Decision** : dans le panneau, Échap : (1) `ChatPanel` interrompt un tour en cours (inchangé) ; (2) un lecteur
  revient à la conversation ; (3) sinon le focus revient au canevas (`.react-flow__pane`). Sur le canevas, Échap
  ferme la carte active (plus de lecteur à replier). Aucun Échap ne ferme un onglet.
- **Rationale** : FR-012 ; Échap reste le geste « revenir en arrière », jamais destructeur.

## R10 — Fenêtre étroite

- **Decision** : sous 1 100 px de large, le panneau passe en surimpression à droite de la carte (position absolue,
  ombre, 360 px minimum), toujours fermable ; au-dessus, il partage la largeur (carte ≥ 40 %).
- **Rationale** : ne pas écraser la carte ; reprend la règle du volet Dépôt (`min-w-[360px]`).

## R11 — Fermeture des onglets

- **Decision** : `IdeasPage` vide le panneau quand le brainstorm change (`brainstormId`). Un onglet `chat` se ferme
  quand son nœud n'existe plus dans la vue du canevas (toutes vues confondues : idées, étapes, éléments, documents,
  livrables), pas quand il est seulement masqué (filtre, repli, autre vue). Un onglet `workflowChat` reste tant que
  le canevas est ouvert.
- **Rationale** : FR-014 ; aujourd'hui une carte se ferme dès que son nœud n'est plus dessiné (y compris replié) : ce
  comportement reste pour les cartes, pas pour les onglets.

## R12 — Dépôt

- **Decision** : `uiStore.openRepo / closeRepo / repoGenesisId` deviennent des façades de `sidePanelStore` (onglet
  `repo`) pour garder les appels existants (badge, bandeau, `Ctrl+Maj+G`, volet de conflits) ; `RepoPanel` perd son
  `<aside>` extérieur (largeur, bordure) au profit du panneau, son ✕ ferme l'onglet.
- **Rationale** : changement minimal des appelants (KISS).

## R13 — Accessibilité

- **Decision** : barre d'onglets `role="tablist"`, onglets `role="tab"` (`aria-selected`, `aria-controls`, ←/→,
  Début/Fin), contenu `role="tabpanel"` ; × de chaque onglet = bouton « Fermer l'onglet « … » » hors du tab ; poignée
  `role="separator"` `aria-orientation="vertical"` `aria-valuenow/min/max`, focusable ; indicateurs avec texte caché
  (« Claude écrit », « attend ton accord »).
- **Rationale** : motif ARIA standard des onglets (Jakob) ; tests `expectNoAxeViolations`.
