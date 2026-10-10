# Feature Specification: Accueil ProjectMaster (spec 024)

**Feature Branch**: `main` · **Created**: 2026-10-09 · **Status**: Draft — réécrite le 2026-10-09 après la correction de mentalyas
**Input**: « Il nous faut une nouvelle user story qui concerne un menu de chargement de brainstorms déjà exécutés, aussi
une possibilité de sauvegarde de brainstorm sur un certain projet et ainsi retrouver la doc, les schémas, cartographies,
etc. sur base de ce projet. […] On doit importer ProjectMaster dans un menu de cette app qui nous permet de créer ou
charger un projet. » — mentalyas. Brainstorm L1 validé : `docs/brainstorm/L1k-accueil-projectmaster.md`.
**Correction de mentalyas (2026-10-09), qui fixe le parcours** : « En ouvrant l'app Brainstormer, la première chose à
laquelle on est confronté, c'est le Project Manager et son interface, qui nous propose de **charger un brainstorm
existant** ou d'en **commencer un nouveau**. Le brainstorm existant est une reprise d'un brainstorm déjà travaillé avec
l'app : on reprend la cartographie etc. là où on s'était arrêtés (penser à une sauvegarde). Dans un nouveau brainstorm,
soit on part de zéro complet pour créer un nouveau projet — le dossier se crée d'office dans le dossier du ProjectMaster,
bien structuré —, OU on reprend un projet en chantier dans lequel on veut brainstormer (exemple : projets de groupe) et
là je me place dans le dossier du projet en question pour y placer ma seed brainstorm config, le git, et continuer à
bosser dedans, OU récupérer un projet Git depuis un lien, faire un clone dans mon dossier ProjectMaster et continuer à
bosser le projet ou le scrap. »
**Glossaire** : *Project Manager* = l'écran d'accueil de l'app ; *coffre* = le dossier ProjectMaster qui range les
projets (chez mentalyas : `ProjectsMaster/`) ; *registre* = la liste des projets du coffre, partagée avec `pm.bat` ;
*brainstorm* = un projet travaillé dans l'app, avec son canevas ; *canevas* = la carte d'un projet ; *vault* = le
dossier `.brainstormer/` posé dans un projet hors du coffre ; *point de sauvegarde* = un état nommé du canevas, auquel
on peut revenir ; *session* = une période de travail ouverte sur un projet.

## Parcours (correction du 2026-10-09)

```
Ouverture de l'app → Project Manager
├── A. Charger un brainstorm existant   → reprendre la cartographie là où on s'était arrêté (sauvegarde)
└── B. Nouveau brainstorm
       ├── B1. De zéro           → nouveau projet, dossier créé d'office dans le coffre, bien structuré
       ├── B2. Projet en chantier → dossier choisi tel quel, vault .brainstormer posé dedans, git selon mon rôle
       └── B3. Depuis un lien Git → clone dans le coffre, puis continuer le projet ou en extraire des morceaux
```

