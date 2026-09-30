# Feature Specification: Boîte à outils de la carte et mini-widgets générés par Claude

**Feature Branch**: `004-widgets`

**Created**: 2026-09-29

**Status**: Draft (à valider par mentalyas)

**Input**: User description: « Sur le canva, un clic droit ouvre un panel d'outils : créer un nœud, écrire une note (label)… et surtout créer un IFRAME, que je place où je veux, que j'agrandis ou rapetisse (taille min et max obligatoires), qui lit du HTML, du CSS et du TypeScript, pour que Claude y génère des widgets ou artefacts : je crée des outils personnalisés en promptant dans ma propre app, via une mini chatbox reliée à l'iframe. Plus tard : connecter ces outils à des nœuds de données brainstormés pour traiter l'information. »

**Cadre** : `docs/FOUNDATION.md` §0.3 « Blocs et mini-widgets » (modèle de sécurité validé) ; décisions du 2026-09-29 :
TypeScript **sans framework** (Angular écarté : runtime + compilateur par widget, `unsafe-eval`), génération par
**Claude Sonnet 5.5** (réglable), **exécution directe** tant que le widget n'a **aucune capacité** (code toujours
consultable) — la revue avant exécution redevient obligatoire dès qu'un widget demandera l'accès aux idées (spec 005).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Boîte à outils au clic droit (Priority: P1)

Un clic droit dans le vide de la carte ouvre, à l'endroit du clic, un petit panneau d'outils : **Nouvelle idée**,
**Note**, **Widget IA**. Chaque outil crée l'objet à cet endroit. Le panneau se ferme par `Échap`, un clic ailleurs ou
après un choix ; il est utilisable au clavier (flèches, `Entrée`).

**Independent Test**: clic droit dans le vide → les 3 outils ; chacun crée son objet au point du clic ; `Échap` ferme.

**Acceptance Scenarios**:

1. **Given** la carte, **When** clic droit dans le vide, **Then** le panneau s'ouvre au point du clic, focus sur le premier outil.
2. **Given** le panneau, **When** « Nouvelle idée », **Then** la saisie d'idée s'ouvre à cet endroit (comme le double-clic).
3. **Given** le panneau, **When** « Note », **Then** une note vide apparaît à cet endroit, en édition.
4. **Given** un clic droit sur un objet (idée, lien, note, widget), **Then** ce panneau ne s'ouvre pas (le menu propre à l'objet garde la main).

### User Story 2 - Notes (étiquettes) sur la carte (Priority: P2)

Une note est un texte libre posé sur la carte (titre de zone, rappel, légende). Elle se déplace, se redimensionne
(bornes min/max), s'édite au double-clic, se supprime ; la physique la traite comme un objet épinglé (rien ne la chevauche).

**Acceptance Scenarios**:

1. **Given** une note, **When** double-clic, **Then** son texte devient éditable ; `Échap`/clic ailleurs enregistre.
2. **Given** une note, **When** l'utilisateur la supprime, **Then** elle disparaît (annulable depuis l'Historique).

### User Story 3 - Widget IA : un outil fabriqué en discutant avec Claude (Priority: P1)

Un widget est un cadre placé sur la carte, déplaçable par sa barre de titre et redimensionnable (**min 240 × 160,
max 1600 × 1200**). Il contient une zone d'exécution isolée et une **mini chatbox**. L'utilisateur décrit l'outil
voulu (« un calculateur de budget mariage avec acompte et solde ») ; Claude génère le widget (HTML + CSS + TypeScript),
qui s'affiche aussitôt. Chaque nouveau message fait évoluer le widget (« ajoute un graphique en barres ») : une
**nouvelle version** est créée, les précédentes restent restaurables. Un onglet **Code** montre le code de la version
affichée. L'indicateur « l'IA réfléchit » + moteur (ex. « Claude Sonnet 5.5 ») s'affiche pendant la génération.

**Independent Test**: créer un widget, demander un compte à rebours, vérifier l'affichage, demander une évolution,
revenir à la version 1, consulter le code, redimensionner hors bornes (refusé), supprimer.

