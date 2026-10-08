# Feature Specification: Nœuds vivants (spec 022)

**Feature Branch**: `main` · **Created**: 2026-10-08 · **Status**: Draft — à valider par mentalyas
**Input**: « Je veux retravailler l'aspect des nœuds mais sans perdre ce qu'on y a implémenté en termes d'affichage et de
comportement. Je veux juste des animations plus fluides et un comportement d'ouverture / fermeture au clic pour consulter
les détails […] je m'en fous de l'aspect circulaire de l'organisation des nœuds, ce qui m'intéresse c'est leur
comportement, la fluidité de déplacement et de leur animation, et cette impression de flottaison. » — mentalyas.
Référence visuelle : composant 21st.dev « radial-orbital-timeline » (jatin-yadav05), code fourni par mentalyas.
**Glossaire** : *carte de détails* = panneau qui se déplie sous un nœud au clic ; *flottaison* = léger mouvement
continu d'un nœud au repos ; *énergie* = jauge propre à chaque sorte de nœud (maturité, avancement, étoiles).

## Décisions (2026-10-08, validées par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Périmètre | Les quatre cartes : carte des idées (genesis, idées, étapes, fantômes), carte de structure (éléments), arbre de skills (skills et skills disponibles de la bibliothèque), blocs du canevas (widgets, notes, documents, cadres). L'agencement circulaire de la référence n'est **pas** repris : chaque carte garde sa disposition. |
| D2 | Conservation | Rien de l'affichage ni du comportement actuels n'est perdu : contenu, couleurs, badges, liens, dispositions, sélection multiple (Ctrl / Cmd / Maj + clic), menus contextuels, double-clic qui ouvre la conversation. |
| D3 | Flottaison | Tous les nœuds flottent : chaque nœud ondule de quelques pixels en continu, à son propre rythme, stable d'une ouverture à l'autre, avec une impression de profondeur ; le mouvement s'arrête pendant une interaction (déplacer, zoomer, glisser) et tant qu'une carte de détails est ouverte ; aucun mouvement en mode « animations réduites ». |
| D4 | Déplacements | Quand une disposition change (nouvelle idée, rangement par domaine, bascule Progression / Architecture, réorganisation), les nœuds glissent vers leur nouvelle place (≈ 700 ms, courbe douce) au lieu de sauter. |
| D5 | Clic | Un clic simple ouvre la **carte de détails** du nœud (une seule ouverte à la fois) ; un second clic, Échap ou un clic dans le vide la referme. Le double-clic ouvre toujours directement la conversation. |
| D6 | Carte de détails | Le nœud grossit légèrement avec une lueur ; la carte, reliée au nœud par un trait, montre statut, date, résumé, une jauge d'énergie, les nœuds liés (cliquables : ils passent à leur carte) et les actions : « Discuter » (conversation, comme avant), « Fiche complète » pour un skill (volet actuel), actions propres d'un bloc. Les voisins reliés pulsent et leurs liens s'éclairent. |
| D7 | Énergie | Idée : maturité ; étape et élément de structure : avancement ; skill : étoiles (s'il a une fiche) ; skill disponible : verdict d'audit ; bloc : pas de jauge. |
| D8 | Amendements | Le geste du clic change dans les specs 008 (clic = conversation), 017 (clic sur un élément) et 020 (clic = fiche du skill) : amendements datés à écrire avant le code de chaque carte. |
| D9 | Ordre | Carte des idées, puis arbre de skills, carte de structure, blocs. |
| D10 | Tout dans le nœud (2026-10-08, après le prototype) | **Plus de volet de droite** pour ces cartes : « Fiche » (« Fiche complète » pour un skill) **étire la carte de détails vers le bas** et y déplie la fiche ; « Discuter » **l'étire vers la droite** et y ouvre la conversation ; les deux peuvent être ouverts ensemble ; la vue glisse pour garder la carte entière à l'écran. La carte vit au-dessus de la toile, à taille fixe (lisible à tout zoom). Le double-clic ouvre la carte directement sur la discussion. *Précisé après le prototype v4 :* la carte s'ouvre **toujours à droite du nœud**, reliée par un trait horizontal à hauteur de son centre, et **le suit sans délai** (déplacement, zoom, flottaison : aucune inertie ni glissement de la carte derrière son nœud). |
| D11 | Aspect des nœuds (2026-10-08, prototype v3 validé) | Le nœud racine (idée de départ, projet d'une carte de structure, « Toi » de l'arbre de skills) est un **gros orbe** en dégradé (violet → bleu → sarcelle, jetons du thème), disque clair au centre, anneau fin autour ; sa taille suit la maturité ; une idée éclose émet une onde, une idée brute est pâle avec un anneau en pointillés. Les **sous-nœuds** (étapes, sous-idées, documents, actions finales, éléments, familles et skills) sont de **petits cercles** (≈ 44 px) au contour fin, avec un **pictogramme de leur type** au centre et leur titre dessous ; contour selon le statut (livré, en cours), lueur selon l'énergie, rang ①②③ d'une étape en pastille. **Pas d'agencement circulaire** : chaque carte garde **une organisation en sens alterné** : le nœud racine déploie ses enfants en colonne (vers le bas), chacun d'eux déploie les siens en ligne (vers la droite), les suivants repartent en colonne, et ainsi de suite ; chaque branche **repousse** ce qui est en dessous ou à droite pour se faire la place (précisé le 2026-10-08) ; liens d'arbre en courbes douces, liens libres en pointillés. Pictogrammes : bibliothèque **Lucide** (licence ISC), forme d'intégration en D12. |
| D12 | Pictogrammes (2026-10-08) | Dépendance **`lucide-react`** (licence ISC, sans dépendance transitive, seules les icônes importées sont embarquées) ; choisie plutôt que la copie des tracés pour pouvoir piocher librement dans toute la bibliothèque. Les icônes sont dessinées en `currentColor` (couleurs des jetons du thème) et restent décoratives (`aria-hidden`) : le type d'un nœud est aussi dans son nom accessible. |
| D13 | Fichiers et contenus dans le nœud (2026-10-08) | Tout ce que l'app permet aujourd'hui de **consulter** sur un nœud se lit **dans sa carte, par étirement** : fichiers d'un livrable ou d'une action finale (différence et contenu, comme la visionneuse actuelle), fichiers liés d'un élément de structure, texte d'un document, contenu d'un skill. La carte liste les fichiers (rubrique « Fichiers ») ; un clic sur l'un d'eux **étire la carte en lecteur** (code coloré avec numéros de ligne, ou texte mis en forme), en lecture seule comme aujourd'hui ; Échap ou ✕ replie le lecteur avant de refermer la carte. Principe général : quand un nœud a plus à montrer, **la carte s'étire** plutôt que d'ouvrir un volet ou une fenêtre. |
| D14 | Afficher / masquer les sous-nœuds (2026-10-08) | Tout nœud qui a des sous-nœuds (idée de départ et ses étapes, étape et ses sous-étapes, élément de structure, famille de skills) peut être **replié** : ses descendants **rentrent en glissant dans le nœud** (≈ 700 ms) et le nœud porte une pastille « ▸ N » (nombre de sous-nœuds masqués) ; déplié, ils **ressortent en glissant** vers leur place. Le geste existe sur le nœud (la pastille) et dans sa carte de détails (« Masquer les sous-étapes (N) » / « Afficher… »). L'état replié est **mémorisé** (comme le repli actuel des éléments de structure, spec 009, qui est repris). Les autres nœuds se resserrent en glissant pour occuper la place libérée. |

| D15 | Plusieurs cartes (amende D5) | **Plusieurs cartes de détails ouvertes à la fois**, une discussion par carte : un clic sur un nœud ajoute sa carte, un nouveau clic sur ce nœud referme la sienne ; ✕ dans l'en-tête ferme une carte, « Fermer les cartes » (barre d'en-tête) les ferme toutes ; un clic dans le vide ne ferme rien (des conversations peuvent tourner) ; la dernière carte touchée est **active** (au premier plan, contour marqué) et Échap n'agit que sur elle. |
| D16 | Carte déplaçable et zoomée (amende D10) | La carte **subit le zoom de la toile** (elle grandit et rapetisse avec les nœuds ; plus de taille fixe) ; elle se **déplace par son en-tête** (poignée à six points, éclairée au survol), garde ensuite son décalage par rapport à son nœud (le suit au déplacement et au zoom), reliée par un **fil en pointillés** ; double-clic sur l'en-tête : elle se recolle contre le nœud. |
| D17 | Hiérarchie visuelle (précise D11) | **Une couleur par grande branche** (enfant direct de la racine), transmise à toute sa descendance (contour, lueur, pictogramme, liens d'arbre, pastille de rang) ; **taille décroissante par niveau** (orbe, puis ≈ 58, 44, 36, 30 px ; titres de plus en plus petits) ; **statut en pastille** (pleine = livré, demi = en cours, vide = à faire) ; **pas de cadres ni de zones colorées** autour des groupes. L'arbre de skills garde sa disposition en **éventail autour de « Toi »** (spec 020, R9 : une branche par groupe sur 360°, skills en rangées de 3), avec ces mêmes nœuds ; la branche des plugins peut être repliée (D14). |
| D18 | Lecteur à droite (précise D13) | Le lecteur de fichier **étire la carte vers la droite, à la place de la discussion** (ouvrir l'un replie l'autre ; la fiche vers le bas peut rester ouverte) ; onglets « Différence » / « Contenu » quand une différence existe ; Échap replie d'abord le lecteur. Un trombone sur le nœud signale qu'il a des fichiers. |
| D19 | Main et agents | La **première discussion ouverte est le Main** (★, couleur fixe ambre, branche principale) ; **toute discussion ouverte en même temps est un agent** (⑂, violet) qui travaille **sur sa propre branche** `agent/<nœud>` (copie de travail séparée, comme l'Analyste) ; l'utilisateur en est toujours conscient : étiquette et note de rôle dans la discussion (« Agent en parallèle · branche … : ses changements restent sur sa branche jusqu'à ce que tu les fusionnes »), anneau de rôle autour du nœud, anneau qui tourne pendant que Claude répond, équipe en cours dans l'en-tête (« ★ Main · titre », « ⑂ N agents »). Le rôle est fixé à l'ouverture ; si le Main est fermé, la prochaine discussion ouverte devient le Main. Pas de limite de nombre (mentalyas gère sa consommation, affichée dans l'en-tête). |
| D20 | Zoom fluide | La molette et les boutons de zoom (+, −, tout afficher) font **glisser la vue avec un amorti** vers le zoom visé, centré sur la souris ; recentrer et aller vers un nœud glissent de même ; le déplacement à la souris reste direct. **Aucune parallaxe ni déformation** (essayées et rejetées). |
| D21 | Style carbone et canevas sobre | Style général « **carbone** » : surfaces presque noires en léger dégradé, **liserés argentés** (reflet en haut), **éclat argenté animé qui fait le tour des cartes** (plus vif sur la carte active ; arrêté en animations réduites), bouton principal argent, champs sombres en relief ; volet, en-tête, barre d'outils et boutons de zoom accordés. Canevas **sobre** : fond neutre, points très discrets, bords légèrement assombris, liens fins sans lueur. Rejetés : verre aéré, canevas « tech » (grille et bleu nuit). |
| D22 | Barre d'outils | Le bouton **« Réorganiser »** est dans la barre d'outils de chaque carte (à côté de « Recentrer ») : les nœuds glissent vers l'autre disposition (arbre transposé ; éventail tourné pour les skills). |
| D23 | Aucune fonctionnalité retirée (2026-10-08, priorité) | **Priorité aux fonctionnalités présentes dans l'app** : on peut ajouter, on ne retire **rien**. Tout ce qu'offrent aujourd'hui les quatre cartes et leurs volets (menus contextuels, actions des nœuds, panneaux de fiche, de livrable, d'élément, de skill et de bibliothèque, filtres, recherche, compteurs, blocs, barre de structure, reprise de projet, raccourcis…) MUST rester accessible, à sa place actuelle ou dans la carte de détails. Le plan commence par un **inventaire** de ces fonctionnalités et la place de chacune après la refonte ; une fonctionnalité sans place prévue bloque la livraison de sa carte. |

| D24 | Taille des cartes (2026-10-09, après le test d'US1) | Une carte de détails **prend la taille de son contenu** (fiche, discussion, lecteur), entre un minimum et un maximum, et défile au-delà ; **aucun redimensionnement manuel** (« l'utilisateur va faire un carnage »). Les documents et livrables, devenus des cercles, ne se redimensionnent plus : leur contenu se lit dans le lecteur de la carte. |
| D25 | Estompage (2026-10-09) | Les autres idées **ne s'estompent plus** quand une discussion est ouverte (plusieurs cartes peuvent l'être) ; l'estompage par un filtre est conservé. |
| D26 | Arbres voisins (2026-10-09) | La physique compte la **portée de l'arbre** de chaque idée (plan, carte de structure) : une idée nouvelle ou libérée se place hors de portée des arbres voisins. Une idée déjà posée ne bouge toujours pas d'elle-même (« Libérer » la replace). |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Une carte des idées qui flotte et se consulte au clic (Priority: P1) 🎯 MVP