## Décisions (2026-10-09, brainstorm L1k et correction de mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Un projet par canevas | Ouvrir un brainstorm ouvre **sa** carte : son genesis, ses brainstorms, sa doc, ses schémas, sa structure (Progression, Architecture) et sa vue Workflow (spec 023). Plusieurs projets sur une même carte : **reporté**. |
| D2 | Rôle du genesis | Le genesis redevient **le nœud de départ d'une idée** ; c'est le **canevas** qui porte le projet. |
| D3 | Pas de brainstorm hors projet | Toute idée est travaillée dans un projet ; plus de genesis « libre » sans dossier. |
| D4 | Workflow ProjectMaster gardé | L'app est **l'interface visuelle** du workflow ProjectMaster (`/hub new`, `/hub work`, `/hub end`, `/brainstorm`) : elle en suit le protocole ; `pm.bat` et l'app restent d'accord (même registre, mêmes sessions). Les opérations git restent sur un clic de mentalyas (constitution II, « Dépôt »). |
| D5 | Project Manager d'abord | À l'ouverture de l'app, **le premier écran est le Project Manager** : « **Charger un brainstorm existant** » ou « **Nouveau brainstorm** ». Aucun canevas ne s'ouvre avant ce choix. |
| D6 | Charger un brainstorm existant | La liste des brainstorms déjà travaillés dans l'app (nom, description, emplacement — coffre ou externe —, branche, dernière session, session restée ouverte). En ouvrir un **reprend la cartographie exactement là où on s'était arrêté** (nœuds, positions, replis, vue, cartes ouvertes, conversations) et suit `/hub work` (anomalies git, résumé, prochaine tâche). |
| D7 | Sauvegarde | **Automatique et continue** : rien à faire pour retrouver son travail ; **plus des points de sauvegarde nommés** (« avant refonte ») posés par mentalyas, pour revenir à un état antérieur du canevas ; revenir à un point est lui-même annulable. |
| D8 | B1 — De zéro | Formulaire comme `pm.bat` : **nom**, **description**, **type**, **GitHub oui / non** et, si oui, **visibilité**. Le dossier est créé **d'office dans le coffre**, avec la structure ProjectMaster (`CLAUDE.md`, `docs/JOURNAL.md`, `src/`, `tests/`, git, registre, graphe). Claude part du nom et de la description pour cibler le brainstorm qui suit. |
| D9 | B2 — Projet en chantier | Mentalyas choisit le dossier d'un projet existant (ex. projet de groupe) ; **il n'est pas déplacé**. L'app y pose son **vault `.brainstormer/`** (identité, sessions, réglages du canevas, points de sauvegarde), ignoré par git par défaut ; brainstorms et doc s'écrivent en Markdown dans le projet ; le contenu de la carte reste dans la base chiffrée de l'app (constitution IV). Le registre du coffre le garde comme **référence externe**. |
| D10 | B2 — Git selon le rôle | À l'ouverture, mentalyas dit comment il travaille : **en collaborateur** (dépôt partagé) → l'app travaille sur **sa branche** (créée ou reprise), ne pousse jamais vers la branche par défaut et propose une PR (spec 021) ; **sur son propre dépôt** → travail direct dans le dépôt ; **pas de dépôt** → l'app propose `git init` (et GitHub en option). Le rôle est mémorisé dans le vault et modifiable. |
| D11 | B3 — Depuis un lien Git | Mentalyas colle un lien ; l'app **clone dans le coffre** (clone partiel, spec 021 GH-C, après confirmation), crée le brainstorm du projet et ouvre son canevas. Ensuite : **continuer le projet** (rôle D10 : collaborateur ou fork) ou **en extraire des morceaux** pour un autre projet, avec sa licence et l'attribution (spec 021 GH-G). |
| D12 | Fin de session éclatée | Les étapes de `/hub end` deviennent des **actions séparées** à cocher : commit, push, journal du projet, journal global, graphe, cours académique, fermeture de la session ; l'app garde en mémoire l'état de la session et ce qui a changé. |
| D13 | Le coffre | Le dossier ProjectMaster est le **coffre** du Brainstormer (chez mentalyas : le dossier actuel ; `projects/gestionnaire-idees` sert de **projet de test**). Un utilisateur qui part de zéro **définit ou crée son coffre** au premier lancement. |
| D14 | « Idées en vrac » sans dossier (2026-10-10, implémentation US1) | Le brainstorm « Idées en vrac » (R10, capture sans brainstorm actif) est **local, sans dossier** : il n'est pas créé comme projet dans le coffre (`pm.bat` ne le verrait que comme un projet vide). Il n'apparaît dans le Project Manager que s'il contient quelque chose. |
| D15 | Sessions `/hub` en lecture d'abord (2026-10-10, US1) | À l'ouverture, l'app **lit** `.hub/sessions.json` (session ouverte ici ou sur un autre projet, signalée) mais **n'y écrit pas encore** : l'ouverture et la fermeture de session s'écriront ensemble avec la fin de session (US6), pour ne jamais laisser une session ouverte que rien ne ferme. |
| D16 | Projets du registre jamais ouverts (2026-10-10, US1) | « Charger un brainstorm existant » liste aussi les projets du registre du coffre jamais ouverts dans l'app ; à la première ouverture, leur brainstorm naît (genesis au nom du projet, lié à son dossier). |
| D17 | Projet en chantier sans dépôt (2026-10-10, US4) | Le rôle « pas de dépôt » ne lance **pas** `git init` : sur un dossier existant, le premier commit ajouterait tous ses fichiers (secrets compris). La création du dépôt d'un projet existant passera par la spec 021 (fichiers choisis, vérification des fichiers sensibles). Le dossier est choisi au sélecteur natif du main ; l'interface ne reçoit qu'un jeton de choix, valable 10 minutes. |
| D18 | Rôle d'un projet cloné (2026-10-10, US5) | Un projet cloné depuis un lien prend le rôle **« collaborateur »** par défaut : on ne pousse jamais vers un dépôt qui n'est pas à soi. Le choix « continuer en collaborateur ou en fork » et l'extraction de morceaux viendront avec la spec 021. Le lien n'est gardé que sans identifiant (« Cloné depuis … »). |
| D19 | Contexte du projet pour tous les genesis (2026-10-10, correction de mentalyas) | Complète D3 : **chaque genesis d'un canevas a accès au dossier du projet du canevas**, sans rien lier (le dossier est lu sur le canevas, jamais recopié sur chaque genesis : la règle « un dossier, un seul neurone » de la spec 017 reste vraie, et un projet déplacé est suivi). Un genesis **sans dossier** travaille dans le projet du canevas ; un genesis **lié à un autre dossier** (combiner des idées, reprendre du code) travaille dans le projet du canevas **et** dans son dossier, ouvert en plus avec les mêmes droits (`--add-dir`, même mode de permission). Ses étapes et ses éléments travaillent dans son dossier, le projet du canevas ouvert en plus (leurs livrables et leurs chemins y sont rangés). Git, lancement et vue Workflow restent sur le dossier lié au genesis. |

