# Feature Specification: Accueil ProjectMaster (spec 024)

**Feature Branch**: `main` · **Created**: 2026-10-09 · **Status**: Draft — à valider par mentalyas
**Input**: « Il nous faut une nouvelle user story qui concerne un menu de chargement de brainstorms déjà exécutés, aussi
une possibilité de sauvegarde de brainstorm sur un certain projet et ainsi retrouver la doc, les schémas, cartographies,
etc. sur base de ce projet. Ensuite ce menu de départ nous demandera si on part sur un nouveau projet ou si on continue
un projet existant et reprend en fait le workflow complet qu'on a configuré dans notre ProjectMaster (`pm.bat`). En
résumé, on doit importer ProjectMaster dans un menu de cette app qui nous permet de créer ou charger un projet. »
— mentalyas. Brainstorm de niveau 1 validé : `docs/brainstorm/L1k-accueil-projectmaster.md` (2026-10-09).
**Glossaire** : *coffre* = le dossier ProjectMaster qui range tous les projets (chez mentalyas : `ProjectsMaster/`) ;
*registre* = la liste des projets du coffre, partagée avec `pm.bat` ; *session* = une période de travail ouverte sur
un projet, fermée par la fin de session ; *canevas* = la carte d'un projet dans l'app ; *workflow ProjectMaster* =
créer (`/hub new`), ouvrir (`/hub work`), brainstormer (`/brainstorm`), fermer (`/hub end`).

## Décisions (2026-10-09, brainstorm L1k validé par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Un projet par canevas | Charger un projet ouvre **sa** carte : son genesis, ses brainstorms, sa doc, ses schémas, sa structure (Progression, Architecture) et sa vue Workflow (spec 023). Plusieurs projets sur une même carte : **reporté**. |
| D2 | Rôle du genesis | Le genesis redevient **le nœud de départ d'une idée** ; c'est le **canevas** qui porte le projet. |
| D3 | Pas de brainstorm hors projet | Brainstormer demande un projet : une idée est travaillée d'office dans un environnement de projet ; plus de genesis « libre » sans dossier. Le choix porte sur le dépôt : **GitHub** ou **local seulement**. |
| D4 | Workflow gardé tel quel | L'app est **l'interface visuelle** du workflow ProjectMaster : elle pilote `/hub new`, `/hub work`, `/hub end` et `/brainstorm` au lieu de les réimplémenter ; les skills restent la source unique ; `pm.bat` et l'app restent d'accord (même registre, mêmes sessions). Les opérations git restent sur un clic de mentalyas (constitution II, « Dépôt »). |
| D5 | Nouveau projet | Formulaire comme `pm.bat` : **nom**, **description**, **type**, **GitHub oui / non** et, si oui, **visibilité** (public / privé). Claude part du nom et de la description pour cibler les questions du brainstorm qui suit. Un projet peut rester **local** (aucun dépôt distant créé). |
| D6 | Continuer un projet | L'accueil liste les projets comme `pm.bat` : pastille d'état, nom, description, branche, dernière session. Une session restée ouverte est signalée et l'accueil propose de la reprendre. Ouvrir un projet charge son canevas et suit `/hub work` (synchronisation git, résumé, prochaine tâche). |
| D7 | Fin de session éclatée | Les étapes de la fin de session deviennent des **actions séparées** : avant d'exécuter, des **cases à cocher** choisissent commit, push, journal du projet, journal global, graphe (graphify), cours académique, fermeture de la session. L'app **garde en mémoire** l'état de la session, son historique et ce qui a changé, au lieu de tout redemander. |
| D8 | Le coffre | Le dossier ProjectMaster devient le **coffre** du Brainstormer : tous les projets, brainstorms et docs y sont rangés. Chez mentalyas, c'est le dossier actuel ; `projects/gestionnaire-idees` sert de **projet de test**. Un utilisateur qui part de zéro **définit ou crée son coffre** au premier lancement. |

## Clarifications

### Session 2026-10-09

- Q : Comment l'app pilote-t-elle `/hub` et `/brainstorm`, qui demandent git, `gh`, Python et les skills de
  mentalyas ? → R : **l'app fait elle-même les étapes de `/hub`** (lecture et écriture de `.hub/`, git et `gh` sur
  clic, graphe), en suivant le protocole du skill étape par étape ; **Claude ne sert qu'au `/brainstorm`**, dans la
  conversation existante (spec 008, mode de permission de la spec 014). Pas de nouveau mode de conversation ; chaque
  étape est une action de l'app, ce qui rejoint la fin de session éclatée (D7).
