# Feature Specification: Conversation en panneau fixe (spec 027)

**Feature Branch**: `main` · **Created**: 2026-10-11 · **Status**: Livrée (2026-10-11)
**Input**: audit d'usage du 2026-10-11 (`docs/AUDIT-2026-10-11-parcours-nouveau-projet.md` §5.4, §5.5), priorité 2,
choisie par mentalyas le 2026-10-11. Constat : la conversation avec Claude et le lecteur de fichiers vivent dans
l'étirement de droite de la carte de détails, posée dans la couche de la carte (spec 022 D5, D6, D10). Elle subit le
zoom, s'ouvre en partie hors de l'écran, « Recentrer » et « Tout afficher » l'ignorent, dézoomée elle devient illisible
(encart d'autorisation compris), et elle couvre la pastille « ⏸ attend ton accord » de son nœud.

## Décisions (2026-10-11, validées par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Où | La conversation et le lecteur de fichiers quittent le canevas pour un **panneau fixe à droite** de l'écran Idées, à taille réelle, qui ne bouge ni ne zoome avec la carte. La carte de détails reste sur le canevas (statut, résumé, jauge, liés, fichiers, gestes, fiche) mais **sans étirement de droite** ; son bouton « Discuter » ouvre la conversation dans le panneau. Amende spec 022 D6 et D10 (étirement de droite). |
| D2 | Plusieurs conversations | **Un onglet par conversation ouverte**, comme dans un navigateur. Un clic sur un onglet, ou « Discuter » sur un nœud, affiche sa conversation. Un onglet porte « ⏸ » quand Claude attend ton accord et un point quand Claude écrit. Fermer une carte du canevas ne ferme pas son onglet : un onglet se ferme par son ×. Plusieurs discussions restent ouvertes à la fois sans épingler de carte (amende spec 022 D28 : l'épingle ne sert plus qu'à garder la carte ouverte sur le canevas). |
| D3 | Volet Dépôt | **Un seul panneau à droite** : le volet Dépôt (spec 021) devient un onglet « ⎇ Dépôt » de ce panneau, à côté des conversations. Le canevas garde au moins 62 % de la largeur par défaut. `Ctrl+Maj+G` ouvre ou ferme l'onglet Dépôt du genesis actif, comme aujourd'hui. |
| D4 | Lien avec le nœud | Le nœud de la conversation affichée porte un **anneau « conversation ouverte »**. L'en-tête du panneau reprend son titre et sa sorte (« Étape ① du plan d'attaque »…), avec un bouton **« Centrer sur le nœud »** qui ramène la carte vers lui. Rien n'est dessiné par-dessus la carte. |
| D5 | Lecteur de fichiers | Le lecteur d'un fichier (livrable, élément, document, tâche Workflow) s'ouvre dans l'onglet de son nœud, à la place de la conversation, comme aujourd'hui dans l'étirement ; « ← Conversation » revient à la discussion. |
| D6 | Largeur | 38 % par défaut ; une poignée sur le bord gauche du panneau la règle entre 25 % et 55 % ; la largeur est mémorisée d'une ouverture à l'autre. Sans onglet ouvert, le panneau disparaît et la carte reprend toute la largeur. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Discuter avec Claude dans un panneau lisible (Priority: P1) 🎯 MVP

mentalyas ouvre la carte d'une étape et clique sur « Discuter » : la conversation s'ouvre à droite de l'écran, à taille
réelle, quel que soit le zoom de la carte. Il zoome, recentre, déplace la carte : la conversation ne bouge pas et reste
lisible, encart d'autorisation compris.

**Why this priority**: c'est le frein le plus visible de l'audit ; chaque échange avec Claude passe par là.

**Independent Test**: ouvrir une conversation, zoomer à 30 % puis à 150 %, « Recentrer », « Tout afficher » : le
panneau garde sa taille et son contenu reste entièrement visible.