## Clarifications

### Session 2026-10-09

- Q : Comment l'app pilote-t-elle `/hub` et `/brainstorm` ? → R : **l'app fait elle-même les étapes de `/hub`** en
  suivant le protocole du skill étape par étape (git et `gh` sur clic) ; **Claude ne sert qu'au `/brainstorm`**, dans la
  conversation existante (spec 008, mode de permission de la spec 014) ; pas de nouveau mode de conversation.
- Q : Que devient le contenu actuel de la carte unique ? → R : le genesis rattaché au dossier du Brainstormer va dans
  le brainstorm `gestionnaire-idees` ; tout le reste va dans un brainstorm local **« Idées en vrac »** créé pour
  l'occasion ; rien n'est perdu.
- Q : `/hub new` crée toujours le dépôt GitHub ; comment créer un projet local ? → R : **option GitHub oui / non
  ajoutée au skill `/hub`** (configuration de mentalyas, hors de ce dépôt, avec son accord) : `pm.bat` en profite aussi.
- Q : Que contient le vault d'un projet hors du coffre ? → R : des **métadonnées** dans `.brainstormer/` ; les
  documents en Markdown dans le projet ; le contenu de la carte dans la base chiffrée.
- Q : Le vault est-il versionné ? → R : **ignoré par défaut** (`.gitignore` du projet).
- Q : Un projet externe apparaît-il dans la liste et le registre ? → R : **oui, comme référence externe**.
- Q : Comment se comporte la sauvegarde ? → R : **automatique et continue, plus des points de sauvegarde nommés** (D7).
- Q : B3, « continuer ou le scrap » ? → R : « scrap » = **en extraire des morceaux** (licence et attribution, spec 021
  GH-G), pas le jeter.
