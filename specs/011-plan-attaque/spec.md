# Feature Specification: Plan d'attaque — couches de sous-nœuds, ordre, verrouillage

**Feature Branch**: `011-plan-attaque` · **Created**: 2026-10-05 · **Status**: Clarifiée (2026-10-05) — à valider par mentalyas

**Input**: reprise du lot B de la spec 008 (« l'entonnoir en couches »), enrichie le 2026-10-05 par mentalyas : plan
d'attaque en sous-nœuds proposés par Claude, différenciation visuelle genesis / sous-nœuds, disposition automatique
ordonnée et incrémentale, verrouillage d'un nœud mûr.

## Décisions (2026-10-05)
| # | Sujet | Décision |
|---|-------|----------|
| D1 | Création des sous-nœuds | **Claude propose, mentalyas valide** : fantômes, validation en bloc ou un par un, refus possible. |
| D2 | Disposition | **Arbre gauche → droite** : genesis à gauche, étapes en colonne triée par rang, sous-étapes en colonne suivante. |
| D3 | Ordre | **Numérotation + dépendances** : rang ①②③ (①.1 au niveau suivant), dépendances « ② attend ① » fléchées. |
| D4 | Verrouillage | Claude **propose** de verrouiller un nœud dont il a tout ce qu'il lui faut ; verrouillé, sa fiche et son contexte sont figés. |
| D5 | Conversation d'un nœud verrouillé | **Dialogue sans écriture** : mentalyas peut encore questionner Claude ; rien ne s'écrit dans le nœud. |
| D6 | Verrou et couche suivante | **Verrou obligatoire** : faire naître la couche suivante verrouille d'abord le parent, dans la même opération annulable. |
| D7 | Glisser (2026-10-05) | **Tous les nœuds se glissent** : une étape glissée garde un décalage par rapport à sa place calculée et **entraîne sa branche** (sous-étapes, annexes) ; un fantôme reste à sa place proposée. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Claude propose le plan d'attaque d'un nœud mûr (Priority: P1)

Quand un genesis a été assez travaillé dans sa conversation (maturité « complet »), Claude propose les étapes qui
permettent d'y arriver : elles apparaissent sur la carte en fantômes, déjà placées à droite du genesis et numérotées
dans l'ordre où les attaquer. mentalyas les valide toutes d'un geste, une par une, ou les refuse ; une étape validée
devient un vrai sous-nœud, avec sa propre conversation qui connaît la fiche du genesis. La même mécanique s'applique à
un sous-nœud mûr, qui reçoit ses sous-étapes (①.1, ①.2…).

**Why this priority**: c'est le passage de « j'ai réfléchi » à « je sais par où commencer » ; sans lui, la carte reste
une collection d'idées isolées.

**Independent Test**: un genesis mûr → Claude propose 3 étapes → 3 fantômes numérotés à droite du genesis → « Tout
valider » → 3 sous-nœuds reliés au genesis ; ouvrir le ② → Claude cite la fiche du genesis sans qu'on la lui redonne.

**Acceptance Scenarios**:

1. **Given** un nœud mûr, **When** Claude propose une couche, **Then** chaque étape proposée apparaît en fantôme
   (titre, rang, une phrase « pourquoi »), sans rien créer dans les données de mentalyas tant qu'il n'a pas validé.
2. **Given** des fantômes, **When** mentalyas valide tout, **Then** le parent est verrouillé (s'il ne l'était pas) et
   les fantômes deviennent des sous-nœuds, en une seule opération d'Historique, annulable d'un geste (D6).
3. **Given** des fantômes, **When** mentalyas en valide un et en refuse un autre, **Then** seul le premier naît ; le
   refusé disparaît et n'est pas reproposé à l'identique pour ce nœud.
4. **Given** un sous-nœud ouvert, **When** mentalyas lui écrit, **Then** sa conversation dispose des fiches du genesis
   et de tous les nœuds de son chemin, sans copier-coller.
5. **Given** un nœud qui n'est pas mûr, **When** mentalyas demande quand même un plan, **Then** Claude explique ce qui
   manque (les « manques » de la fiche) au lieu de proposer des étapes.

---

### User Story 2 — Un plan lisible, ordonné, qui pousse sans tout bousculer (Priority: P1)

Le plan se dessine tout seul en arbre de gauche à droite : le genesis à gauche, ses étapes en colonne dans l'ordre de
leur rang, les sous-étapes d'une étape dans la colonne suivante, alignées sur elle. Ajouter une étape ou une sous-étape
ne déplace que sa branche, en douceur ; le reste de la carte ne bouge pas. Une étape qui en attend une autre est
toujours placée après elle, et un trait fléché montre l'attente. mentalyas réordonne en glissant une étape dans sa
colonne : les numéros suivent.

**Why this priority**: l'ordre de développement est l'information principale du plan ; une disposition instable ou
désordonnée le rend illisible.

**Independent Test**: un genesis avec 3 étapes et 2 sous-étapes sous ① → ajout d'une sous-étape ①.3 : seule la branche
① s'allonge, ② et ③ glissent juste ce qu'il faut, le genesis et les autres idées ne bougent pas ; fermer et rouvrir
l'app → disposition identique.

**Acceptance Scenarios**:

1. **Given** un plan, **When** il s'affiche, **Then** les étapes d'un même parent sont dans une même colonne, de haut en
   bas par rang croissant, et aucune ne chevauche une autre ni une idée voisine.
2. **Given** « ② attend ① », **When** le plan s'affiche, **Then** ② est sous ① et une flèche va de ① vers ②.
3. **Given** un plan affiché, **When** une étape naît, **Then** seule sa branche est réarrangée (animation de 250 ms,
   aucune si « réduire les animations ») ; les autres nœuds restent à leur place au pixel près.
4. **Given** une étape glissée au-dessus d'une autre de sa colonne, **When** elle est lâchée, **Then** les rangs sont
   renumérotés, sauf si le nouvel ordre viole une dépendance : le glisser est alors refusé avec un message clair.
5. **Given** le même plan, **When** l'app est fermée puis rouverte, **Then** la disposition est identique.

---

### User Story 3 — Voir d'un coup d'œil ce qui est quoi (Priority: P2)

Le genesis, une étape et une sous-étape ne se ressemblent pas : le genesis reste l'hexagone, le plus grand, à la
couleur de sa catégorie avec un halo et un anneau de maturité ; une étape est une carte arrondie moyenne, son titre
dedans, à la teinte atténuée de la catégorie du genesis, avec sa pastille de rang et un anneau de statut ; une
sous-étape est une carte plus petite et plus compacte, plus atténuée encore, avec sa pastille ①.1. Un fantôme est en
pointillés, à demi transparent, avec ses boutons ✓ et ✗. Un nœud verrouillé porte un cadenas.

**Why this priority**: la lecture du plan dépend de la hiérarchie visuelle, mais le plan reste utilisable sans elle.

**Independent Test**: un plan à 3 niveaux, en thème clair et sombre : on distingue sans lire le texte genesis, étape,
sous-étape, fantôme et nœud verrouillé ; les lecteurs d'écran annoncent le type, le rang et l'état de chaque nœud.

**Acceptance Scenarios**:

1. **Given** un plan, **When** il est affiché, **Then** chaque niveau a une forme, une taille et une intensité de
   couleur distinctes, contrastes WCAG AA respectés dans les deux thèmes.
2. **Given** un nœud quelconque du plan, **When** il a le focus clavier, **Then** il est annoncé « Étape ② de
   « Studio photo », en cours, verrouillée » (type, rang, parent, statut, verrou).
3. **Given** un fantôme, **When** il a le focus, **Then** ✓ et ✗ sont atteignables au clavier.

---

### User Story 4 — Verrouiller un nœud mûr pour figer la base de ses enfants (Priority: P1)

Quand mentalyas a assez brainstormé un nœud et que Claude juge qu'il a tout ce qu'il lui faut, Claude propose de le
verrouiller. Verrouillé, le nœud est figé : sa fiche, son titre, sa description ne changent plus, ni par mentalyas ni
par Claude ; ses sous-nœuds s'appuient sur ce contexte stable. C'est ce qui évite qu'une modification d'un nœud A,
faite après la création de ses sous-nœuds, ou d'un nœud B dont d'autres dépendent, casse la logique en cascade.

**Why this priority**: sans verrou, chaque retouche d'un parent rend silencieusement ses enfants incohérents.

**Independent Test**: un nœud mûr → Claude propose le verrou → mentalyas accepte → le nœud montre un cadenas ; tenter
de modifier sa fiche (par Claude) ou son titre (par mentalyas) est refusé avec un message qui dit pourquoi ; ses
enfants continuent de lire sa fiche.

**Acceptance Scenarios**:

1. **Given** un nœud dont Claude estime le contexte suffisant, **When** Claude le signale, **Then** une proposition
   « Verrouiller ce nœud » s'affiche, avec la fiche qui sera figée ; rien n'est verrouillé sans l'accord de mentalyas.
2. **Given** un nœud verrouillé, **When** Claude essaie d'écrire sa fiche ou de le modifier par le pont, **Then**
   l'écriture est refusée et Claude reçoit la raison (« nœud verrouillé »).
3. **Given** un nœud verrouillé, **When** mentalyas essaie de renommer ou modifier le nœud, **Then** c'est refusé avec
   la raison ; seuls la position sur la carte et l'ajout de sous-nœuds restent permis.
4. **Given** un verrouillage accepté, **When** mentalyas annule l'opération dans l'Historique, **Then** le nœud
   redevient modifiable.
5. **Given** un nœud verrouillé, **When** mentalyas ouvre sa conversation, **Then** il peut encore dialoguer avec
   Claude (relire, expliquer, préparer la couche suivante), le chat signale que le nœud est verrouillé, et aucune
   écriture dans le nœud n'aboutit (D5).

---

### Edge Cases

- Claude propose une couche alors que des fantômes de la couche précédente attendent encore : les nouveaux remplacent
  les anciens non décidés du même parent (une seule proposition en attente par nœud).
- Une dépendance déclarée crée un cycle (① attend ②, ② attend ①) : elle est refusée, Claude reçoit la raison.
- Une dépendance vers un nœud d'un autre arbre : refusée (une conversation n'écrit que dans son arbre, spec 008).
- Un sous-nœud est supprimé : ses propres sous-nœuds partent avec lui dans la même opération annulable ; les rangs de
  ses frères sont renumérotés ; les dépendances vers lui sont retirées.