mentalyas ouvre la carte des idées : les nœuds ondulent doucement, chacun à son rythme. Il clique sur une idée : elle
grossit, s'éclaire, et une carte de détails se déplie dessous avec son statut, sa maturité, le résumé de sa fiche et
les idées liées ; les idées reliées pulsent. Il passe à une idée liée depuis la carte, ou clique « Discuter » pour
ouvrir la conversation. Échap referme la carte.

**Why this priority**: c'est la carte la plus utilisée ; elle porte l'essentiel de la demande (flottaison, fluidité,
consultation au clic).

**Independent Test**: sur le profil démo, ouvrir la carte des idées : les nœuds ondulent ; cliquer une idée ouvre sa
carte de détails, un second clic la referme, Échap aussi ; « Discuter » ouvre la conversation ; le double-clic ouvre
la conversation sans carte ; Ctrl + clic sélectionne sans ouvrir de carte.

**Acceptance Scenarios**:

1. **Given** la carte des idées au repos, **When** mentalyas la regarde, **Then** chaque nœud ondule doucement, avec des
   rythmes différents d'un nœud à l'autre, et les mêmes à l'ouverture suivante.
2. **Given** une idée, **When** mentalyas clique dessus, **Then** elle grossit avec une lueur et sa carte de détails se
   déplie dessous (statut, maturité en jauge, résumé, idées liées, « Discuter ») ; la flottaison s'arrête.