**Acceptance Scenarios**:

1. **Given** une carte de détails ouverte, **When** mentalyas clique sur « Discuter », **Then** la conversation
   s'ouvre dans le panneau de droite et la carte de détails n'a plus d'étirement de droite.
2. **Given** une conversation ouverte, **When** la carte est zoomée, recentrée ou déplacée, **Then** le panneau ne
   change ni de place ni de taille.
3. **Given** une demande de permission en attente, **When** la carte est dézoomée au plus loin, **Then** l'encart
   « Claude demande… » et ses boutons restent lisibles dans le panneau.
4. **Given** un projet neuf, **When** la conversation du genesis s'ouvre à la création (spec 024), **Then** elle
   s'ouvre dans le panneau, entièrement visible, et le premier message préparé est dans son champ.

---

### User Story 2 — Plusieurs conversations en onglets (Priority: P1)

mentalyas travaille sur le genesis et sur l'étape ① en même temps. Chaque conversation a son onglet ; il passe de l'une
à l'autre d'un clic. Pendant qu'il lit le genesis, l'onglet de l'étape affiche « ⏸ » : Claude y attend son accord.

**Why this priority**: garder ce que la spec 022 D28 permettait (plusieurs discussions à la fois) sans épingler de
cartes.

**Independent Test**: ouvrir deux conversations, provoquer une demande de permission dans celle qui n'est pas affichée :
son onglet porte « ⏸ », un clic l'affiche avec l'encart.

**Acceptance Scenarios**:

1. **Given** une conversation ouverte, **When** mentalyas clique sur « Discuter » sur un autre nœud, **Then** un
   deuxième onglet s'ajoute et devient l'onglet affiché ; le premier reste ouvert.
2. **Given** « Discuter » sur un nœud dont l'onglet est déjà ouvert, **Then** cet onglet s'affiche, sans doublon.
3. **Given** Claude écrit dans une conversation non affichée, **Then** son onglet porte un point ; s'il attend une
   permission, l'onglet porte « ⏸ » jusqu'à la décision ou la fin du tour.
4. **Given** mentalyas ferme la carte de détails d'un nœud sur le canevas, **Then** l'onglet de sa conversation reste
   ouvert ; un clic sur le × de l'onglet le ferme.
5. **Given** un tour de Claude en cours, **When** mentalyas ferme son onglet, **Then** le tour continue en arrière-plan
   (comme quand on ferme une carte aujourd'hui) et l'onglet se rouvre avec la réponse au prochain « Discuter ».

---

### User Story 3 — Retrouver le nœud de la conversation (Priority: P2)

Sur une grande carte, mentalyas ne sait plus à quel nœud appartient la conversation affichée. Le nœud porte un anneau ;
« Centrer sur le nœud » ramène la carte vers lui.

**Why this priority**: la conversation n'est plus collée à son nœud ; il faut garder le lien sans encombrer la carte.

**Independent Test**: ouvrir une conversation, déplacer la carte jusqu'à faire sortir le nœud de l'écran, cliquer sur
« Centrer sur le nœud » : le nœud revient au centre, avec son anneau.

**Acceptance Scenarios**:

1. **Given** une conversation affichée, **Then** son nœud porte l'anneau « conversation ouverte » et aucun autre nœud
   ne le porte.
2. **Given** l'onglet affiché change, **Then** l'anneau passe au nœud du nouvel onglet.
3. **Given** « Centrer sur le nœud », **Then** la carte se déplace jusqu'au nœud (sans animation si les animations
   sont réduites).
4. **Given** le nœud n'est pas dans la vue affichée (Workflow, Progression, Architecture), **Then** « Centrer sur le
   nœud » bascule d'abord vers sa vue, puis centre.

---

### User Story 4 — Le Dépôt dans le même panneau (Priority: P2)

mentalyas ouvre le volet Dépôt pendant une conversation : il s'ouvre comme un onglet « ⎇ Dépôt » du même panneau, et
la conversation reste à un clic.