- Q : B2, que fait l'app côté git ? → R : **selon le rôle** : collaborateur sur sa branche, ou sur son propre dépôt
  (D10) ; sans dépôt, elle propose d'en créer un.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reprendre un brainstorm là où je m'étais arrêté (Priority: P1) 🎯 MVP

Mentalyas ouvre l'app : le Project Manager s'affiche. Il choisit « Charger un brainstorm existant », puis un brainstorm
de la liste : son canevas s'ouvre exactement comme il l'avait laissé (nœuds, positions, replis, vue, cartes ouvertes),
et l'app suit `/hub work` (session, anomalies git, résumé, prochaine tâche).

**Why this priority**: c'est le geste de tous les jours ; sans reprise fidèle, le reste n'a pas de sens.

**Independent Test**: travailler sur le brainstorm `gestionnaire-idees` (déplacer des nœuds, plier une branche, passer
en Workflow), fermer l'app, la rouvrir, recharger ce brainstorm : tout est à l'identique.

**Acceptance Scenarios**:

1. **Given** l'app qui démarre, **When** le coffre est défini, **Then** le premier écran est le Project Manager, avec
   « Charger un brainstorm existant » et « Nouveau brainstorm » ; aucun canevas n'est ouvert.
2. **Given** « Charger un brainstorm existant », **When** la liste s'affiche, **Then** chaque brainstorm montre son nom,
   sa description, son emplacement (coffre ou externe), sa branche, sa dernière session et une session restée ouverte ;
   un dossier introuvable est grisé avec la mention « dossier introuvable ».
3. **Given** un brainstorm choisi, **When** son canevas s'ouvre, **Then** il retrouve ses nœuds, positions, replis, vue
   et cartes ouvertes de la dernière fois, et rien d'un autre projet.
4. **Given** l'ouverture, **When** le dépôt a des fichiers non commités, des commits non poussés ou un distant en avance,
   ou qu'une session est restée ouverte, **Then** chaque cas est signalé avec son action proposée, exécutée seulement
   sur un clic.

---

### User Story 2 — Poser et retrouver des points de sauvegarde (Priority: P2)

Avant de réorganiser sa carte, mentalyas pose un point de sauvegarde « avant refonte ». Plus tard, il ouvre la liste de
ses points, voit leur date, revient à « avant refonte » ; s'il change d'avis, il annule ce retour.

**Why this priority**: la sauvegarde continue protège déjà le travail ; les points permettent d'essayer sans crainte.

**Independent Test**: poser un point, supprimer trois nœuds, revenir au point : les nœuds sont là ; annuler le retour :
ils ont de nouveau disparu.

**Acceptance Scenarios**:

1. **Given** un canevas ouvert, **When** mentalyas pose un point de sauvegarde nommé, **Then** il apparaît dans la liste
   du brainstorm avec son nom et sa date.
2. **Given** un point de sauvegarde, **When** mentalyas y revient, **Then** le canevas reprend cet état (nœuds, liens,
   positions, replis) après confirmation, et ce retour est annulable.
3. **Given** un point, **When** mentalyas le renomme ou le supprime, **Then** la liste suit ; supprimer demande
   confirmation.

---

### User Story 3 — Nouveau brainstorm de zéro (Priority: P2)

« Nouveau brainstorm » › « De zéro » : nom, description, type, GitHub oui / non (et visibilité). Le projet est créé
d'office dans le coffre avec la structure ProjectMaster ; le dépôt GitHub n'est créé que s'il est demandé et confirmé ;
le canevas s'ouvre avec son genesis et le brainstorm démarre, ciblé par le nom et la description.

**Why this priority**: ferme la boucle « créer » depuis l'app.

**Independent Test**: créer « essai-local » sans GitHub : le dossier existe dans le coffre avec sa structure, le
registre le liste, aucun dépôt distant n'existe, le canevas s'ouvre et la première question du brainstorm cite la
description.

