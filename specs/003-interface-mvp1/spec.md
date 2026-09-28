# Feature Specification: Interface MVP-1 — coquille, capture, validation, organigramme (F1 · F3 · F4)

**Feature Branch**: `003-interface-mvp1`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Boucler le MVP-1 : la coquille de l'app (démarrage avec Windows, icône de zone de notification, navigation latérale, réglages, premier lancement minimal), F1 Capture rapide (docs/FOUNDATION.md §9.1), F3 Aperçu & validation (§9.3) et F4 Organigramme (§9.4), avec les parcours P0, P1, P2 et P4 et les écrans E1, E3, E5, E6, E8, E9, E10, E11 du niveau 4 (§11). S'appuie sur les features 001 (moteur IA) et 002 (structuration)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capturer une idée en quelques secondes (Priority: P1)

Depuis n'importe quelle application, l'utilisateur appuie sur un raccourci clavier global : une petite fenêtre de saisie apparaît au premier plan, il tape son idée, `Entrée`, la fenêtre disparaît et le focus revient là où il était. En arrière-plan, l'IA locale propose une catégorie. L'app tourne en permanence, discrète, avec une icône dans la zone de notification et un démarrage automatique avec Windows.

**Why this priority**: porte d'entrée de tout le système ; si capturer est pénible, l'agenda ne s'alimente pas.

**Independent Test**: depuis un éditeur de texte, déclencher le raccourci, taper une idée, valider ; vérifier l'affichage quasi instantané, le retour du focus et l'idée enregistrée (catégorisée ou « À classer »).

**Acceptance Scenarios**:

1. **Given** l'app lancée en arrière-plan, **When** l'utilisateur appuie sur le raccourci depuis une autre application, **Then** la fenêtre de capture apparaît au premier plan, champ prêt à la saisie, de façon perçue comme instantanée.
2. **Given** une idée tapée, **When** l'utilisateur appuie sur `Entrée`, **Then** l'idée est enregistrée, une confirmation brève s'affiche, la fenêtre se ferme et le focus revient à l'application précédente.
3. **Given** du texte tapé, **When** l'utilisateur appuie sur `Échap` ou clique ailleurs, **Then** la fenêtre se ferme et le texte est conservé en brouillon pour la prochaine ouverture.
4. **Given** une idée tapée, **When** l'utilisateur appuie sur `Ctrl+Entrée`, **Then** l'idée est enregistrée et l'app complète s'ouvre sur son questionnaire de structuration.
5. **Given** l'IA locale arrêtée, **When** une idée est capturée, **Then** elle est enregistrée avec la catégorie « À classer » et sera catégorisée plus tard.
6. **Given** une idée catégorisée par l'IA, **When** l'utilisateur la consulte, **Then** la catégorie est marquée « proposée par l'IA » et modifiable en un clic.

---

### User Story 2 - Relire et valider une proposition de l'IA (Priority: P1)

Les propositions de l'IA (décompositions, restructurations) arrivent dans une file « À valider » signalée par un badge. L'écran de revue montre l'arbre proposé et la liste des changements (ajout, modification, suppression). L'utilisateur peut décocher des éléments, corriger un texte, un montant ou une date, puis accepter, refuser (avec raison facultative) ou demander une correction à l'IA. L'acceptation s'applique en une fois, tout ou rien, et reste annulable.

**Why this priority**: principe « humain dans la boucle » ; sans validation, les propositions de F2 ne deviennent jamais des tâches.

**Independent Test**: à partir d'une proposition préparée (fixture), décocher une tâche, corriger un montant, accepter ; vérifier l'arbre créé, l'historique, puis annuler et vérifier le retour à l'état initial.

**Acceptance Scenarios**:

1. **Given** une proposition en attente, **When** l'utilisateur ouvre la revue, **Then** il voit l'arbre et la liste des changements avec des marqueurs distincts pour ajout, modification et suppression.
2. **Given** une proposition, **When** l'utilisateur décoche une tâche dont une autre dépend, **Then** un avertissement lui propose de décocher aussi la tâche dépendante ou d'annuler.
3. **Given** une proposition éditée, **When** l'utilisateur accepte, **Then** tous les éléments cochés sont appliqués ensemble ; si une erreur survient, rien n'est appliqué.
4. **Given** une proposition acceptée, **When** l'utilisateur choisit « Annuler » dans la notification ou l'historique, **Then** l'état précédent est restauré.
5. **Given** une proposition, **When** l'utilisateur la refuse avec une raison, **Then** rien n'est modifié et la raison est conservée comme exemple pour l'agent.
6. **Given** une proposition, **When** l'utilisateur demande une correction (« uniquement via la mission »), **Then** une nouvelle version remplace l'ancienne dans la file.
7. **Given** une proposition dont l'idée a changé depuis, **When** elle est affichée, **Then** elle est marquée « périmée » et ne peut pas être acceptée telle quelle.