**Why this priority**: une seule zone à droite, un seul geste à apprendre ; le canevas ne rétrécit pas davantage.

**Independent Test**: conversation ouverte, `Ctrl+Maj+G` : l'onglet Dépôt apparaît et s'affiche ; un clic sur
l'onglet de la conversation la réaffiche ; `Ctrl+Maj+G` ferme l'onglet Dépôt.

**Acceptance Scenarios**:

1. **Given** le badge du dépôt d'un genesis, **When** mentalyas clique dessus, **Then** l'onglet « ⎇ Dépôt » s'ouvre
   et s'affiche dans le panneau.
2. **Given** l'onglet Dépôt ouvert, **When** `Ctrl+Maj+G`, **Then** il se ferme ; les conversations restent.
3. **Given** la résolution d'un conflit de fusion (spec 021 US4), **Then** la vue de résolution remplace la carte comme
   aujourd'hui et le panneau reste à côté.

---

### User Story 5 — Régler la largeur du panneau (Priority: P3)

mentalyas élargit le panneau pour lire un long livrable, puis le resserre pour voir la carte. La largeur choisie est
gardée à la réouverture de l'app.

**Independent Test**: glisser la poignée jusqu'à 50 %, fermer et rouvrir l'app : le panneau s'ouvre à 50 %.

**Acceptance Scenarios**:

1. **Given** la poignée du bord gauche, **When** mentalyas la glisse, **Then** la largeur suit entre 25 % et 55 %.
2. **Given** la poignée a le focus, **When** mentalyas appuie sur ← ou →, **Then** la largeur change par pas de 2 %.
3. **Given** l'app est rouverte, **Then** le panneau reprend la dernière largeur choisie.

---

### Edge Cases

- **Nœud supprimé ou annulé** (Historique) alors que son onglet est ouvert : l'onglet se ferme ; une conversation en
  cours est arrêtée comme aujourd'hui à la suppression d'un nœud.
- **Changement de brainstorm** (← Projets, autre canevas) : les onglets du canevas quitté se ferment ; ils ne sont pas
  rouverts dans un autre canevas.
- **Beaucoup d'onglets** : au-delà de la largeur, la barre d'onglets défile horizontalement ; aucun onglet n'est fermé
  d'office.
- **Lecteur ouvert puis nouvelle demande de permission** : l'onglet porte « ⏸ » ; revenir à la conversation montre
  l'encart.
- **Fenêtre étroite** (moins de 1 100 px) : le panneau garde au moins 360 px et la carte au moins 40 % ; en dessous,
  le panneau passe par-dessus la carte (fermable) plutôt que de l'écraser.
- **Conversation « Local uniquement »** (spec 017) : l'onglet s'ouvre avec le message d'indisponibilité, comme
  aujourd'hui.
- **Carte Workflow** (spec 023) : « Discuter » sur une tâche ouvre son onglet avec la consigne préparée, comme
  aujourd'hui.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La conversation d'un nœud MUST s'afficher dans un panneau fixe à droite de l'écran Idées, hors de la
  couche de la carte : son affichage MUST être indépendant du zoom, du recentrage et du déplacement de la carte.
- **FR-002**: La carte de détails MUST rester sur le canevas avec son contenu actuel, sans étirement de droite ; son
  bouton « Discuter » MUST ouvrir (ou afficher) l'onglet de la conversation du nœud.
- **FR-003**: Le panneau MUST présenter un onglet par conversation ouverte et un seul onglet par nœud ; un onglet MUST
  porter le titre du nœud, un indicateur « Claude écrit » et un indicateur « ⏸ attend ton accord ».
- **FR-004**: Fermer une carte de détails MUST NOT fermer l'onglet de sa conversation ; un onglet MUST se fermer par
  son bouton × ; fermer un onglet MUST NOT interrompre un tour en cours.
