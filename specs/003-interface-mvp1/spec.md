# Feature Specification: Interface MVP-1 « Brainstormer » — coquille, capture, neurones, fusion, réseau

**Feature Branch**: `003-interface-mvp1`

**Created**: 2026-09-28 · **Révisée** : 2026-09-28 (amendements L1b « Brainstormer » et L4b « neurones » — remplace la version liste/revue/organigramme, conservée dans l'historique git)

**Status**: Draft

**Input**: User description: "Interface du MVP-1 selon docs/FOUNDATION.md §0 et la maquette docs/design/neurones-dispositions-2a-2b-2c.png : coquille (zone de notification, démarrage avec Windows, navigation Idées · À valider · Historique, réglages), capture rapide, écran Idées en deux zones (incubateur des neurones bruts et en développement / réseau des neurones éclos reliés), plongée dans un neurone (fil d'Ariane, panneau de questions de l'IA, jauge, verrouillage), aperçu de synthèse et animation de fusion, suivi des neurones Action éclos, lecture des synthèses Réflexion, suggestions de liens, historique avec annulation, export Markdown, animations respectant la préférence « réduire les animations ». S'appuie sur 001 (moteur IA) et 002 (moteur de neurones)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capturer une idée en quelques secondes (Priority: P1)

Depuis n'importe quelle application, un raccourci clavier global ouvre une petite fenêtre de saisie ; l'utilisateur tape son idée, `Entrée`, la fenêtre disparaît et le focus revient là où il était. Un nouveau neurone brut apparaît dans l'incubateur ; l'IA locale lui propose une nature (Action/Réflexion) et une catégorie en arrière-plan. L'app vit dans la zone de notification et démarre avec Windows.

**Why this priority**: porte d'entrée du Brainstormer.

**Independent Test**: depuis un éditeur, raccourci → texte → `Entrée` ; vérifier l'affichage perçu instantané, le retour du focus, le neurone brut créé (nature/catégorie proposées, ou « À classer » si l'IA locale est arrêtée).

**Acceptance Scenarios**:

1. **Given** l'app en arrière-plan, **When** l'utilisateur appuie sur le raccourci, **Then** la fenêtre de capture apparaît au premier plan sur l'écran actif, prête à la saisie.
2. **Given** une idée tapée, **When** `Entrée`, **Then** le neurone est créé, une confirmation brève s'affiche, la fenêtre se ferme et le focus revient à l'application précédente.
3. **Given** du texte tapé, **When** `Échap` ou clic extérieur, **Then** la fenêtre se ferme et le texte est gardé en brouillon.
4. **Given** une idée tapée, **When** `Ctrl+Entrée`, **Then** le neurone est créé et l'app s'ouvre directement en plongée dans ce neurone, développement lancé.
5. **Given** l'IA locale arrêtée, **When** une idée est capturée, **Then** le neurone est créé (nature Réflexion par défaut, catégorie « À classer ») et sera classé plus tard.

---

### User Story 2 - Voir tout son cerveau : incubateur et réseau (Priority: P1)

L'écran Idées montre deux zones : à gauche l'**incubateur** (neurones bruts en pointillés qui dérivent lentement, neurones en développement avec leurs premiers sous-neurones), à droite le **réseau** (neurones éclos à double anneau et halo, reliés par des liens libellés). Un en-tête résume « N brutes · N en dév. · N écloses ». L'utilisateur peut créer une idée (« + Une idée ? »), zoomer, recentrer, filtrer (nature, catégorie), rechercher.

**Why this priority**: c'est la vision neuronale demandée ; l'écran d'accueil du Brainstormer.

**Independent Test**: charger un jeu de neurones fictifs dans les trois états ; vérifier la répartition dans les deux zones, les aspects distincts, les liens, les compteurs, les filtres et la navigation au clavier.

**Acceptance Scenarios**:

1. **Given** des neurones dans les trois états, **When** l'utilisateur ouvre Idées, **Then** bruts et en développement sont dans l'incubateur, éclos dans le réseau, chacun avec un aspect distinct, et les compteurs sont justes.
2. **Given** des liens acceptés, **When** le réseau s'affiche, **Then** chaque lien porte son libellé ; les liens suggérés apparaissent en pointillés avec ✓ / ✗.
3. **Given** beaucoup de neurones, **When** l'utilisateur filtre par nature ou catégorie, ou recherche un mot, **Then** seuls les neurones correspondants restent mis en évidence.
4. **Given** aucun neurone, **When** l'écran s'ouvre, **Then** un état vide explique comment capturer la première idée.
5. **Given** la souris inutilisée, **When** l'utilisateur navigue au clavier, **Then** il peut parcourir les neurones, en ouvrir un et revenir, avec un focus visible.

