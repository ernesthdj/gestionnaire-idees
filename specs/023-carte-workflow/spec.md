# Feature Specification: Carte Workflow (spec 023)

**Feature Branch**: `main` · **Created**: 2026-10-09 · **Status**: Draft — à valider par mentalyas
**Input**: « Il faudra revenir à comment la cartographie est structurée, car il faut qu'elle représente un workflow
logique en termes d'organisation et qui se calque sur notre façon de bosser. Brainstorm, specs, fonctionnalités, use
cases, implémentation etc. » — mentalyas. Brainstorm complet : `docs/brainstorm/L1j-carte-workflow.md` (sections 1 à 9
et synthèse, 2026-10-09), avec la note du Claude de l'app (avancement lu dans `tasks.md`).
**Glossaire** : *vue Workflow* = la carte d'un projet rangée selon notre façon de travailler (brainstorm → specs → user
stories → tâches) ; *projet lié* = genesis rattaché à un dossier de projet (genesis projet, spec 016, ou projet repris,
spec 017) ; *spec* = un dossier `specs/0NN-<nom>/` du projet ; *tâche restante* = case non cochée de `tasks.md`.

## Décisions (2026-10-09, brainstorm validé par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Usage | La vue sert **à piloter et à présenter, à égalité** : dire où en est le projet et quoi faire ensuite, et expliquer le projet de bout en bout (du pourquoi au comment) à quelqu'un d'autre ou à soi plus tard. |
| D2 | Portée | **Tous les projets liés, adaptée à chacun** : un projet mené à notre façon (brainstorm, specs, tâches) a la carte complète ; un projet repris sans specs ne montre que ce qu'il a (« À brainstormer », vues de structure) et se remplit au fil du travail. |
| D3 | Vues | La bascule actuelle d'une carte de structure (« Progression | Architecture », spec 017 D20) gagne une position : **« Workflow | Progression | Architecture »**. Les vues ne se mélangent jamais à l'écran. Progression et Architecture sont **inchangées** (spec 022 D23 : rien n'est retiré). La position Workflow existe aussi sur un projet lié pas encore cartographié (elle ne demande pas Claude). |
| D4 | Source | Le contenu est **lu par l'app dans les fichiers du projet**, sans Claude : `specs/*/spec.md`, `specs/*/tasks.md`, `docs/brainstorm/*.md`, `docs/FOUNDATION.md`. **Lecture seule**, confinée au dossier du projet lié ; le Markdown est une **donnée** (jamais exécuté, jamais interprété comme instruction, aucun HTML rendu). |
| D5 | Profondeur | **Spec › user stories (avec priorité) › tâches restantes**. Les tâches faites ne sont qu'un compteur (« 31/49 ») ; une user story livrée est **repliée d'office** (dépliable, spec 022 D14). Les tâches sans user story (mise en place, fondations, finitions) se rangent sous un nœud « Socle » de la spec. |
| D6 | Actions | Chaque nœud ouvre sa **carte de détails** (spec 022). « Discuter » sur une tâche ouvre une conversation chargée de **l'implémenter** ; sur une user story, de mener ses tâches restantes ; sur une idée « à brainstormer », de **lancer le brainstorm**. L'app **n'écrit jamais** `spec.md` ni `tasks.md` : cocher une case reste le travail de Claude, la carte suit en relisant les fichiers. *Précisé le 2026-10-09 (test de mentalyas) :* « Discuter » **étire la carte du nœud** vers la droite (pas de carte séparée) avec **une conversation propre à ce nœud** (spec, user story, socle, tâche ou idée) : créée au premier « Discuter », reprise ensuite, dans le dossier du projet et avec sa confidentialité ; la consigne pré-remplie porte sur ce nœud. |
| D7 | Statut d'une spec | **Calculé** depuis `tasks.md` : aucune case cochée = **planifiée**, toutes = **livrée**, sinon **en cours** ; sans `tasks.md` = **spécifiée**. Un **marqueur** dans la ligne `**Status**` de `spec.md` **prime sur le calcul** : « Livrée » → **livrée** (même avec des cases restantes, montrées comme **reliquats** dans sa carte), « En pause » → **en pause**, « Abandonnée » → **abandonnée** (rangée avec les livrées, marquée comme telle). Claude tient ces marqueurs à jour ; il les pose une fois sur les specs existantes du Brainstormer, avec l'accord de mentalyas (Q1). |
| D8 | Rangement | Le genesis du projet, puis quatre branches : **▶ En cours** · **⏸ À venir** (planifiées, spécifiées, en pause) · **✔ Livrées** (repliée, avec leur nombre) · **✦ À brainstormer**. Disposition en sens alterné et nœuds vivants de la spec 022 (couleur par branche, taille par niveau, statut en pastille, repli « ▸ N », glissements). |
| D9 | Pont avec la structure | Les **chemins de fichiers cités** par les tâches (« … in `src/x.ts` ») forment la liste des fichiers d'une tâche, d'une user story (union) et d'une spec ; ils s'affichent dans sa carte. « Voir dans la structure » bascule en Progression et met en focus l'élément qui couvre ce fichier (s'il existe). Aucun lien n'est dessiné entre les vues. *Révisé le 2026-10-09 (test guidé de mentalyas : « je ne comprends pas l'utilité de la vue Progression quand on clique sur structure ») :* plus de bascule ; à côté de chaque fichier, le **module qui le couvre** s'affiche sur place (« Parent › Élément »), sans quitter la vue Workflow. |
| D10 | Rafraîchissement (défaut, à confirmer par mentalyas) | Les fichiers sont relus **à l'ouverture de la vue** et **à chaque fin de tour de Claude** dans une conversation de ce projet ; un bouton « Relire » le fait à la demande. |
| D11 | À brainstormer (Q2) | Seuls les documents de **niveau 1** (`L1*.md`, une idée = un L1) sont des nœuds ; un L1 **cité par une spec** est couvert et n'apparaît pas dans « À brainstormer » (il figure dans la carte de la spec qui le cite). Les documents L2, L3 et L4 d'une même famille (un mot commun entre leur nom et celui du L1) sont des **fichiers de la carte** de ce L1 ; ceux sans famille, et `L1-fondation.md`, vont dans la carte du genesis avec la fondation. |
| D12 | Raccourcis du code (2026-10-09, retour de mentalyas) | Le lecteur d'une carte Workflow affiche, au-dessus du code, les **raccourcis** du fichier : classes, interfaces, fonctions et méthodes repérées par l'**analyse syntaxique tree-sitter** (paquet `@vscode/tree-sitter-wasm`, licence MIT, déjà utilisé par la spec 017), comme le lecteur des éléments ; un clic **surligne** le code concerné et la vue s'y place. L'analyse tourne dans le processus séparé de l'app (le code est lu, jamais exécuté) ; langage non analysé, erreur ou délai dépassé : pas de raccourci, le code reste lisible. |
| D13 | Lecture des fichiers de méthode (2026-10-09, retour de mentalyas) | Un fichier Markdown (`spec.md`, `tasks.md`, `plan.md`, brainstorm, fondation) s'affiche **mis en forme** dans le lecteur (titres, listes, cases à cocher, tableaux, code), avec une bascule **« Mis en forme \| Texte brut »**. Dans `tasks.md`, l'identifiant d'une tâche ressort en gras et ses étiquettes (`[US4]`, `[P]`) en pastilles. D4 tient toujours : même rendu sûr que les réponses de Claude (spec 008) — aucun HTML brut interprété, images jamais chargées ; et, comme l'exige FR-003, les **liens sont inertes** (soulignés, adresse au survol, rien ne s'ouvre). |
| D14 | Anatomie d'un fichier (2026-10-09, brainstorm flash de mentalyas) | Dernier niveau sous la tâche › fichier › code : le lecteur d'un fichier de code gagne une bascule **« Code \| Schéma »**. Le **schéma** montre, de gauche à droite, **ce que le fichier utilise** (ses imports, regroupés par source), **ses blocs** (classes avec leurs méthodes, fonctions ; taille selon le nombre de lignes, complexité en pastille) reliés par leurs **appels internes**, et **ce qu'il offre** (blocs exportés ou publics). Un bloc ni appelé dans le fichier ni offert est **grisé** (« peut-être inutilisé »). Un **clic** sur un bloc revient au code, surligné (D12). **Parcours de lecture** : des étapes numérotées partent de ce que le fichier offre et suivent les appels ; « Précédent / Suivant » avance bloc par bloc, le code suit. **Ce que la tâche touche** : ouvert depuis une tâche (ou une user story), les blocs dont le nom figure dans sa description **brillent**. Source : la même analyse syntaxique tree-sitter d'un seul fichier (D12), dans le processus séparé ; les appels sont reconnus **par le nom** dans le fichier (une approximation, dite dans le schéma). Langages analysés seulement (TS, C#, PHP) ; sinon pas de bascule. *Précisé le 2026-10-09 (test guidé de mentalyas : « pas assez ludique et explicite ») :* le schéma s'ouvre **en grand** (« ◈ Schéma du fichier », par-dessus la carte) en **arbre de haut en bas** : ce que le fichier offre en haut, ce que chaque bloc appelle dessous, les méthodes accrochées à leur classe ; **nœuds aux formes géométriques nettes, une forme et une couleur par rôle** (composant, hook, classe, type, méthode, fonction utilitaire) avec une légende « Comment lire ce schéma » ; **connexions orthogonales fléchées** ; sous chaque nom, **la phrase « ce que ça fait »** tirée du commentaire qui précède le bloc ; le **survol** d'un bloc éteint le reste, allume ses liens et le raconte (« appelle … », « appelé par … ») ; le **parcours** devient une **histoire** : une carte-récit par étape (rôle, phrase, appelants, appelés), blocs visités cochés, jauge « N / M explorés ». La liste à arcs dans le lecteur est retirée. *Remplacé le 2026-10-09 par D15.* |
| D15 | « Que fait ce fichier ? » (2026-10-09, 2e test guidé de mentalyas : « le survol est bugué, et le résultat général n'est pas compréhensible ») | **Remplace le schéma de D14** (arbre, formes, survol, parcours, blocs cités : retirés). Le lecteur d'un fichier de code offre **« ✨ Expliquer ce fichier »** : à la demande seulement, la tâche automatique `file_summary` (passerelle IA, **sans outil**, consigne figée, code balisé comme donnée, schéma de sortie fermé ; modèle des éléments de projet, Sonnet par défaut ; IA locale pour un projet « Local uniquement ») rédige : le **rôle** du fichier en une phrase simple, ce qu'il **reçoit**, ce qu'il **produit**, et **3 à 5 morceaux importants** dans l'ordre de lecture, chacun avec son utilité ; un morceau est un bloc **existant** du fichier (un nom inventé est écarté) et un clic surligne son code. L'explication est gardée **en mémoire** tant que le fichier ne change pas. Les raccourcis (D12) restent. *Précisé le 2026-10-09 (« l'explication est TOP, y'a moyen de la générer avec un petit mermaid en plus ? ») :* l'explication porte aussi un **petit schéma** « Comment ça marche » : 2 à 8 flèches légendées d'un verbe entre l'entrée (« Reçoit »), les morceaux et la sortie (« Produit »), **dessiné par l'app** (aucune dépendance, aucun texte de l'IA interprété ; seules les flèches entre bouts existants sont gardées), de haut en bas ; un clic sur un morceau surligne son code ; **« Copier en Mermaid »** donne le même schéma en texte Mermaid (identifiants générés, libellés échappés) pour des notes. |
| D16 | Tâches faites (2026-10-09, retour de mentalyas : « je dois voir les tâches qui ont été accomplies ») | **Précise D5** : sous chaque user story (et sous le socle), un nœud **« ✓ Faites (N) »**, replié d'office ; déplié, il montre les tâches cochées, grisées et marquées ✓, chacune ouvrant sa carte (fichiers, code, explication). Une user story livrée reste repliée d'office (D5). |
| D17 | Lecteur confortable (2026-10-09, test du petit schéma, capture de mentalyas : « c'est trop petit, je ne peux pas bien consulter ni le code ni le mermaid ; au lieu d'empiler les vues verticalement, les empiler horizontalement ») | Explication ouverte : **explication à gauche, code (raccourcis compris) à droite**, chacun sur toute la hauteur ; le lecteur s'élargit à 1 000 px pour ce seul cas. Le petit schéma garde sa **taille naturelle** (réduit si la colonne est plus étroite, jamais agrandi). **« ⤢ Agrandir »** ouvre le lecteur (explication et code) sur toute la fenêtre, quel que soit le zoom de la carte ; « ⤡ Réduire » ou Échap revient à la carte sans la fermer. Pas de redimensionnement à la main (spec 022 D24 inchangée). *Précisé le 2026-10-09 (capture : « le mermaid doit respirer, on n'arrive pas à lire le texte sur les liens ») :* les morceaux que rien n'appelle partagent la première rangée avec « Reçoit » ; plus d'espace (36 px entre boîtes, 84 px entre rangées) ; chaque verbe sur une **pastille** posée près du départ de sa flèche, décalée si elle touche une boîte ou une autre pastille, coupée au-delà de 24 caractères (texte entier au survol). |
| D18 | Explication gardée (2026-10-09, mentalyas : « ce qui est généré par une analyse explicative reste là tant que le code n'a pas été changé ») | **Précise D15** : l'explication est **enregistrée** (table `code_file_summaries`, une par fichier d'un projet lié) avec l'**empreinte SHA-256** du contenu expliqué. À l'ouverture d'un fichier, l'explication à jour **s'affiche d'elle-même**, même après un redémarrage, sans appeler l'IA ; si le code a changé, elle n'est pas montrée et le bouton devient « ✨ Réexpliquer (le code a changé) » ; la nouvelle remplace l'ancienne. Une ligne abîmée ou d'un ancien format est ignorée (revalidée à la lecture). |

## Clarifications

### Session 2026-10-09

- Q : Presque aucune spec du dépôt n'a toutes ses cases cochées (001 : 55/60, 007 : 38/39, 009 : 11/12…) ; comment
  reconnaître une spec livrée ? → R : **marqueur dans la ligne `**Status**`** (« Livrée », « En pause »,
  « Abandonnée ») qui prime sur le calcul ; les cases restantes d'une spec livrée sont des reliquats visibles dans sa
  carte (D7).
- Q : `docs/brainstorm/` compte 75 documents ; que met-on dans « À brainstormer » ? → R : **les L1 non cités par une
  spec** ; les L2/L3/L4 de leur famille sont des fichiers de leur carte (D11).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Voir où en est le projet, rangé selon notre façon de travailler (Priority: P1) 🎯 MVP

mentalyas ouvre la carte de structure du Brainstormer et bascule sur « Workflow ». Le genesis du projet déploie
quatre branches : « En cours » montre les specs 017 et 022 avec leur jauge (« 71/80 », « 33/49 ») ; sous la 022, les
user stories US2, US4 et US5 sont dépliées avec leurs tâches restantes, US1 et US3 sont repliées et marquées livrées ;
« À venir » liste les specs planifiées et en pause ; « Livrées » est repliée avec leur nombre. Il revient à
« Progression » : la carte de structure est exactement celle d'avant.

**Why this priority**: c'est le cœur de la demande (une carte qui suit le workflow) et elle sert seule à piloter ;
les autres stories s'appuient dessus.

**Independent Test**: sur le profil démo, un projet lié dont le dossier contient deux specs (une à moitié faite, une
sans case cochée) montre en Workflow la bonne répartition, les bons compteurs et seulement les tâches restantes ;
basculer en Progression puis revenir ne perd rien.

**Acceptance Scenarios**:

1. **Given** un projet lié avec `specs/` contenant une spec à 3/5 tâches cochées, **When** mentalyas choisit
   « Workflow », **Then** la spec est sous « En cours » avec « 3/5 », et seules ses 2 tâches restantes sont des nœuds.
2. **Given** une user story dont toutes les tâches sont cochées, **When** la vue s'affiche, **Then** elle est repliée et
   marquée livrée ; la déplier montre qu'elle n'a pas de tâche restante.
3. **Given** une spec sans `tasks.md`, **When** la vue s'affiche, **Then** elle est sous « À venir » marquée spécifiée.
4. **Given** la ligne `**Status**` d'une spec contient « En pause », **When** la vue s'affiche, **Then** la spec est
   sous « À venir » marquée en pause, avec sa jauge.
5. **Given** la vue Workflow ouverte, **When** mentalyas bascule en Progression puis en Architecture, **Then** ces vues
   sont identiques à celles d'avant la spec 023, et le retour en Workflow glisse (spec 022 D27).
6. **Given** un projet lié sans dossier `specs/` ni `docs/brainstorm/`, **When** mentalyas choisit « Workflow », **Then**
   la vue montre le genesis et un message expliquant comment la carte se remplira (brainstormer, puis spécifier).

---

### User Story 2 — Lancer Claude sur une tâche ou une idée depuis la carte (Priority: P2)

mentalyas clique sur la tâche T032 de la spec 022 : sa carte de détails montre la spec et la user story, la
description de la tâche et les fichiers qu'elle cite. Il clique « Discuter » : la conversation s'ouvre, Claude
reçoit la consigne d'implémenter T032 dans le dossier du projet. Quand Claude coche la case, la tâche disparaît de la
carte et la jauge avance.

**Why this priority**: c'est ce qui fait de la vue un poste de pilotage et pas seulement un tableau de bord.

**Independent Test**: « Discuter » sur une tâche ouvre une conversation dans le dossier du projet dont le premier
message nomme la spec et la tâche ; modifier à la main la case dans `tasks.md` puis terminer un tour de Claude met la
carte à jour.

**Acceptance Scenarios**:

1. **Given** une tâche restante, **When** mentalyas clique dessus, **Then** sa carte de détails montre son identifiant,
   sa description, sa user story, sa spec et les fichiers qu'elle cite.
2. **Given** la carte d'une tâche, **When** il clique « Discuter », **Then** une conversation s'ouvre dans le dossier du
   projet avec la consigne d'implémenter cette tâche (spec et identifiant nommés) ; double-clic sur le nœud = même effet.
3. **Given** la carte d'une user story, **When** il clique « Discuter », **Then** la consigne porte sur ses tâches
   restantes, dans l'ordre.
4. **Given** une idée « à brainstormer », **When** il clique « Discuter », **Then** la conversation part avec la
   consigne de brainstormer à partir de ce document.
5. **Given** Claude a coché une case pendant son tour, **When** le tour se termine, **Then** la carte se met à jour sans
   action de mentalyas (tâche retirée, jauge avancée, user story repliée si elle est finie).

---

### User Story 3 — Présenter le projet de bout en bout (Priority: P3)

mentalyas présente le projet à quelqu'un : le genesis porte le résumé de la fondation ; la branche « Livrées » dépliée
montre l'historique des specs, chacune avec sa phrase d'intention et ses user stories ; une carte de spec affiche son
objectif, ses décisions clés comptées, ses user stories avec leur priorité et ses documents de brainstorm d'origine.

**Why this priority**: second usage voulu (D1) ; il réutilise les données de l'US1 et ajoute surtout du contenu dans
les cartes.

**Independent Test**: sur un projet de démo, chaque spec livrée a une carte lisible (titre, intention, user stories,
documents d'origine) sans ouvrir aucun fichier.

**Acceptance Scenarios**:

1. **Given** un projet avec `docs/FOUNDATION.md`, **When** mentalyas ouvre la carte du genesis en vue Workflow,
   **Then** elle montre le résumé de la fondation (premier paragraphe), lisible dans le lecteur de la carte (spec 022 D13).
2. **Given** une spec, **When** il ouvre sa carte, **Then** elle montre son titre, son statut et sa jauge, sa date de
   création, le nombre de ses décisions, ses user stories (priorité, titre, livrée ou non) et les documents de
   brainstorm qu'elle cite, ouvrables en lecture dans la carte.
3. **Given** une spec livrée, **When** il déplie « Livrées », **Then** les specs apparaissent dans l'ordre de leur numéro.

---

### User Story 4 — Passer d'une tâche au code concerné (Priority: P4)

Sur la carte d'une tâche, mentalyas voit « Fichiers : `src/renderer/src/canvas/structureGraph.ts` · Carte › Structure » :
le module qui couvre ce fichier s'affiche à côté, sans quitter la vue Workflow (D9 révisé le 2026-10-09 ; avant :
bascule en Progression).

**Why this priority**: utile pour comprendre ce qu'une tâche touche, mais la vue est complète sans ce pont.

**Independent Test**: une tâche citant un fichier couvert par un élément de la carte de structure affiche cet élément
à côté du fichier ; un fichier non couvert est listé seul.

**Acceptance Scenarios**:

1. **Given** une tâche dont la description cite un chemin de fichier du projet, **When** sa carte s'ouvre, **Then** le
   chemin est listé dans « Fichiers » ; un clic l'ouvre dans le lecteur de la carte (lecture seule).
2. **Given** ce fichier est couvert par un élément de la carte de structure, **When** la carte s'ouvre, **Then** le
   titre de l'élément (précédé de son parent) s'affiche à côté du fichier, sans changer de vue (révisé le 2026-10-09).
3. **Given** un chemin cité qui n'existe pas ou sort du dossier du projet, **When** la carte s'ouvre, **Then** il est
   listé grisé, sans lecture ni bouton.

---

### User Story 5 — Comprendre un fichier d'un coup d'œil (Priority: P5)

Depuis la carte d'une tâche, mentalyas ouvre un fichier cité ; au lieu de 400 lignes, il bascule sur « Schéma » : il
voit ce que le fichier utilise, ses blocs reliés par leurs appels, ce qu'il offre, et les deux fonctions que la tâche
nomme brillent. Il lance le parcours de lecture : « Suivant » le mène bloc par bloc, le code défile à côté (D14).

**Why this priority**: c'est le dernier niveau de la descente spec › user story › tâche › fichier ; utile pour agir
et pour apprendre (suivi académique), mais la vue est complète sans lui.

**Independent Test**: sur un fichier TS de quelques fonctions qui s'appellent, le schéma montre les imports, les blocs,
les flèches d'appel et les blocs offerts ; un clic sur un bloc surligne son code ; le parcours suit l'ordre des appels.

**Acceptance Scenarios**:

1. **Given** un fichier de code d'un langage analysé ouvert dans le lecteur, **When** mentalyas choisit « Schéma »,
   **Then** il voit trois colonnes : ce que le fichier utilise, ses blocs reliés par les appels internes, ce qu'il offre.
2. **Given** le schéma affiché, **When** il clique sur un bloc, **Then** le lecteur revient au code, le bloc surligné.
3. **Given** un bloc ni appelé dans le fichier ni offert, **When** le schéma s'affiche, **Then** il est grisé avec la
   mention « peut-être inutilisé ».
4. **Given** le schéma ouvert depuis une tâche qui nomme `decorateTasks`, **When** il s'affiche, **Then** le bloc
   `decorateTasks` brille ; ouvert depuis une carte sans description (spec, genesis), rien ne brille.
5. **Given** le schéma affiché, **When** il lance le parcours, **Then** l'étape ① est un bloc offert, « Suivant » suit
   ses appels puis passe au bloc offert suivant, chaque étape surligne le bloc et place son code ; chaque bloc n'est
   visité qu'une fois.
6. **Given** un fichier d'un langage non analysé, une analyse en panne ou trop longue, **When** il est ouvert,
   **Then** la bascule « Schéma » est absente et le code reste lisible.

---

### Edge Cases

- Gros fichier (plus de 40 blocs) : les méthodes restent repliées dans leur classe, avec leur nombre ; une classe se
  déplie au clic ; le parcours ne visite que les blocs visibles. Plus de 20 sources d'import : les 20 premières, puis
  « + N autres ».
- Appel récursif (un bloc qui s'appelle lui-même) ou appels croisés : la flèche existe, le parcours ne repasse jamais
  par un bloc déjà visité.
- Deux blocs du même nom (méthodes de deux classes) : un appel par le nom relie les deux, le schéma l'indique
  (« appel ambigu »).
- `tasks.md` ou `spec.md` mal formé (titres absents, cases d'un autre format) : la spec reste affichée avec ce qui a
  pu être lu (nom du dossier comme titre) et une mention « lecture partielle » ; jamais d'erreur bloquante.
- Fichier énorme ou hors du dossier (lien symbolique, chemin `..`) : ignoré au-delà d'une taille limite ou s'il sort
  du dossier du projet, avec une mention dans la carte.
- Projet avec des dizaines de specs : « Livrées » reste repliée ; seules les tâches restantes des specs en cours sont
  dépliées par défaut ; l'état de repli choisi par mentalyas est mémorisé.
- Tâches citant une user story absente de `spec.md` (`[US9]`) : elles forment un nœud « US9 » avec le titre « (user
  story non décrite) ».
- Dossier `specs/` qui change pendant que la vue est ouverte (Claude crée une spec) : la relecture suivante (D10)
  l'ajoute en glissant.
- Dossier du projet absent (déplacé, disque débranché) : la vue le dit et propose de relier le dossier, comme les
  autres vues d'un projet repris.
- Le contenu des fichiers peut contenir des instructions ou du HTML : affiché comme texte, jamais suivi ni rendu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (D3) : La bascule d'une carte de projet lié MUST offrir trois positions « Workflow | Progression |
  Architecture » ; Progression et Architecture MUST rester identiques à leur comportement actuel ; la position Workflow
  MUST être disponible même sans carte de structure dessinée.
- **FR-002** (D4) : L'app MUST lire `specs/*/spec.md`, `specs/*/tasks.md`, `docs/brainstorm/*.md` et `docs/FOUNDATION.md`
  du dossier du projet lié, en lecture seule, sans appel à Claude, en refusant tout chemin qui sort de ce dossier et
  tout fichier au-delà d'une taille limite.
- **FR-003** (D4) : Le texte lu MUST être affiché comme du texte (aucun HTML rendu, aucun lien actif vers l'extérieur) et
  MUST être validé à la frontière entre le processus principal et l'interface.
- **FR-004** (D5) : Pour chaque spec, l'app MUST extraire son numéro, son titre, sa ligne de statut, ses user stories
  (numéro, titre, priorité) et, depuis `tasks.md`, chaque tâche (identifiant, case cochée ou non, user story, description).
- **FR-005** (D7) : Le statut d'une spec MUST être calculé ainsi : sans `tasks.md` = spécifiée ; aucune case cochée =
  planifiée ; toutes cochées = livrée ; sinon en cours ; un marqueur « En pause » dans sa ligne de statut MUST la
  classer en pause ; un marqueur « Livrée » ou « Abandonnée » MUST la classer livrée ou abandonnée quel que soit le
  nombre de cases, ses tâches non cochées étant listées comme reliquats dans sa carte (et non comme nœuds).
- **FR-006** (D5) : Une user story MUST être livrée quand toutes ses tâches sont cochées ; elle MUST alors être repliée
  par défaut ; seules les tâches non cochées MUST apparaître comme nœuds, les tâches cochées comme compteur.
- **FR-007** (D5) : Les tâches sans user story MUST être regroupées sous un nœud « Socle » de leur spec.
- **FR-008** (D8) : La vue MUST ranger les specs sous quatre branches du genesis — En cours, À venir (planifiées,
  spécifiées, en pause), Livrées (repliée par défaut, avec leur nombre), À brainstormer — avec la disposition et les
  nœuds de la spec 022 (couleur par branche, taille par niveau, statut en pastille, repli, glissements).
- **FR-009** (D6) : Chaque nœud MUST ouvrir sa carte de détails au clic ; « Discuter » (et le double-clic) MUST ouvrir une
  conversation dans le dossier du projet avec une consigne selon le nœud : implémenter la tâche, mener les tâches
  restantes de la user story, ou brainstormer à partir du document.
- **FR-010** (D6) : L'app MUST NOT écrire dans `spec.md`, `tasks.md` ni aucun fichier lu par la vue.
- **FR-011** (D10) : La vue MUST relire les fichiers à son ouverture, à chaque fin de tour de Claude dans une conversation
  rattachée à ce projet, et sur le bouton « Relire » ; les changements MUST apparaître en glissant.
- **FR-012** (D9) : Les chemins de fichiers cités dans la description d'une tâche MUST être listés dans sa carte (union
  pour une user story et une spec), ouvrables en lecture seule dans le lecteur de la carte s'ils existent dans le dossier
  du projet ; sinon listés grisés.
- **FR-013** (D9, révisé le 2026-10-09) : à côté d'un fichier cité, la carte MUST afficher sur place l'élément de la carte
  de structure qui le couvre (son titre, précédé de celui de son parent s'il en a un), sans changer de vue ; rien
  n'est affiché quand aucun élément ne le couvre.
- **FR-014** (US3) : La carte du genesis en vue Workflow MUST montrer le résumé de `docs/FOUNDATION.md` (premier
  paragraphe) quand le fichier existe ; la carte d'une spec MUST montrer titre, statut, jauge, date de création, nombre de
  décisions, user stories et documents de brainstorm cités.
- **FR-015** (D2) : Un projet sans `specs/` ni `docs/brainstorm/` MUST afficher le genesis seul avec un message qui
  explique comment la vue se remplit ; un fichier mal formé MUST être affiché partiellement avec la mention « lecture
  partielle », sans bloquer la vue.
- **FR-018** (D11) : « À brainstormer » MUST lister les documents `docs/brainstorm/L1*.md` qu'aucune `spec.md` ne cite
  (sauf `L1-fondation.md`) ; les documents L2 à L4 MUST être rattachés comme fichiers à la carte du L1 de leur famille,
  ou à celle du genesis à défaut ; un L1 cité MUST figurer dans la carte de chaque spec qui le cite.
- **FR-016** (D8) : L'état de repli des nœuds de la vue Workflow MUST être mémorisé par projet.
- **FR-017** (accessibilité) : La bascule, les nœuds et les cartes MUST être utilisables au clavier (spec 022) et sans
  violation d'accessibilité détectée.

- *FR-019 à FR-023 : remplacées par FR-025 (D15, 2026-10-09).*
- **FR-019** (D14, précisé le 2026-10-09) : Le lecteur d'un fichier d'un langage analysé MUST offrir « ◈ Schéma du
  fichier », ouvert en grand en arbre de haut en bas, une forme et une couleur par rôle, légende comprise ; le schéma
  MUST montrer, pour chaque bloc, la première phrase du commentaire qui le précède quand il y en a un ; il MUST montrer les imports (regroupés par source), les blocs (classe › méthodes, fonctions) avec leur taille en
  lignes et leur complexité, les appels internes reconnus par le nom, et les blocs offerts (exportés ou publics).
- **FR-020** (D14) : Un bloc ni appelé dans le fichier ni offert MUST être grisé avec la mention « peut-être inutilisé » ;
  le schéma MUST dire que les appels sont reconnus par le nom (approximation).
- **FR-021** (D14, précisé) : Un clic (ou Entrée) sur un bloc MUST le raconter (rôle, phrase, appelants, appelés) avec
  « Voir le code », qui ferme le schéma et revient au code, le bloc surligné ; le survol MUST éteindre les blocs sans
  lien avec lui.
- **FR-022** (D14) : Le parcours de lecture MUST partir des blocs offerts, dans l'ordre du fichier, suivre leurs appels
  en profondeur, ne visiter chaque bloc qu'une fois, et offrir « Précédent / Suivant » au clavier ; chaque étape MUST
  être racontée (carte-récit) et cadrée, les blocs visités cochés, la jauge « N / M explorés » à jour.
- **FR-023** (D14) : Ouvert depuis une tâche ou une user story, le schéma MUST mettre en valeur les blocs dont le nom
  apparaît comme mot entier dans sa description (autrement que par la seule couleur).
- **FR-024** (D14, SC-006) : Les données du schéma MUST venir du processus d'analyse séparé, revalidées à la réception ;
  langage non analysé, erreur ou délai dépassé MUST masquer la bascule sans bloquer la lecture du code.

- **FR-025** (D15) : Le lecteur d'un fichier de code MUST offrir « Expliquer ce fichier », qui ne lance la tâche
  `file_summary` qu'à ce geste ; la réponse MUST être validée par schéma, ses morceaux MUST être des blocs existants du
  fichier (les autres écartés), chaque morceau MUST surligner son code au clic ; un projet « Local uniquement » MUST
  rester sur l'IA locale (sinon un message dit pourquoi) ; une panne MUST laisser le code lisible et offrir
  « Réessayer ». Le petit schéma MUST ne garder que des flèches entre l'entrée, des morceaux gardés et la sortie, être
  dessiné sans interpréter de texte, être décrit en texte pour un lecteur d'écran, et « Copier en Mermaid » MUST
  produire un texte Mermaid dont aucun libellé ne casse la syntaxe.
- **FR-026** (D16) : Chaque user story et chaque socle ayant des tâches faites MUST porter un nœud « ✓ Faites (N) »
  replié d'office ; ses tâches MUST s'ouvrir comme les autres (carte, fichiers, code).

- **FR-027** (D17) : Explication ouverte, le lecteur MUST montrer l'explication et le code côte à côte ; « Agrandir »
  MUST ouvrir le lecteur sur toute la fenêtre (dialogue modal), et Échap MUST le réduire sans fermer la carte ni le
  lecteur ; le focus MUST revenir sur « Agrandir ».

- **FR-028** (D18) : Une explication MUST être enregistrée avec l'empreinte du contenu expliqué, réaffichée sans appel à
  l'IA tant que le contenu est identique, jamais montrée pour un contenu différent ; la relecture MUST la revalider.

### Key Entities

- **Projet (vue Workflow)** : un projet lié, son dossier, sa fondation (résumé), ses specs et ses documents de
  brainstorm, l'état de repli de sa vue.
- **Spec** : numéro, nom de dossier, titre, ligne de statut (marqueur éventuel), statut retenu, reliquats, date de création, nombre de décisions,
  user stories, tâches, documents de brainstorm cités.
- **User story** : numéro, titre, priorité, tâches (restantes et faites), livrée ou non, fichiers (union).
- **Tâche** : identifiant (T0NN), cochée ou non, user story éventuelle, description, fichiers cités.
- **Document de brainstorm** : nom, niveau (L1 à L4), titre, couvert par une spec ou non.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** : En moins de 10 secondes après avoir ouvert la vue, mentalyas sait quelles specs sont en cours et quelle
  est la prochaine tâche à faire, sans ouvrir de fichier.
- **SC-002** : Sur le dépôt du Brainstormer (21 specs, environ 750 tâches), la vue s'affiche en moins de 2 secondes et
  reste fluide (glissements de la spec 022 sans à-coup).
- **SC-003** : Les compteurs et statuts affichés correspondent à 100 % aux cases des fichiers `tasks.md` (vérifiable
  spec par spec).
- **SC-004** : Une case cochée par Claude est reflétée sur la carte au plus tard à la fin de son tour.
- **SC-005** : Aucune fonctionnalité des vues Progression et Architecture n'est perdue (inventaire de la spec 022
  repris et vérifié).
- **SC-006** : Un fichier hostile (HTML, instructions, chemin hors du dossier, taille excessive) ne produit ni rendu
  HTML, ni lecture hors du dossier, ni blocage de la vue.
- **SC-007** (D14) : Sur un fichier de 500 lignes du Brainstormer, le schéma s'affiche en moins de 1 seconde après le
  code, et chaque bloc du fichier y figure (ou dans le nombre d'une classe repliée).

## Assumptions

- Les specs suivent le format Spec Kit du dépôt : titres « User Story N — Titre (Priority: PN) » ou « User Story N -
  Titre (Priority: PN) » / « (PN) », tâches « - [ ] T0NN [P] [USn] description » ; les variantes rencontrées dans le
  dépôt sont tolérées (FR-015).
- La vue réutilise les nœuds, cartes de détails, lecteur, repli et glissements livrés par la spec 022 (US1, US3) et la
  bascule de vues de la spec 017 ; aucune dépendance nouvelle n'est prévue.
- La conversation lancée par « Discuter » est celle de la spec 008 (claude -p dans le dossier du projet lié, réglages
  isolés) ; la forme exacte de la consigne (message envoyé ou pré-rempli) est fixée au plan.
- Hors périmètre : modifier les fichiers depuis la carte (cocher, changer un statut), lier les tâches aux éléments par
  des liens dessinés, lire des plans (`plan.md`) ou recherches (`research.md`) autrement que comme fichiers ouvrables.
