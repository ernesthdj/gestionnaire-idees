# Feature Specification: Les trois vues — Workflow, Progression, Architecture (spec 032)

**Feature Branch**: `main` · **Created**: 2026-10-14 · **Status**: Écrite (2026-10-14) — maquettes validées par
mentalyas dans l'artifact de brainstorm, lots à coder

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
| D9 | **Un rond** = un document de brainstorm (`docs/brainstorm/*.md`) ou une spec (`specs/0NN-*/spec.md`). Son parent est dit par `**Parent** : <nom du fichier>` dans l'en-tête du document (sous le titre ; plusieurs champs sur une ligne, séparés par « · ») — absent, ou `L1-fondation.md` (le document du projet lui-même) : niveau 1, sous le projet ; une spec qui cite un L1 (023 D11) en est l'enfant. Un fichier de tâches (`docs/TACHES-*.md`, `tasks.md`) se range sous le rond qui le nomme par une ligne `**Tâches** : <chemin>` (ou sous la spec qui le contient) ; sinon il est un rond de niveau 1 à lui seul. Ses lots `##` sont des ronds intermédiaires, ses cases les carrés. Bornes : 4 niveaux sous le projet (au-delà, regroupé), celles de la spec 023 pour les fichiers. |
| D10 | **Maturité du brainstorm = maturité évaluée** (choix de mentalyas) : Claude l'écrit dans le document du rond, ligne `**Maturité** : insuffisant \| suffisant \| complet` (33 / 66 / 100 %), en même temps que sa liste « ce qui manque ». Une spec écrite vaut « complet ». Sans ligne : anneau vide et gris (« non évalué »), action « Évaluer la maturité ». |
| D11 | **Brainstorm et pont MCP.** « ✦ Nouveau brainstorm » (023 D26) et « Lancer / Continuer le brainstorm » demandent à Claude d'écrire le document du rond avec ses lignes `**Parent**`, `**Maturité**`, `**Tâches**`, et ses tâches dans `docs/TACHES-<Sujet>.md` ; les consignes du pont le disent. Aucune écriture dans la carte (023 D27). |
| D12 | **Progression : trois lectures au choix** (« j'aime les 3 », mentalyas) : **A l'arbre qui pousse** (modules en colonnes sous le projet, leurs parties dessous), **B le chantier par étages** (fondations en bas, une brique par élément), **C les lots du Workflow** (une colonne par spec ou fichier de tâches, dans l'ordre du Workflow). Un sélecteur dans la barre, gardé par projet. Les trois ont la bascule **Réel · Prévu · Les deux**. |
| D13 | **Prévu, réel, hors plan.** Prévu = ce que la doc décrit (ronds et carrés du Workflow pas encore bâtis), en fantôme pointillé. Réel = ce que l'analyse du code trouve (spec 017 : modules, fichiers), plein, avec l'avancement de ses carrés. Hors plan = dans le code, couvert par aucun rond ni aucune tâche, en orange. Le lien entre un élément du code et le Workflow passe par les chemins de fichiers cités par les tâches (023 D9). |
| D14 | **Architecture = l'explorateur en boîtes dans la carte** (spec 031, choix de mentalyas) : la position « Architecture » affiche la carte en boîtes du projet à la place de l'ancienne vue en bandes de couches (spec 017 D20, retirée), avec ses gestes, sa fiche et sa recherche. |
| D15 | **Détecteur d'architecture** en tête de l'explorateur : l'architecture reconnue (Clean, hexagonale, MVVM, MVC, couches, aucune) **par des règles** sur les noms des modules et le sens des appels (ex. `domain`/`application`/`infrastructure` → Clean ; `ports`/`adapters` → hexagonale ; `viewmodels` → MVVM ; `controllers`/`models`/`views` → MVC), avec sa raison en une phrase ; Claude peut la préciser (D20 de la 017, `structure_dessiner`), mentalyas la corrige (sa correction prime, annulable). Les boîtes gardent leur couche (spec 031 D2). |
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