---

### User Story 3 - Explorer et faire vivre l'organigramme (Priority: P1)

L'onglet Organigramme montre toutes les idées sous forme de carte : une carte par idée (repliée, couleur de sa catégorie), les liens entre idées (« finance »), et, en dépliant une idée, son arbre (tâches, conditions en losange, opportunités). L'utilisateur choisit la branche réelle d'une condition (les autres sont grisées mais conservées), coche une tâche faite (les tâches qui en dépendent se débloquent), marque un déclencheur atteint, et peut éditer directement un texte, une date ou un montant.

**Why this priority**: c'est la « carte » de l'agenda organique et l'endroit où le plan avance au quotidien.

**Independent Test**: charger l'arbre « 2e écran » accepté ; choisir « Non » à la condition, marquer « Mission payée » atteint ; vérifier que « Réserver X € » passe de bloquée à prête et que la branche « Oui » est grisée.

**Acceptance Scenarios**:

1. **Given** des idées structurées, **When** l'utilisateur ouvre l'Organigramme, **Then** il voit une carte par idée, colorée par catégorie, avec les liens entre idées, et peut zoomer, se déplacer et utiliser une mini-carte.
2. **Given** une condition « J'ai l'argent ? », **When** l'utilisateur choisit « Non », **Then** la branche « Non » devient active, la branche « Oui » est grisée et reste réactivable.
3. **Given** une tâche dont une autre dépend, **When** l'utilisateur la marque faite, **Then** la tâche dépendante passe de « bloquée » à « prête ».
4. **Given** un déclencheur « au paiement de la mission », **When** l'utilisateur le marque atteint, **Then** les tâches qui l'attendent deviennent prêtes.
5. **Given** un nœud, **When** l'utilisateur modifie son titre, sa date ou son montant, **Then** la modification est appliquée directement et inscrite dans l'historique.
6. **Given** beaucoup d'idées, **When** l'utilisateur filtre par catégorie ou statut, recherche un mot ou fait le focus sur une idée, **Then** seule la sélection (et ses voisines directes pour le focus) est affichée.
7. **Given** aucune idée structurée, **When** l'utilisateur ouvre l'Organigramme, **Then** un état vide explique comment capturer et structurer une idée.

---

### User Story 4 - Naviguer dans l'app et la régler (Priority: P2)

L'app complète s'ouvre depuis l'icône de la zone de notification. Une navigation latérale gauche donne accès à Idées · À valider (badge) · Organigramme · Historique (le Planning viendra avec le MVP-2) ; les réglages (⚙) sont en haut à droite : raccourci, démarrage avec Windows, apparence (clair/sombre), nombre maximal de questions, et l'accès aux réglages IA de la feature 001.

**Why this priority**: indispensable au confort, mais les stories 1 à 3 sont démontrables sur des écrans isolés.

**Independent Test**: ouvrir l'app depuis l'icône, parcourir les 4 sections au clavier, changer le thème et le raccourci, redémarrer ; vérifier que les réglages sont conservés.

**Acceptance Scenarios**:

1. **Given** l'app en arrière-plan, **When** l'utilisateur clique l'icône de la zone de notification, **Then** un menu propose : Capturer une idée, Ouvrir l'app, À valider (nombre), Quitter.
2. **Given** l'app complète, **When** l'utilisateur navigue au clavier, **Then** chaque section et chaque action est accessible sans souris, avec un focus visible.
3. **Given** un raccourci déjà utilisé par une autre application, **When** l'app tente de l'enregistrer, **Then** l'utilisateur est prévenu et invité à en choisir un autre.
4. **Given** « Démarrer avec Windows » activé, **When** l'utilisateur ouvre sa session, **Then** l'app démarre discrètement dans la zone de notification.

---

### User Story 5 - Premier lancement guidé (Priority: P3)

Au tout premier lancement, un parcours court vérifie l'IA locale (instructions si absente), fait choisir et essayer le raccourci, propose (facultatif) de configurer Claude et le profil, puis invite à capturer la première idée.

**Why this priority**: améliore la prise en main, mais les réglages permettent déjà tout configurer.

**Independent Test**: démarrer avec des données vides ; suivre le parcours en sautant les étapes facultatives ; vérifier qu'il ne réapparaît plus ensuite.

