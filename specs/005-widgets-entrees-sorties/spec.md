# Feature Specification: Widgets branchés — entrées, sorties et cadre résultat

**Feature Branch**: `005-widgets-entrees-sorties`

**Created**: 2026-09-30

**Status**: Draft (à valider par mentalyas)

**Input**: User description: « Les neurones d'idées produisent des données stockées. Je veux que les widgets aient des
entrées et des sorties : récupérer les infos d'un neurone, les travailler dans un widget, et récupérer la sortie sous
forme de data. Le widget génère un autre cadre avec la data produite ; Claude arrange ce cadre résultat selon les
structures et types de données produites. »

**Cadre** : `docs/FOUNDATION.md` §0.3 (capacités par `postMessage`, écritures = propositions, revue avant exécution) ;
constitution 1.2.0, principe III (toute capacité impose la revue du code et des capacités) ; spec 004 (bac à sable).
Décisions du 2026-09-30 (mentalyas) : **branchement par un lien tiré sur la carte** ; **le résultat peut être branché
sur une autre idée** ; données transmises : tranché ci-dessous (toute l'idée par défaut, parties décochables).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Brancher une idée sur un widget (Priority: P1)

L'utilisateur tire un lien d'une idée vers un widget. Un écran de revue s'ouvre : le code du widget, ce qu'il
demande (« lire l'idée *Mariage* »), et les parties de l'idée transmises (toutes cochées par défaut, décochables).
Après accord, le widget reçoit les données et les utilise. Plusieurs idées peuvent être branchées sur un même widget.

**Independent Test**: brancher une idée sur un widget « tableau des dépenses » → revue → accord → le widget affiche
les montants de l'idée ; refuser → le widget ne reçoit rien.

**Acceptance Scenarios**:

1. **Given** une idée et un widget, **When** l'utilisateur tire un lien de l'idée vers le widget, **Then** la revue s'ouvre (code, capacité demandée, parties transmises) et rien n'est transmis avant « Autoriser ».
2. **Given** un branchement autorisé, **When** le widget s'affiche, **Then** il reçoit les parties cochées de l'idée, et seulement elles.
3. **Given** un widget branché, **When** Claude en génère une nouvelle version, **Then** la revue est redemandée avant que cette version reçoive des données (version figée par empreinte).
4. **Given** un branchement, **When** l'idée change (nouvelle réponse, verrouillage), **Then** le widget reçoit les données à jour à son prochain affichage (ou au bouton Relancer).
5. **Given** un branchement, **When** l'utilisateur supprime le lien, **Then** le widget ne reçoit plus rien de cette idée ; la suppression est annulable.
6. **Given** un widget branché, **When** l'utilisateur lui demande une évolution, **Then** Claude connaît la **structure** des entrées (champs et types), jamais leurs valeurs.

### User Story 2 - Sortie d'un widget dans un cadre résultat (Priority: P1)

Un widget peut émettre un résultat (des données structurées). Dès la première émission, un **cadre résultat**
apparaît à côté du widget, relié à lui, et affiche les données dans une vue générique (tableau, liste, arbre,
valeur). Il se déplace et se redimensionne comme tout bloc. Chaque nouvelle émission le met à jour.

**Independent Test**: un widget « budget » émet `{ total, lignes: [...] }` → un cadre résultat apparaît avec un
tableau des lignes et le total ; modifier une valeur dans le widget met le cadre à jour.

**Acceptance Scenarios**:

1. **Given** un widget, **When** il émet un résultat valide, **Then** un cadre résultat relié au widget apparaît (une seule fois) et affiche les données.
2. **Given** un cadre résultat, **When** le widget émet à nouveau, **Then** le cadre se met à jour ; le dernier résultat est conservé après redémarrage.
3. **Given** un résultat trop gros, mal formé ou trop profond, **Then** il est refusé, le cadre garde le précédent et un message l'explique dans le widget.
4. **Given** un cadre résultat, **When** l'utilisateur le supprime, **Then** il disparaît (annulable) ; la prochaine émission le recrée.
5. **Given** un cadre résultat, **Then** il est aussi isolé qu'un widget : il ne lit que le résultat de son widget.

### User Story 3 - Claude met le résultat en forme (Priority: P2)

Dans le cadre résultat, « Mettre en forme avec Claude » demande à Claude un affichage adapté à la structure des
données (cartes, graphique en barres, tableau trié…). Claude reçoit la **structure** (noms de champs, types,
tailles), pas les valeurs. La mise en forme est conservée et réutilisée tant que la structure ne change pas ;
l'utilisateur peut la faire évoluer par la même chatbox qu'un widget, ou revenir à la vue générique.

**Acceptance Scenarios**:

1. **Given** un résultat, **When** « Mettre en forme avec Claude », **Then** l'indicateur IA s'affiche puis le cadre montre la mise en forme ; aucune valeur du résultat n'a quitté la machine.
2. **Given** une mise en forme, **When** le widget émet un résultat de même structure, **Then** elle est réutilisée sans appel à Claude.
3. **Given** une mise en forme, **When** la structure change, **Then** le cadre revient à la vue générique et propose de remettre en forme.
4. **Given** Claude indisponible ou budget atteint, **Then** la vue générique reste affichée, avec le message habituel.

### User Story 4 - Brancher le résultat sur une idée ou un autre widget (Priority: P2)

L'utilisateur tire un lien du cadre résultat vers une idée : une **proposition** apparaît (« Ajouter ces données à
l'idée *Mariage* »). Une fois validée, les données sont attachées à l'idée (section « Données » de sa fiche),
datées, avec leur provenance. Il peut aussi tirer le lien vers un autre widget : le résultat devient une entrée de
ce widget (chaîne d'outils). « Nouvelle idée depuis ce résultat » crée une idée brute portant ces données.

**Acceptance Scenarios**:

1. **Given** un cadre résultat et une idée, **When** un lien est tiré de l'un vers l'autre, **Then** rien n'est écrit avant validation de la proposition ; l'écriture est dans l'Historique et annulable.
2. **Given** des données attachées à une idée, **When** le résultat change, **Then** une nouvelle proposition de mise à jour apparaît ; les données attachées ne changent jamais seules.
3. **Given** un cadre résultat et un autre widget, **When** un lien est tiré, **Then** la revue (US1) s'ouvre pour ce widget, avec « lire le résultat de *Budget* » comme capacité.
4. **Given** une idée portant des données attachées, **When** elle est branchée sur un widget, **Then** ces données font partie des parties transmissibles.
5. **Given** un branchement qui créerait une boucle (A → B → A), **Then** il est refusé avec un message clair.

### Edge Cases

- Idée supprimée ou archivée alors qu'elle est branchée : le lien disparaît, le widget reçoit une entrée vide.
- Widget qui émet en rafale : émissions regroupées (une écriture au plus toutes les 500 ms).
- Résultat contenant du HTML ou du script : traité comme du texte ; jamais interprété dans l'app.
- Widget branché sur 0 idée : fonctionne comme en 004 (aucune revue, aucune entrée).
- Restauration d'une ancienne version d'un widget branché : autorisée seulement si cette version a déjà été approuvée, sinon revue.

## Requirements *(mandatory)*

- **FR-001** Un lien tiré d'une idée vers un widget crée un **branchement d'entrée** (persisté, supprimable, annulable).
- **FR-002** **Revue avant exécution** : code de la version, capacités demandées, parties transmises ; rien n'est transmis sans accord. L'accord porte sur une **version figée** (empreinte SHA-256 du code et des capacités) ; toute nouvelle version le redemande.
- **FR-003** Parties transmissibles d'une idée, toutes cochées par défaut, décochables par branchement : identité (titre, nature, catégorie, état), texte d'origine, questions et réponses, sous-neurones (arbre), document éclos (plan d'action ou fiche, montants compris), données attachées.
- **FR-004** Pont par `postMessage` entre l'app et le cadre : messages validés (Zod), origine vérifiée par la fenêtre source ; le widget dispose de `gi.inputs` (lecture) et `gi.output(données)` (émission). Aucune autre capacité.
- **FR-005** Résultat : JSON seul, ≤ 200 Ko, profondeur ≤ 8, clés et chaînes bornées ; sinon refusé avec message.
- **FR-006** **Cadre résultat** : bloc de la carte (`kind: 'result'`) créé à la première émission, relié à son widget, isolé comme un widget, persistant le dernier résultat.
- **FR-007** Vue générique locale, sans IA : valeur simple, liste, tableau (liste d'objets homogènes), arbre (objet imbriqué).
- **FR-008** Mise en forme par Claude **à la demande** (tâche `widget`), à partir de la **signature de structure** du résultat (champs, types, tailles) ; réutilisée tant que la signature est identique ; évolutive par chatbox ; retour à la vue générique possible.
- **FR-009** Lien résultat → idée : **proposition** soumise à validation (principe II), puis données attachées à l'idée avec provenance (widget, version, date) ; Historique, annulation.
- **FR-014** *(ajout 2026-09-30)* La « prochaine étape » d'une idée (spec 003 FR-037) est une source d'entrée : un lien tiré de l'étape vers un widget lui transmet son texte et l'identité de son idée (même revue que FR-002).
- **FR-010** Lien résultat → widget : branchement d'entrée de type résultat (même revue que FR-002) ; boucles refusées.
- **FR-011** « Nouvelle idée depuis ce résultat » : idée brute portant les données attachées.
- **FR-012** Claude ne reçoit jamais les valeurs des entrées ni des résultats : seulement leur structure. Les données réelles ne circulent qu'entre la base locale et les cadres isolés (aucun réseau : spec 004).
- **FR-013** Les données attachées à une idée ne sont **pas** injectées dans les demandes à l'IA en v1 (décision séparée, soumise à l'anonymisation).

## Success Criteria

- **SC-001** Brancher une idée, autoriser, voir ses données dans le widget : < 30 s, sans écrire de code.
- **SC-002** 100 % des tentatives testées échouent : lire une idée non branchée, lire une partie décochée, émettre hors format, recevoir des données avec une version non approuvée, usurper le pont depuis un autre cadre.
- **SC-003** Aucune valeur d'idée ni de résultat dans les appels à Claude (vérifié par test sur la demande envoyée).
- **SC-004** La vue générique affiche un résultat de 1 000 lignes sans bloquer la carte.
