# Niveau 1 — Les agents assemblés (modes de Claude et agents qui communiquent)

**Parent** : L1c-pont-claude-code.md · **Maturité** : complet · **Tâches** : docs/TACHES-AGENTS.md

> Projet : Gestionnaire_idées · Basé sur : brainstorm du neurone « Modes de Claude et agents qui communiquent »
> (2026-10-14), revue du code T001–T004 (2026-10-15), décisions de mentalyas (2026-10-16) · Date : 2026-10-16
>
> Le design des nœuds d'agents reste à définir (T006) ; le reste est arrêté.

## 1. Objectif
Faire travailler des agents Claude Code (profils : rôle, permissions, modèle, effort, skills) sur les tâches d'un projet,
**assemblés à la main par mentalyas** sur la carte. Un seul agent sur une tâche précise est un cas normal ; un
assemblage de plusieurs agents aussi. Rien n'est figé : ni ordre, ni nombre d'agents, ni valeur par défaut.

## 2. Ce qui change par rapport au brainstorm du 2026-10-14
| Avant (14/10) | Maintenant (16/10) |
|---------------|--------------------|
| File fixe PO → Architecte → Backend → Frontend → QA | Assemblage libre, dessiné par mentalyas |
| Les agents travaillent l'un après l'autre | En parallèle s'ils sont indépendants ; à la suite s'ils sont reliés |
| Le QA seul fusionne sur `main` | Rien ne va sur `main` sans l'accord de mentalyas ; le QA est un agent comme un autre |
| Validation de mentalyas à la fin, après la fusion | Accord **avant** toute fusion |

## 3. Décisions

### D1 — Le PO ouvre le travail
- Un agent **PO** (Product Owner) se connecte à un **nœud d'idée** (ou une tâche, un module). Il inspecte le contexte
  et les tâches à faire, puis rédige sa **spec signée** (seul le PO la modifie, T002).
- Sa spec **recommande les agents** à intégrer pour ce travail. Il connaît les profils d'agents existants ; pour une
  tâche complexe sans profil adapté, il **suggère la création d'un nouvel agent** (rôle, consignes, skills).
- Les recommandations et suggestions sont des propositions « par Claude » : mentalyas crée et connecte les agents.
- Les agents connectés au PO lisent sa spec avant de commencer.

### D2 — Les liens disent qui attend qui
- Un lien A → B : B attend que A ait fini, et part de son résultat (sa branche, son rapport).
- Sans lien entre eux, deux agents prêts travaillent **en même temps**, chacun sur sa tâche.
- Les liens sont posés par **mentalyas**. Claude (le PO, ou un agent qui voit qu'il lui manque le résultat d'un autre)
  peut **suggérer** un lien, marqué « par Claude » et annulable ; il ne met jamais seul deux agents en parallèle ou en
  séquence.
- Un agent démarre quand tous ceux qu'il attend ont fini et que son contexte est prêt (spec du PO lue) ; sinon il
  s'arrête et dit ce qui manque.

### D3 — Une branche et un worktree par agent au travail
- Chaque agent travaille dans son propre `git worktree` (copie de travail séparée), sur sa branche
  `agents/<ID-tâche>/<agent>` ; jamais dans la copie de travail de mentalyas.
- Un agent qui attend un seul autre part de sa branche ; s'il en attend plusieurs, il part de leur fusion (un conflit
  arrête l'agent et le signale).
- Fusion sur la branche de base (`main` par défaut) **seulement après l'accord de mentalyas**.

### D4 — Zones de travail
- Chaque tâche confiée à un agent déclare sa zone (dossiers ou fichiers).
- Deux agents **en parallèle** dont les zones se chevauchent : avertissement avant le lancement, avec la proposition
  de les relier (séquence).

### D5 — Hooks et fichiers ajoutés nommément
- Jamais de `--no-verify` (commits, fusion) ; jamais de `git add -A` : l'agent ajoute ses fichiers par leur nom.