**Acceptance Scenarios**:

1. **Given** un premier lancement, **When** l'app démarre, **Then** le parcours s'affiche ; seules les étapes « IA locale » et « Raccourci » sont obligatoires.
2. **Given** le parcours terminé ou passé, **When** l'app redémarre, **Then** il ne s'affiche plus (réaccessible depuis les réglages).

---

### Edge Cases

- Raccourci global indisponible au démarrage : l'app fonctionne via l'icône de la zone de notification et signale le problème.
- Fenêtre de capture ouverte pendant qu'un jeu ou une vidéo est en plein écran : elle s'affiche au-dessus sans voler durablement le focus.
- Deux propositions en attente pour la même idée : la plus récente remplace l'autre, marquée « remplacée ».
- Annulation d'une validation après que l'utilisateur a modifié l'arbre à la main : l'annulation ne restaure que ce que la validation avait changé, et prévient en cas de conflit.
- Idée supprimée ou archivée alors qu'une proposition la concerne : la proposition devient « périmée ».
- Organigramme de 50 idées et 300 nœuds : navigation fluide.
- Plusieurs écrans : la fenêtre de capture s'ouvre sur l'écran actif.
- Propositions en attente depuis plus de 14 jours : archivées automatiquement, récupérables.

## Requirements *(mandatory)*

### Functional Requirements

**Coquille & réglages**
- **FR-001**: L'app MUST fonctionner en arrière-plan avec une icône de zone de notification (menu : Capturer, Ouvrir l'app, À valider (n), Quitter) et MUST pouvoir démarrer avec Windows (réglage activé par défaut).
- **FR-002**: L'app complète MUST offrir une navigation latérale (Idées, À valider avec badge, Organigramme, Historique) et un accès aux réglages en haut à droite.
- **FR-003**: Les utilisateurs MUST pouvoir régler : raccourci de capture, démarrage avec Windows, thème clair/sombre/système, nombre maximal de questions (3 à 15), et accéder aux réglages IA (feature 001).
- **FR-004**: L'app MUST afficher un parcours de premier lancement (IA locale et raccourci obligatoires ; Claude, profil facultatifs), une seule fois, réaccessible depuis les réglages.
- **FR-005**: Toute l'interface MUST être utilisable entièrement au clavier, avec focus visible et contrastes conformes au niveau AA.

**F1 — Capture**
- **FR-006**: Un raccourci clavier global configurable (défaut `Ctrl+Alt+Espace`) MUST ouvrir la fenêtre de capture au premier plan, sur l'écran actif, champ prêt à la saisie.
- **FR-007**: La fenêtre de capture MUST supporter : `Entrée` enregistrer, `Maj+Entrée` retour à la ligne, `Ctrl+Entrée` enregistrer et structurer, `Échap`/clic extérieur fermer en conservant le brouillon ; texte vide ignoré ; 2 000 caractères maximum.
- **FR-008**: Après enregistrement, la fenêtre MUST afficher une confirmation brève, se fermer et rendre le focus à l'application précédente.
- **FR-009**: Une idée capturée MUST être enregistrée même si aucune IA n'est disponible ; la catégorisation par l'IA locale est faite en arrière-plan, et rejouée plus tard si l'IA est indisponible.
- **FR-010**: La catégorie proposée par l'IA MUST être signalée comme telle et modifiable en un clic ; un choix de l'utilisateur n'est jamais écrasé par l'IA.

**F3 — Validation**
- **FR-011**: Le système MUST présenter les propositions en attente dans une file « À valider » avec un compteur visible (navigation et icône de notification).
- **FR-012**: L'écran de revue MUST afficher l'arbre proposé et la liste des changements marqués ajout / modification / suppression, avec le caractère « dégradé » éventuel.
- **FR-013**: Les utilisateurs MUST pouvoir décocher un élément, modifier titre, montant et date avant acceptation ; décocher un élément dont un autre dépend MUST déclencher un avertissement.
- **FR-014**: L'acceptation MUST appliquer tous les éléments cochés en une seule opération tout-ou-rien, créer l'arbre de l'idée (tâches, conditions, opportunités, dépendances, liens), mettre à jour le statut de l'idée et enregistrer l'historique.
- **FR-015**: Les utilisateurs MUST pouvoir refuser une proposition avec une raison facultative (« pas pertinent », « faux », « plus tard », texte libre) ; la décision MUST alimenter les exemples de l'agent (acceptée = positif, refusée = négatif).
- **FR-016**: Les utilisateurs MUST pouvoir demander une correction à l'IA avec une consigne ; la nouvelle version remplace l'ancienne.
- **FR-017**: Une proposition dont l'idée a changé depuis sa création MUST être marquée « périmée » et ne MUST PAS être acceptée sans être régénérée.
- **FR-018**: Les utilisateurs MUST pouvoir annuler une validation depuis la notification qui suit et depuis l'historique ; l'annulation restaure l'état précédent et signale les conflits avec des modifications manuelles ultérieures.
- **FR-019**: Les propositions en attente depuis plus de 14 jours MUST être archivées automatiquement et rester consultables.

