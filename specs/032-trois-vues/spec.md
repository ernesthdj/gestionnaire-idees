# Feature Specification: Les trois vues — Workflow, Progression, Architecture (spec 032)

**Feature Branch**: `main` · **Created**: 2026-10-14 · **Parent** : L1j-carte-workflow.md · **Status**: Livrée (2026-10-14) — lots 1 à 6 ; maquettes
validées par mentalyas dans l'artifact de brainstorm

> Suite de l'amendement de la spec 023 (D26 à D29 : le travail se fait dans le Workflow, Progression et Architecture
> le reflètent). Brainstorm visuel du 2026-10-14 dans un artifact (canevas « Progression et Architecture —
> brainstorm » : planche « Workflow — la nouvelle vue », pistes A, B, C de la Progression). Spec légère (décisions,
> exigences, tâches), comme la 030 et la 031.

## Problème

1. Le Workflow d'aujourd'hui (spec 023 D8) range les fichiers par branches (En cours, À venir, Livrées, À
   brainstormer) : il dit où en sont les specs, pas comment le projet se construit, ni où brainstormer, ni où
   implémenter.
2. Progression et Architecture recevaient du travail (étapes, tâches, décisions) : corrigé par 023 D27, mais leur
   rendu ne distingue pas ce que la doc prévoit de ce que le code contient.
3. L'Architecture du canevas (bandes de couches, spec 017 D20) refait moins bien ce que l'explorateur en boîtes
   (spec 031) montre déjà : modules, appels, fichiers.

## Décisions