**Acceptance Scenarios**:

1. **Given** le formulaire, **When** le nom est invalide (règles de `/hub new`) ou existe déjà, **Then** la création est
   refusée avec la raison, avant toute écriture.
2. **Given** « GitHub : non », **When** le projet est créé, **Then** aucun dépôt distant n'est créé et le registre le note
   local.
3. **Given** « GitHub : oui », **When** l'étape du dépôt arrive, **Then** l'app montre nom, visibilité et description et
   attend la confirmation.
4. **Given** le projet créé, **When** son canevas s'ouvre, **Then** son genesis porte le nom du projet et le brainstorm
   démarre avec le nom et la description.

---

### User Story 4 — Nouveau brainstorm sur un projet en chantier (Priority: P2)

« Nouveau brainstorm » › « Projet en chantier » : mentalyas choisit le dossier d'un projet existant, par exemple un
projet de groupe. L'app ne le déplace pas : elle montre ce qu'elle va y écrire (`.brainstormer/`, une ligne du
`.gitignore`, la référence au registre) puis demande comment il travaille — en collaborateur (sa branche) ou sur son
propre dépôt —, et ouvre le canevas du projet.

**Why this priority**: c'est la porte d'entrée des projets nés ailleurs, dont les projets de groupe.

**Independent Test**: choisir un dépôt partagé en « collaborateur » : `.brainstormer/` est créé et ignoré par git, une
branche personnelle est créée ou reprise, la liste montre le projet comme externe ; aucun push vers la branche par
défaut n'est possible.

**Acceptance Scenarios**:

1. **Given** un dossier hors du coffre, **When** mentalyas le choisit, **Then** l'app montre ce qu'elle va écrire et
   n'écrit qu'après confirmation ; un dossier qui a déjà un `.brainstormer/` est repris, pas dupliqué.
2. **Given** le rôle « collaborateur », **When** le projet s'ouvre, **Then** l'app travaille sur la branche de mentalyas
   (créée ou reprise, nom proposé et modifiable) et ses pushs vont vers cette branche, jamais vers la branche par
   défaut ; une PR est proposée quand il le demande.
3. **Given** le rôle « mon propre dépôt », **When** le projet s'ouvre, **Then** l'app travaille dans le dépôt tel quel
   (commit et push sur clic).
4. **Given** un dossier sans dépôt git, **When** il est choisi, **Then** l'app propose `git init` (et GitHub en option)
   et n'en fait rien sans accord.
