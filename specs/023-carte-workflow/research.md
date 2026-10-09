# Research — Carte Workflow (spec 023)

## R1 — Où vit la vue Workflow
- **Decision** : une position de la bascule des cartes de projet lié (`StructureView = 'workflow' | 'progression' |
  'architecture'`), dessinée sous le genesis à la place de la structure quand elle est choisie.
- **Rationale** : D3 (jamais mélangées), réutilise la barre de la spec 017 et le glissement entre vues (022).
- **Alternatives** : page dédiée (perd la carte et ses cartes de détails) ; superposition des deux (refusée, D3).

## R2 — Analyse des fichiers Markdown
- **Decision** : fonctions pures ligne par ligne, tolérantes, dans `src/main/domain/workflow/`.
  - Titre : première ligne `# …` (préfixe « Feature Specification: » retiré) ; sinon nom du dossier.
  - Statut : première ligne contenant `**Status**:` (valeur jusqu'au prochain « · ») ; marqueur reconnu sans casse ni
    accents **au début de la valeur** : `Livrée|Delivered`, `En pause|Paused`, `Abandonnée|Abandoned` (« Draft — US1
    livrée » n'est pas un marqueur) ; `Created` lu sur la même ligne ou la ligne `**Created**:`.
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

## R10 — Source de l'anatomie (US5, D14)
- **Decision** : un seul passage du processus d'analyse par fichier ouvert. `WorkflowSymbols` devient
  `WorkflowAnatomy` : à partir de l'extraction tree-sitter déjà produite (symboles avec parent et complexité, imports,
  appels), le main renvoie une `WorkflowAnatomyView` revalidée et bornée ; les **raccourcis** du lecteur (D12) en sont
  dérivés côté interface. Le canal `workflow:symbols` est **remplacé** par `workflow:anatomy` (DRY : une analyse, deux
  usages).
- **Alternatives** : second canal à côté de `workflow:symbols` (deux analyses du même fichier, refusé) ; analyse du
  projet entier comme la spec 017 (lente, inutile pour un seul fichier, refusée).

## R11 — Blocs « offerts »
- **Decision** : le processus d'analyse ajoute `exported: boolean` à chaque symbole, lu dans l'arbre syntaxique (pas
  dans le texte) : **TS/TSX/JS** — déclaration sous un `export_statement` (y compris `export default`) ; méthode d'une
  classe offerte sans `private` / `protected` ni nom `#privé`. **C#** — modificateur `public` (membres d'une interface :
  offerts). **PHP** — classes et fonctions de premier niveau offertes ; méthodes sans `private` / `protected`. Schéma
  Zod du protocole mis à jour avec le champ ; la spec 017 ne stocke pas ce champ (aucune migration, ses résultats ne
  changent pas).
- **Alternatives** : lire `export` / `public` sur la ligne de début du bloc dans le main (fragile : décorateurs,
  déclarations sur plusieurs lignes ; refusé).