- Un nœud verrouillé dont un descendant est supprimé : autorisé (le verrou fige le nœud, pas sa descendance).
- Profondeur : au plus 4 niveaux sous le genesis (①.1.1.1) ; au-delà, Claude est invité à regrouper.
- Plus de 12 étapes proposées d'un coup pour un même parent : refusé, Claude est invité à regrouper.
- Un genesis portant une carte de structure de projet (spec 009) : son plan d'attaque et sa structure coexistent sans
  se chevaucher.
- Valider des fantômes sous un nœud non verrouillé : la validation affiche que le parent sera verrouillé ; annuler
  l'opération déverrouille le parent et retire les enfants nés (D6).
- Annuler le verrouillage d'un nœud qui a déjà des enfants (opération plus ancienne que leur naissance) : refusé avec
  la raison (« ses sous-nœuds s'appuient sur ce contexte ») ; il faut d'abord annuler la naissance des enfants.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Claude MUST pouvoir proposer, pour un nœud de son arbre, une couche de 1 à 12 étapes (titre, une phrase
  « pourquoi », rang, dépendances éventuelles vers des frères) ; la proposition est affichée en fantômes et n'écrit
  rien dans les nœuds de mentalyas avant validation (constitution II).
- **FR-002**: mentalyas MUST pouvoir valider toute la couche, valider ou refuser chaque fantôme ; chaque validation est
  une opération d'Historique atomique et annulable, qui verrouille d'abord le parent s'il ne l'est pas (D6) ; un refus est mémorisé pour ne pas reproposer la même étape au même
  parent.
- **FR-003**: Un sous-nœud MUST avoir sa propre conversation Claude Code ; à chaque ouverture, elle reçoit les fiches
  du genesis et de tous les nœuds de son chemin (du genesis au parent).
- **FR-004**: Chaque sous-nœud MUST avoir un rang unique parmi ses frères, affiché en pastille (①, ①.1…), et peut
  dépendre d'autres frères ; une dépendance créant un cycle MUST être refusée.
- **FR-005**: Le plan MUST être disposé automatiquement en arbre gauche → droite : enfants d'un même parent en colonne,
  par rang croissant, aucune étape placée avant une étape qu'elle attend, sans chevauchement avec les autres objets de
  la carte.
- **FR-006**: La disposition MUST être déterministe (mêmes nœuds → mêmes places) et incrémentale : un ajout, un retrait
  ou un réordonnancement ne déplace que la branche concernée et les branches situées en dessous dans la même colonne.
- **FR-007**: mentalyas MUST pouvoir réordonner une étape en la glissant dans sa colonne ; les rangs suivent ; un ordre
  qui viole une dépendance MUST être refusé.
- **FR-008**: Genesis, étape (niveau 1), sous-étape (niveau 2+), fantôme et nœud verrouillé MUST être visuellement
  distincts (forme, taille, intensité de couleur, pastille, cadenas), en thème clair et sombre, contrastes WCAG AA, et
  annoncés aux lecteurs d'écran (type, rang, parent, statut, verrou).
- **FR-009**: Chaque sous-nœud MUST porter un statut d'avancement (à faire, en cours, fait, bloqué), modifiable par
  mentalyas et par Claude, visible en anneau.
- **FR-010**: Claude MUST pouvoir proposer le verrouillage d'un nœud de son arbre ; le verrouillage n'est appliqué
  qu'après acceptation de mentalyas, en une opération d'Historique annulable.
- **FR-011**: Un nœud verrouillé MUST refuser toute modification de sa fiche, de son titre et de sa description, par
  mentalyas comme par Claude (pont MCP), avec un message qui en donne la raison ; sa position sur la carte, son statut
  d'avancement et l'ajout de sous-nœuds restent permis. Sa conversation reste ouverte au dialogue, sans écriture
  dans le nœud (D5). Un nœud qui a des sous-nœuds MUST NOT pouvoir être déverrouillé (D6).
- **FR-012**: Toute écriture de Claude de cette spec (proposition de couche, statut, dépendance, proposition de
  verrou) MUST rester dans l'arbre de sa conversation et être marquée « par Claude » (spec 007, 008).

### Key Entities

- **Nœud** : genesis (racine) ou sous-nœud ; parent, niveau, rang parmi ses frères, statut d'avancement, verrou
  (oui / non, date), fiche, conversation.
- **Dépendance** : « le nœud X attend le nœud Y », entre frères d'un même parent.
- **Proposition de couche** : parent, fantômes proposés (titre, pourquoi, rang, dépendances), état de chaque fantôme
  (en attente, validé, refusé), auteur Claude.
- **Proposition de verrou** : nœud visé, fiche figée au moment de la proposition, état (en attente, acceptée, refusée).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: D'un genesis mûr à un plan de 3 étapes validées : moins de 1 minute et au plus 2 gestes de mentalyas
  (demander, tout valider).
- **SC-002**: Ajouter une étape à un plan de 20 nœuds ne déplace aucun nœud hors de la branche concernée et des
  branches situées en dessous d'elle (vérifiable au pixel).
- **SC-003**: 100 % des écritures sur un nœud verrouillé (par l'interface ou par le pont) sont refusées avec un motif.
- **SC-004**: Un test de 5 secondes sur un plan à 3 niveaux : mentalyas désigne sans erreur le genesis, une étape, une
  sous-étape, un fantôme et un nœud verrouillé.
- **SC-005**: Le plan est identique (places, rangs, statuts) après fermeture et réouverture de l'app.

## Assumptions

- « Mûr » = dernière maturité évaluée « complet » (outil `maturite_evaluer`, spec 008) ; mentalyas peut aussi demander
  un plan à tout moment, Claude répondant alors par les manques (US1 scénario 5).
- Le statut d'avancement (FR-009) est ajouté car un plan d'attaque sans « fait / en cours » perd son intérêt ; il ne
  pilote pas la disposition (l'ordre reste celui des rangs).
- Hors périmètre (lot B de la spec 008, reportés) : type d'entonnoir du genesis, remontée vers le genesis, éclosion et
  export au format `/brainstorm`.
- Les éléments de structure de projet (spec 009) gardent leur propre disposition ; le plan d'attaque se place à droite
  du genesis, la structure garde sa place actuelle, et les deux ne se chevauchent pas.
- La physique de la carte continue de placer les genesis entre eux ; un plan se déplace avec son genesis.
- Le verrou ne fige que le nœud lui-même, pas ses descendants ni ses liens libres.
