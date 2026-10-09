# Feature Specification: Carte de structure d'un projet (P1 — outil de chirurgie)

**Feature Branch**: `009-carte-structure` · **Created**: 2026-10-04 · **Status**: Livrée (2026-10-09) — reliquat : T011 (test guidé) ; validée (vision L1e, arbitrages 20–24)

**Input**: « Sur base du projet, le Brainstormer doit me dessiner le diagramme du projet via des nœuds et connexions…
un nœud n'est plus une question-réponse mais un élément du projet avec lequel interagir. » Détail :
`docs/brainstorm/L1e-chirurgie-projet.md`, `docs/brainstorm/L3-carte-structure.md`.

## User Scenarios & Testing

### User Story 1 - Cartographier un projet (P1)
Sur un genesis lié à un dossier, « Cartographier ce projet » fait lire le projet à Claude, qui dessine sa structure :
modules, fonctionnalités, composants, données, interfaces, tâches, décisions, reliés par des liens typés.
**Independent Test**: lier `gestionnaire-idees`, cartographier → modules `main`, `renderer`, `shared`, relais, et les
fonctionnalités (pont MCP, chat…) apparaissent autour du genesis, lisibles.
1. **Given** un genesis lié, **When** la cartographie est lancée, **Then** des éléments typés apparaissent, niveau 1 déplié.
2. **Given** une carte existante, **When** on recartographie, **Then** les éléments sont mis à jour sans doublon.
3. **Given** un lot invalide (clé de parent absente, chemin hors projet), **Then** rien n'est dessiné et Claude reçoit l'erreur.

### User Story 2 - Lire et déplier (P1)
Chaque élément affiche type, titre, statut, résumé, nombre de fichiers et d'enfants ; on déplie / replie ; les liens
d'un élément replié se rattachent à son ancêtre visible.
1. **Given** un module replié avec 5 enfants, **When** on clique « ▸ 5 », **Then** ses enfants apparaissent ; l'état est gardé.

### User Story 3 - Travailler sur un élément (P1)
Un clic sur un élément ouvre sa conversation, dans le dossier du projet, avec le contexte du projet, le chemin
d'ancêtres, ses fichiers et les fiches (projet, élément).
1. **Given** l'élément « ConversationService », **When** on l'ouvre et demande « explique ce composant », **Then** Claude
   lit ses fichiers et répond en citant le contexte du projet.

### Edge Cases
- Annuler une cartographie retire tous ses éléments et liens d'un coup.
- Un élément ne peut pas écrire la fiche d'un élément d'un autre projet.
- Plus de 300 éléments en un appel : refusé avec la borne (Claude découpe).

## Requirements
- **FR-001** Éléments = neurones typés rattachés à un genesis, avec conversation et fiche.
- **FR-002** Outil `structure_dessiner` (création / mise à jour par clé stable, liens typés, tout ou rien, Historique).
- **FR-003** Outil `structure_lire`.
- **FR-004** Chemins relatifs validés, jamais exécutés.
- **FR-005** Affichage par niveaux dépliables, positions calculées autour du genesis, liens regroupés vers l'ancêtre visible.
- **FR-006** Conversation d'un élément dans le dossier du projet, contexte : projet + ancêtres + fichiers + fiches.
- **FR-007** Bouton « Cartographier ce projet » dans le chat d'un genesis lié.
- **FR-008** Lecture seule côté projet (P2 apportera l'écriture validée).

## Success Criteria
- **SC-001** Le projet `gestionnaire-idees` est cartographié en une demande, lisible sans retouche (jugement de mentalyas).
- **SC-002** Recartographier ne crée aucun doublon (tests).
- **SC-003** La conversation d'un élément cite ses fichiers réels.

## Assumptions
- Un composant peut regrouper plusieurs fichiers ; la carte vit dans l'app.
- Les éléments ne sont pas déplaçables à la main en P1 (disposition automatique).
