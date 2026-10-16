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
- Vue animée des agents sur la carte (T006) : brainstorm à part, après le planificateur.
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
  son **volet** (profil, passe en cours, rapport, conversation). Le design des nœuds reste à définir (T006).

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