**F4 — Organigramme**
- **FR-020**: L'organigramme MUST afficher une carte par idée (repliée par défaut, couleur de catégorie), les liens entre idées, et au dépliage l'arbre de l'idée avec des formes distinctes pour idée, tâche, condition et opportunité.
- **FR-021**: L'organigramme MUST offrir zoom, déplacement, mini-carte, mise en page automatique à la première ouverture et mémorisation des positions déplacées.
- **FR-022**: Les statuts de tâche MUST être : bloquée, prête, en cours, faite, abandonnée ; une tâche est bloquée tant qu'une dépendance n'est pas faite ou qu'un déclencheur n'est pas atteint ; tout changement MUST se propager aux tâches dépendantes.
- **FR-023**: Les utilisateurs MUST pouvoir choisir la branche active d'une condition ; les autres branches sont grisées, conservées et réactivables.
- **FR-024**: Les utilisateurs MUST pouvoir marquer un déclencheur comme atteint (et l'annuler).
- **FR-025**: Les utilisateurs MUST pouvoir modifier directement titre, date et montant d'un nœud et ajouter une tâche ; ces éditions sont appliquées sans passer par la validation et inscrites dans l'historique.
- **FR-026**: L'organigramme MUST offrir filtres par catégorie et statut, recherche texte, focus sur une idée et ses voisines directes, et un état vide explicatif.
- **FR-027**: Un panneau de détail MUST montrer le nœud sélectionné (idée d'origine, dépendances, montant, branche, statut) à côté de la carte.

**Historique**
- **FR-028**: L'historique MUST lister les changements (validations, éditions manuelles, annulations) du plus récent au plus ancien, avec l'action « Annuler » quand elle est possible.

### Key Entities

- **Réglages de l'app**: raccourci, démarrage avec Windows, thème, nombre maximal de questions, premier lancement effectué.
- **Brouillon de capture**: texte en cours non validé.
- **Proposition** (feature 002) : statut étendu avec « archivée » ; sélection de l'utilisateur (éléments cochés, éditions) au moment de l'acceptation.
- **Nœud, Dépendance, Lien entre idées, Historique** (feature 002) : désormais créés et modifiés par cette feature.
- **Position de nœud**: coordonnées mémorisées sur la carte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Une idée est capturée (raccourci → saisie → fermeture) en moins de 5 secondes pour une phrase courte, et la fenêtre de capture apparaît de façon perçue comme instantanée dans 95 % des ouvertures.
- **SC-002**: 100 % des idées capturées sont conservées, IA disponible ou non (test avec IA arrêtée).
- **SC-003**: Une proposition typique (≤ 15 éléments) est relue et acceptée en moins de 1 minute.
- **SC-004**: 0 état partiellement appliqué : une erreur simulée pendant l'acceptation laisse les données inchangées dans 100 % des cas.
- **SC-005**: Toute validation annulée dans la minute restaure exactement l'état précédent (comparaison avant/après).
- **SC-006**: L'organigramme reste fluide (déplacement et zoom sans saccade perceptible) avec 50 idées et 300 nœuds.
- **SC-007**: Marquer une tâche faite met à jour le statut de toutes ses dépendantes immédiatement (perçu comme instantané).
- **SC-008**: 100 % des actions principales (capturer, naviguer, valider, refuser, cocher, choisir une branche) sont réalisables au clavier seul.

## Assumptions

- Features 001 (moteur IA, base, réglages IA) et 002 (idées, sessions, propositions, modèle central) sont implémentées.
- Le Planning (F5), Outlook (F6), le Conseiller (F7) et le Compagnon (F8) relèvent du MVP-2 ; l'action « à planifier » des tâches est conservée dans les données mais sans envoi vers Outlook dans cette feature.
- Les propositions « suggestion » (F7) utiliseront le même écran de revue plus tard.
- Mono-utilisateur, Windows 11, un ou plusieurs écrans.
- Délai d'annulation depuis la notification : 10 secondes ; depuis l'historique : sans limite tant qu'aucun conflit n'empêche la restauration.