### D6 — Skills transmis
- Les skills cochés dans le profil (page Skills › Profils d'agents, T001) sont transmis à la session de l'agent.
- À vérifier avant de coder : `claude -p` avec `--setting-sources ""` charge-t-il les skills ? Sinon, leurs
  instructions sont ajoutées au prompt système de l'agent.

### D7 — Pas de valeur imposée
- Pas de limite d'agents simultanés, pas d'ordre de rôles, pas d'assemblage par défaut : mentalyas construit chaque
  assemblage à la main.

## 4. Ce qui reste du code T001–T004
| Élément | Sort |
|---------|------|
| Profils d'agents (T001) | Gardé ; le rôle « Autre » sert aux agents suggérés par le PO |
| Documents : spec signée, rapports, journaux (T002) | Gardé ; un rapport par agent (`rapport-<agent>.md`), spec et rapports commités sur la branche de l'agent (ils suivent les liens) ; journal du projet hors du dépôt (deux branches parallèles le fusionneraient en conflit) ; la spec gagne les lignes `RECOMMANDÉ:` (profil existant) et `SUGGÉRÉ:` (profil à créer), lues par `parseSpecAgents` (T009) |
| `AgentSession` (session `claude -p`) | Gardé ; ajout des skills (D6) et du worktree (D3) |
| `PipelineEngine` (file fixe, `PIPELINE_ORDER`, fusion par le QA) | **Réécrit** en planificateur d'assemblage (D2, D3) |

## 5. Hors périmètre ici
- Vue animée des agents sur la carte : faite (T006, D10).
- Personnages évolutifs des agents (T008).

### D8 — Le QA teste, le PO réécrit, les agents concernés repassent
- Le QA lance les tests et vérifie le travail. S'il trouve des erreurs, il les **documente** dans son rapport et
  renvoie ses observations **au PO** (pas directement aux agents).
- Le PO **réécrit sa spec** (nouvelle version, signée) en désignant les agents concernés ; ceux-ci la relisent et
  retravaillent leur partie. Les autres ne repartent pas.
- La spec réécrite finit par une ligne `AGENTS: <agent>=correction, <agent>=repasse` (sans elle, le PO s'arrête). Les
  agents qui dépendent d'un agent désigné repartent aussi (en repasse), et le QA revérifie toujours.
- Pas de plafond imposé (D7) : la boucle continue jusqu'à ce que le QA valide, ou que mentalyas l'arrête.

### D9 — Chaque passe est indexée
- Chaque tour d'un agent porte un **numéro de passe** et une **nature**, transmis dans sa mission, ses commits et son
  rapport :
  - **initiale** : première implémentation à partir de la spec v1 ;
  - **correction** : l'agent reprend une erreur relevée par le QA dans sa partie ;
  - **repasse** : l'agent n'est pas en faute, mais la spec a changé là où il travaille ; il relit et ajuste.
- La spec du PO est versionnée (v1, v2…) ; chaque passe cite la version qu'elle applique.

### D10 — Les agents sont des nœuds de la carte
- Un agent est un **nœud du canevas**, relié au nœud d'idée et aux autres agents (les liens de D2) ; un clic ouvre
  son **volet** (profil, passe en cours, rapport, conversation).
- **Design défini le 2026-10-16 (T006)** :
  - **Croquis, puis travail** : les agents connectés à un nœud (idée, étape ou module d'un projet lié) forment un
    **croquis** enregistré (table `assembly_sketches`, un par nœud) ; il se modifie jusqu'au lancement. Un nœud d'agent
    n'est pas un neurone : il est **dérivé** du croquis et du suivi, et disparaît si le nœud est replié ou hors de la
    vue. *(Placement et apparence remplacés par D13 : posé librement, glissable, dessiné en chambre-cube.)*
  - **Entrée** : « ◇ Agents » dans la carte de détails du nœud. Elle ouvre l'onglet « ◇ <nœud> » du panneau de droite :
    ajouter un agent (profil), choisir qui attend qui (ou **tirer un lien** d'une poignée du bas à une poignée du haut
    sur la carte), tâche et zone de chaque agent, lancer, arrêter, accord de fusion.
  - **Liens** : « B attend A » en trait plein ; le nœud vers un agent qui n'attend personne en tirets fins (le contexte).
    Quand A a fini et que B travaille, les pointillés **avancent** (le résultat passe) ; rouge si l'un des deux est arrêté.
  - **États** (couleur, pictogramme et texte, jamais la couleur seule) : à lancer (pointillés) · en attente · **au travail**
    (bordure d'accent qui pulse, barre qui défile, passe indiquée) · terminé · **validé (vert)** quand le QA a validé
    l'assemblage entier · fusionné (vert cerclé) après l'accord · renvoyé par le QA (orangé) · bloqué (orangé, pointillés) ·
    **en erreur (rouge)** · annulé. Mouvement réduit : plus d'animation, les états restent lisibles.
  - **Clic = volet** : profil, état, passe (numéro, nature, version de spec), verdict du QA, motif d'arrêt, puis l'échange
    **mission → rapport** de l'agent. Pas de conversation reprise en direct avec la session de l'agent : le rapport de sa
    dernière passe est lu tel quel (limite connue).
  - **Progression** : barre de chaque nœud (vide en attente, qui défile au travail, pleine à la fin) ; dans le volet,
    « n agents sur N ont fini ».

### D11 — Un seul accord, pour l'assemblage entier
- Pendant le travail, aucun agent ne demande de permission : chacun agit selon le **mode de permissions** de son profil
  (T001).
- mentalyas donne **un accord unique** à la fin, pour fusionner tout l'assemblage sur la branche de base : les
  branches finales (celles que personne n'attend) sont fusionnées à part, puis la base avance d'un coup ; un conflit ou
  une copie de travail modifiée arrête tout sans rien changer.
- Vérifié le 2026-10-16 (sonde `claude -p`) : « Demander avant d'écrire » refuse écritures et commandes ; « Écrire sans
  demander » écrit mais refuse les commandes (pas de tests). Les deux sont signalés au moment d'assembler.

### D12 — Un agent seul n'a pas besoin de PO
- Un agent connecté seul à une tâche précise lit la tâche et le contexte du nœud, sans spec de PO. Le PO reste
  indispensable dès qu'un assemblage a plusieurs agents.

### D13 — L'agent est sa chambre-cube, posée librement sur la carte (2026-10-16, T008)
- **Apparence** : un agent se dessine sur la carte en **diorama** : une chambre-cube vue en isométrique figée, sans
  cadre ni fond autour, où vit son personnage (créature voxel tirée de l'un des 4 univers : robots, science-fiction,
  heroic fantasy, WTF décalé). Planche de référence : `docs/design/agents/dioramas-3d.html`.
- **Placement libre** : le nœud d'agent se **glisse** où mentalyas veut ; aucune place imposée (une disposition
  automatique tournerait au chaos). Sa position est enregistrée par rapport à son nœud (il le suit quand le Workflow se
  réorganise). Un agent jamais déplacé se pose sous son nœud, comme en D10. Le lien vers le nœud reste visible.
- **Échelle** : assez grand pour que le personnage se voie à l'échelle normale de la carte (environ 256 px de large).
- **Identité** : tirée une fois pour toutes de l'identifiant du profil (même profil = même personnage, sur toutes les
  cartes) ; jamais de nouveau tirage. L'objet tenu est l'**objet de métier** du rôle.
- **Chambre** : tirée au hasard (calques à rareté : papier peint, sol, bureau, lit, coin sport, déco, plan au mur et
  schéma, ambiance), puis **enrichie** par le travail livré (passes validées par le QA, fusions acceptées) : chaque
  palier relève la rareté d'un calque.
- **Vie** : l'activité suit l'état réel (au travail → bureau ; en attente ou à lancer → vie libre ; terminé → sport ;
  validé ou fusionné → fête ; renvoyé par le QA → réfléchit au tableau ; bloqué ou en erreur → panique au bureau).
  Le texte de l'état reste écrit sous la chambre (jamais l'image seule). Mouvement réduit : image fixe.
- **Performance** : un seul contexte WebGL pour toutes les chambres (chacune copiée dans sa propre image), rendu
  seulement des chambres visibles, 30 images par seconde au plus, ombres calculées une fois, `three` chargé à la
  demande.
- **Clic = chat en visio** : un clic sur l'agent ouvre un **volet de chat flottant à côté de lui** (pas dans le
  panneau de droite) et l'agent **passe en visio** : la vue de sa webcam remplace la chambre (la chambre reste en
  incrustation), sa bouche bouge quand il répond. Fermer le volet raccroche. Le volet garde ce que montrait D10
  (profil, état, passe, rapport) au-dessus de la conversation. La conversation est une session `claude -p` avec le
  profil de l'agent (rôle, consignes, skills, modèle), dans le dossier où il travaille (son worktree s'il existe),
  reprise d'un clic à l'autre (Libre n'est jamais repris d'office du profil : « Écrire sans demander » au plus). Pendant
  qu'il répond, l'agent hoche la tête et sa réponse passe en sous-titres sur l'image ; la carte se recentre sur lui (à
  100 % au moins) en laissant la place du volet. Remplace la limite de D10 « pas de conversation en direct ».