- Q : Que devient le contenu actuel de la carte unique ? → R : le genesis rattaché au dossier du Brainstormer va dans
  le canevas de `gestionnaire-idees` ; **tout le reste** (genesis sans dossier, fiches, liens libres, widgets) va dans
  un projet **local « Idées en vrac »** créé pour l'occasion ; mentalyas déplace ensuite ce qu'il veut vers un vrai
  projet. Rien n'est perdu, et « pas de genesis sans projet » (D3) reste vrai.
- Q : `/hub new` crée toujours le dépôt GitHub ; comment créer un projet local ? → R : **ajouter au skill `/hub` une
  option GitHub oui / non** (dans la configuration de mentalyas, hors de ce dépôt) : `pm.bat` en profite aussi, et le
  skill reste la référence que l'app suit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Retrouver mes projets dans l'app (Priority: P1) 🎯 MVP

Au lancement, mentalyas voit l'accueil : la liste de ses projets ProjectMaster (pastille actif / inactif, nom,
description, branche, dernière session), comme dans `pm.bat`. Il en choisit un : l'app ouvre **le canevas de ce
projet**, avec ses brainstorms, sa doc, ses schémas, sa structure et sa vue Workflow.

**Why this priority**: c'est le cœur de la demande (« charger un projet ») et la condition des autres histoires ; sans
canevas par projet, rien ne se range « sur base de ce projet ».

**Independent Test**: avec le coffre de mentalyas, l'accueil liste les projets du registre ; ouvrir
`gestionnaire-idees` affiche son canevas (genesis, documents, vue Workflow) et rien d'un autre projet.

**Acceptance Scenarios**:

1. **Given** un coffre défini, **When** l'app démarre, **Then** l'accueil liste chaque projet du registre avec sa
   pastille, son nom, sa description, sa branche et sa dernière session, dans l'ordre de la dernière session.
2. **Given** l'accueil, **When** mentalyas ouvre un projet, **Then** son canevas s'affiche avec ce qui lui appartient
   (genesis, brainstorms, documents, schémas, structure, vue Workflow) et seulement cela.
3. **Given** un canevas ouvert, **When** mentalyas revient à l'accueil puis ouvre un autre projet, **Then** chaque
   canevas retrouve son état (nœuds, positions, replis) tel qu'il l'avait laissé.
4. **Given** un projet du registre dont le dossier est introuvable, **When** l'accueil s'affiche, **Then** il est listé
   grisé avec la mention « dossier introuvable », sans bloquer les autres.

---

### User Story 2 — Continuer un projet comme `/hub work` (Priority: P1)

Mentalyas ouvre un projet ; l'app suit `/hub work` : elle signale une session restée ouverte (reprendre, fermer
d'abord, ignorer), des fichiers non commités, des commits non poussés, un dépôt distant en avance ; puis elle montre le
résumé actionnable (dernières entrées du journal, issues ouvertes, prochaine tâche suggérée) et ouvre la session.

**Why this priority**: c'est le geste quotidien ; il fait de l'app l'interface du workflow existant (D4, D6).

**Independent Test**: sur un projet avec une session ouverte et un fichier modifié, l'ouverture affiche les deux
anomalies et les choix ; « Reprendre » ouvre le canevas et la session reste celle de `.hub` (visible aussi par
`pm.bat`).

**Acceptance Scenarios**:

1. **Given** une session restée ouverte sur un projet, **When** l'accueil s'affiche, **Then** ce projet porte la mention
   « session ouverte depuis … » et l'ouvrir propose : reprendre, fermer d'abord, ignorer.
2. **Given** un projet ouvert, **When** son dépôt a des fichiers non commités, des commits non poussés ou un distant en
   avance, **Then** chaque anomalie est listée avec son action proposée, qui ne s'exécute que sur un clic.
3. **Given** l'ouverture terminée, **When** le résumé s'affiche, **Then** il montre les dernières entrées du journal du
   projet, ses issues ouvertes (si GitHub) et une prochaine tâche suggérée ; la session est enregistrée comme ouverte
   pour l'app **et** pour `pm.bat`.

---

### User Story 3 — Créer un nouveau projet et le brainstormer (Priority: P2)

