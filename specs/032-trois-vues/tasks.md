# Tâches — spec 032 « Les trois vues »

Un commit par lot. Chaque lot : tests, typecheck, lint, Prettier, e2e touchés, JOURNAL.

## Lot 0 — Décisions ouvertes

- [x] T001 Faire trancher Q1 (passe d'écriture des lignes `**Parent**` / `**Maturité**` sur les documents existants)
  et Q2 (specs livrées) ; amender la spec. Q1 : passe faite sur les 90 documents ; Q2 : ronds complets, carrés faits.

## Lot 1 — L'arbre du Workflow (main, sans IA)

- [x] T010 Lecture des lignes `**Parent**`, `**Maturité**`, `**Tâches**` (D9, D10, FR-002) dans
  `src/main/domain/workflow/` + tests (valeurs inconnues, chemins hors du projet).
- [x] T011 Domaine pur `workflowArbre` (FR-001) : ronds, carrés, lots, maturité, avancement, ébauches, « Bosser ici »,
  bornes ; tests de déterminisme (SC-001) et cas limites (fichier sans rond, spec sans L1, cycle de `**Parent**`).
- [x] T012 `WorkflowService` : l'arbre dans la réponse de lecture du Workflow (Zod) ; mesure SC-004 sur le dépôt.

## Lot 2 — Le Workflow sur la carte

- [x] T020 Disposition en sens alterné à 4 niveaux (D2), dessin de l'app pour le genesis et les ronds, deux anneaux
  (D3), carrés (D4), ébauches (D5), halo « Bosser ici » (D6) ; tests renderer et axe.
- [x] T021 Panneau d'actions (D7) et consignes pures (FR-004) ; tests.
- [x] T022 Retrait du rangement par branches (023 D8) ; e2e `workflow-task-files` et parcours « Bosser ici » (SC-002).

## Lot 3 — Brainstorm et pont MCP

- [x] T030 « Nouveau brainstorm » et « Lancer / Continuer le brainstorm » écrivent les lignes du rond (D11) ;
  « Évaluer la maturité » (D10) ; consignes et descriptions du pont ; tests.

## Lot 4 — Architecture = l'explorateur

- [x] T040 Domaine pur du détecteur d'architecture (D15) + tests sur les jeux de test de la spec 017 (SC-005).
- [x] T041 Explorateur monté dans la carte en position « Architecture » (D14), détecteur en tête (correction
  annulable) ; retrait des bandes de couches (017 D20) ; tests renderer, e2e.

## Lot 5 — Progression A, B, C

- [x] T050 Domaine pur : prévu, réel, hors plan (D13) par les chemins des tâches ; tests.
- [x] T051 Les trois lectures (D12), sélecteur gardé par projet, bascule Réel · Prévu · Les deux ; tests renderer et
  axe ; e2e.

## Lot 6 — Finitions

- [x] T060 Spec 023 (D8 remplacée, D29 réalisée), spec 017 (D20 remplacée), `CLAUDE.md`, `docs/FOUNDATION.md`,
  JOURNAL ; vérifications finales.
- [x] T061 Q7 : le terminé replié en « ✔ Bâti » (A, B), finitions vers les maquettes ; tests ; captures sur le dépôt
  du Brainstormer.
- [x] T062 Q8 : la Progression en canevas (zoom, déplacement, « Tout afficher »), matière organique, groupe
  « ✦ Plus tard », clic → Workflow centré, déplié et surligné ; tests ; captures sur le dépôt du Brainstormer.
