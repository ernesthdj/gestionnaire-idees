# Feature Specification: Moteur de neurones — croissance, jauge, fusion, réseau (F2 v2)

**Feature Branch**: `002-structuration-ia`

**Created**: 2026-09-28 · **Révisée** : 2026-09-28 (amendements « Brainstormer » L1b et « neurones » L4b — remplace la version « questionnaire linéaire », conservée dans l'historique git)

**Status**: Draft

**Input**: User description: "Moteur générique du Brainstormer (docs/FOUNDATION.md §0) : chaque idée est un neurone de nature Action ou Réflexion. Claude propose au moins 3 questions d'extension, sans maximum ; chaque réponse fait pousser un sous-neurone, qui peut lui-même proposer des extensions ; l'utilisateur peut ajouter ses propres branches. Une jauge de contexte indique si le neurone peut être verrouillé. Au verrouillage, Claude synthétise (plan d'action pour Action, synthèse structurée pour Réflexion) ; l'utilisateur confirme, le neurone éclôt. Les neurones éclos se relient entre eux par des liens suggérés par l'IA. Pose le modèle de données central."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Faire pousser un neurone par les questions de l'IA (Priority: P1)

L'utilisateur ouvre un neurone brut (« Acheter une télé »). Claude propose au moins 3 extensions (« Quand ? », « Quel prix ? », « Quel modèle ? »). L'utilisateur en choisit une, y répond (réponse rapide, texte ou « je ne sais pas ») : un sous-neurone pousse avec la réponse. Claude peut proposer de nouvelles extensions sur ce sous-neurone si c'est utile, et l'utilisateur peut ajouter ses propres branches. Il n'y a pas de limite de profondeur imposée par la mécanique au-delà d'un garde-fou de lisibilité.

**Why this priority**: c'est le cœur du Brainstormer ; tout le reste en découle.

**Independent Test**: sur un neurone brut, avec une IA simulée, ouvrir le développement, répondre à 2 extensions, en ajouter une soi-même ; vérifier la création des sous-neurones, les nouvelles extensions proposées et la persistance après redémarrage.

**Acceptance Scenarios**:

1. **Given** un neurone brut, **When** l'utilisateur lance son développement, **Then** au moins 3 extensions sont proposées, chacune avec 0 à 4 réponses rapides, et le neurone passe « en développement ».
2. **Given** une extension proposée, **When** l'utilisateur y répond, **Then** un sous-neurone contenant la réponse apparaît, rattaché au neurone d'origine, et l'extension est marquée résolue.
3. **Given** un sous-neurone dont la réponse ouvre de nouvelles questions (« Budget ? → Non »), **When** l'IA l'analyse, **Then** elle peut proposer des extensions sur ce sous-neurone.
4. **Given** un neurone en développement, **When** l'utilisateur ajoute sa propre branche (question ou note), **Then** elle est créée comme un sous-neurone d'origine « utilisateur » et prise en compte par l'IA ensuite.
5. **Given** une extension jugée inutile, **When** l'utilisateur l'écarte, **Then** elle disparaît sans créer de sous-neurone et n'est plus reproposée.
6. **Given** un développement en cours, **When** l'utilisateur ferme puis rouvre l'app, **Then** l'arbre et les extensions en attente sont retrouvés à l'identique.

---

### User Story 2 - Savoir quand l'idée est mûre : la jauge de contexte (Priority: P1)

À chaque réponse, une jauge indique si le neurone a assez de contexte pour être verrouillé : insuffisant, suffisant ou complet, avec la liste de ce qui manque (ex. « source d'argent », « date »).

**Why this priority**: remplace la limite fixe de questions ; guide l'utilisateur sans l'enfermer.

**Independent Test**: répondre successivement à des extensions avec une IA simulée renvoyant des évaluations croissantes ; vérifier l'affichage des niveaux, des manques et le plancher de 3 réponses.

**Acceptance Scenarios**:

1. **Given** un neurone avec moins de 3 réponses, **When** la jauge est calculée, **Then** elle est « insuffisant », quelle que soit l'évaluation de l'IA.
2. **Given** l'IA évalue les dimensions essentielles comme couvertes et au moins 3 réponses, **When** la jauge est calculée, **Then** elle passe « suffisant » et le verrouillage devient disponible.
3. **Given** une jauge « suffisant », **When** l'utilisateur consulte les manques, **Then** il voit les dimensions encore ouvertes (facultatives) qui mèneraient à « complet ».

---

### User Story 3 - Verrouiller : synthèse puis éclosion (Priority: P1)

L'utilisateur verrouille le neurone. Claude synthétise l'arbre : pour un neurone **Action**, un plan organisé (tâches, conditions et leurs branches, dépendances, déclencheurs, dates, opportunités) ; pour un neurone **Réflexion**, une synthèse structurée (pistes retenues, décisions, arguments pour/contre, questions ouvertes). L'utilisateur voit un aperçu compact, le corrige ou le confirme ; à la confirmation, le neurone éclôt. Rien n'est appliqué avant confirmation.

**Why this priority**: transforme la réflexion en résultat exploitable ; principe « humain dans la boucle ».

**Independent Test**: verrouiller le neurone « 2e écran » (Action) et un neurone « Concept portfolio » (Réflexion) avec une IA simulée ; vérifier le bon type de synthèse, l'absence d'écriture avant confirmation, puis l'éclosion.

**Acceptance Scenarios**:

1. **Given** un neurone Action « suffisant », **When** l'utilisateur verrouille, **Then** une synthèse de type plan est proposée (dont, pour « 2e écran », la condition « J'ai l'argent ? » et ses deux branches) et le neurone n'est pas encore éclos.
2. **Given** un neurone Réflexion « suffisant », **When** l'utilisateur verrouille, **Then** une synthèse structurée (pistes, décisions, arguments, questions ouvertes) est proposée.
3. **Given** une synthèse proposée, **When** l'utilisateur confirme, **Then** le résultat est appliqué en une seule opération tout-ou-rien, le neurone devient éclos et l'historique enregistre le changement.
4. **Given** une synthèse proposée, **When** l'utilisateur demande une correction avec une consigne, **Then** une nouvelle synthèse remplace la précédente.
5. **Given** une synthèse contenant un montant ou une date jamais donnés par l'utilisateur, **When** elle est contrôlée, **Then** la valeur est retirée et remplacée par un élément « à trouver ».
6. **Given** un neurone « insuffisant », **When** l'utilisateur demande à verrouiller quand même, **Then** un avertissement liste les manques et le verrouillage n'a lieu qu'après confirmation explicite.
7. **Given** un neurone éclos, **When** l'utilisateur veut le rouvrir, **Then** il repasse en développement, son arbre et sa synthèse précédente restent consultables.

---

### User Story 4 - Relier les neurones éclos (Priority: P2)

Quand un neurone éclôt, l'IA compare sa synthèse à celles des autres neurones éclos et suggère des liens libellés (« financement », « photo », « mobilité »). L'utilisateur accepte ou refuse chaque suggestion ; il peut aussi créer un lien lui-même.

**Why this priority**: donne sa valeur au réseau (« connexions qu'on ne verrait pas »), mais les neurones sont utiles seuls.

**Independent Test**: faire éclore deux neurones liés par le sens (écran + mission mariage) avec une IA simulée ; vérifier la suggestion « financement », son acceptation et son refus.

**Acceptance Scenarios**:

1. **Given** un neurone qui éclôt et des neurones éclos existants, **When** l'analyse des liens s'exécute, **Then** 0 à 3 liens libellés sont suggérés, chacun avec une courte justification.
2. **Given** une suggestion, **When** l'utilisateur l'accepte, **Then** le lien est créé ; **When** il la refuse, **Then** elle n'est plus reproposée.
3. **Given** deux neurones, **When** l'utilisateur crée un lien avec un libellé, **Then** il est enregistré comme lien d'origine « utilisateur ».

---

### User Story 5 - Nature Action ou Réflexion (Priority: P2)

À la création, l'IA locale propose la nature du neurone (Action ou Réflexion) et une catégorie ; l'utilisateur peut les changer à tout moment. La nature oriente les questions (exécution vs exploration) et le type de synthèse.

**Why this priority**: indispensable au Brainstormer, mais une nature par défaut (Réflexion) permet d'avancer sans IA locale.

**Independent Test**: créer « acheter une télé » et « concept de mon portfolio » ; vérifier les natures proposées, le changement manuel et son effet sur les questions suivantes.

**Acceptance Scenarios**:

1. **Given** un nouveau neurone, **When** l'IA locale est disponible, **Then** une nature et une catégorie sont proposées et signalées comme telles.
2. **Given** une nature choisie par l'utilisateur, **When** l'IA repasse, **Then** elle ne l'écrase pas.
3. **Given** un neurone dont la nature change en cours de développement, **When** de nouvelles extensions sont demandées, **Then** elles suivent la nouvelle orientation.

---

### Edge Cases

- L'IA propose moins de 3 extensions : la réponse est rejetée et redemandée une fois ; en cas de nouvel échec, les extensions reçues sont affichées avec un message « l'IA a peu de pistes, ajoute les tiennes ».
- L'IA externe est indisponible ou le plafond de coût atteint : l'utilisateur peut continuer à ajouter ses propres branches ; les extensions IA et la synthèse attendent (ou mode local dégradé signalé).
- L'utilisateur modifie un sous-neurone après la synthèse proposée : la synthèse devient « périmée » et doit être régénérée.
- Arbre très profond : au-delà de 6 niveaux, l'IA ne propose plus d'extension sur ce chemin et suggère de créer un neurone distinct (lien « lié à »).
- Une réponse contient des instructions (« ignore tes règles ») : traitée comme donnée.
- Demande d'œuvre finie (« écris le poème ») : l'IA refuse de la produire et propose des extensions pour y réfléchir.
- Double-clic sur une extension : un seul sous-neurone créé.
- Suppression d'un sous-neurone : ses descendants sont supprimés avec lui, après confirmation ; la jauge est recalculée.

## Requirements *(mandatory)*

### Functional Requirements

**Neurones**
- **FR-001**: Les utilisateurs MUST pouvoir créer, lister (filtres état, nature, catégorie, recherche, pagination), modifier et archiver un neurone racine (texte 1 à 2 000 caractères).
- **FR-002**: Chaque neurone racine MUST avoir une nature (Action ou Réflexion), une catégorie et un état : brut, en développement, éclos, archivé. Nature et catégorie proposées par l'IA locale sont signalées et jamais écrasées après un choix de l'utilisateur ; nature par défaut : Réflexion.

**Croissance**
- **FR-003**: Le développement d'un neurone MUST obtenir de l'IA au moins 3 extensions (question, 0 à 4 réponses rapides, dimension couverte), orientées selon la nature.
- **FR-004**: L'IA MUST pouvoir proposer des extensions supplémentaires sur tout sous-neurone lorsque sa réponse ouvre de nouvelles questions ; il n'existe pas de nombre maximal d'extensions ; au-delà de 6 niveaux de profondeur, aucune extension IA n'est proposée sur ce chemin.
- **FR-005**: Répondre à une extension (choix, texte ≤ 1 000 caractères, ou « je ne sais pas ») MUST créer exactement un sous-neurone : réponse, condition (question fermée avec branches), opportunité (ressource avec montant/date) ou investigation (« je ne sais pas »).
- **FR-006**: Les utilisateurs MUST pouvoir ajouter leurs propres branches, écarter une extension (non reproposée), modifier ou supprimer un sous-neurone (avec ses descendants, après confirmation).
- **FR-007**: Tout l'arbre (sous-neurones, extensions en attente, écartées) MUST être persisté à chaque action et restauré à l'identique au redémarrage.

**Jauge**
- **FR-008**: Après chaque réponse, le système MUST évaluer le contexte du neurone : niveau (insuffisant, suffisant, complet), dimensions couvertes et manquantes ; niveau forcé à « insuffisant » tant que moins de 3 extensions ont reçu une réponse.
- **FR-009**: L'évaluation du contexte MUST être obtenue avec la même demande que les nouvelles extensions (un seul appel IA par réponse).

**Fusion**
- **FR-010**: Le verrouillage MUST être disponible dès « suffisant » ; avant, il MUST exiger une confirmation explicite après affichage des manques.
- **FR-011**: Au verrouillage, le système MUST obtenir une synthèse : plan d'action (Action) ou synthèse structurée (Réflexion), contrôlée (format, références, branches 2 à 4, absence de boucle, profondeur, provenance des montants/dates).
- **FR-012**: Aucune synthèse ne MUST modifier les données tant que l'utilisateur ne l'a pas confirmée ; la confirmation MUST s'appliquer en une opération tout-ou-rien et rendre le neurone éclos.
- **FR-013**: Les utilisateurs MUST pouvoir demander une correction de la synthèse avec une consigne ; la nouvelle version remplace l'ancienne.
- **FR-014**: Une synthèse MUST être marquée périmée si l'arbre a changé depuis sa création.
- **FR-015**: Un neurone éclos MUST pouvoir être rouvert (retour en développement) sans perdre son arbre ni sa synthèse précédente.
- **FR-016**: Toute valeur chiffrée ou datée d'une synthèse qui ne provient pas des réponses de l'utilisateur MUST être retirée et remplacée par un élément « à trouver ».

**Réseau**
- **FR-017**: À chaque éclosion, le système MUST demander à l'IA 0 à 3 suggestions de liens libellés et justifiés vers d'autres neurones éclos (parmi un ensemble de candidats fourni), à accepter ou refuser ; un refus n'est pas reproposé.
- **FR-018**: Les utilisateurs MUST pouvoir créer, renommer et supprimer un lien entre deux neurones.

**Transverse**
- **FR-019**: Toute demande IA MUST passer par le moteur de la feature 001 (cadre « Brainstormer », anonymisation, budget, validation) ; une demande d'œuvre finie est refusée avec une proposition d'y réfléchir.
- **FR-020**: Les montants MUST être stockés en centimes d'euro (entiers ≥ 0).
- **FR-021**: Chaque action de l'utilisateur MUST produire un retour visible immédiat, y compris pendant qu'une demande IA est en cours.

### Key Entities

- **Neurone racine**: texte, nature (Action/Réflexion), catégorie, état (brut, en développement, éclos, archivé), version, position dans l'incubateur ou le réseau.
- **Sous-neurone**: rattaché à un parent ; type (réponse, condition, branche de condition, opportunité, investigation, branche utilisateur) ; contenu, montant, date ; origine (IA/utilisateur).
- **Extension**: question proposée sur un neurone ou sous-neurone ; réponses rapides ; dimension ; statut (proposée, répondue, écartée) ; origine.
- **Évaluation de contexte**: niveau, dimensions couvertes, manquantes, nombre de réponses ; une par réponse (la dernière fait foi).
- **Synthèse**: type (plan d'action / synthèse structurée), contenu, version de l'arbre de départ, statut (proposée, confirmée, refusée, remplacée, périmée).
- **Plan d'action** (neurone Action éclos) : tâches, conditions et branches, dépendances, déclencheurs, opportunités, dates, statuts.
- **Synthèse structurée** (neurone Réflexion éclos) : pistes retenues, décisions, arguments pour/contre, questions ouvertes.
- **Lien**: entre deux neurones racines ; libellé ; justification ; origine ; statut (suggéré, accepté, refusé).
- **Historique**: avant/après de chaque changement appliqué, groupé par opération.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des développements affichent au moins 3 extensions (ou le message de repli explicite) — jeu de 20 neurones de test.
- **SC-002**: Sur l'exemple « 2e écran », la synthèse Action contient la condition « argent ? » et ses deux branches dans 100 % de 10 exécutions réelles.
- **SC-003**: 0 montant ou date inventé conservé dans une synthèse (jeu de 20 arbres de test).
- **SC-004**: Une réponse à une extension fait apparaître son sous-neurone de façon perçue comme instantanée ; les nouvelles extensions et la jauge arrivent en moins de 10 secondes dans 90 % des cas.
- **SC-005**: Aucune synthèse ne modifie les données avant confirmation ; une erreur pendant la confirmation laisse les données inchangées (100 % des cas testés).
- **SC-006**: Un arbre en cours est restauré sans perte après fermeture de l'app dans 100 % des cas.
- **SC-007**: Pour 2 neurones de test sémantiquement liés, la suggestion de lien attendue apparaît dans 8 exécutions réelles sur 10.

## Assumptions

- Feature 001 disponible avec le cadre « Brainstormer » et les types de demande `categoriser`, `etendre`, `synthetiser`, `reviser`, `suggerer_liens`.
- L'interface (incubateur, réseau, plongée, animations, suivi des tâches, export Markdown) relève de la spec 003 ; cette feature fournit le moteur et le modèle de données.
- La conversion Réflexion → neurones Action (« Passer à l'action »), le planning et Outlook relèvent du MVP-2.
- Verrouillage forcé avant « suffisant » autorisé avec avertissement (proposé, à confirmer par mentalyas).
- Mono-utilisateur ; dates en fuseau Europe/Brussels.