Depuis l'accueil, « Nouveau projet » ouvre un formulaire : nom, description, type, GitHub oui / non (et visibilité).
L'app crée le projet comme `/hub new` (structure, journal, git, registre, graphe), crée le dépôt GitHub seulement si
demandé et confirmé, puis ouvre le canevas du projet avec son genesis et lance le brainstorm, ciblé par le nom et la
description.

**Why this priority**: ferme la boucle « créer » ; sans elle, l'app n'ouvre que des projets créés par `pm.bat`.

**Independent Test**: créer « essai-local » en local seulement : le dossier, le journal et l'entrée du registre
existent, aucun dépôt distant n'est créé, le canevas s'ouvre et le brainstorm démarre avec une première question liée à
la description.

**Acceptance Scenarios**:

1. **Given** le formulaire, **When** le nom n'est pas un identifiant valide (règles de `/hub new`) ou existe déjà,
   **Then** la création est refusée avec la raison, avant toute écriture.
2. **Given** « GitHub : non », **When** mentalyas crée le projet, **Then** aucun dépôt distant n'est créé et le
   registre le note comme local.
3. **Given** « GitHub : oui », **When** l'étape de création du dépôt arrive, **Then** l'app montre le nom, la visibilité
   et la description du dépôt et attend la confirmation de mentalyas.
4. **Given** le projet créé, **When** son canevas s'ouvre, **Then** son genesis porte le nom du projet et le brainstorm
   démarre en tenant compte du nom et de la description.

---

### User Story 4 — Fermer une session étape par étape (Priority: P3)

Sur un projet ouvert, « Fin de session » liste les étapes avec des cases à cocher (commit, push, journal du projet,
journal global, graphe, cours académique, fermeture de la session), cochées par défaut selon ce que la session a
changé. Mentalyas décoche ce qu'il ne veut pas (par exemple le graphe) ; chaque étape s'exécute séparément, avec son
résultat (réussie, échouée, sautée).

**Why this priority**: utile tous les jours, mais `/hub end` dans un terminal reste possible en attendant.

**Independent Test**: sur une session avec un fichier modifié, décocher « graphe » et « cours » : le commit montre son
diff et attend le clic, le push suit sur clic, les journaux reçoivent leur entrée, la session est fermée dans `.hub` ;
le graphe et le cours sont marqués « sautés ».

**Acceptance Scenarios**:

1. **Given** une session ouverte, **When** mentalyas ouvre « Fin de session », **Then** chaque étape est listée avec une
   case et un état ; les étapes sans objet (rien à commiter, suivi académique désactivé) sont décochées avec la raison.
2. **Given** des étapes cochées, **When** il lance la fin de session, **Then** elles s'exécutent dans l'ordre de
   `/hub end`, chacune séparément ; un échec arrête les étapes qui en dépendent (pas de push sans commit réussi) et
   laisse les autres choisir.
3. **Given** le commit ou le push, **When** leur étape arrive, **Then** l'app montre les fichiers et le diff (commit)
   ou la destination, la branche et les commits (push), et n'agit que sur un clic (constitution II).
4. **Given** la fermeture de session cochée et réussie, **When** `pm.bat` est lancé ensuite, **Then** il ne voit plus de
   session ouverte.

---

### User Story 5 — Définir mon coffre au premier lancement (Priority: P3)

Au premier lancement (ou si le coffre a disparu), l'app demande où est le coffre ProjectMaster : choisir un dossier
existant, ou en créer un nouveau, vide et prêt (registre, sessions, dossier des projets, journal global).

**Why this priority**: indispensable pour un autre utilisateur ; chez mentalyas, le coffre existe déjà.

**Independent Test**: profil neuf → l'app demande le coffre ; « Créer » dans un dossier vide produit un coffre que
`pm.bat` sait lire ; « Choisir » le coffre de mentalyas liste ses projets.

**Acceptance Scenarios**:

1. **Given** aucun coffre défini, **When** l'app démarre, **Then** elle propose de choisir un coffre existant ou d'en
   créer un, et n'affiche l'accueil qu'ensuite.
2. **Given** un dossier choisi qui n'est pas un coffre (pas de registre), **When** mentalyas le valide, **Then** l'app
   propose d'y créer un coffre plutôt que d'échouer.
3. **Given** un dossier interdit (dossier de données de l'app, racine d'un disque, dossier système), **When** il est
   choisi, **Then** il est refusé avec la raison.

---

### Edge Cases