## R12 — Appels internes, JSX et blocs peut-être inutilisés
- **Decision** : fonction pure `fileAnatomy(extraction)` (`src/main/domain/workflow/anatomy.ts`). Un appel est
  **interne** quand son nom correspond à un bloc du fichier et que l'appel est direct (`receiver` nul) ou porte sur
  l'objet courant (`this`, `$this`, `self`, `static`), ou que c'est un `new` d'une classe du fichier. Plusieurs blocs du
  même nom : un lien vers chacun, marqué `ambiguous`. Un bloc est **peut-être inutilisé** s'il n'est ni offert, ni
  cible d'un appel interne, ni parent d'un bloc qui l'est (une classe dont une méthode sert est utile).
  **JSX** : l'analyseur TS/TSX compte `<Composant …>` (élément dont le nom commence par une majuscule) comme un appel
  de `Composant` ; sans cela, chaque composant React privé paraîtrait inutilisé. Effet de bord voulu : les liens
  mesurés de la spec 017 gagnent les usages de composants (tests 017 relus).
  Un nom passé en valeur (`list.map(trailOf)`) n'est pas un appel : c'est la limite dite par « peut-être ».
  *Précisé le 2026-10-09 (essai sur `WorkflowCard.tsx` et `IdeasCanvas.tsx`)* : une **fonction locale à une fonction**
  (gestionnaire d'un composant, `onSelect={choisir}`) n'est jamais grisée — elle est presque toujours passée en
  valeur, et le compilateur ou le linter signale déjà une locale inutilisée. Compter les noms passés en valeur comme
  des appels a été écarté : ils deviendraient des liens dans l'analyse de projet de la spec 017 (bruit).
- **Alternatives** : résolution de types (compilateur TypeScript : lourd, un seul langage, refusé).

## R13 — Dessin du schéma
- *Remplacée le 2026-10-09 par R16 (test guidé : « pas assez ludique et explicite »).* Première version : HTML + SVG dans le lecteur, sans React Flow (panneau étroit, disposition fixe). Trois colonnes :
  **Utilise** (sources d'import, nom court, nombre de noms importés ; 20 au plus puis « + N autres »), **Blocs** (dans
  l'ordre du fichier, méthodes en retrait sous leur classe, hauteur selon le nombre de lignes bornée, pastille de
  complexité « ● ●● ●●● » à seuils 1–4 / 5–9 / 10+), **Offre** (noms des blocs offerts, reliés à leur bloc). Les appels
  internes sont des **arcs** à gauche de la colonne Blocs (diagramme en arcs : lisible sur une liste verticale). Plus
  de 40 blocs : classes repliées avec leur nombre de méthodes, dépliables. Mentions : « appels reconnus par le nom ».
- **Alternatives** : React Flow avec disposition automatique (lourd dans un panneau, déplacements inutiles ici).

## R14 — Parcours de lecture et blocs cités par la tâche
- **Decision** : `readingPath(anatomy)` (pur) : pour chaque bloc offert dans l'ordre du fichier, parcours en profondeur
  de ses appels internes (ordre des lignes d'appel), chaque bloc visité une seule fois ; les blocs jamais atteints
  viennent ensuite, dans l'ordre du fichier, sous « Le reste ». « Précédent / Suivant » (← / → au clavier) surlignent
  l'étape et placent son code dans la colonne du lecteur (le schéma reste visible au-dessus, réduit).
  **Blocs cités** : `citedBlocks(texts, names)` (pur) : noms de blocs présents comme **mot entier** dans la description
  de la tâche (ou des tâches restantes et du titre d'une user story), sensible à la casse ; marqués par un contour, un
  « ✦ » et le texte accessible « cité par la tâche » (pas la couleur seule, FR-023).
- **Alternatives** : parcours dans l'ordre du fichier seul (ne raconte rien) ; mise en valeur par la couleur seule
  (inaccessible).

## R15 — La phrase « ce que ça fait »
- **Decision** : l'analyseur ajoute `doc: string | null` à chaque symbole : le ou les commentaires **collés** au-dessus
  de la déclaration (ou de son `export`, de sa déclaration `const`), sans marqueurs (`/** */`, `*`, `///`, `//`, `#`) ni
  balises XML de C# (`<summary>`), sans emphase Markdown (`**`, `` ` ``) ni renvois de méthode (« (spec 023 D6) »,
  « (FR-012) »), **première phrase** seulement, espaces réduits, 200 caractères au plus. Affichée
  comme du texte, jamais interprétée. Ce dépôt commente presque chaque bloc en français : le schéma dit ce que fait
  chaque bloc sans appel à Claude.
- **Alternatives** : résumé par Claude (`claude -p` : lent, coûteux pour un simple survol, rejeté) ; nom seul (pas
  assez explicite, retour de mentalyas).

## R16 — Arbre en grand, formes par rôle, récit
- **Decision** : « ◈ Schéma du fichier » ouvre une **fenêtre plein écran** (dialogue modal, Échap ferme) avec React Flow
  (déjà dans la stack : déplacement, zoom, cadrage) et une **disposition en couches maison, pure** (`anatomyTree.ts`) :
  racines = blocs sans appelant ni classe (offerts d'abord, puis ordre du fichier), couche = profondeur la plus courte
  depuis une racine (une méthode est sous sa classe), ordre dans la couche par barycentre des parents ; liens
  orthogonaux (`smoothstep`) fléchés pour les appels, pointillés sans flèche pour « contient ». **Rôles** (pur,
  `blockRole`) : composant (fonction en majuscule d'un `.tsx` / `.jsx`), hook (`useX`), classe, type (interface),
  méthode, fonction utilitaire ; une **forme** chacun (bandeau à gauche, hexagone, double bordure, coins coupés, pilule,
  rectangle) et une **couleur** de jeton du thème, rappelées par une légende. Panneau de droite = **récit** du bloc
  choisi, survolé ou de l'étape : rôle, phrase, taille et complexité en mots (« simple », « moyen », « dense »),
  « appelé par », « appelle », « ✦ cité par la tâche », « Voir le code ». Survol : les blocs sans lien passent à 25 %
  d'opacité. Parcours : cadrage animé sur l'étape (immédiat si animations réduites), blocs visités cochés, jauge.
- **Alternatives** : liste à arcs dans le lecteur (R13, jugée pas assez explicite) ; ELK / dagre (dépendance nouvelle
  pour un arbre de quelques dizaines de blocs, rejeté).

## R17 — « Que fait ce fichier ? » (D15)
- **Decision** : tâche automatique `file_summary` par l'`AIGateway` (constitution III) : cadre figé
  `FileSummaryFrame`, entrée balisée `<fichier>` (code, 40 000 caractères au plus, mention si tronqué) et `<blocs>`
  (nom, sorte, offert, lignes, phrase de commentaire R15 — l'analyse sert d'aide à Claude), balises fermantes
  neutralisées ; sortie `FileSummaryOut` (`role`, `recoit`, `produit`, `morceaux` 1–6) ; **sans outil** (constitution
  IV : le code est passé en donnée, Claude ne lit rien d'autre) ; `localOnly` pour un projet « Local uniquement » ;
  jamais mise en file. `WorkflowSummaries` (main) : garde de lecture de `workflow:file`, morceaux réduits aux blocs
  existants et dédoublonnés, **cache en mémoire** (empreinte SHA-256 du contenu, 50 entrées, demandes simultanées
  partagées, panne non gardée). Canal `workflow:summary`. Modèle : celui des éléments de projet.
  *Révisé le 2026-10-09 (D18)* : le cache en mémoire devient une **table** `code_file_summaries` (migration 0038 et son
  `down`) : (genesis, chemin) → empreinte, JSON de l'explication ; canal `workflow:savedSummary` (lecture sans IA) ;
  seules les demandes en cours restent en mémoire (partagées).
- **Alternatives** : schéma d'appels (R13, R16 : jugé incompréhensible, retiré) ; table de cache (migration pour une
  aide de lecture, rejetée : l'explication se refait en quelques secondes) ; conversation `claude -p` avec outils
  (lourde, et lit au-delà du fichier).

## R18 — Petit schéma de l'explication (D15 précisé)
- **Decision** : la sortie `file_summary` gagne `liens` (`de` = « entree » ou morceau, `vers` = morceau ou
  « sortie », `verbe` ≤ 40 ; 10 au plus) ; cadre en version 2. Le main ne garde que les flèches entre bouts existants,
  sans doublon ni boucle (`flow`). L'interface **dessine** en SVG (`flowDiagram.ts`, pur : rang = plus long chemin
  depuis le haut, cycle ignoré, flèche qui remonte contournée par la droite) ; « Copier en Mermaid » écrit un
  `flowchart TD` aux identifiants générés et libellés échappés (`#quot;`, `#124;`).
- **Alternatives** : bibliothèque `mermaid` avec texte écrit par l'IA (dépendance lourde, syntaxe parfois invalide,
  texte de l'IA interprété : écartée par mentalyas au profit du dessin par l'app).