| # | Décision |
|---|----------|
| D1 | **Trois vues, trois rôles.** Workflow : le chantier (on y brainstorme, on y documente, on y implémente). Progression : où en est la construction, prévue (doc) et réelle (code). Architecture : comment la stack s'assemble (l'explorateur). La bascule « Workflow \| Progression \| Architecture » de la barre reste. |
| D2 | **Le Workflow est un arbre en sens alterné** (dessin de la carte, spec 022) : le projet en haut ; niveau 1 vers le bas, niveau 2 vers la droite, niveau 3 vers le bas, niveau 4 vers la droite. Le genesis et les ronds **gardent le dessin de l'app** (orbe du genesis ; cercle teinté par sa grande branche, icône, pastille de rang, point de statut). |
| D3 | **Rond = on brainstorme et on documente.** Un rond se calcule de ses enfants (on n'y implémente rien). Autour de lui, **deux anneaux fins** : l'extérieur (violet) = la **maturité de son brainstorm**, l'intérieur (bleu) = l'**avancement de ses tâches**. Le genesis garde son orbe ; ses deux chiffres sont écrits sous son nom. |
| D4 | **Carré = on implémente.** Une feuille de l'arbre est un carré, lié à **une case** d'un fichier de tâches : plein et coché quand elle est faite, anneau quand elle est en cours (`- [~]`), pointillé quand elle est prévue, orange quand elle est hors plan (dans le code, absente de la doc). |
| D5 | **Ébauches.** Tant que le brainstorm d'un rond n'est pas complet, ses carrés s'affichent **en ébauche** (pâles, pointillé violet, ✦) : on voit la suite, on ne l'implémente pas encore. Brainstorm complet : les ébauches deviennent des carrés. |
| D6 | **« ▶ Bosser ici »** : un seul carré s'allume (halo, étiquette) — le premier pas fini dans l'ordre de l'arbre, un carré en cours avant un carré seulement prévu ; jamais une ébauche ni un hors plan. Mouvement réduit : halo fixe. |
| D7 | **Actions au clic** (panneau du nœud ; consignes pré-remplies dans la conversation du nœud, jamais envoyées sans le geste de mentalyas) : rond pas mûr → « ✦ Lancer / Continuer le brainstorm » ; rond mûr → « Rédiger ou relire la doc », « Rouvrir le brainstorm » ; carré → « ▶ Implémenter » (ou « Relire ce qui a été fait »), « Voir ses tâches » ; ébauche → « Continuer le brainstorm du parent » (implémenter grisé) ; hors plan → « Le documenter », « Le retirer du code ». |
| D8 | **L'arbre vient des fichiers, écrits par Claude ; l'app les relit sans IA** (choix de mentalyas, 2026-10-14). Même fichiers, même arbre : rien n'est régénéré à l'affichage. L'app n'écrit jamais ces fichiers (023 D6). |
| D9 | **Un rond** = un document de brainstorm (`docs/brainstorm/*.md`) ou une spec (`specs/0NN-*/spec.md`). Son parent est dit par `**Parent** : <nom du fichier>` dans l'en-tête du document (sous le titre ; plusieurs champs sur une ligne, séparés par « · ») — absent, ou `L1-fondation.md` (le document du projet lui-même) : niveau 1, sous le projet ; une spec se range sous son `**Parent**` s'il est écrit, sinon sous le document de plus bas niveau qu'elle cite (023 D11) — citer n'est pas toujours en venir (la 032 cite `L1l` en exemple). Un fichier de tâches (`docs/TACHES-*.md`, `tasks.md`) se range sous le rond qui le nomme par une ligne `**Tâches** : <chemin>` (ou sous la spec qui le contient) ; sinon il est un rond de niveau 1 à lui seul. Ses lots `##` sont des ronds intermédiaires, ses cases les carrés. Bornes : 4 niveaux sous le projet (au-delà, regroupé), celles de la spec 023 pour les fichiers. |
| D10 | **Maturité du brainstorm = maturité évaluée** (choix de mentalyas) : Claude l'écrit dans le document du rond, ligne `**Maturité** : insuffisant \| suffisant \| complet` (33 / 66 / 100 %), en même temps que sa liste « ce qui manque ». Une spec écrite vaut « complet ». Sans ligne : anneau vide et gris (« non évalué »), action « Évaluer la maturité ». |
| D11 | **Brainstorm et pont MCP.** « ✦ Nouveau brainstorm » (023 D26) et « Lancer / Continuer le brainstorm » demandent à Claude d'écrire le document du rond avec ses lignes `**Parent**`, `**Maturité**`, `**Tâches**`, et ses tâches dans `docs/TACHES-<Sujet>.md` ; les consignes du pont le disent. Aucune écriture dans la carte (023 D27). |
| D12 | **Progression : trois lectures au choix** (« j'aime les 3 », mentalyas) : **A l'arbre qui pousse** (modules en colonnes sous le projet, leurs parties dessous), **B le chantier par étages** (fondations en bas, une brique par élément), **C les lots du Workflow** (une colonne par spec ou fichier de tâches, dans l'ordre du Workflow). Un sélecteur dans la barre, gardé par projet. Les trois ont la bascule **Réel · Prévu · Les deux**. |
| D13 | **Prévu, réel, hors plan.** Prévu = ce que la doc décrit (ronds et carrés du Workflow pas encore bâtis), en fantôme pointillé. Réel = ce que l'analyse du code trouve (spec 017 : modules, fichiers), plein, avec l'avancement de ses carrés. Hors plan = dans le code, couvert par aucun rond ni aucune tâche, en orange. Le lien entre un élément du code et le Workflow passe par les chemins de fichiers cités par les tâches (023 D9). |
| D14 | **Architecture = l'explorateur en boîtes dans la carte** (spec 031, choix de mentalyas) : la position « Architecture » affiche la carte en boîtes du projet à la place de l'ancienne vue en bandes de couches (spec 017 D20, retirée), avec ses gestes, sa fiche et sa recherche. |
| D15 | **Détecteur d'architecture** en tête de l'explorateur : l'architecture reconnue (Clean, hexagonale, MVVM, MVC, couches, aucune) **par des règles** sur les noms des modules et le sens des appels (ex. `domain`/`application`/`infrastructure` → Clean ; `ports`/`adapters` → hexagonale ; `viewmodels` → MVVM ; `controllers`/`models`/`views` → MVC), avec sa raison en une phrase ; Claude peut la préciser (D20 de la 017, `structure_dessiner`), mentalyas la corrige (sa correction prime, annulable). Les boîtes gardent leur couche (spec 031 D2). |
| D17 (2026-10-16, retour de mentalyas) | **« ↻ Mettre à jour » dans le Workflow remet un ancien projet au format** | Un projet commencé avant cette spec n'a ni en-têtes de brainstorm ni fichier `TACHES-*.md` : ses tâches restent des ébauches ou ne sont pas lues, aucun carré n'est « Bosser ici ». Dans la vue Workflow, « ↻ Mettre à jour » (qui ne faisait que la mise à jour de la carte de structure, spec 022) envoie à Claude une consigne propre au Workflow : l'app dit ce qui manque (brainstorms sans en-tête, tâches en ébauches, aucun fichier de tâches), Claude complète les en-têtes, écrit ou range les tâches dans `docs/TACHES-<Sujet>.md` et coche leur état réel d'après le code, le JOURNAL et git, sans toucher au code ni rien inventer. À la fin de son tour, l'app relit le Workflow et **centre la carte sur « ▶ Bosser ici », en surbrillance**. L'arbre reste lu dans les fichiers, sans IA (D8). |
| D18 (2026-10-16, retour de mentalyas) | **Jauge de contexte sur chaque tâche, « ▶ Compléter ici »** | Un nœud sans le contexte au maximum ne doit pas permettre de travailler sur ses tâches (D5) : chaque carré porte un **anneau de contexte** (la maturité de son brainstorm : 33, 66, 100 %, pointillé si non évalué), et seul un carré à 100 % peut être « Bosser ici ». Quand aucune tâche n'est travaillable, le **rond du brainstorm à compléter** s'allume (même halo) avec « ▶ Compléter ici » : le plus mûr de ceux qui ont encore des tâches à faire, le premier dans l'ordre de l'arbre à égalité. Après « Mettre à jour » (D17), la carte s'y centre. |
| D16 | **Ce qui reste** : la confidentialité, les conversations de nœud (023 D6), les fichiers d'une tâche et leur code (023 D9, D12, D15), le bandeau « à reporter » (023 D28), la rediffusion et les nouveautés (spec 021). L'ancien rangement du Workflow par branches (023 D8) est **remplacé** par l'arbre (D2). |

## Exigences

- **FR-001** Domaine pur `workflowArbre` : depuis les fichiers lus (brainstorm, specs, fichiers de tâches), l'arbre des
  ronds et des carrés (D9), la maturité (D10), l'avancement des tâches, les ébauches (D5) et le carré « Bosser ici »
  (D6) ; déterministe (mêmes fichiers, même arbre) ; tests.
- **FR-002** Lecture des lignes `**Parent**`, `**Maturité**`, `**Tâches**` : données, jamais instructions ; chemin
  confiné au dossier du projet ; valeur inconnue ignorée.
- **FR-003** Renderer Workflow : sens alterné, dessin de l'app pour le genesis et les ronds, deux anneaux, carrés,
  ébauches, halo, panneau d'actions (D7) ; accessibilité (nœuds en boutons, noms accessibles disant brainstorm et
  tâches, `expectNoAxeViolations`) ; mouvement réduit respecté.
- **FR-004** Consignes de D7 et D11 : pures, testées ; consignes du pont MCP mises à jour.
- **FR-005** Progression A, B, C (D12) et bascule Réel · Prévu · Les deux (D13) ; sélecteur gardé par projet.
- **FR-006** Architecture : explorateur (spec 031) monté dans la carte (D14) ; détecteur (D15) en domaine pur, testé
  sur les jeux de test de la spec 017 (TS, C#, PHP).

## Critères de réussite

- **SC-001** Les mêmes fichiers donnent deux fois le même arbre Workflow (test), et un fichier de tâches modifié par
  Claude se voit à la relecture suivante (023 D10).
- **SC-002** Depuis le Workflow, le carré à implémenter s'ouvre en un clic (« ▶ Bosser ici ») et sa consigne attend
  dans la conversation.
- **SC-003** Un rond pas mûr ne propose jamais « Implémenter » ; ses tâches restent des ébauches.
- **SC-004** Sur le dépôt du Brainstormer, l'arbre Workflow s'affiche en moins de 2 s (comme 023 SC-002).
- **SC-005** Le détecteur reconnaît l'architecture des jeux de test de la spec 017 (une raison en mots par résultat).

## Clarifications (2026-10-14, mentalyas)

- **Q1** Les documents de brainstorm existants n'avaient ni `**Parent**` ni `**Maturité**` → **une passe les écrit**
  (faite le 2026-10-14 sur les 90 documents du Brainstormer) : parent = le L1 de la famille (023 D11), le L2 de même
  nom pour un L3, le document amendé pour un amendement, `L1-fondation.md` pour une fonctionnalité de départ sans
  famille ; maturité « complet » pour toute famille qui a abouti à une spec (D10), « insuffisant » pour
  `L1l-noeuds-genesis.md` (graine, rien de décidé).
- **Q2** Une spec livrée est un **rond complet avec ses carrés faits** (plus de repli d'office, 023 D5 remplacée pour
  le Workflow).
- **Q3 (lot 5)** « Réel » vient de **l'analyse du code** (spec 017 : modules et fichiers, comme l'explorateur), pas de
  la carte de structure de Claude : sans IA, à jour après « Réanalyser ». Une **partie** est un rond du Workflow qui
  porte des carrés (user story, socle d'une spec, lot ou groupe d'un fichier de tâches ; un document sans tâches est
  une partie vide) : réelle si un fichier qu'elle cite existe dans le code (ou si toutes ses cases sont faites),
  prévue sinon ; son module est celui de la plupart de ses fichiers. Hors plan : fichier du code (hors plomberie)
  qu'aucune tâche ne cite (un chemin cité couvre un fichier ou un dossier).
- **Q4 (lot 5)** Les trois lectures s'affichent **en panneau sur la carte**, comme l'Architecture (lisibles quel que
  soit le zoom, fidèles aux maquettes), avec la bascule des vues en tête.
- **Q5 (lot 5)** Le panneau **se replie** (« ▾ Voir la carte », « ▴ Rouvrir ») pour montrer la carte dessous : la
  carte de structure de Claude et ses statuts (spec 030), les blocs de la vue (023 D25) restent accessibles. Un panneau
  ne s'ouvre que sur un choix de vue (sans choix, la carte s'affiche comme avant) ; « Centrer sur le nœud » d'un
  élément de la carte replie le panneau.
- **Q6 (2026-10-14, après essai sur le dépôt du Brainstormer)** Le premier rendu rangeait la Progression par dossiers
  du code (`main`, `renderer`…) : des dizaines de user stories et de « Socle » par colonne, 613 fichiers hors plan un
  par case, loin des maquettes. → Une colonne (A), un étage (B), une colonne de lots (C) = une **famille du Workflow**
  (un rond de niveau 1 : un L1, ou une spec ou un fichier de tâches sans L1), ses **lots** dessous (specs, fichiers de
  tâches ; un document sans tâches seulement si la famille n'a encore rien de spécifié) ; A a le rond du projet en haut
  (son %) et le tronc ; un lot est bâti si un fichier cité existe, si ses cases sont faites, ou s'il est livré. Le
  **hors plan se regroupe par dossier, replié** (« src/main/git · 12 fichiers »), dans un bloc orange sous la lecture.
  Pendant une première analyse (carte du code vide), rien n'est encore réel ni hors plan.
- **Q7 (2026-10-15, après essai sur le dépôt du Brainstormer)** Les maquettes montraient 4 familles ; le dépôt en a
  une quarantaine : A débordait (et sa partie gauche était inaccessible), B empilait 41 étages. → Une famille
  **terminée** (chacun de ses lots livré, abandonné ou toutes cases faites) rejoint un groupe **« ✔ Bâti »** replié :
  la première branche de A, l'étage des fondations de B, dépliable d'un clic (une brique par famille). Les familles
  ouvertes gardent leur branche ou leur étage, dans l'ordre du Workflow. C reste complète (une colonne par famille,
  étape en couleur comme la maquette). Finitions vers les maquettes : titre non répété quand la famille est le lot, rond
  du projet plus grand, briques et barres plus lisibles, légende et résumé en pied de vue, hors plan replié en une
  ligne (« à décrire dans une spec, ou à retirer »), et un document sans tâches dont la maturité est « complet » est
  « à spécifier », plus « à brainstormer ».
- **Q8 (2026-10-15, maquettes « Progression en canevas », piste organique choisie)** La Progression n'a plus de barre
  de défilement : c'est un **canevas** (molette = zoom autour du pointeur, glisser le fond = se déplacer, boutons
  « + », « − », « Tout afficher » ; chaque lecture s'ouvre cadrée en entier). Matière **organique** : fond pointillé
  qui suit le déplacement, anneaux à halo, branches en courbes (pleines et bleues vers le bâti, pointillées vers le
  prévu), briques à ombre douce, prévu en bourgeon hachuré, l'arbre « pousse » à l'ouverture (rien en animations
  réduites). Les familles **« à brainstormer plus tard »** (en-tête `**Maturité** : … plus tard`) se regroupent en
  **« ✦ Plus tard »**, replié, comme « ✔ Bâti ». **Un clic** sur une famille, une brique ou une famille d'un groupe
  ouvre la vue **Workflow** centrée sur son rond : ses ancêtres repliés et lui-même se déplient, le rond et ses
  carrés sont surlignés quelques secondes (un contour fixe en animations réduites).
- **Q10 (2026-10-15, après les pipelines d'agents)** Un fichier de tâches qu'aucun document ne nomme (`**Tâches**`)
  comptait d'office comme mûr (100 %) : ses tâches étaient des carrés à implémenter alors que leur conception n'avait
  jamais été écrite (le brainstorm des pipelines était resté dans une conversation). → Un fichier de tâches **orphelin
  est « non évalué »** : ses tâches restent des **ébauches** (D5) tant qu'un document de brainstorm complet ne le nomme
  pas ; « Discuter » sur lui ou sur une de ses ébauches fait écrire ce brainstorm (avec `**Tâches**` et `**Maturité**`).
  Et toute consigne d'implémentation (tâche, user story, tâche de fichier, lot) rappelle les règles du projet : lire
  son `CLAUDE.md` et ses règles de travail, vérifier avec ses commandes (typecheck, lint, format, tests), consigner le
  changement dans son journal, jamais `--no-verify` ni d'ajout global sans revue (le chat ne charge aucun réglage).
- **Q9 (2026-10-15)** L'Architecture ne reprend que ce qui aide à comprendre le projet : le code et la doc
  informative (README, fondation, brainstorms, specs). L'outillage et la doc **utiles seulement à l'IA** (skills,
  `.specify`, `graphify-out` et ses 2 400 fichiers, consignes `CLAUDE.md`, `docs/claude/`, journal) sortent **dès
  l'analyse** (017 FR-013 amendée) : explorateur, Architecture et hors plan s'allègent ensemble.
- **Écart à valider (lot 2, 2026-10-14)** : sur le dépôt du Brainstormer, l'arbre compte 1 030 carrés ; tout déplier
  rendrait la carte illisible et lente. Un rond **dont tous les carrés sont faits** est donc replié d'office (« ▸ N »),
  dépliable d'un clic, choix mémorisé (023 FR-016). Les autres ronds restent ouverts.