---

### User Story 3 - Plonger dans un neurone et le faire pousser (Priority: P1)

Un double-clic (ou `Entrée`) sur un neurone ouvre la **plongée** : zoom sur le neurone, fil d'Ariane (Idées › 2e écran › Budget ?), badge de profondeur, parent estompé (clic = remonter). Un panneau latéral affiche la question de l'IA sélectionnée, ses réponses rapides, un champ libre et « Je ne sais pas » ; autour du neurone, les extensions proposées apparaissent comme des emplacements « + ». Répondre fait pousser un sous-neurone ; l'utilisateur peut ajouter sa propre branche, écarter une extension, demander « plus de questions », modifier ou supprimer un sous-neurone. La jauge de contexte (barre + manques) est visible en permanence.

**Why this priority**: c'est l'interaction centrale.

**Independent Test**: plonger dans un neurone fictif, répondre à 3 extensions, ajouter une branche, remonter via le fil d'Ariane ; vérifier les sous-neurones, la jauge et la navigation.

**Acceptance Scenarios**:

1. **Given** un neurone brut, **When** l'utilisateur plonge dedans, **Then** le développement se lance, au moins 3 extensions apparaissent et le panneau montre la première question.
2. **Given** une extension, **When** l'utilisateur répond, **Then** un sous-neurone pousse immédiatement (animation courte) et un indicateur montre que l'IA réfléchit aux suivantes.
3. **Given** un sous-neurone, **When** l'utilisateur double-clique dessus, **Then** la plongée descend d'un niveau (fil d'Ariane mis à jour) ; **When** il clique le parent estompé ou le fil d'Ariane, **Then** il remonte.
4. **Given** la jauge, **When** une réponse fait évoluer le contexte, **Then** la barre et la liste des manques se mettent à jour ; le bouton « Verrouiller 🔒 » devient actif à « suffisant ».
5. **Given** une extension non pertinente, **When** l'utilisateur l'écarte, **Then** elle disparaît.

---

### User Story 4 - Verrouiller, confirmer, voir la fusion (Priority: P1)

« Verrouiller 🔒 » demande la synthèse à l'IA ; un aperçu compact s'affiche (plan : tâches, conditions, dates ; ou synthèse : pistes, décisions, pour/contre, questions ouvertes). L'utilisateur peut corriger un élément, demander une révision avec une consigne, refuser, ou confirmer. À la confirmation, les sous-neurones se résorbent dans le neurone principal (animation de fusion), le neurone prend l'aspect « éclos » et migre de l'incubateur vers le réseau. Si la jauge est « insuffisant », un avertissement liste les manques et demande confirmation avant de lancer la synthèse.

**Why this priority**: le moment « récompense » et la garantie « rien sans validation ».

**Independent Test**: verrouiller un neurone Action et un neurone Réflexion fictifs (IA simulée) ; corriger un montant, confirmer ; vérifier la fusion, la migration et l'historique ; annuler et vérifier le retour.

**Acceptance Scenarios**:

1. **Given** un neurone « suffisant », **When** l'utilisateur verrouille, **Then** l'aperçu de synthèse adapté à la nature s'affiche et rien n'est encore appliqué.
2. **Given** un aperçu, **When** l'utilisateur confirme, **Then** l'animation de fusion joue, le neurone devient éclos et apparaît dans le réseau ; une notification propose « Annuler » pendant 10 secondes.
3. **Given** un aperçu, **When** l'utilisateur demande une révision avec une consigne, **Then** un nouvel aperçu remplace le précédent.
4. **Given** un neurone « insuffisant », **When** l'utilisateur verrouille, **Then** un avertissement liste les manques et la synthèse ne part qu'après confirmation.
5. **Given** la préférence système « réduire les animations », **When** une fusion a lieu, **Then** elle est remplacée par un fondu court, sans mouvement.

---

### User Story 5 - Suivre et exploiter un neurone éclos (Priority: P2)

En plongée dans un neurone **Action** éclos : le plan s'affiche (tâches, conditions en losange, opportunités) ; l'utilisateur coche une tâche faite (les dépendantes se débloquent), choisit la branche réelle d'une condition (les autres grisées), marque un déclencheur atteint, édite un titre, une date ou un montant. En plongée dans un neurone **Réflexion** éclos : la synthèse structurée s'affiche, avec les sous-neurones sources de chaque point. Les deux peuvent être **rouverts** (retour en développement) ou **exportés en Markdown**.

**Why this priority**: donne une suite concrète à l'éclosion ; les stories 1 à 4 forment déjà un MVP démontrable.

**Independent Test**: sur un neurone Action éclos fictif, choisir « Non » à « argent ? », marquer « mission payée » ; vérifier les statuts. Exporter un neurone Réflexion et vérifier le fichier Markdown.

**Acceptance Scenarios**:

1. **Given** un plan, **When** l'utilisateur marque une tâche faite, **Then** ses dépendantes passent de bloquées à prêtes.
2. **Given** une condition, **When** l'utilisateur choisit une branche, **Then** les autres sont grisées et restent réactivables.
3. **Given** un déclencheur, **When** il est marqué atteint, **Then** les tâches qui l'attendent deviennent prêtes.
4. **Given** un neurone éclos, **When** l'utilisateur l'exporte, **Then** un fichier Markdown contient le titre, la nature, l'arbre des questions/réponses et le plan ou la synthèse, à l'emplacement choisi.
5. **Given** un neurone éclos, **When** l'utilisateur le rouvre, **Then** il repasse en développement dans l'incubateur, son plan ou sa synthèse précédents restant consultables.

---

### User Story 6 - À valider, Historique, Réglages, premier lancement (Priority: P2)

« À valider » regroupe les suggestions de liens en attente et les aperçus de synthèse laissés ouverts. « Historique » liste les changements (fusions, éditions, liens) avec « Annuler » quand c'est possible. Les réglages (⚙) couvrent raccourci, démarrage avec Windows, thème, animations (auto / réduites) et l'accès aux réglages IA. Un premier lancement court vérifie l'IA locale et fait essayer le raccourci.

**Why this priority**: confort et maîtrise ; non bloquant pour la démonstration du cœur.

**Independent Test**: accepter/refuser une suggestion depuis À valider ; annuler une fusion depuis l'historique ; changer le thème et l'option d'animations ; relancer l'app.

**Acceptance Scenarios**:

1. **Given** des suggestions de liens, **When** l'utilisateur ouvre À valider, **Then** il les accepte ou refuse avec leur justification visible ; le compteur du menu et de l'icône se met à jour.
2. **Given** une fusion récente, **When** l'utilisateur l'annule depuis l'historique, **Then** le neurone revient en développement avec son arbre intact ; en cas de modification ultérieure incompatible, un conflit est signalé.
3. **Given** « animations réduites » dans les réglages, **When** l'app anime un changement, **Then** seules des transitions instantanées ou des fondus courts sont utilisés, même si le système ne le demande pas.
4. **Given** un premier lancement, **When** l'app démarre, **Then** le parcours (IA locale, raccourci obligatoires ; Claude, profil facultatifs) s'affiche une seule fois.

---

### Edge Cases

- Raccourci indisponible : l'app fonctionne via la zone de notification et signale le problème.
- IA externe indisponible pendant la plongée : branches manuelles possibles, extensions IA et verrouillage en attente, message clair.
- Un neurone est modifié pendant qu'un aperçu de synthèse est ouvert : l'aperçu est marqué périmé et doit être régénéré.
- Plus de 100 neurones : les neurones hors de la vue ne sont pas animés ; la dérive est suspendue quand l'utilisateur interagit.
- Export vers un emplacement non accessible : message d'erreur, rien n'est perdu.
- Plusieurs écrans : la capture s'ouvre sur l'écran actif.
- Annulation d'une fusion après réouverture et nouvelles réponses : conflit signalé, annulation refusée.

## Requirements *(mandatory)*

### Functional Requirements

**Coquille**
- **FR-001**: L'app MUST tourner en arrière-plan avec une icône de zone de notification (Capturer, Ouvrir, À valider (n), Quitter), démarrer avec Windows (activé par défaut) et n'avoir qu'une seule instance.
- **FR-002**: La navigation latérale MUST proposer Idées, À valider (avec compteur) et Historique ; les réglages MUST être accessibles en haut à droite.
- **FR-003**: Les réglages MUST couvrir : raccourci, démarrage avec Windows, thème (clair/sombre/système), animations (automatique selon le système / réduites) et l'accès aux réglages IA et contexte (feature 001).
- **FR-004**: Un premier lancement MUST guider (IA locale et raccourci obligatoires ; Claude et profil facultatifs), une seule fois, réaccessible.
- **FR-005**: Toute l'interface MUST être utilisable au clavier seul, avec focus visible, contrastes AA en clair et en sombre.

**Capture (F1)**
- **FR-006**: Un raccourci global configurable (défaut `Ctrl+Alt+Espace`) MUST ouvrir la capture au premier plan sur l'écran actif.
- **FR-007**: La capture MUST gérer `Entrée` (créer), `Maj+Entrée` (retour ligne), `Ctrl+Entrée` (créer et plonger), `Échap`/clic extérieur (fermer, brouillon conservé), 2 000 caractères max, texte vide ignoré ; puis rendre le focus à l'application précédente.
- **FR-008**: Un neurone capturé MUST être créé même sans IA ; nature et catégorie proposées en arrière-plan, signalées comme telles, modifiables en un clic.

**Écran Idées**
- **FR-009**: L'écran Idées MUST présenter l'incubateur (bruts + en développement) et le réseau (éclos), avec trois aspects distincts : brut (contour pointillé), en développement (plein, sous-neurones visibles), éclos (double anneau + halo).
- **FR-010**: Le réseau MUST afficher les liens libellés ; les liens suggérés MUST être distincts (pointillés) et acceptables/refusables sur place.
  Les liens MUST NOT se croiser (ni passer sous une idée) dès que le réseau le permet géométriquement (réseau planaire) ; sinon le nombre de croisements MUST être réduit au minimum atteignable par la disposition *(exigence de mentalyas, 2026-09-28)*.
- **FR-011**: L'écran MUST offrir : compteurs par état, « + Une idée ? », zoom, recentrer, filtres (nature, catégorie), recherche, état vide.
- **FR-012**: Les neurones bruts MUST dériver lentement ; la dérive MUST se suspendre pendant l'interaction et être désactivée en mode animations réduites.

- **FR-026**: La toile MUST accepter un type de nœud générique « bloc » (conteneur vide que l'utilisateur place, déplace, redimensionne et supprime, avec position et taille persistées), sans exécution de code en MVP-1 ; il servira de support aux mini-widgets de la v2 (docs/brainstorm/L4c-widgets.md).
- **FR-027**: Les suggestions de l'IA (spec 002 US6) MUST apparaître comme **neurones fantômes** rattachés à leur neurone (contour en pointillés, opacité réduite, apparition 150 ms) : Tab ou clic = accepter (le fantôme se solidifie en sous-neurone marqué ✦ IA), Échap ou « × » = ignorer ; un fantôme en vérification web affiche un indicateur discret, puis ses sources (titre + domaine, lien externe ouvert dans le navigateur système) au survol ou au focus ; tout reste utilisable au clavier et lisible par lecteur d'écran (« suggestion de l'IA »).
- **FR-028** *(ajout 2026-09-29, décision de mentalyas)*: Un lien accepté MAY porter **une seule graine** : une idée nouvelle (titre + pourquoi) que l'IA voit naître de la rencontre des deux idées. Elle est proposée avec les liens suggérés à l'éclosion (même appel, aucun coût en plus) et, en arrière-plan, quand l'utilisateur relie lui-même deux idées. La graine n'est visible qu'une fois le lien accepté (pastille 🌱 au milieu du trait ; un clic ou `Entrée` ouvre une carte — titre, pourquoi, « Refuser » / « Faire naître » — refermée par un clic ailleurs ou `Échap` ; *révisé 2026-09-29 après test : l'ouverture au survol se refermait avant qu'on atteigne les boutons*). Acceptée, elle devient une idée **brute** « née de A × B », placée entre ses parents **dans le réseau**, développable comme les autres ; l'acceptation est annulable depuis l'historique. Refusée, elle n'est jamais reproposée pour ce lien. Rien ne se crée sans acceptation.

**Plongée & croissance**
- **FR-013**: Double-clic ou `Entrée` sur un neurone MUST ouvrir la plongée : neurone centré, sous-neurones autour, fil d'Ariane, badge de profondeur, parent estompé cliquable, panneau latéral.
- **FR-014**: Le panneau MUST afficher la question sélectionnée, ses réponses rapides, un champ libre, « Je ne sais pas », les autres extensions, « Plus de questions », « Ajouter ma branche », et la jauge (niveau + manques).
- **FR-015**: Répondre MUST faire apparaître le sous-neurone immédiatement, puis afficher un indicateur tant que l'IA prépare les extensions suivantes.
- **FR-016**: Les utilisateurs MUST pouvoir écarter une extension, modifier et supprimer un sous-neurone (confirmation si descendants), changer la nature et la catégorie du neurone.

**Fusion**
- **FR-017**: « Verrouiller » MUST être actif dès « suffisant » ; avant, il MUST avertir que le résultat risque de ne pas être optimal, afficher les manques et demander confirmation.
- **FR-018**: L'aperçu de synthèse MUST être compact et adapté à la nature (plan ou synthèse), éditable élément par élément, avec Réviser (consigne), Refuser et Confirmer ; un aperçu périmé MUST être signalé et non confirmable.
- **FR-019**: La confirmation MUST déclencher l'animation de fusion, l'aspect éclos et la migration vers le réseau, puis une notification « Annuler » pendant 10 secondes.

**Neurones éclos**
- **FR-020**: La plongée dans un neurone Action éclos MUST afficher le plan et permettre : changer le statut d'une tâche (avec propagation aux dépendantes), choisir une branche, marquer un déclencheur, éditer titre/date/montant, ajouter une tâche.
- **FR-021**: La plongée dans un neurone Réflexion éclos MUST afficher la synthèse structurée avec, pour chaque point, l'accès aux sous-neurones sources.
- **FR-022**: Les utilisateurs MUST pouvoir rouvrir un neurone éclos et exporter tout neurone éclos en Markdown (titre, nature, catégorie, arbre questions/réponses, plan ou synthèse, liens).

**À valider & Historique**
- **FR-023**: « À valider » MUST lister les suggestions de liens et les aperçus de synthèse en attente, avec leur justification, et permettre de décider sur place.
- **FR-024**: L'historique MUST lister les changements (fusions, éditions, liens, annulations) et permettre d'annuler un lot ; l'annulation d'une fusion ramène le neurone en développement et signale les conflits.

**Animations**
- **FR-025**: Les animations MUST suivre les durées : pousse 250 ms, plongée/remontée 400 ms, fusion 600–800 ms, éclosion/migration ~600 ms, apparition de suggestion 150 ms, halo en pulsation lente ; toutes MUST être remplacées par des transitions instantanées ou des fondus courts si le système ou les réglages demandent des animations réduites.

### Key Entities

- **Réglages de l'app**: raccourci, démarrage, thème, animations, premier lancement effectué, brouillon de capture.
- **Vues** (issues de 002) : neurone racine, arbre, extensions, jauge, synthèse, plan, synthèse structurée, liens.
- **Lot d'historique**: ensemble de changements annulables (issu de 002 `change_log`).
- **Export Markdown**: fichier généré à la demande (pas stocké dans l'app).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Capture d'une phrase courte (raccourci → fermeture) en moins de 5 secondes ; fenêtre perçue instantanée dans 95 % des ouvertures.
- **SC-002**: Un nouvel utilisateur (mentalyas) fait pousser un neurone jusqu'à « suffisant » et le fait éclore sans aide en moins de 3 minutes sur un sujet simple.
- **SC-003**: Chaque réponse fait apparaître son sous-neurone de façon perçue comme instantanée.
- **SC-004**: L'écran Idées reste fluide (déplacement, zoom, dérive) avec 100 neurones et 50 liens.
- **SC-005**: 100 % des actions principales (capturer, naviguer, plonger, répondre, verrouiller, confirmer, cocher, accepter un lien, annuler) sont réalisables au clavier seul.
- **SC-006**: Avec « animations réduites », aucun mouvement autre que des fondus courts n'est joué (vérification sur les 7 animations).
- **SC-007**: Un export Markdown s'ouvre correctement dans un éditeur Markdown standard et contient 100 % des éléments du neurone (arbre, plan/synthèse, liens).
- **SC-008**: Toute fusion annulée dans les 10 secondes restaure exactement l'état précédent.

## Assumptions

- Features 001 (moteur IA, réglages IA, contexte) et 002 (moteur de neurones : croissance, jauge, fusion, liens, `change_log`) sont implémentées.
- Planning, Outlook, conseiller proactif, compagnon et « Passer à l'action » relèvent du MVP-2 ; l'entrée Planning est ajoutée à la navigation à ce moment-là.
- Pont vers le hub ProjectMaster : v2.
- La maquette `docs/design/neurones-dispositions-2a-2b-2c.png` fait référence pour la disposition ; la direction visuelle finale (couleurs, typographie) viendra des designs de mentalyas et pourra ajuster les tokens.