3. **Given** une carte de détails ouverte, **When** mentalyas clique une autre idée, **Then** la première se referme et
   la seconde s'ouvre ; **When** il clique sur la même idée, dans le vide, ou appuie sur Échap, **Then** elle se
   referme et la flottaison reprend.
4. **Given** une carte ouverte, **Then** les idées reliées pulsent et leurs liens s'éclairent ; **When** mentalyas
   clique une idée liée dans la carte, **Then** la carte de cette idée s'ouvre.
5. **Given** une idée, **When** mentalyas double-clique dessus, **Then** la conversation s'ouvre directement (comme
   aujourd'hui) ; **When** il fait Ctrl / Cmd / Maj + clic, **Then** l'idée rejoint la sélection, sans carte.
6. **Given** une nouvelle idée ou un réarrangement, **Then** les nœuds glissent vers leur nouvelle place au lieu de
   sauter.
7. **Given** le mode « animations réduites », **Then** aucun nœud ne bouge de lui-même ; ouverture et fermeture de la
   carte se font en fondu.
8. **Given** le clavier, **When** le focus est sur un nœud et mentalyas appuie sur Entrée, **Then** sa carte s'ouvre
   et le focus y entre ; Échap la referme et rend le focus au nœud.

---

### User Story 2 — L'arbre de skills vivant (Priority: P2)