- `pm.bat` et l'app ouverts en même temps : une écriture du registre ou des sessions par l'un est vue par l'autre ;
  aucune écriture n'écrase un changement plus récent (écriture atomique, relecture avant écriture).
- Session ouverte par `pm.bat` sur un autre projet que celui que mentalyas ouvre dans l'app : l'app le signale
  (« un seul projet actif à la fois », règle du workspace) et propose de fermer l'autre d'abord.
- Projet du registre sans dossier, registre illisible, ou fichier de sessions abîmé : message clair, rien n'est réécrit
  sans accord.
- Nom de projet qui ressemble à une commande ou contient des caractères spéciaux : refusé par les règles de nom avant
  toute exécution.
- `gh` absent ou non connecté et « GitHub : oui » : l'étape du dépôt échoue avec la raison, le projet reste créé en
  local et peut être publié plus tard (spec 021).
- Étape de fin de session longue (graphe d'un gros projet) : elle montre qu'elle travaille, peut être annulée, et ne
  bloque pas les étapes déjà faites.
- Contenu actuel de la carte unique (genesis sans dossier, fiches, liens libres, widgets) au passage à un canevas par
  projet : voir FR-016.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (D8) : L'app MUST connaître un coffre ProjectMaster ; sans coffre défini, elle MUST proposer d'en choisir
  un ou d'en créer un avant l'accueil ; un dossier sensible (données de l'app, racine de disque, dossier système) MUST
  être refusé.
- **FR-002** (D8) : Créer un coffre MUST produire une structure que `pm.bat` sait lire : registre et sessions vides,
  dossier des projets, journal global.
- **FR-003** (D6) : L'accueil MUST lister les projets du registre (pastille, nom, description, branche, dernière
  session), signaler une session ouverte et un dossier introuvable.
- **FR-004** (D1) : Ouvrir un projet MUST afficher son seul canevas ; chaque canevas MUST garder son propre état
  (nœuds, positions, replis, vues) d'une ouverture à l'autre.
- **FR-005** (D4, D6) : Ouvrir un projet MUST suivre le protocole `/hub work` : détection des anomalies (session mal
  fermée, fichiers non commités, commits non poussés, distant en avance), résumé actionnable, ouverture de la session
  dans les fichiers de session partagés avec `pm.bat`.
- **FR-006** (D4) : Toute action git proposée par l'ouverture ou la fin de session MUST attendre un clic de mentalyas
  après affichage de ce qu'elle fera (constitution II, « Dépôt »).
- **FR-007** (D5) : « Nouveau projet » MUST demander nom, description, type, GitHub oui / non et, si oui, visibilité ;
  le nom MUST respecter les règles de `/hub new` (format, longueur, mots réservés, unicité) avant toute écriture.
- **FR-008** (D5) : Créer un projet MUST produire le même résultat que `/hub new` (structure, journal, dépôt git local,
  premier commit, graphe initial, registre, journal global) ; le dépôt GitHub MUST n'être créé que si demandé, après
  confirmation ; un projet local MUST être noté comme tel dans le registre.
- **FR-009** (D3, D5) : Après la création, le canevas du projet MUST s'ouvrir avec un genesis au nom du projet et le
  brainstorm MUST démarrer en recevant le nom et la description du projet.
- **FR-010** (D3) : Brainstormer une nouvelle idée MUST se faire dans un projet ; l'app MUST NOT créer de genesis sans
  projet.
- **FR-011** (D7) : « Fin de session » MUST lister les étapes de `/hub end` avec une case chacune, cochées selon ce que
  la session a changé ; les étapes cochées MUST s'exécuter séparément, dans l'ordre de `/hub end`, chacune avec son
  résultat ; un échec MUST arrêter les étapes qui en dépendent.
- **FR-012** (D7) : La fermeture de session MUST mettre à jour les fichiers de session partagés et la dernière session
  du registre, de sorte que `pm.bat` voie le même état.
- **FR-013** (D7) : L'app MUST garder, par projet, l'historique de ses sessions (ouverture, fermeture, étapes faites,
  fichiers changés) et s'en servir pour pré-cocher la fin de session et résumer la prochaine ouverture.
- **FR-014** (D4, Q1) : Les étapes de `/hub` (new, work, end) MUST être faites par l'app en suivant le protocole du
  skill `/hub` étape par étape, avec un résultat identique dans le coffre ; l'app MUST NOT diverger de ce que `pm.bat`
  et le skill attendent (même registre, mêmes sessions, mêmes journaux, mêmes exclusions du graphe).
- **FR-015** (Q1) : Le brainstorm MUST se faire dans la conversation existante du genesis du projet (spec 008), avec
  son mode de permission (spec 014) ; l'app MUST NOT ouvrir de mode de conversation nouveau pour `/hub` : ses étapes
  sont des actions de l'app (git et `gh` sur clic, constitution II).
- **FR-016** (Q2) : Au passage à un canevas par projet, le genesis rattaché au dossier du Brainstormer MUST aller dans
  le canevas de `gestionnaire-idees`, et tout autre contenu de la carte unique (genesis sans dossier, fiches, liens
  libres, widgets) MUST aller dans un projet local « Idées en vrac » créé pour l'occasion, sans perte ; mentalyas MUST
  pouvoir déplacer ensuite un genesis et sa descendance vers un autre projet.
- **FR-017** (D5, Q3) : Le skill `/hub` MUST accepter le choix GitHub oui / non à la création (modification de la
  configuration de mentalyas, hors de ce dépôt, proposée et appliquée avec son accord) ; l'app MUST suivre ce même
  protocole pour un projet local (aucun dépôt distant, registre noté « local »).
- **FR-018** (accessibilité) : L'accueil, les formulaires et la fin de session MUST être utilisables au clavier et
  passer la vérification d'accessibilité ; chaque étape longue MUST montrer qu'elle travaille et pouvoir être annulée.

### Key Entities

- **Idées en vrac** : projet local créé au passage à un canevas par projet (FR-016), qui reçoit le contenu sans projet.
- **Coffre** : dossier ProjectMaster ; registre des projets, fichiers de session, dossier des projets, journal global.
- **Projet** : entrée du registre (identifiant, nom, description, type, visibilité, local ou GitHub, statut, dernière
  session, branche, adresse du dépôt) et son dossier.
- **Canevas** : la carte d'un projet (son genesis, ses nœuds, ses documents, ses vues et leur état).
- **Session** : ouverture et fermeture sur un projet, branche ; dans l'app, en plus : étapes de fin faites ou sautées,
  fichiers changés.
- **Étape de fin de session** : commit, push, journal du projet, journal global, graphe, cours académique, fermeture ;
  état (à faire, faite, échouée, sautée) et raison.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** : Depuis le lancement de l'app, mentalyas ouvre le canevas d'un projet existant en 2 gestes au plus
  (choisir le projet, confirmer s'il y a une anomalie).
- **SC-002** : Après une ouverture ou une fin de session dans l'app, `pm.bat` affiche le même état (session ouverte ou
  non, dernière session) dans 100 % des cas testés ; et inversement.
- **SC-003** : Créer un projet local depuis l'accueil, jusqu'à la première question du brainstorm, prend moins de
  2 minutes hors temps de réponse de Claude.
- **SC-004** : Aucune action git (commit, push, création de dépôt) ne s'exécute sans un clic de mentalyas après
  affichage de son contenu (vérifiable par test).
- **SC-005** : Le passage à un canevas par projet ne perd aucun nœud, document, lien ni widget existant (inventaire
  avant / après identique).
- **SC-006** : L'accueil s'affiche en moins de 2 secondes avec 30 projets dans le registre.

## Assumptions

- Le coffre de mentalyas est `ProjectsMaster/` et ses fichiers `.hub/registry.json` et `.hub/sessions.json` gardent le
  format actuel (lu par `pm.bat` et par `HubRegistry`, spec 016) ; l'app y écrit de façon atomique.
- Les étapes de `/hub` restent celles du skill actuel ; si le skill évolue, l'app suit le skill (D4).
- « Un seul projet actif à la fois » (règle du workspace) reste vrai : l'app n'ouvre qu'une session à la fois.
- Git et GitHub dans l'app (spec 021) fournissent le commit, le push et la création de dépôt sur clic ; la 024 s'appuie
  dessus plutôt que de les refaire.
- Le clone d'un projet (spec 017 US5, spec 021 US3) devient un troisième chemin de l'accueil (« Cloner un projet »)
  ; il est réconcilié dans le plan, pas redéfini ici.
- Plusieurs projets sur une même carte : hors périmètre (D1, reporté).
- Ordre de travail (L1k, « Suite ») : cette spec est écrite maintenant, codée **après** la fermeture d'une partie des
  chantiers ouverts (019, 022, 023, 017, 013), car elle touche au cœur de l'app.