- **FR-005**: Le volet Dépôt MUST être un onglet du même panneau ; le badge du dépôt et `Ctrl+Maj+G` MUST l'ouvrir et
  le fermer comme aujourd'hui.
- **FR-006**: Le nœud de la conversation affichée MUST porter un anneau « conversation ouverte », distinct de la
  pastille « attend ton accord » et du statut, et le seul de la carte.
- **FR-007**: L'en-tête du panneau MUST reprendre le titre et la sorte du nœud et proposer « Centrer sur le nœud »,
  qui bascule si besoin vers la vue du nœud puis centre la carte sur lui.
- **FR-008**: Le lecteur de fichiers MUST s'ouvrir dans l'onglet de son nœud à la place de la conversation, avec un
  retour à la conversation.
- **FR-009**: La largeur du panneau MUST être réglable entre 25 % et 55 % à la souris et au clavier, valoir 38 % par
  défaut et être mémorisée entre deux ouvertures de l'app.
- **FR-010**: Sans onglet ouvert, le panneau MUST disparaître et la carte reprendre toute la largeur.
- **FR-011**: Le panneau MUST être accessible : onglets navigables au clavier (←/→ entre onglets, Entrée pour
  afficher), focus visible, nom accessible de chaque onglet et de la poignée, aucune violation axe.
- **FR-012**: Échap dans le panneau MUST d'abord interrompre un tour en cours (comme aujourd'hui), sinon revenir du
  lecteur à la conversation, sinon rendre le focus à la carte ; Échap MUST NOT fermer un onglet.
- **FR-013**: Les animations du panneau (ouverture, changement d'onglet, recentrage) MUST respecter le réglage
  « réduire les animations ».
- **FR-014**: Les onglets d'un canevas MUST se fermer quand on quitte ce canevas ; un nœud supprimé MUST fermer son
  onglet.
- **FR-015**: La fonction MUST rester entièrement dans l'interface : aucune donnée enregistrée en base ni canal IPC
  nouveau, hors la largeur mémorisée du panneau.

### Key Entities

- **Onglet du panneau** : une conversation de nœud (identifiant du neurone, titre, sorte, contenu affiché :
  conversation ou fichier lu) ou l'onglet Dépôt d'un genesis. Vit le temps de l'ouverture du canevas.
- **Panneau** : liste ordonnée d'onglets, onglet affiché, largeur.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: À tout niveau de zoom de la carte (de 30 % à 150 %), 100 % du texte de la conversation et de l'encart
  d'autorisation reste lisible à sa taille normale.
- **SC-002**: Ouvrir la conversation d'un nœud demande au plus 2 gestes depuis la carte (ouvrir la carte, « Discuter »)
  et elle est entièrement visible sans déplacer la carte, dans 100 % des cas.
- **SC-003**: Passer d'une conversation ouverte à une autre demande 1 clic.
- **SC-004**: Une demande de permission dans une conversation non affichée est signalée sur son onglet et sur son nœud
  en moins d'1 seconde.
- **SC-005**: Repris dans le parcours de l'audit (brainstorm → plan → étape → commit), aucune étape ne demande de
  dézoomer, de faire glisser la carte ou de forcer un clic pour atteindre la conversation.

## Assumptions

- La largeur mémorisée est une préférence d'affichage de l'interface, commune à tous les canevas, gardée comme les
  autres préférences d'affichage existantes (le plan dira lesquelles), sans nouvelle table.
- La fiche (étirement vers le bas, spec 022 D16) reste dans la carte de détails : elle est courte et liée au nœud.
- Les widgets (plein écran, réglages flottants, spec 026) ne changent pas.
- Les conversations des autres écrans (Skills, spec 020) gardent leur disposition actuelle : la spec ne vise que
  l'écran Idées.
- Le panneau reprend les jetons et la proportion 62 / 38 du volet Dépôt actuel (règle φ du dépôt).