**Acceptance Scenarios**:

1. **Given** un widget vide, **When** l'utilisateur envoie une demande, **Then** l'indicateur IA s'affiche, puis le widget généré s'exécute dans le cadre.
2. **Given** un widget généré, **When** l'utilisateur demande une évolution, **Then** Claude part du code actuel, une version N+1 s'affiche, la version N reste restaurable.
3. **Given** un widget, **When** l'utilisateur ouvre « Code », **Then** il voit le HTML, le CSS et le TypeScript de la version affichée.
4. **Given** du code qui tente d'accéder au réseau, au parent, à `window.api`, d'ouvrir une fenêtre, une boîte de dialogue ou de naviguer, **When** il s'exécute, **Then** tout est bloqué et l'app reste intacte.
5. **Given** un TypeScript non transpilable ou une réponse invalide, **Then** un message clair s'affiche dans la chatbox et la version précédente reste affichée.
6. **Given** le budget IA atteint ou Claude indisponible, **Then** la génération est refusée avec le message habituel (pas de repli local : l'IA locale ne génère pas de code).
7. **Given** le thème clair ou sombre, **Then** le widget suit le thème de l'app (jetons de couleur injectés).

### Edge Cases

- Widget qui boucle à l'infini : il ne bloque que son propre cadre (bouton « Arrêter » = recharger le cadre vide).
- Code très long : taille bornée (HTML/CSS/TS ≤ 100 Ko chacun) ; au-delà, réponse refusée.
- Demande hors outil (« écris-moi un poème ») : Claude répond par un widget qui l'affiche, jamais en dehors du cadre.
- Redimensionnement pendant l'exécution : le cadre ignore la souris pendant le geste (pas de capture du glisser).

## Requirements *(mandatory)*

- **FR-001** Clic droit dans le vide → panneau d'outils (Nouvelle idée, Note, Widget IA) au point du clic, accessible au clavier.
- **FR-002** Notes : création, édition, déplacement, redimensionnement borné, suppression annulable ; persistées.
- **FR-003** Widgets : création, déplacement par la barre de titre, redimensionnement borné (240×160 → 1600×1200), suppression annulable ; persistés (position, taille, versions, conversation).
- **FR-004** Génération par la passerelle IA (tâche `widget`, **Claude uniquement**, modèle réglable, défaut `claude-sonnet-5-5`), budget, anonymisation et journal d'appels comme toute tâche.
- **FR-005** Sortie structurée validée (Zod) : titre, HTML, CSS, TypeScript, résumé de ce qui a changé ; bornes de taille.
- **FR-006** TypeScript **transpilé localement** (retrait des types, sans dépendance) ; échec → message, version précédente conservée.
- **FR-007** Exécution isolée : protocole dédié servi par le main, `iframe sandbox="allow-scripts"` sans `allow-same-origin`, CSP par en-tête `default-src 'none'` (aucun réseau), WebRTC désactivé, aucune requête sortante hors du protocole (filtre `webRequest`), pas de preload dans le cadre.
- **FR-008** Versions : chaque génération crée une version ; restaurer une version la rend courante.
- **FR-009** Code consultable (onglet Code) pour la version affichée.
- **FR-010** Indicateur IA (animation + moteur) pendant la génération ; chatbox figée pendant ce temps.
- **FR-011** Thème : jetons de couleur de l'app injectés dans le widget (clair/sombre).
- **FR-012** Aucune capacité en v1 : le widget ne reçoit ni n'envoie de données de l'app (le pont `postMessage` + capacités = spec 005).

## Success Criteria

- **SC-001** Un widget simple (compte à rebours, calculatrice) est généré et affiché en < 60 s.
- **SC-002** 100 % des tentatives d'évasion testées (réseau, `parent`, `top`, `window.open`, `alert`, navigation, `window.api`) sont bloquées.
- **SC-003** Coût moyen d'une génération ≤ 0,10 € avec Sonnet 5.5 (mesuré via `scripts/ai-usage.cjs`).
