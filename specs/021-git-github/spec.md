# Feature Specification: Git et GitHub (spec 021)

**Feature Branch**: `main` · **Created**: 2026-10-07 · **Status**: En pause (2026-10-09) — planifiée, à coder
**Input**: « Pouvoir récupérer direct un projet dans le Brainstormer depuis un lien GitHub, pour pouvoir scrapper les
open sources ou travailler en colab avec des collègues sur des projets à plusieurs. L'idée est de récupérer un working
tree et tracer aussi chronologiquement qui a fait quoi et quand, en fonction des collaborateurs, ensuite pouvoir créer un
repo sur mon GitHub, commit dessus, pull et push, en gros la continuité du git local, le prolonger vers mon GitHub. »
— mentalyas. Brainstorm complet : `docs/FOUNDATION.md` §000000, `docs/brainstorm/L1i-git-github.md` (D1–D7, H1–H18
validées), `L2-git-{depot-local, publier, cloner, historique, conflits, pr-issues, extraire}.md`,
`L3-git-{depot-local, publier, cloner, conflits, pr-issues}.md`, `L4g-git.md`. Constitution **4.4.0** (amendée pour
cette spec).
**Glossaire** : *commit* = un enregistrement daté des changements ; *pousser (push)* = envoyer ses commits sur GitHub ;
*tirer (pull)* = récupérer ceux des autres ; *branche* = une ligne de travail parallèle ; *conflit* = deux changements
incompatibles sur les mêmes lignes ; *PR (Pull Request)* = demande d'intégrer une branche, relue par les autres ;
*fork* = copie d'un dépôt d'autrui sur son propre compte ; *dépôt de confiance* = projet marqué comme sûr par mentalyas
(spec 014).

