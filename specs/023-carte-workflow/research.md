# Research — Carte Workflow (spec 023)

## R1 — Où vit la vue Workflow
- **Decision** : une position de la bascule des cartes de projet lié (`StructureView = 'workflow' | 'progression' |
  'architecture'`), dessinée sous le genesis à la place de la structure quand elle est choisie.
- **Rationale** : D3 (jamais mélangées), réutilise la barre de la spec 017 et le glissement entre vues (022).
- **Alternatives** : page dédiée (perd la carte et ses cartes de détails) ; superposition des deux (refusée, D3).

## R2 — Analyse des fichiers Markdown
- **Decision** : fonctions pures ligne par ligne, tolérantes, dans `src/main/domain/workflow/`.
  - Titre : première ligne `# …` (préfixe « Feature Specification: » retiré) ; sinon nom du dossier.
  - Statut : première ligne contenant `**Status**:` ; marqueur reconnu sans casse ni accents : `livrée|livree|delivered`,
    `en pause|paused`, `abandonnée|abandonnee|abandoned` ; `Created` lu sur la même ligne ou la ligne `**Created**:`.
  - Décisions : lignes de tableau `| D<n>` (comptées).
  - User stories : `^### User Story (\d+)\s*[—–-]\s*(.+?)\s*\((?:Priority:\s*)?P(\d)\)` (formats du dépôt : tiret ou
    tiret long, « (Priority: P1) » ou « (P1) ») ; suffixes (🎯 MVP) retirés.
  - Tâches : `^\s*- \[( |x|X)\]\s+(T\d{3,4})\b(.*)$` ; `[P]` ignoré ; `[US(\d+)]` → user story ; description = reste,
    sans les étiquettes.
  - Chemins cités : segments entre backticks ou après « in » / « dans » qui ressemblent à un chemin relatif
    (`[\w.-]+(/[\w.@-]+)+\.\w+` ou dossier `…/`), dédoublonnés, au plus 20 par tâche ; jamais absolus ni `..`.
- **Rationale** : formats Spec Kit connus (21 specs vérifiées le 2026-10-09) ; aucune dépendance ; rien n'est rendu.
- **Alternatives** : bibliothèque Markdown (dépendance, produit du HTML) ; demander à Claude (coût, D4 l'exclut).

## R3 — Bornes et sécurité de lecture
- **Decision** : `spec.md` / `tasks.md` / docs ≤ 512 Ko chacun (au-delà : ignoré, « lecture partielle ») ; au plus 200
  specs, 1 000 tâches par spec, 300 documents de brainstorm ; seuls `.md` lus pour la vue ; dossiers lus par
  `readdir` non récursif (`specs/`, `docs/brainstorm/`) ; chaque fichier résolu par `realpath` et vérifié sous la
  racine réelle (un lien symbolique sortant est ignoré) ; fichier contenant `\0` = binaire, ignoré. Lecture d'un
  fichier cité (`workflow:file`) : mêmes gardes que les fichiers d'élément (≤ 1 Mo, sensible refusé), via le module
  partagé `projectFiles.ts`, **et** le chemin doit être cité par une tâche du projet (pas de lecture arbitraire).
- **Rationale** : principe I (fichiers d'un projet importé non fiables), FR-002, SC-006.
- **Alternatives** : lecture libre de tout chemin relatif (élargit la surface sans besoin).

## R4 — « Discuter » : quelle conversation, quel déclenchement
- **Decision** : la conversation **du genesis du projet** (spec 008, dossier lié, réglages isolés), ouverte dans la
  carte du genesis côté discussion ; la consigne est **pré-remplie** dans le champ (mentalyas l'envoie). Consignes
  (`prompts.ts`) : tâche → « Implémente la tâche T032 de la spec 022-noeuds-vivants (specs/022-noeuds-vivants/tasks.md),
  en suivant /speckit-implement ; coche sa case quand elle est faite. » ; US → « Mène les tâches restantes de l'US2 … dans
  l'ordre » ; L1 → « Lance /brainstorm à partir de docs/brainstorm/L1j-carte-workflow.md ».
- **Rationale** : une tâche n'est pas un neurone (pas de conversation propre) ; II et coût (aucun tour sans geste).
- **Alternatives** : un neurone par tâche (pollue la base, synchronisation fichiers ↔ base) ; envoi automatique.

## R5 — Rafraîchissement
- **Decision** : `useQuery(['workflow', genesisId])` actif seulement quand la vue Workflow est choisie ; invalidé sur
  chaque `chat:turnEnd` (fichiers courts, relecture < 100 ms) et sur « Relire » ; aucun observateur de fichiers.
- **Rationale** : D10 ; simple ; Claude est le seul auteur habituel des cases.
- **Alternatives** : `fs.watch` (fragile sous Windows, fuites, bruit pendant les écritures de Claude).

## R6 — Repli mémorisé
- **Decision** : liste des clés de nœuds repliés/dépliés contre leur défaut, par genesis, dans `settings`
  (`workflow.folded.<genesisId>`, JSON validé par Zod, ≤ 500 clés) ; défaut : Livrées repliée, US livrées repliées,
  Socle replié, À venir dépliée au niveau spec seulement.
- **Rationale** : FR-016 sans migration ; les nœuds Workflow ne sont pas des lignes de la base.
- **Alternatives** : colonne sur `neurons` (pas de neurone par nœud) ; mémoire seulement (perdu au redémarrage).

## R7 — Clés de nœuds stables
- **Decision** : `wf:<genesisId>:<chemin>` avec chemin `branch:active|upcoming|delivered|brainstorm`, `spec:022`,
  `story:022:2`, `socle:022`, `task:022:T032`, `doc:L1j-carte-workflow`. Le repli, les cartes ouvertes et le glissement
  s'appuient dessus.
- **Rationale** : une relecture garde les cartes ouvertes et anime seulement ce qui change.

## R8 — Pont vers la structure
- **Decision** : côté interface, l'élément couvrant = celui du même genesis dont un chemin couvre le fichier, le plus
  précis (même règle que `covers` / meilleur chemin de `measured.ts`, déplacée dans `src/shared/structure/covers.ts`).
  « Voir dans la structure » : `setStructureView(genesisId, 'progression')`, puis ouverture de la carte de l'élément et
  centrage (fonction de focus existante).
- **Alternatives** : liens dessinés entre vues (refusé, D9).

## R9 — Marqueurs sur les specs existantes
- **Decision** : au lot 5, liste proposée à mentalyas (specs dont le travail est fini mais avec des cases restantes :
  candidates 001, 002, 004, 006, 007, 008, 009, 010, 016, 020…) ; il valide ou corrige ; Claude écrit alors la ligne
  `**Status**` de chacune (fichiers du dépôt, commit `docs`). L'app, elle, n'écrit jamais.