5. **Given** un dossier sensible (données de l'app, racine de disque, dossier système) ou sans droit d'écriture,
   **When** il est choisi, **Then** il est refusé avec la raison, sans rien écrire.

---

### User Story 5 — Nouveau brainstorm depuis un lien Git (Priority: P3)

« Nouveau brainstorm » › « Depuis un lien Git » : mentalyas colle l'adresse d'un dépôt. L'app montre où elle va le
cloner (dans le coffre), clone après confirmation, crée le brainstorm du projet et ouvre son canevas. Il peut ensuite
continuer le projet (en collaborateur ou par un fork) ou en extraire des morceaux pour un autre projet.

**Why this priority**: s'appuie sur la spec 021 (clone, fork, extraire), pas encore codée.

**Independent Test**: cloner un petit dépôt public de test : il arrive dans le coffre, apparaît dans la liste, son
canevas s'ouvre ; « Extraire un morceau » copie un fichier vers un autre projet avec sa licence et l'attribution.

**Acceptance Scenarios**:

1. **Given** un lien, **When** mentalyas le colle, **Then** l'app vérifie qu'il s'agit d'une adresse de dépôt valide et
   montre le dossier de destination dans le coffre avant de cloner.
2. **Given** le clone terminé, **When** le canevas s'ouvre, **Then** le projet est au registre et le contenu cloné est
   traité comme une donnée non fiable (jamais exécuté, jamais une consigne pour Claude).
3. **Given** un projet cloné, **When** mentalyas choisit « Extraire un morceau », **Then** les fichiers choisis sont
   copiés vers un autre projet avec la licence d'origine et l'attribution.

---

### User Story 6 — Fermer une session étape par étape (Priority: P3)

Sur un brainstorm ouvert, « Fin de session » liste les étapes de `/hub end` avec des cases, cochées selon ce que la
session a changé ; chaque étape s'exécute séparément, avec son résultat (faite, échouée, sautée).

**Why this priority**: `/hub end` en terminal reste possible en attendant.

**Independent Test**: décocher « graphe » et « cours » : le commit montre son diff et attend le clic, les journaux
reçoivent leur entrée, la session est fermée et `pm.bat` le voit.

**Acceptance Scenarios**:

1. **Given** une session ouverte, **When** mentalyas ouvre « Fin de session », **Then** chaque étape est listée avec une
   case et un état ; une étape sans objet est décochée avec la raison.
2. **Given** des étapes cochées, **When** il lance la fin, **Then** elles s'exécutent dans l'ordre de `/hub end`, une
   par une ; un échec arrête les étapes qui en dépendent.
3. **Given** le commit ou le push, **When** leur étape arrive, **Then** l'app montre les fichiers et le diff, ou la
   destination et la branche, et n'agit que sur un clic.

---

### User Story 7 — Définir mon coffre au premier lancement (Priority: P3)

Au premier lancement (ou si le coffre a disparu), avant le Project Manager, l'app demande où est le coffre : choisir un
dossier existant, ou en créer un, vide et prêt.

**Why this priority**: indispensable pour un autre utilisateur ; chez mentalyas, le coffre existe.

**Independent Test**: profil neuf → l'app demande le coffre ; « Créer » produit un coffre que `pm.bat` sait lire.

**Acceptance Scenarios**:

1. **Given** aucun coffre défini, **When** l'app démarre, **Then** elle propose de choisir ou de créer un coffre, puis
   affiche le Project Manager.
2. **Given** un dossier qui n'est pas un coffre, **When** il est validé, **Then** l'app propose d'y créer un coffre.
3. **Given** un dossier interdit, **When** il est choisi, **Then** il est refusé avec la raison.

---

### Edge Cases

- `pm.bat` et l'app ouverts en même temps : une écriture du registre ou des sessions par l'un est vue par l'autre ;
  aucune écriture n'écrase un changement plus récent.
- Session ouverte par `pm.bat` sur un autre projet : l'app le signale (un seul projet actif à la fois) et propose de la
  fermer d'abord.
- Projet externe déplacé ou renommé : grisé « dossier introuvable », avec « Relier à son nouvel emplacement » (le vault
  le reconnaît).
- Vault `.brainstormer/` abîmé ou d'un format inconnu : signalé, recréation proposée, documents Markdown intacts.
- Collaborateur dont la branche a été supprimée du distant : l'app le signale et propose de la recréer depuis l'état
  local.
- Lien Git invalide, dépôt privé sans accès, `gh` absent : message clair, rien n'est écrit dans le coffre.
- Point de sauvegarde très ancien (le projet a beaucoup changé depuis) : le retour reste possible et annulable ; il ne
  touche qu'au canevas, jamais aux fichiers du projet.
- Coupure (panne, fermeture brutale) : la sauvegarde continue retrouve l'état d'avant la coupure, au plus quelques
  secondes de travail perdues.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (D5) : Au démarrage, une fois le coffre défini, l'app MUST afficher le Project Manager (« Charger un
  brainstorm existant », « Nouveau brainstorm ») avant tout canevas.
- **FR-002** (D6) : « Charger » MUST lister les brainstorms (coffre et externes) avec nom, description, emplacement,
  branche, dernière session, session ouverte, dossier introuvable.
- **FR-003** (D1, D6) : Ouvrir un brainstorm MUST afficher son seul canevas, dans l'état exact de la dernière fois
  (nœuds, positions, replis, vue, cartes ouvertes).