## Décisions (2026-10-07, brainstorm validé)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Collaboration | Par git / GitHub seulement : les collègues gardent leurs outils ; aucune donnée de l'app (cartes, fiches) n'est partagée. |
| D2 | Déclencheur | Claude **propose** (message de commit, découpage, texte de PR, résolution de conflit) ; seul un **clic** de mentalyas, après affichage, commite, fusionne, pousse ou écrit sur GitHub. L'app ne pousse jamais d'elle-même. |
| D3 | Connexion | Par git et `gh` (CLI GitHub) du poste, déjà connectés par mentalyas ; l'app ne demande, ne lit, ne stocke ni ne journalise aucun jeton. |
| D4 | Périmètre | Clone, commit, pull, push + branches, conflits guidés par Claude, PR, issues, fork, extraction. |
| D5 | Chronologie | Frise des commits par auteur + « rediffusion » sur la carte : les nœuds se colorent selon qui les a touchés ; couleur **et** initiales ; auteurs pseudonymisés pour Claude. |
| D6 | Interface | Volet « Dépôt » du projet (onglets Changements · Branches · Historique · PR · Issues) + badge sur le nœud genesis ; le clone passe par « Reprendre un projet » (spec 017). |
| D7 | Open source | Étudier, extraire un morceau (licence + attribution), forker et contribuer, suivre les mises à jour. |
| D8 | Garde-fous (H1–H18) | Rien de coché d'office ; ni rebase, ni `--amend`, ni reset, ni forçage, ni `--no-verify` ; fusion en cas de divergence ; fichier sensible dans les commits à pousser = blocage sans contournement (seuls les motifs ambigus s'acceptent un par un) ; branche + PR vers la branche principale d'un dépôt d'autrui ; hooks seulement dans un dépôt de confiance ; vérification de GitHub à l'ouverture du volet, jamais en tâche de fond ; clone partiel par défaut ; PR consultées, relues et commentées, jamais approuvées ni fusionnées ; liens issue ↔ nœud locaux ; vue de conflit qui remplace la carte. |
| D9 | Constitution | Amendement **4.4.0** (2026-10-07, validé) : principe I (`gh` en liste blanche, identifiants jamais touchés, hooks selon la confiance) ; principe II (écritures git et GitHub sur clic, sans réécriture d'historique, contrôle bloquant des fichiers sensibles, données GitHub non fiables). |
| D10 | Ordre | MVP = US1 + US2 + US3 ; puis US4 (conflits), US5 (historique), US6 (PR, issues, fork), US7 (extraire). Tant qu'US4 n'existe pas, un pull en conflit est annulé proprement avec une explication. |
| D11 | Propriétaire (analyse H3, 2026-10-08) | Le compte connecté est « propriétaire » d'un dépôt s'il est à son compte **ou** s'il y a le droit `admin` ou `maintain` : il peut alors pousser sur la branche principale, toujours après le récapitulatif ; sinon branche + PR. |
| D12 | Auteur principal en clone partiel (analyse H4, 2026-10-08) | Dans un clone partiel, l'auteur principal se calcule au **nombre de commits** (affiché « par commits ») ; au nombre de lignes après « Tout télécharger » ou dans un dépôt complet. |
| D13 | Une seule entrée pour cloner (2026-10-10, choix de mentalyas) | Le clone par lien vit dans le **Project Manager** (spec 024 US5, « Nouveau brainstorm › Depuis un lien Git », clone dans le coffre) ; l'assistant « Reprendre un projet existant » (spec 017) ne reçoit **pas** de seconde entrée. US3 y ajoute : confidentialité choisie au clone (spec 017 FR-005), projet repris enregistré et analyse statique lancée, dépôt marqué « cloné » avec son dernier commit vu, question « Continuer / Annuler » à 500 Mo, clones en cours inscrits en base (nettoyés au démarrage après une fermeture brutale), « Depuis ta dernière visite » (`last_seen..@{upstream}`, avancé seulement par « Marquer comme vu »). Les nœuds touchés surlignés sur la carte de structure (T030) sont reportés. |
| D14 | Conflits : réponse directe et volet verrouillé (2026-10-10, US4) | `git:conflictPropose` renvoie directement la vue du fichier avec les propositions (pas de jeton puis d'événement : un fichier à la fois, sur clic). Pendant une fusion ouverte par l'app, le volet Dépôt est verrouillé (commit, tirer, pousser) : seule la vue de résolution agit, jusqu'à « Terminer » ou « Abandonner ». |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Gérer le dépôt local d'un projet (Priority: P1) 🎯 MVP

Sur la carte d'un projet lié à un dossier git, mentalyas ouvre le volet **Dépôt** : il voit les fichiers modifiés et
leur diff, coche ceux à commiter, reçoit de Claude une proposition de message, l'ajuste et clique **Commiter** ; il crée
une branche ou change de branche ; un badge sur le nœud du projet résume l'état (branche, fichiers modifiés, à pousser,
à tirer).

**Why this priority**: c'est le socle de tout le reste et le geste du quotidien.

**Independent Test**: sur un dépôt de test local : modifier 3 fichiers, n'en cocher que 2, accepter le message proposé →
un commit contenant exactement ces 2 fichiers, sans ligne de co-auteur ; le 3ᵉ reste modifié.

**Acceptance Scenarios**:

1. **Given** un projet lié à un dossier git, **When** mentalyas ouvre le volet Dépôt, **Then** il voit la branche
   courante, les fichiers modifiés (aucun coché d'office) et le diff du fichier sélectionné.
2. **Given** des fichiers cochés, **When** il demande une proposition, **Then** Claude rédige un message au format
   Conventional Commits, modifiable, sans ligne de co-auteur.
3. **Given** un message et une sélection, **When** il clique Commiter, **Then** seuls les fichiers cochés sont commités ;
   si le dossier a changé entre-temps (fichier en plus ou en moins dans la sélection), le commit est refusé et la liste
   rafraîchie.
4. **Given** un fichier sensible modifié (`.env`, clé privée…), **Then** il est signalé et ne peut pas être coché.
5. **Given** un dépôt de confiance, **Then** ses hooks s'exécutent au commit (un hook en échec bloque, avec sa sortie) ;
   **Given** un dépôt non de confiance, **Then** aucun hook ne s'exécute.
6. **Given** le volet ouvert, **When** il crée une branche ou en change (sans changement non commité qui serait perdu),
   **Then** le badge et le volet se mettent à jour.
7. **Given** un dossier sans git, **Then** le volet propose « Initialiser git » (spec 016) au lieu de s'afficher vide.
8. **Given** un commit de la liste des derniers commits, **When** mentalyas clique « Annuler ce commit » et confirme,
   **Then** un commit d'annulation (revert) est créé, sans réécrire l'historique ; un commit de fusion ne peut pas être
   annulé ainsi (explication).

---

### User Story 2 — Publier sur GitHub, tirer et pousser (Priority: P1) 🎯 MVP

mentalyas publie un projet local sur son compte GitHub (dépôt **privé par défaut**), puis, au quotidien, tire le travail
des collègues et pousse le sien, toujours après avoir vu la destination, la branche et les commits concernés.

**Why this priority**: c'est « prolonger le git local vers GitHub », le cœur de la demande.

**Independent Test**: sur un dépôt distant de test : publier, pousser 2 commits, tirer un commit fait ailleurs ; un
commit contenant un faux `.env` bloque le push ; aucune commande de forçage n'est jamais lancée.

**Acceptance Scenarios**:

1. **Given** un projet sans dépôt distant et `gh` connecté, **When** mentalyas clique Publier, **Then** il choisit le nom
   et la visibilité (privé coché ; public demande une seconde confirmation), le dépôt est créé sur son compte et la
   branche courante y est poussée après le récapitulatif.
2. **Given** `gh` absent ou non connecté, **Then** l'app explique la commande à lancer (`gh auth login`) et ne demande
   aucun identifiant.
3. **Given** l'ouverture du volet ou un clic sur Actualiser, **Then** l'app vérifie GitHub et le badge indique « N à
   tirer · M à pousser » avec l'heure de la vérification.
4. **Given** des commits à tirer et aucun commit local propre, **When** il clique Tirer, **Then** la branche avance ;
   **Given** des commits des deux côtés, **Then** l'app propose une fusion (jamais de rebase) ; en cas de conflit, sans
   l'US4, la fusion est annulée proprement avec une explication.
5. **Given** des commits à pousser, **When** il clique Pousser, **Then** un récapitulatif montre dépôt, branche et
   commits ; après confirmation, la branche est poussée.
6. **Given** un fichier sensible dans l'un des commits à pousser, **Then** le push est bloqué sans contournement et
   l'app explique comment retirer le fichier ; un motif ambigu (ressemblant à un jeton dans un fichier de test) peut être
   accepté motif par motif.
7. **Given** la branche principale d'un dépôt dont mentalyas n'est pas propriétaire (ni à son compte, ni avec le droit
   `admin` ou `maintain`), **Then** le push direct est refusé et l'app propose une branche + une PR ; **Given** un
   dépôt à son compte ou où il a le droit `admin` / `maintain`, **Then** le push vers la branche principale est permis
   après le récapitulatif (D11).

---

### User Story 3 — Cloner un projet par lien et suivre ses mises à jour (Priority: P1) 🎯 MVP

Depuis « Reprendre un projet », mentalyas colle un lien GitHub (projet open source ou de collègues), choisit le dossier
de destination ; l'app clone le projet avec tout son historique, crée le projet sur la carte et lance la reprise (spec
017). Plus tard, elle lui montre « ce qui a changé depuis ta dernière visite ».

**Why this priority**: c'est la première moitié de la demande (« récupérer direct un projet depuis un lien »).

**Independent Test**: cloner un dépôt de démonstration servi en local : projet créé, reprise lancée, aucun hook ni script
exécuté ; une adresse piégée est refusée sans rien lancer ; annuler un clone ne laisse aucun dossier.

**Acceptance Scenarios**:

1. **Given** une adresse `https://` ou `git@` valide et un dossier vide choisi, **When** mentalyas lance le clone,
   **Then** une progression s'affiche, l'historique complet des commits est récupéré, le contenu des anciennes versions
   seulement à la demande (case « Tout télécharger » pour l'avoir d'emblée).
2. **Given** une adresse piégée (autre transport, option déguisée, caractère de contrôle), **Then** elle est refusée
   avant tout lancement.
3. **Given** une adresse contenant un identifiant, **Then** il est retiré avant affichage, journal et stockage.
4. **Given** un dépôt dépassant 500 Mo reçus, **Then** l'app pose la question « Continuer / Annuler » (le téléchargement
   continue pendant la question ; Annuler l'arrête et nettoie).
5. **Given** un clone annulé, échoué ou interrompu par la fermeture de l'app, **Then** seul le dossier créé est
   supprimé (au plus tard au démarrage suivant).
6. **Given** un dépôt cloné, **Then** il n'est pas « de confiance » : aucun hook, sous-module, installation ni script
   n'est exécuté, et ses textes (README, messages, auteurs) sont des données pour Claude, jamais des consignes.
7. **Given** un projet cloné revu plus tard, **When** de nouveaux commits ont été tirés, **Then** la section « Depuis ta
   dernière visite » les liste jusqu'à « Marquer comme vu ».

---

### User Story 4 — Résoudre un conflit avec Claude (Priority: P2)

Quand un pull rencontre des conflits, une vue dédiée remplace la carte : pour chaque fichier, mentalyas voit sa version,
celle de GitHub et la proposition de Claude, et choisit bloc par bloc ; il termine la fusion ou l'abandonne.

**Why this priority**: les collègues créent des conflits dès le premier pull divergent (passe avant la frise).

**Independent Test**: un dépôt de test à 2 fichiers en conflit : la proposition de Claude (simulé) contenant encore des
marqueurs est rejetée ; « Terminer » refusé tant qu'un fichier n'est pas résolu ; « Abandonner » rend l'état exact
d'avant.

**Acceptance Scenarios**:

1. **Given** un pull en conflit, **Then** la vue de résolution s'ouvre avec la liste des fichiers en conflit.
2. **Given** un fichier, **Then** chaque bloc montre « ma version », « leur version », la proposition de Claude et sa
   justification ; mentalyas choisit l'une, l'autre, la proposition ou édite.
3. **Given** des fichiers non résolus, **Then** « Terminer la fusion » est refusé ; une fois tout résolu, le commit de
   fusion n'a lieu que sur ce clic.
4. **Given** « Abandonner » confirmé, **Then** le dépôt revient exactement à son état d'avant le pull.
5. **Given** l'app fermée en pleine résolution, **Then** elle reprend où elle en était ; les décisions sont effacées en
   fin ou abandon de fusion.
6. **Given** un projet « Local uniquement » ou un fichier au-delà des bornes, **Then** rien n'est envoyé à Claude et le
   fichier se résout à la main.

---

### User Story 5 — Voir qui a fait quoi et quand (Priority: P2)

Dans l'onglet Historique, une frise montre les commits par auteur ; en déplaçant le curseur de temps, les nœuds de la
cartographie du projet se colorent selon leur auteur principal à cette date (initiales en pastille), comme une
rediffusion du projet ; Claude peut « raconter la période ».

**Why this priority**: c'est le cœur visuel de l'idée (« tracer chronologiquement qui a fait quoi »).

**Independent Test**: un dépôt fictif à 3 auteurs : la frise montre 3 lignes ; au curseur donné, chaque nœud a la couleur
et les initiales attendues ; le récit envoyé à Claude ne contient aucun nom ni e-mail réel.

**Acceptance Scenarios**:

1. **Given** un projet avec historique, **Then** la frise montre une ligne par auteur, légende toujours visible (couleur
   + initiales).
2. **Given** le curseur sur une date, **Then** chaque nœud de la cartographie prend la couleur de l'auteur ayant modifié
   le plus de lignes jusqu'à cette date ; les autres auteurs apparaissent en pastilles ; **Given** un clone partiel,
   **Then** l'auteur principal est celui qui a le plus de commits sur le nœud, et la légende indique « par commits »
   jusqu'à « Tout télécharger » (D12).
3. **Given** deux identités du même collègue, **Then** mentalyas peut les fusionner (gardé dans l'app, par projet).
4. **Given** « Raconter la période », **Then** Claude reçoit les messages de commit et des alias (Auteur A, B…) ; l'app
   remet les vrais noms à l'affichage.
5. **Given** un historique de plus de 5 000 commits, **Then** « Charger plus » complète la frise.

---

### User Story 6 — Pull requests, issues et fork (Priority: P3)

mentalyas voit les PR du dépôt (statut, diff), les relit avec Claude et les commente ; il ouvre une PR depuis sa branche
(texte proposé par Claude, modifiable) ; il voit les issues, en crée, et en relie à des nœuds de la carte ; il forke un
dépôt d'autrui pour y contribuer.

**Why this priority**: utile à la collaboration et à la contribution open source, mais après le socle et l'historique.

**Independent Test**: avec `gh` simulé : liste des PR et issues bornée ; création de PR et commentaire seulement sur clic
après récapitulatif ; un lien non-GitHub dans une description n'est pas cliquable ; aucune approbation ni fusion
possible.

**Acceptance Scenarios**:

1. **Given** l'onglet PR, **Then** la liste (50 au plus) montre titre, auteur, statut ; une PR ouverte montre son diff et
   sa description affichée en texte (sans HTML ni image distante).
2. **Given** une PR, **When** mentalyas demande une relecture, **Then** Claude commente le diff dans l'app ; publier un
   commentaire sur GitHub se fait sur clic, après relecture du texte.
3. **Given** une branche poussée, **When** il ouvre une PR, **Then** titre et description proposés par Claude sont
   modifiables avant le clic Créer.
4. **Given** l'onglet Issues, **Then** il voit, crée des issues et en relie à des nœuds ; le lien reste dans l'app.
5. **Given** un dépôt d'autrui, **When** il clique Forker, **Then** le fork est créé sur son compte, et les remotes
   « origin » (son fork) et « upstream » (l'original) sont réglés.
6. **Given** un lien externe dans un texte venu de GitHub, **Then** seuls les liens `https://github.com/…` s'ouvrent ;
   les autres sont copiables, pas cliquables.

---

### User Story 7 — Extraire un morceau d'un projet open source (Priority: P3)

Dans un projet cloné, mentalyas sélectionne un fichier ou un extrait et l'enregistre dans `snippets/` ou `techno/` du
workspace : l'app affiche d'abord la licence et ajoute un en-tête d'attribution.

**Why this priority**: complète l'étude de l'open source ; indépendant du reste.

**Independent Test**: sur des dépôts fictifs (MIT, sans licence) : la licence est affichée avant la copie ; l'en-tête
d'attribution est présent ; sans licence, seule une note d'étude est proposée ; une destination hors des deux dossiers
est refusée.

**Acceptance Scenarios**:

1. **Given** un fichier sélectionné, **Then** la licence identifiée (ou « inconnue ») est affichée avant toute copie.
2. **Given** une licence qui permet la copie, **When** il confirme, **Then** le fichier est écrit avec un en-tête
   d'origine, chemin, commit, licence et copyright.
3. **Given** une licence inconnue ou absente, **Then** seule une note d'étude (sans copie du code) est proposée.
4. **Given** une destination hors de `snippets/` ou `techno/`, **Then** elle est refusée.

### Edge Cases

- `index.lock` présent (git occupé par un autre outil) → « git occupé », réessayer ; jamais supprimé par l'app.
- Deux opérations en même temps sur le même dépôt → la seconde attend ou est refusée (une écriture à la fois).
- Changement fait en terminal pendant que le volet est ouvert → l'état est relu au retour du focus ; un récapitulatif
  devenu faux (branche, remote ou commits changés) annule l'opération.
- Collègue qui pousse entre la vérification et le push → push refusé par GitHub, l'app propose de tirer d'abord.
- Réseau coupé, délai dépassé, identifiants refusés → message clair, rien de modifié localement.
- Dépôt en HEAD détachée, fusion ou rebase en cours lancé hors de l'app → volet en lecture, explication.
- Configuration locale d'un dépôt non de confiance qui désigne un programme (moniteur de fichiers, commande ssh, filtre)
  → les clés neutralisables le sont à chaque commande ; une clé non neutralisable (filtre, inclusion, commande ssh,
  assistant d'identifiants…) bloque **toute** commande git du volet, lecture comprise, tant qu'elle est présente
  (explication et liste des clés).
- Fichier sensible déjà dans un ancien commit à pousser → blocage ; aide pour le retirer hors de l'app.
- Dépôt énorme ou très long historique → avertissement, frise paginée.
- Adresse avec identifiant collée → identifiant retiré, jamais conservé.
- Projet « Local uniquement » → aucune tâche Claude : messages, textes et résolutions à la main.

## Requirements *(mandatory)*

### Functional Requirements

**Dépôt local (US1)**
- **FR-001**: Le volet Dépôt MUST montrer branche courante, fichiers modifiés (non cochés d'office), diff du fichier
  sélectionné, et un badge d'état sur le nœud du projet (branche, modifiés, à pousser, à tirer, heure de vérification).
- **FR-002**: Un commit MUST n'avoir lieu que sur clic de mentalyas, avec les seuls fichiers cochés, ajoutés nommément ;
  il MUST être refusé si la sélection ne correspond plus à l'état du dossier.
- **FR-003**: Les fichiers sensibles (liste fixe : `.env*` sauf exemples, clés privées, certificats, fichiers
  d'identifiants) MUST NOT pouvoir être cochés.
- **FR-004**: La proposition de message MUST venir d'une tâche Claude sans outil, recevant le diff borné comme donnée et
  sans fichier sensible ; elle MUST être modifiable ; aucune ligne de co-auteur MUST être ajoutée, et une telle ligne
  proposée MUST être retirée.
- **FR-005**: Les hooks MUST s'exécuter seulement dans un dépôt de confiance, et jamais être contournés ; ailleurs, git
  MUST tourner sans hooks ni programme désigné par la configuration du dépôt ; dans un dépôt non de confiance, une
  configuration locale désignant un programme que l'app ne peut pas neutraliser MUST bloquer toute commande git,
  lecture comprise. Même dans un dépôt de confiance, aucun hook MUST s'exécuter tant que HEAD est sur une branche de
  PR récupérée (`pr/*`) : ses hooks peuvent venir de l'auteur de la PR.
- **FR-006**: mentalyas MUST pouvoir créer une branche et changer de branche ; un changement qui écraserait des
  modifications non commitées MUST être refusé avec explication.
- **FR-007**: L'app MUST NOT proposer ni lancer de réécriture d'historique (amend, reset, rebase, forçage) ; un retour
  arrière se fait par un commit d'annulation (revert), sur clic.
- **FR-008**: Une seule écriture git à la fois par dépôt ; un verrou git existant MUST NOT être supprimé par l'app.

**Publier, tirer, pousser (US2)**
- **FR-009**: Publier MUST créer un dépôt sur le compte connecté, **privé par défaut** (public après seconde
  confirmation), puis pousser la branche courante après récapitulatif.
- **FR-010**: La connexion MUST passer par git et `gh` du poste ; l'app MUST NOT demander, lire, stocker ni journaliser
  un jeton ; `gh` absent ou non connecté MUST donner la commande à lancer ; seules des sous-commandes `gh` d'une liste
  fixe MUST être lancées.
- **FR-011**: La vérification de GitHub (fetch) MUST se faire à l'ouverture du volet, sur Actualiser, et juste avant
  tirer ou pousser ; jamais en tâche de fond.
- **FR-012**: Tirer MUST avancer la branche si possible, sinon proposer une fusion ; jamais de rebase ; un conflit sans
  l'US4 MUST annuler la fusion et l'expliquer.
- **FR-013**: Pousser MUST montrer dépôt, branche et commits avant le clic ; une seule branche ; jamais de forçage, de
  suppression distante ni d'envoi de toutes les branches ; l'opération MUST être annulée si l'état a changé depuis le
  récapitulatif.
- **FR-014**: Avant tout push, les fichiers de **tous** les commits envoyés MUST être contrôlés ; un nom sensible ou une
  clé privée MUST bloquer sans contournement ; un motif ambigu MUST pouvoir être accepté motif par motif, ligne affichée.
- **FR-015**: Le push direct vers la branche par défaut d'un dépôt dont le compte connecté n'est pas propriétaire MUST
  être refusé, avec proposition branche + PR ; le compte est propriétaire si le dépôt est à son compte **ou** s'il y a
  le droit `admin` ou `maintain` (D11) ; le push reste précédé du récapitulatif.
- **FR-016**: Les adresses de dépôt distant MUST être affichées et enregistrées sans identifiant.

**Cloner, suivre (US3)**
- **FR-017**: Le clone MUST accepter seulement `https://` et `git@hôte:chemin`, refuser tout autre transport, option
  déguisée ou caractère de contrôle avant lancement, et retirer tout identifiant.
- **FR-018**: Le clone MUST récupérer l'historique complet des commits, le contenu ancien à la demande (option « Tout
  télécharger »), sans hooks, sous-modules ni exécution ; avertir à 500 Mo reçus ; être annulable.
- **FR-019**: La destination MUST être choisie au sélecteur natif (dossier vide, jamais le dossier de données de l'app),
  pré-positionnée sur la dernière utilisée ; seul le dossier créé MUST être nettoyé en cas d'échec, d'annulation ou
  d'interruption.
- **FR-020**: Un projet cloné MUST être créé sur la carte et sa reprise (spec 017) lancée ; il MUST NOT être de
  confiance ; il MUST NOT être inscrit d'office au registre du hub.
- **FR-021**: L'app MUST garder par projet le dernier commit vu et lister « Depuis ta dernière visite » jusqu'à « Marquer
  comme vu ».
- **FR-022**: Un seul service de clone MUST servir cette spec et l'import de skills (spec 020, clone superficiel en
  quarantaine).

**Conflits (US4)**
- **FR-023**: Un pull en conflit MUST ouvrir une vue de résolution (qui remplace la carte) listant les fichiers en
  conflit ; chaque bloc montre les deux versions, la proposition de Claude et sa justification.
- **FR-024**: La proposition MUST venir d'une tâche Claude sans outil, versions balisées comme données ; une proposition
  contenant des marqueurs de conflit MUST être rejetée ; bornes : 50 fichiers, 200 Ko par fichier, 30 blocs par fichier
  (au-delà, résolution manuelle).
- **FR-025**: « Terminer la fusion » MUST être refusé tant qu'un fichier reste non résolu ; le commit de fusion n'a lieu
  que sur ce clic ; « Abandonner » MUST rendre l'état exact d'avant.
- **FR-026**: Les décisions en cours MUST survivre à la fermeture de l'app et être effacées en fin ou abandon de fusion ;
  aucune stratégie automatique MUST être appliquée d'office.

**Historique (US5)**
- **FR-027**: La frise MUST montrer les commits par auteur (couleur + initiales, légende visible, contraste ≥ 3:1) et la
  rediffusion MUST colorer chaque nœud de la cartographie selon son auteur principal à la date du curseur (lignes
  modifiées ; dans un clone partiel, nombre de commits, affiché « par commits », jusqu'à « Tout télécharger » — D12).
- **FR-028**: Les noms et e-mails d'auteurs MUST NOT être journalisés ni envoyés à Claude (alias) ; les fusions
  d'identités MUST être gardées dans l'app, par projet.
- **FR-029**: La lecture MUST être bornée (5 000 commits par lecture, « Charger plus ») et ne lancer aucune écriture git.

**PR, issues, fork (US6)**
- **FR-030**: L'app MUST lister PR (50) et issues (100 par page), afficher leurs textes comme du Markdown sans HTML ni
  image distante, et n'ouvrir que les liens `https://github.com/…`.
- **FR-031**: Créer une PR, une issue, un commentaire de PR ou un fork MUST se faire sur clic, après récapitulatif ; les
  textes proposés par Claude MUST être modifiables avant.
- **FR-032**: L'app MUST NOT approuver, fusionner ni fermer une PR ou une issue.
- **FR-033**: Les liens issue ↔ nœud MUST rester dans l'app ; rien n'est écrit dans l'issue.
- **FR-034**: Un fork MUST régler « origin » sur le fork et « upstream » sur l'original.

**Extraire (US7)**
- **FR-035**: La licence MUST être identifiée par règles fixes (ou « inconnue ») et affichée avant toute copie ; sans
  licence permettant la copie, seule une note d'étude est proposée.
- **FR-036**: Le fichier extrait MUST porter un en-tête d'attribution (origine, chemin, commit, licence, copyright) et
  n'être écrit que dans `snippets/` ou `techno/` du workspace ; l'app ne le commite ni ne l'exécute.

**Transverses**
- **FR-037**: Tout texte venu d'un dépôt ou de GitHub (code, messages, PR, issues, noms) MUST être traité comme une
  donnée non fiable : jamais exécuté, jamais une consigne pour Claude.
- **FR-038**: Un projet « Local uniquement » MUST n'envoyer aucune donnée à Claude ; les propositions sont alors vides.
- **FR-039**: Chaque opération d'écriture MUST être journalisée dans l'app (type, dépôt, résultat, code d'erreur) sans
  contenu, jeton ni nom d'auteur.
- **FR-040**: Erreurs (réseau, délai, identifiants refusés, git occupé, état changé) MUST donner un message clair et ne
  rien modifier localement.

### Key Entities

- **Dépôt suivi** : projet de la carte ↔ dossier git ; dépôt GitHub lié (sans identifiant), dernière vérification,
  dernier commit vu, confiance.
- **Opération git** : commit, fusion, push, publication, clone, fork, PR, issue, commentaire ; type, dépôt, résultat,
  date ; sans contenu.
- **Clone en cours** : adresse nettoyée, dossier créé, profil, progression ; nettoyé au démarrage s'il est orphelin.
- **Session de fusion** : dépôt, fichiers en conflit, décisions par bloc ; effacée en fin ou abandon.
- **Alias d'auteur** : identités fusionnées d'un même collègue, par projet.
- **Lien issue ↔ nœud** : numéro d'issue, dépôt, nœud de la carte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: mentalyas commite une sélection de fichiers avec un message proposé en moins de 30 secondes, sans quitter
  l'app.
- **SC-002**: 100 % des pushes passent par un récapitulatif ; 0 commande de forçage, de rebase, d'amend ou de
  `--no-verify` n'est lancée par l'app (vérifié par les tests sur toutes les commandes construites).
- **SC-003**: 100 % des faux fichiers sensibles du jeu de test (dans le dernier commit comme dans un ancien commit à
  pousser) bloquent le push.
- **SC-004**: Aucun jeton, identifiant d'adresse ni nom d'auteur n'apparaît dans la base, les journaux ou les entrées
  envoyées à Claude (test sur jeu fictif).
- **SC-005**: 100 % des adresses piégées du jeu de test sont refusées sans qu'aucun programme ne soit lancé ; aucun hook
  ni script n'est exécuté sur un dépôt cloné.
- **SC-006**: Un projet open source de taille moyenne (≈ 10 000 commits) est cloné et visible sur la carte en moins de
  3 minutes sur une connexion domestique.
- **SC-007**: Sur un conflit de test à 2 fichiers, mentalyas termine la fusion en moins de 3 minutes, et « Abandonner »
  rend l'état exact d'avant dans 100 % des cas.
- **SC-008**: Au curseur de la frise, mentalyas identifie l'auteur principal de n'importe quel nœud en moins de
  5 secondes, sans s'appuyer sur la couleur seule.

## Assumptions

- git et `gh` sont installés sur le poste et `gh` est connecté par mentalyas (`gh auth login`) ; sinon l'app guide.
- GitHub est le seul hébergeur visé ; d'autres (GitLab…) sont hors périmètre.
- « Commiter l'étape » (spec 014 US7, par Claude selon le mode de permission) reste inchangé ; ses commits apparaissent
  dans le volet comme les autres.
- La marque « dépôt de confiance » est celle de la spec 014.
- La cartographie d'un projet (spec 017) existe pour la rediffusion ; sans elle, la frise s'affiche seule.
- Le clone contrôlé est codé une seule fois, par la première spec qui le livre (021 US3 ou 020 US4).
- Aucune dépendance npm nouvelle n'est prévue ; programme ajouté : `gh`.
- Migration à numéroter au moment de coder (après celle réservée par la spec 020).
- Tests de bout en bout sur des dépôts git locaux et un `gh` simulé ; aucun appel réel à GitHub en test automatique.