- Hors de ce lot : la bulle qui parle sur la carte (planche) viendra après.

### D14 — Les agents se connectent aux nœuds du Workflow, et s'appellent au clic droit (2026-10-16)
- **Où** : seulement sur les nœuds de la vue **Workflow** (tâche, lot, fichier de tâches, spec, user story, document de
  brainstorm), là où le travail se fait. Progression et Architecture ne font que refléter : plus de « ◇ Agents » sur
  une idée, une étape ou un élément.
- **Clé** : le croquis est rangé sous la clé de carte du nœud (`wf:<genesis>:<sorte>:…`) ; la table `assembly_sketches`
  perd sa clé étrangère vers `neurons` (migration 0054). Un croquis dont le nœud a quitté les fichiers n'est plus
  dessiné.
- **Contexte de l'agent** : lu dans les fichiers du projet : la ligne de la tâche (ou les tâches du lot, du fichier, de
  la spec), les fichiers qu'elle cite et les documents d'où elle vient (fichier de tâches, brainstorm, `spec.md` et
  `tasks.md`), que l'agent ouvre lui-même ; plus la fiche du genesis.
- **Clic droit** sur un nœud du Workflow : « Appeler <profil> » pour chaque profil d'agent (il apparaît sous le nœud),
  et « Gérer les agents… » (volet de droite : qui attend qui, lancement, accord de fusion). « ◇ Agents » reste dans la
  carte de détails du nœud.