- **FR-004** (D4, D6) : Ouvrir un brainstorm MUST suivre `/hub work` : anomalies (session mal fermée, fichiers non
  commités, commits non poussés, distant en avance), résumé, ouverture de session dans les fichiers partagés avec
  `pm.bat`.
- **FR-005** (D7) : Le canevas MUST être enregistré en continu, sans geste de mentalyas ; une coupure MUST faire perdre
  au plus quelques secondes de travail.
- **FR-006** (D7) : Mentalyas MUST pouvoir poser, nommer, renommer, supprimer (avec confirmation) des points de
  sauvegarde d'un brainstorm, et revenir à l'un d'eux après confirmation ; le retour MUST être annulable et ne toucher
  qu'au canevas (jamais aux fichiers du projet).
- **FR-007** (D8) : « De zéro » MUST demander nom, description, type, GitHub oui / non et visibilité ; le nom MUST
  respecter les règles de `/hub new` avant toute écriture ; le dossier MUST être créé dans le coffre avec la structure
  ProjectMaster ; le dépôt GitHub MUST n'être créé que si demandé et confirmé.
- **FR-008** (D3, D8) : Après la création, le canevas MUST s'ouvrir avec un genesis au nom du projet et le brainstorm
  MUST démarrer en recevant le nom et la description ; l'app MUST NOT créer de genesis sans projet.
- **FR-009** (D9) : « Projet en chantier » MUST NOT déplacer le dossier ; l'app MUST montrer puis, après confirmation,
  créer `.brainstormer/` (repris s'il existe), l'ajouter au `.gitignore`, écrire la doc en Markdown dans le projet,
  garder le contenu de la carte dans la base chiffrée, et ajouter une référence externe au registre.
- **FR-010** (D10) : L'app MUST demander le rôle (collaborateur, mon propre dépôt) et le mémoriser dans le vault ; en
  collaborateur, elle MUST travailler sur la branche de mentalyas et MUST NOT pousser vers la branche par défaut ; sans
  dépôt, elle MUST proposer `git init` sans l'imposer.
- **FR-011** (D11) : « Depuis un lien Git » MUST valider l'adresse, montrer la destination dans le coffre, cloner après
  confirmation (spec 021), ajouter le projet au registre et ouvrir son canevas ; le contenu cloné MUST rester une donnée
  non fiable.
- **FR-012** (D11) : « Extraire un morceau » MUST copier les fichiers choisis vers un autre projet avec la licence
  d'origine et l'attribution (spec 021 GH-G).
- **FR-013** (D12) : « Fin de session » MUST lister les étapes de `/hub end` avec une case chacune, les exécuter
  séparément dans l'ordre, chacune avec son résultat ; un échec MUST arrêter celles qui en dépendent ; la fermeture MUST
  mettre à jour les fichiers de session partagés et la dernière session du registre.
- **FR-014** (D4) : Toute action git (commit, push, branche, `git init`, création de dépôt, clone) MUST attendre un clic
  de mentalyas après affichage de ce qu'elle fera (constitution II, « Dépôt »).
- **FR-015** (D4) : Les étapes de `/hub` MUST être faites par l'app en suivant le protocole du skill ; le brainstorm MUST
  se faire dans la conversation existante du genesis (spec 008, mode de permission de la spec 014) ; aucun nouveau mode
  de conversation.
- **FR-016** : Au passage à un canevas par projet, le contenu actuel de la carte unique MUST être rangé sans perte : le
  genesis du Brainstormer dans le brainstorm `gestionnaire-idees`, le reste dans un brainstorm local « Idées en vrac ».
- **FR-017** (D8) : Le skill `/hub` MUST accepter le choix GitHub oui / non à la création (modification de la
  configuration de mentalyas, hors de ce dépôt, avec son accord).
- **FR-018** (D13) : Sans coffre défini, l'app MUST proposer d'en choisir ou d'en créer un avant le Project Manager ;
  un coffre créé MUST être lisible par `pm.bat` ; un dossier sensible MUST être refusé.
- **FR-019** (accessibilité) : Le Project Manager, les formulaires, la liste des points de sauvegarde et la fin de
  session MUST être utilisables au clavier et passer la vérification d'accessibilité ; chaque étape longue (clone,
  graphe) MUST montrer qu'elle travaille et pouvoir être annulée.

