# Feature Specification: Structuration IA — questionnaire & décomposition (F2)

**Feature Branch**: `002-structuration-ia`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "F2 — Structuration IA, telle que définie dans docs/FOUNDATION.md §2bis, §9.2 et §10.1 : transformer une idée brute en arbre de tâches actionnable. L'IA pose des questions une à une, puis produit une décomposition avec sous-tâches, branches conditionnelles, dépendances/déclencheurs, opportunités et liens vers d'autres idées. Le résultat est une proposition en attente de validation (appliquée par F3). Pose aussi le modèle de données central des idées et des arbres, partagé par F1, F3, F4 et F5."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Répondre au questionnaire de l'IA (Priority: P1)

À partir d'une idée brute (« acheter un 2e écran »), l'utilisateur lance la structuration. L'IA pose une question à la fois, avec des réponses rapides quand c'est possible (« As-tu déjà l'argent ? [Oui] [Non] [En partie] »), jusqu'à avoir assez d'informations ou atteindre la limite de questions.

**Why this priority**: c'est l'entrée du cœur de l'app ; sans questionnaire, pas de décomposition pertinente.

**Independent Test**: créer une idée, lancer la structuration avec une IA simulée, répondre à 3 questions ; vérifier l'enchaînement, l'enregistrement de chaque réponse et l'arrêt sur « prêt » ou à la limite.

**Acceptance Scenarios**:

1. **Given** une idée brute, **When** l'utilisateur lance la structuration, **Then** une première question s'affiche avec, si pertinent, 2 à 4 réponses rapides.
2. **Given** une question affichée, **When** l'utilisateur répond (clic ou texte), **Then** la réponse est enregistrée immédiatement et la question suivante s'affiche.
3. **Given** 8 questions posées, **When** l'utilisateur répond à la 8e, **Then** plus aucune question n'est posée et la décomposition est proposée.
4. **Given** un questionnaire en cours, **When** l'utilisateur ferme l'app puis la rouvre, **Then** il reprend à la question où il s'était arrêté.

---

### User Story 2 - Obtenir une décomposition en arbre conditionnel (Priority: P1)

Quand l'IA a assez d'éléments (ou que l'utilisateur clique « Décompose maintenant »), elle propose un arbre : tâches et sous-tâches, points de décision avec leurs branches (« J'ai l'argent ? Oui → fixer une date / Non → créer un budget »), dépendances (« après X »), déclencheurs (« au paiement de la mission ») et informations manquantes signalées. La proposition attend la validation de l'utilisateur ; rien n'est encore appliqué.

**Why this priority**: c'est la valeur centrale du « secrétaire » ; avec US1, elle forme le MVP de la feature.

**Independent Test**: jouer l'exemple de référence « 2e écran » avec une IA simulée ; vérifier que la proposition contient la condition « argent ? », ses deux branches et une tâche de budget, et qu'aucune donnée de l'idée n'a été modifiée.

**Acceptance Scenarios**:

1. **Given** un questionnaire terminé sur l'exemple « 2e écran », **When** la décomposition est produite, **Then** la proposition contient une condition « J'ai l'argent ? » avec une branche « Oui » (date d'achat) et une branche « Non » (budget).
2. **Given** une décomposition dont les dépendances forment une boucle, **When** elle est contrôlée, **Then** elle est rejetée et une nouvelle tentative est faite ; en cas de nouvel échec, un message clair s'affiche et les réponses sont conservées.
3. **Given** un arbre de plus de 5 niveaux, **When** il est contrôlé, **Then** il est rejeté comme hors règles.
4. **Given** une proposition produite, **When** l'utilisateur la consulte, **Then** elle est marquée « en attente de validation » et l'idée n'a pas changé.

---

### User Story 3 - Ne jamais inventer : tâches d'investigation (Priority: P1)

Quand l'utilisateur répond « je ne sais pas » (prix, date, lieu), l'IA ne fabrique pas de valeur : elle ajoute une tâche du type « Trouver le prix du modèle ». Aucun montant ou date n'apparaît dans la proposition sans venir des réponses de l'utilisateur.

**Why this priority**: principe non négociable de fiabilité (constitution III) ; un montant inventé dans un budget fausse toutes les décisions.

**Independent Test**: répondre « je ne sais pas » à la question du prix ; vérifier la présence d'une tâche d'investigation et l'absence de tout montant dans la proposition.

**Acceptance Scenarios**:

1. **Given** la question « Quel est le prix ? », **When** l'utilisateur répond « je ne sais pas », **Then** la proposition contient une tâche d'investigation et aucun montant pour cet élément.
2. **Given** une proposition de l'IA contenant un montant jamais donné par l'utilisateur, **When** elle est contrôlée, **Then** le montant est retiré et une tâche d'investigation le remplace.

---

### User Story 4 - Faire émerger une opportunité liée (Priority: P2)

Si une réponse révèle une ressource (« j'ai une mission photo mariage payée 1 250 € le 15/11 »), l'IA propose de créer une opportunité distincte (objectif + tâche + rentrée d'argent) reliée à l'idée courante (« finance »), dans la même proposition.

**Why this priority**: c'est ce qui fait « agenda organique » ; la décomposition simple fonctionne sans.

**Independent Test**: mentionner une mission payée dans une réponse ; vérifier qu'une opportunité liée avec son montant et sa date apparaît dans la proposition.

**Acceptance Scenarios**:

1. **Given** une réponse mentionnant une rentrée datée et chiffrée, **When** la décomposition est produite, **Then** une opportunité avec ce montant et cette date est proposée, liée à l'idée par « finance ».
2. **Given** une opportunité proposée, **When** une tâche en dépend (« au paiement → réserver X € »), **Then** la dépendance de type déclencheur figure dans la proposition.

---

### User Story 5 - Restructurer une idée déjà décomposée (Priority: P3)

Quand la situation change (« finalement j'ai reçu une prime »), l'utilisateur relance la structuration sur une idée déjà structurée. L'IA pose les questions nécessaires et propose uniquement les différences (ajouts, modifications, suppressions).

**Why this priority**: utile dans la durée, mais pas indispensable à la première version.

**Independent Test**: sur une idée déjà structurée, décrire un changement ; vérifier que la proposition ne contient que des différences marquées.

**Acceptance Scenarios**:

1. **Given** une idée structurée, **When** l'utilisateur décrit un changement, **Then** la proposition liste des ajouts, modifications et suppressions par rapport à l'arbre actuel.

---

### Edge Cases

- L'utilisateur modifie le texte de l'idée pendant le questionnaire : la proposition produite ensuite est marquée « périmée ».
- Double-clic sur une réponse : la réponse n'est enregistrée qu'une fois.
- Demande de décomposition alors qu'une proposition existe déjà pour cette session : la proposition existante est renvoyée.
- Une seule structuration ouverte à la fois par idée.
- L'IA externe est indisponible ou le plafond de coût atteint : proposer d'attendre ou un questionnaire simplifié par l'IA locale, signalé comme de moindre qualité.
- L'app est coupée pendant que l'IA réfléchit : au redémarrage, la session revient à son dernier état stable.
- L'IA répond hors périmètre ou fait référence à une idée inexistante : réponse rejetée.
- Le texte d'une idée contient des instructions (« ignore tes règles ») : traitées comme de simples données.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Les utilisateurs MUST pouvoir créer, lister (filtres statut, catégorie, recherche, pagination) et modifier une idée (texte 1 à 2 000 caractères).
- **FR-002**: Les utilisateurs MUST pouvoir lancer une structuration sur une idée brute ; une seule structuration ouverte par idée.
- **FR-003**: Le système MUST poser une question à la fois, avec 0 à 4 réponses rapides, et accepter une réponse par choix, texte libre (≤ 1 000 caractères) ou « je ne sais pas ».
- **FR-004**: Le système MUST enregistrer chaque réponse immédiatement et permettre de reprendre un questionnaire interrompu.
- **FR-005**: Le système MUST limiter le questionnaire à 8 questions par défaut (configurable) et permettre à tout moment « Décompose maintenant ».
- **FR-006**: Le système MUST produire une proposition de décomposition contenant : tâches (profondeur ≤ 5), conditions (question fermée, 2 à 4 branches), dépendances (« après » ou « au déclencheur »), opportunités, montants, échéances, tâches à planifier, tâches d'investigation, liens vers d'autres idées, informations manquantes.
- **FR-007**: Le système MUST contrôler chaque proposition : format, profondeur, références internes existantes, absence de boucle de dépendances ; en cas d'échec, une nouvelle tentative, puis un échec propre avec réponses conservées. Les liens vers des idées qui ne font pas partie des idées candidates proposées à l'IA sont retirés (sans rejeter la proposition).
- **FR-017**: L'abandon ou l'échec définitif d'une structuration MUST rendre à l'idée le statut qu'elle avait avant la session (brute pour une décomposition, structurée pour une restructuration).
- **FR-008**: Le système MUST NOT conserver dans une proposition un montant, un prix ou une date qui ne provient pas des réponses de l'utilisateur ; il le remplace par une tâche d'investigation.
- **FR-009**: Le système MUST proposer une opportunité liée quand une réponse révèle une ressource (montant, date).
- **FR-010**: Les propositions MUST rester « en attente de validation » ; cette feature n'applique aucune modification à l'arbre d'une idée (application = F3).
- **FR-011**: Le système MUST marquer une proposition « périmée » si l'idée a changé depuis le début de la structuration.
- **FR-012**: Le système MUST permettre de restructurer une idée structurée et produire une proposition de différences.
- **FR-013**: Le système MUST permettre d'abandonner une structuration en cours.
- **FR-014**: Les montants MUST être stockés en centimes d'euro (entiers ≥ 0).
- **FR-015**: Toute demande à l'IA MUST passer par le moteur IA de la feature 001 (cadre, anonymisation, budget, validation) ; les demandes hors périmètre sont refusées et recentrées.
- **FR-016**: Le système MUST signaler en continu que l'IA réfléchit (retour visible immédiat à chaque action).

### Key Entities

- **Catégorie**: Général, Achat, Projet, Sortie, Photo, IT (liste initiale) ; libellé, couleur, ordre.
- **Idée**: texte, catégorie (proposée par l'IA ou choisie), statut (brouillon, brute, en questionnaire, à valider, structurée, terminée, archivée), version (change à chaque modification).
- **Session de structuration**: idée, état (questions, prête, décomposition, proposée, abandonnée, échouée), nombre de questions, moteur utilisé.
- **Tour de questionnaire**: question, réponses rapides, réponse, ordre.
- **Proposition**: origine (décomposition, restructuration, suggestion), contenu, version de l'idée au départ, statut (en attente, acceptée, refusée, remplacée, périmée).
- **Nœud** (créé à l'acceptation par F3) : tâche, condition ou opportunité ; titre, parent, branche, montant, échéance, statut.
- **Dépendance**: « après » ou « au déclencheur », entre deux nœuds.
- **Lien entre idées**: finance, lié à, bloque.
- **Historique des changements**: avant/après de chaque modification appliquée.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sur l'exemple de référence « 2e écran », 100 % des décompositions obtenues contiennent la condition « argent ? » avec ses deux branches (10 exécutions avec l'IA réelle, validation manuelle).
- **SC-002**: 0 montant ou date présent dans une proposition sans provenir d'une réponse de l'utilisateur (jeu de 20 questionnaires de test).
- **SC-003**: 100 % des propositions contenant une boucle ou une profondeur > 5 sont rejetées avant affichage.
- **SC-004**: Un questionnaire complet (idée → proposition) prend moins de 3 minutes à l'utilisateur dans 80 % des cas.
- **SC-005**: Chaque action de l'utilisateur dans le questionnaire produit un retour visible immédiat (perçu comme instantané) ; chaque nouvelle question arrive en moins de 10 secondes dans 90 % des cas.
- **SC-006**: Un questionnaire interrompu (fermeture de l'app) est repris sans perte dans 100 % des cas.
- **SC-007**: Aucune proposition ne modifie les données d'une idée tant qu'elle n'est pas acceptée (vérifié par test).

## Assumptions

- Le moteur IA hybride (feature 001) est disponible : routage (questionner/décomposer → Claude), anonymisation, budget, validation.
- La capture rapide (F1) créera les idées au quotidien ; cette feature fournit néanmoins la création et la liste d'idées nécessaires pour être testée seule.
- L'écran de revue et l'application des propositions relèvent de F3 ; l'affichage de l'arbre accepté relève de F4.
- L'utilisateur est seul ; aucune gestion de droits.
- Les dates sont en fuseau Europe/Brussels.