### D15 — Créer un profil d'agent avec Claude (2026-10-16)
- **Où** : Skills › Profils d'agents, « ✦ Créer avec Claude » : la conversation à gauche, la fiche du profil à droite.
- **Déroulé** : mentalyas décrit librement son agent ; Claude ne pose que les questions utiles (deux ou trois au plus),
  consulte les skills présents (`skills_lire`), puis **remplit la fiche** (outil `agent_profil_proposer` : nom, rôle,
  consignes, modèle, effort, mode de permission, skills choisis, et pourquoi). Les champs proposés sont marqués ✦
  jusqu'à ce que mentalyas les touche ; **rien n'est créé avant « Enregistrer »**.
- **Skills qui manquent** : Claude dit lesquels créer et pourquoi ; sur l'accord de mentalyas, il en dépose le
  brouillon (`skill_brouillon`), que mentalyas installe dans la page Skills ; une fois installé, Claude peut le cocher
  dans la fiche.
- La fiche reste modifiable à la main à tout moment, pendant et après la conversation.

### D16 — Peaufiner ses skills en visio avec l'agent (2026-10-16)
- Les skills s'ajoutent surtout à la création (D15) ; ensuite, en tête-à-tête (visio, D13), mentalyas peut demander à
  l'agent d'ajouter, de retirer ou d'améliorer ses skills.
- **Ajouter ou retirer** : l'agent lit les skills (`skills_lire`) et **propose** (`agent_skills_proposer` : ajouter,
  retirer, pourquoi). Une carte « ✦ » apparaît dans le volet de visio avec **Accepter / Refuser** ; rien ne change sans
  le clic de mentalyas. Seulement des skills personnels ou de projet.
- **Améliorer un skill** (son SKILL.md) : l'agent dépose un brouillon (`skill_brouillon`) ; le volet de visio liste les
  brouillons déposés pendant l'appel avec « Voir et installer » (différences, Installer, Jeter), sans quitter la
  conversation.
- La persona de l'agent lui dit quels skills son profil peut consulter et comment proposer un changement.

### D17 — Des agents aussi sur un projet analysé (2026-10-16)
- Un projet qui a une analyse de code (« projet repris », spec 017, y compris un projet du Brainstormer passé par
  « Analyser le code… », D23) accueille des agents : ils travaillent dans leurs worktrees, sur leurs branches, et rien
  ne va sur la branche de base sans l'accord de fusion de mentalyas (D11). Seul « Local uniquement » les refuse : Claude
  n'y a pas accès.
- Constat de mentalyas : son projet de test, créé par le Brainstormer (donc écrit par Claude), était refusé parce que
  l'analyse de code l'avait rangé parmi les projets repris.

### D18 — Voir ce que fait l'agent dans sa visio (2026-10-16)
- Pendant qu'un agent travaille, sa conversation de visio se remplit comme le chat général : « ▶ Au travail : passe N
  (nature) », chaque outil qu'il utilise (fichiers lus, écrits, modifiés en pastilles cliquables, avec leurs
  différences), puis le rapport de la passe et le bilan des fichiers ajoutés, modifiés ou supprimés (lu dans son commit).