### Key Entities

- **Coffre** : dossier ProjectMaster ; registre, fichiers de session, dossier des projets, journal global.
- **Brainstorm (projet)** : entrée du registre (identifiant, nom, description, type, local ou GitHub, **dans le coffre
  ou externe**, origine : de zéro, en chantier, cloné ; dernière session, branche, adresse du dépôt) et son dossier.
- **Canevas** : la carte d'un brainstorm (genesis, nœuds, liens, documents, vues, cartes ouvertes et leur état),
  enregistrée en continu.
- **Point de sauvegarde** : un état nommé et daté d'un canevas, auquel on revient (retour annulable).
- **Vault** : `.brainstormer/` d'un projet externe ; identité, sessions, réglages du canevas, rôle git ; ignoré par git.
- **Rôle git** : collaborateur (branche personnelle) ou propriétaire (dépôt propre) ; mémorisé par projet.
- **Session** et **étape de fin de session** : ouverture, fermeture, branche ; étapes faites, échouées ou sautées.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** : Depuis l'ouverture de l'app, mentalyas reprend un brainstorm existant en 2 gestes au plus (« Charger »,
  puis le brainstorm), hors anomalie à traiter.
- **SC-002** : Un brainstorm rechargé après fermeture de l'app est identique à 100 % (nœuds, liens, positions, replis,
  vue) dans les cas testés.
- **SC-003** : Revenir à un point de sauvegarde puis annuler ce retour redonne exactement l'état d'avant (inventaire
  identique).
- **SC-004** : Après une ouverture ou une fin de session dans l'app, `pm.bat` affiche le même état dans 100 % des cas
  testés, et inversement.
- **SC-005** : Créer un brainstorm de zéro, jusqu'à la première question, prend moins de 2 minutes hors temps de
  réponse de Claude.
- **SC-006** : Charger un projet en chantier ne modifie dans son dossier que `.brainstormer/` et une ligne du
  `.gitignore` (inventaire avant / après), et ne déplace aucun fichier.
- **SC-007** : Aucune action git ne s'exécute sans clic de mentalyas après affichage de son contenu, et aucun push
  « collaborateur » ne vise la branche par défaut (vérifiable par test).
- **SC-008** : Le passage à un canevas par projet ne perd aucun nœud, document, lien ni widget (inventaire identique).
- **SC-009** : Le Project Manager s'affiche en moins de 2 secondes avec 30 brainstorms.

## Assumptions

- Le coffre de mentalyas est `ProjectsMaster/` ; `.hub/registry.json` et `.hub/sessions.json` gardent leur format
  (lus par `pm.bat` et `HubRegistry`, spec 016) ; l'app y écrit de façon atomique, et ajoute aux entrées les champs
  nécessaires (externe, origine) sans gêner `pm.bat`.
- La spec 021 (Git et GitHub : commit, push, branches, clone, fork, PR, extraire) fournit les opérations git ; la 024
  s'appuie dessus. B3 (US5) et le rôle « collaborateur » (D10) attendent donc la 021.
- L'import d'un projet existant de la spec 017 (analyse statique, confidentialité) se combine avec B2 : un projet en
  chantier peut être analysé ; la réconciliation se fait dans le plan.
- « Un seul projet actif à la fois » (règle du workspace) reste vrai.
- Plusieurs projets sur une même carte : hors périmètre (D1, reporté).
- Ordre de travail : spec écrite maintenant, codée après la fermeture d'une partie des chantiers ouverts ; la 021
  passe avant les parties qui en dépendent.