Les nœuds de l'arbre de skills (installés et disponibles) flottent ; un clic ouvre une carte de détails : description,
étoiles en jauge, usage, liens, verdict pour un skill disponible, et « Fiche complète » qui ouvre le volet actuel.

**Why this priority**: carte récente et dense (jusqu'à ~300 nœuds avec la bibliothèque) : elle éprouve la fluidité.

**Independent Test**: avec la bibliothèque dépliée (≈ 300 nœuds), la toile reste fluide ; cliquer un skill ouvre sa
carte ; « Fiche complète » ouvre le volet de droite comme aujourd'hui.

**Acceptance Scenarios**:

1. **Given** l'arbre de skills, **Then** tous les nœuds flottent sans ralentir le déplacement ni le zoom.
2. **Given** un skill, **When** mentalyas clique dessus, **Then** sa carte montre description, étoiles (jauge et
   nombre), usage sur 30 jours, skills liés et « Fiche complète ».
3. **Given** un skill disponible de la bibliothèque, **Then** sa carte montre son verdict (icône + libellé) et
   « Installer… » ouvre son volet actuel.
4. **Given** un rangement par domaine qui change, **Then** les nœuds glissent vers leur nouvelle branche.

---

### User Story 3 — La carte de structure vivante (Priority: P3)

Les éléments d'une carte de structure flottent ; un clic ouvre une carte de détails : statut, avancement en jauge, ce
qui reste, fichiers liés, « Discuter ». La bascule Progression / Architecture fait glisser les éléments.

**Why this priority**: même comportement, moins de nœuds ; vient après les deux cartes les plus utilisées.

**Independent Test**: ouvrir une carte de structure, cliquer un élément, basculer en vue Architecture : les éléments
glissent vers leur couche.

**Acceptance Scenarios**:

1. **Given** un élément, **When** mentalyas clique dessus, **Then** sa carte montre statut, avancement, reste à faire,
   fichiers et « Discuter ».
2. **Given** la bascule Progression / Architecture, **Then** les éléments glissent vers leur nouvelle place.

---

### User Story 4 — Les blocs du canevas vivants (Priority: P4)

Widgets, notes, documents et cadres flottent ; un clic ouvre une carte de détails avec leur aperçu et leurs actions.

**Why this priority**: les blocs ont déjà leurs propres actions ; le gain est surtout de cohérence.

**Independent Test**: poser un widget et une note, cliquer chacun : carte de détails avec ses actions ; le
déplacement à la souris reste précis.

**Acceptance Scenarios**:

1. **Given** un bloc, **When** mentalyas clique dessus, **Then** sa carte montre son aperçu et ses actions.
2. **Given** un bloc qu'on déplace à la souris, **Then** il suit la souris sans flotter pendant le geste.

---

### User Story 5 — Main et agents en parallèle (Priority: P5)

mentalyas ouvre la discussion d'une étape : c'est le Main. Il en ouvre une deuxième sur une autre étape : elle devient
un agent, sur sa propre branche, et il le voit tout de suite (étiquette, couleur, en-tête). Les deux travaillent en même
temps ; l'anneau qui tourne montre qui répond.

**Why this priority**: prépare l'usage agentique (plusieurs Claude en parallèle) ; demande une copie de travail par
agent, la brique la plus lourde.

**Independent Test**: ouvrir trois discussions ; la première porte ★ Main, les deux autres ⑂ Agent avec leur branche ;
envoyer un message dans chacune sans attendre ; les anneaux tournent ; un fichier modifié par un agent n'apparaît que
sur sa branche.

**Acceptance Scenarios**:

1. **Given** aucune discussion, **When** mentalyas en ouvre une, **Then** c'est le Main (★, ambre, branche principale).
2. **Given** un Main ouvert, **When** il ouvre une autre discussion, **Then** c'est un agent (⑂, violet) sur la branche
   `agent/<nœud>`, annoncée dans la discussion et dans l'en-tête.
3. **Given** plusieurs discussions, **When** il envoie un message dans chacune, **Then** elles avancent en parallèle et
   chaque nœud concerné porte l'anneau d'activité.
4. **Given** un agent qui modifie un fichier, **Then** la modification reste sur sa branche jusqu'à une fusion décidée par
   mentalyas.

---

### Edge Cases

- Carte de détails près du bord de l'écran : elle reste entièrement visible (la vue se décale si besoin).
- Nœud qui disparaît (supprimé, filtré, replié) pendant que sa carte est ouverte : la carte se referme.
- Plusieurs centaines de nœuds : la flottaison ne ralentit ni le déplacement ni le zoom ; au-delà d'un seuil, elle peut
  se limiter aux nœuds visibles.
- Plusieurs cartes qui se recouvrent : la carte touchée passe devant ; chacune se déplace par son en-tête.
- Carte d'un agent fermée pendant qu'il travaille : la conversation s'arrête proprement, sa branche et sa copie de
  travail restent (à garder ou jeter plus tard).
- Main fermé alors que des agents tournent : les agents restent des agents ; la prochaine discussion ouverte devient le
  Main.
- Nœud replié dont un descendant a sa carte ouverte : la carte se referme. Nœud lié par un lien libre à un nœud
  masqué : le lien s'accroche au parent replié.
- Fichier introuvable, trop gros ou binaire : le lecteur l'indique en clair, comme la visionneuse actuelle.
- Nœud sans données pour une rubrique (pas de fiche, pas de lien) : la rubrique est absente plutôt que vide.
- Lecteur d'écran : l'ouverture d'une carte est annoncée ; l'ondulation n'est jamais annoncée.

## Requirements *(mandatory)*

### Functional Requirements

**Flottaison et déplacements**

- **FR-001**: Chaque nœud des quatre cartes MUST onduler de quelques pixels au repos, à un rythme propre et stable
  (déduit de son identifiant), sans changer sa position dans la disposition.
- **FR-002**: La flottaison MUST s'arrêter pendant un déplacement, un zoom ou un glisser, et tant qu'une carte de
  détails est ouverte ; elle MUST reprendre ensuite sans à-coup.
- **FR-003**: Quand une disposition change, les nœuds MUST glisser vers leur nouvelle place (≈ 700 ms, courbe douce)
  au lieu de sauter ; un nœud déplacé à la souris MUST suivre la souris sans délai.
- **FR-004**: En mode « animations réduites » (réglage de l'app ou du système), aucun nœud MUST NOT bouger de
  lui-même ; changements de disposition et ouverture / fermeture de carte MUST être instantanés ou en fondu court.

**Carte de détails**

- **FR-005** (D15): Un clic simple sur un nœud MUST ouvrir sa carte de détails à droite du nœud (D10) sans fermer les
  autres ; un nouveau clic sur ce nœud, ✕ ou Échap (carte active) MUST la refermer ; un clic dans le vide MUST NOT fermer
  de carte ; « Fermer les cartes » MUST toutes les fermer.
- **FR-006**: Le nœud ouvert MUST grossir légèrement et s'éclairer ; la carte MUST être reliée visuellement au nœud.
- **FR-007**: La carte MUST montrer, selon la sorte de nœud et quand l'information existe : statut, date, résumé,
  jauge d'énergie (D7) avec sa valeur en clair, nœuds liés, et ses actions (D6) ; une rubrique sans donnée est absente.
- **FR-008**: Les nœuds liés au nœud ouvert MUST pulser et leurs liens s'éclairer ; un clic sur un nœud lié dans la
  carte MUST ouvrir sa carte (et la vue se déplacer jusqu'à lui s'il est hors de l'écran).
- **FR-009** (D10): « Fiche » MUST déplier la fiche complète dans la carte par un étirement animé vers le bas ;
  « Discuter » MUST ouvrir la conversation (la même qu'aujourd'hui : messages, permissions, modes, orbe) dans la carte
  par un étirement animé sur le côté ; le volet de droite MUST NOT s'ouvrir pour ces cartes ; les actions d'un bloc
  MUST garder leur effet actuel.
- **FR-009a** (D10, D16): La carte de détails MUST subir le zoom de la toile, rester accrochée à son nœud sans délai ni
  inertie pendant un déplacement, un zoom ou la flottaison, pouvoir être déplacée par son en-tête (poignée visible) en
  gardant ensuite son décalage relatif, reliée au nœud par un fil, et la vue MUST glisser pour la garder entièrement
  visible après un étirement.

- **FR-009e** (D13): La carte d'un nœud qui a des fichiers ou un contenu consultable (livrable, action finale, élément
  de structure, document, skill) MUST les lister ; ouvrir l'un d'eux MUST étirer la carte en lecteur (code coloré avec
  numéros de ligne et différence quand elle existe, ou texte mis en forme), en lecture seule ; le lecteur MUST se replier
  par Échap ou ✕ avant que la carte ne se referme ; rien de ce qui se consulte aujourd'hui dans un volet ou une
  visionneuse pour ces nœuds MUST NOT être perdu.

- **FR-009f** (D14): Tout nœud ayant des sous-nœuds MUST pouvoir être replié et déplié, depuis le nœud (pastille
  « ▸ N ») et depuis sa carte de détails ; replier MUST faire rentrer les descendants dans le nœud en glissant, déplier
  les faire ressortir vers leur place, et la disposition MUST se resserrer ou s'écarter en glissant (FR-003) ; l'état
  MUST être mémorisé d'une ouverture à l'autre ; au clavier, la pastille MUST être atteignable et annoncer « Déplier /
  Replier « titre » (N sous-nœuds) » ; en mode « animations réduites », le changement MUST être instantané.

**Aspect des nœuds (D11)**

- **FR-009b**: Le nœud racine de chaque carte MUST s'afficher en gros orbe (dégradé des jetons du thème, disque central,
  anneau), sa taille et son aspect MUST refléter sa maturité ou son état (éclose : onde ; brute : pâle, anneau pointillé ;
  aucune onde en mode « animations réduites »).
- **FR-009c**: Chaque sous-nœud MUST s'afficher en petit cercle portant le pictogramme de son type et son titre dessous ;
  son statut MUST rester lisible sans la couleur seule (libellé dans la carte de détails et dans le nom accessible).
- **FR-009d**: Les cartes MUST se disposer en sens alterné par niveau (enfants de la racine en colonne, leurs enfants
  en ligne à droite, les suivants en colonne, etc.), chaque branche repoussant les voisines pour éviter tout
  chevauchement, y compris après un repli ou un dépli ; aucun agencement circulaire.

**Ce qui ne change pas**

- **FR-010**: Le double-clic MUST ouvrir la carte directement sur la conversation (idée, étape, élément, skill) ; Ctrl / Cmd / Maj + clic
  MUST garder la sélection multiple sans ouvrir de carte ; les menus contextuels MUST rester inchangés.
- **FR-011**: Les informations portées par les nœuds (titre, état, maturité, statut, rang, catégorie, badges) et leurs
  liens MUST rester disponibles, sur le nœud ou dans sa carte de détails ; seul leur aspect change (D11) ; toutes les
  couleurs ajoutées MUST venir des jetons du thème (clair et sombre).

**Accessibilité et performance**

- **FR-012**: Au clavier, Entrée sur un nœud MUST ouvrir sa carte et y placer le focus ; Échap MUST la refermer et
  rendre le focus au nœud ; la carte MUST être annoncée aux lecteurs d'écran, jamais l'ondulation ; l'information
  ne MUST jamais passer par la seule couleur (jauge avec sa valeur, statut avec son libellé).
- **FR-013**: Avec environ 300 nœuds affichés, déplacement et zoom de la carte MUST rester fluides.
- **FR-015** (D17): Chaque grande branche MUST avoir sa couleur, transmise à sa descendance ; la taille des sous-nœuds
  MUST décroître avec la profondeur ; le statut MUST s'afficher en pastille (avec libellé accessible) ; aucun cadre ni zone
  colorée MUST NOT entourer les groupes ; l'arbre de skills MUST garder son éventail (spec 020).
- **FR-016** (D18): Le lecteur et la discussion MUST se remplacer l'un l'autre dans l'étirement de droite ; un nœud ayant
  des fichiers MUST le signaler (trombone).
- **FR-017** (D19): La première discussion ouverte MUST être le Main ; chaque discussion ouverte en même temps MUST être
  un agent travaillant sur sa propre branche dans une copie de travail séparée ; rôle et branche MUST être visibles dans
  la discussion, autour du nœud et dans l'en-tête (équipe en cours) ; un nœud dont la conversation est en cours MUST porter
  un indicateur d'activité ; les changements d'un agent MUST rester sur sa branche jusqu'à une fusion décidée par
  l'utilisateur.
- **FR-018** (D20): Le zoom (molette, boutons) MUST glisser avec un amorti vers sa cible ; aucune parallaxe.
- **FR-019** (D21): Le style carbone (surfaces, liserés argentés, éclat animé des cartes, boutons) et le canevas sobre MUST
  être réalisés avec des jetons du thème ; l'éclat MUST s'arrêter en mode « animations réduites ».
- **FR-020** (D22): « Réorganiser » MUST être disponible dans la barre d'outils de chaque carte.
- **FR-021** (D23): Aucune fonctionnalité existante des quatre cartes ni de leurs volets MUST NOT disparaître ; chacune
  MUST avoir une place après la refonte (inchangée ou dans la carte de détails), vérifiée par l'inventaire du plan et
  par les tests existants, qui MUST rester verts.
- **FR-014**: Aucune dépendance nouvelle MUST NOT être ajoutée pour cette fonctionnalité, sauf celle des pictogrammes
  décidée en D12.

### Key Entities

- **Carte de détails** : nœud ouvert, sorte de nœud, rubriques affichées (statut, date, résumé, énergie, liens,
  actions) ; une seule à la fois par carte.
- **Énergie** : valeur 0–100 % (ou 1–5 ★ pour un skill) et son libellé, selon la sorte de nœud (D7).
- **Rythme de flottaison** : amplitude, durée et décalage propres à un nœud, stables (déduits de son identifiant).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100 %** des comportements actuels listés en D2 restent disponibles (vérifiés par les tests existants et
  un test guidé par carte).
- **SC-002**: mentalyas consulte les détails d'un nœud en **1 clic** et revient à la carte en **1 geste** (clic ou
  Échap), sans ouvrir le volet de droite.