- Les sessions d'agents tournent en flux continu (`stream-json`) ; les chemins de son worktree (retiré après la passe)
  sont montrés dans le dossier du projet : les différences sont visibles tout de suite, le contenu après la fusion.

### D19 — Un seul réglage : celui du profil de l'agent (2026-10-16)
- Dans la visio d'un agent, le mode de permission et le modèle choisis dans la conversation **s'écrivent dans son
  profil** ; le pipeline lit le même réglage. Plus de mode « de conversation » qui contredit celui du profil.
- Libre reste confirmé une fois dans la conversation (spec 014 D8) : tant qu'il ne l'est pas, la conversation parle en
  « Écrire sans demander », même si le profil est en Libre (le pipeline, lui, l'applique).

### D20 — Un agent qui n'a pas pu travailler n'est pas « fini » (2026-10-16, premier vrai lancement sur Bike_cycle)
- **Écritures refusées** : si les outils d'un agent ont été refusés (mode de permission de son profil, personne pour
  répondre en `claude -p`) et qu'il n'a rien changé, il s'arrête « en erreur » avec le motif (combien de refus, quel
  mode, quoi changer) ; l'assemblage n'est pas validé.
- **Copie de travail non commitée** : avant le lancement, l'app signale les fichiers non commités (les agents partent
  du dernier commit et ne les voient pas), avec « Ouvrir le Dépôt » pour les commiter d'abord.
- **Rangement** : la mission dit où écrire un brainstorm (`docs/brainstorm/L<niveau><lettre>-<sujet>.md`, avec son
  en-tête) et ses tâches (`docs/TACHES-<Sujet>.md`), pour qu'ils apparaissent dans le Workflow.

### D21 — L'agent se révèle à sa création (2026-10-16)
- Dès « Nouveau profil » ou « ✦ Créer avec Claude », la fiche montre l'**agent minté** : sa chambre-cube où vit son
  personnage, chaque calque (univers, silhouette, yeux, coiffe, objet de métier, chambre) avec sa rareté, et son rang.
  L'objet suit le rôle choisi. La carte se révèle (chambre, puis calques un à un, puis rang).
- L'identifiant du profil est tiré à l'ouverture de la fiche : le personnage montré est celui qui naît.
- « ✦ Créer l'agent » joue l'éclat de la naissance (couleur du rang), puis crée le profil. Mouvement réduit : rien
  d'animé, tout est affiché.

### D22 — La fenêtre de l'agent (2026-10-16, remplace en partie D21)
- Retour de mentalyas : montrer l'agent avant sa création tue l'effet de surprise. La fiche d'un **nouveau** profil ne
  montre plus le personnage ; l'identifiant reste tiré à l'ouverture (le personnage qui naît est bien celui du profil).
- « ✦ Créer l'agent » ouvre la **fenêtre de l'agent** : « Félicitations ! « X » rejoint l'équipe », sa chambre-cube en
  grand (elle domine, les calques restent discrets), révélée, avec des confettis de la couleur de son rang (rien
  d'animé en mouvement réduit). Boutons : « Discuter avec lui », « Modifier le profil », « Fermer ».
- La même fenêtre, sans la fête, s'ouvre au clic sur n'importe quel agent de la gestion des agents.
- « Discuter avec lui » : un tête-à-tête hors de toute tâche (une conversation par profil, sans genesis, clé
  `agent-profile-chat:<profil>`), avec la persona de son profil, dans le dossier de travail de l'app ; il peut y
  proposer des skills comme en visio (D16). La chambre reste à gauche, la conversation à droite.
- La modification d'un profil existant garde sa carte dans la fiche.
- Amendement du 2026-10-16 (retours de mentalyas) : « Discuter avec lui » passe la fenêtre **en visio** (caméra de
  la webcam, bandeau « En visio avec X » et durée de l'appel, tête qui bouge et sous-titres pendant qu'il répond),
  **sans** la chambre en incrustation (retirée aussi de la visio de la carte, même jour). La fenêtre a une **taille
  fixe** en discussion : la conversation défile à
  l'intérieur, rien ne grandit. Derrière l'agent, la webcam filme un **mur de la visio** (le côté ouvert de la
  chambre, caché dans la vue chambre) : même papier peint, cadre au motif du thème, étagère et plinthe aux couleurs de
  l'univers ; il sert aussi à la visio de la carte.