- **SC-003**: Avec **300 nœuds** affichés, déplacement et zoom restent fluides à l'œil (aucune saccade perçue lors du
  test guidé) et la page reste utilisable en moins de 2 s.
- **SC-004**: En mode « animations réduites », **0** mouvement autonome de nœud (vérification sur les quatre cartes).
- **SC-005**: **0** violation d'accessibilité détectée par le contrôle automatique sur la carte de détails de chaque
  sorte de nœud.
- **SC-006**: mentalyas juge la carte « fluide et flottante », conforme au prototype validé (version 23), à chaque test
  guidé.
- **SC-007**: Avec **3 discussions** ouvertes en même temps (1 Main, 2 agents), chacune répond sans bloquer les autres et
  **0** fichier d'un agent n'apparaît sur la branche principale avant fusion.

## Assumptions

- La référence 21st.dev sert de maquette : durées (≈ 700 ms), courbe douce, grossissement et lueur du nœud ouvert,
  trait vers la carte, pulsation des voisins, jauge d'énergie ; son agencement en orbite et sa rotation automatique ne sont
  pas repris ; son orbe central et ses satellites inspirent l'aspect des nœuds (D11).
- Le résumé d'une idée vient de sa fiche ; la date est celle de création ou de dernière mise à jour connue.
- Les amendements des specs 008, 017 et 020 (D8) sont écrits au moment de livrer chaque carte.
- Le prototype validé (artifact « Nœuds vivants », version 23, données fictives) sert de référence visuelle et de
  comportement ; il n'est pas versionné dans le dépôt.
- Style carbone : il devient un thème du sélecteur (à côté de système, clair, sombre) ou remplace le thème sombre ;
  le choix est fait dans le plan.
- Hors périmètre : nouvelles dispositions, nouvelles données affichées hors carte de détails. La conversation elle-même
  (fil, permissions, modes, orbe) est reprise telle quelle, seulement déplacée du volet vers la carte (D10).
