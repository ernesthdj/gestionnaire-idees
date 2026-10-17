# Tâches — Les agents assemblés (Modes de Claude et agents qui communiquent)

> Origine : brainstorm du neurone « Modes de Claude et agents qui communiquent » (2026-10-14), refondu le 2026-10-16 :
> `docs/brainstorm/L1o-agents-assembles.md` (assemblage libre par mentalyas, PO qui ouvre le travail et recommande les
> agents, parallèle sans lien, séquence avec lien, worktree par agent, fusion après accord).

## Lot 1 — Fondations

- [x] T001 Profils d'agents : rôle, mode de permissions, modèle, effort, skills consultables, créés dans la page Skills
- [x] T002 Documents du pipeline : spec signée du PO (ID de tâche, PO seul peut modifier), rapports d'agent, journal par projet et journal global court (taille limitée, condensation)
- [x] T009 Spec du PO : liste des agents recommandés et suggestions de nouveaux agents (rôle, consignes, skills), à partir des profils existants (D1)
- [x] T010 Skills du profil transmis à la session de l'agent ; vérifier d'abord leur chargement avec `--setting-sources ""` (D6)

## Lot 2 — Exécution

- [x] T003 Moteur d'enchaînement : une session `claude -p` par agent, dans l'ordre, sur des branches en chaîne (remplacé par T011)
- [x] T004 QA : vérification contre `main`, merge, renvoi dans la boucle, arrêt au plafond, validation finale (remplacé par T011, T016 et T018)
- [x] T011 Planificateur d'assemblage : agents reliés = à la suite, non reliés = en parallèle ; démarrage quand ceux attendus ont fini et que le contexte est prêt, sinon arrêt avec ce qui manque (D2, D7) ; retirer `PIPELINE_ORDER`
- [x] T012 Un `git worktree` et une branche `agents/<ID-tâche>/<agent>` par agent ; départ de la branche attendue, ou de la fusion de plusieurs ; jamais `--no-verify` ni `git add -A` (D3, D5)
- [x] T016 Boucle QA → PO → agents concernés : rapport d'erreurs du QA au PO, spec réécrite et versionnée, seuls les agents désignés repartent ; aucun plafond imposé (D8)
- [x] T017 Passes indexées : numéro et nature (initiale, correction, repasse) dans la mission, les commits et le rapport ; version de spec citée (D9)
- [x] T018 Un accord unique de fusion pour l'assemblage ; profils en mode « Demander avant d'écrire » signalés à l'assemblage (D11)
- [x] T014 Zones de travail : chaque tâche déclare sa zone ; avertissement et proposition de lien si deux agents en parallèle se chevauchent (D4)
- [x] T005 Connecter un PO à un nœud d'idée, une tâche ou un module, ou un agent seul à une tâche précise sans PO (D12) ; brancher le planificateur au bootstrap et à l'IPC
- [x] T015 Finitions T001–T004 : JOURNAL, Prettier (fins de ligne), `pipeline-engine.test.ts` sous 5 s

## Lot 3 — Visuel

- [x] T006 Agents en nœuds du canevas, volet au clic (design à définir, D10) ; vue animée : liens entre eux, progression, couleurs validation/erreur, clic = chat, nœud vert à la validation ; connectés aux nœuds du Workflow seulement, appelés au clic droit (D14)

## Lot 4 — Extensions

- [x] T019 Créer un profil d’agent avec Claude : conversation et fiche côte à côte, skills choisis par Claude, brouillons des skills manquants sur accord (D15)
- [x] T020 Peaufiner les skills d’un agent en visio : il propose d’ajouter ou de retirer (Accepter / Refuser dans le volet), brouillons à installer depuis le volet (D16)
- [ ] T007 Étendre à un module entier : le PO répartit les sous-nœuds dont la doc est prête entre les agents connectés (remplacé par le lot 5, D25)
- [x] T008 Personnages évolutifs des agents : chambre-cube 3D posée librement sur la carte, personnage tiré du profil, chambre enrichie par le travail livré, clic = visio et conversation avec l’agent (D13)
- [x] T030 Tiroir « Agents » : cartes d'identité des profils (tête, nom, rôle, rang), glissées sur la carte (agent libre), puis reliées par un lien à une tâche ou un nœud du Workflow (D26)

## Lot 5 — Le PO cadre un lot, l'équipe l'enchaîne (D25)

- [x] T021 Spec de lot : PO connecté à un lot ou un fichier de tâches ; une section par tâche (critères, complexité) ; une ligne d'aiguillage par tâche (agents, qui attend qui) et un conseil de rythme justifié, lus par l'app
- [ ] T022 Équipe du lot recommandée dans la visio du PO : cartes « Connecter ‹profil› » et « Créer ‹agent› » (création préremplie puis fenêtre de l'agent) ; rien sans clic
- [x] T023 Aiguillage automatique : agents et liens de chaque tâche tirés du plan du PO, modifiables dans « Qui attend qui » (le choix de mentalyas prime)
- [ ] T024 (repris par T013 de docs/TACHES-PIPELINE.md, L2-pipeline-optimal D8) Enchaînement : « Une à une » (accord de fusion après chaque tâche) ou « Tout le lot » (branche d'intégration du lot, un accord final) ; chaque tâche cochée à la fusion ; tâches indépendantes en parallèle, groupe par groupe en « Une à une » (D28)
- [x] T031 Consigne du PO : « A attend B » seulement si A a besoin du résultat de B ; agents indépendants en parallèle, le QA attend ceux qui codent ; groupes visibles dans « Qui attend qui » (« Front ∥ Back → QA ») (D28)
- [x] T032 Dépendances entre tâches : « après T002 » dans la ligne d'aiguillage, lues par `parseLotPlan`, retouchables dans « Qui attend qui » ; groupes de tâches indépendantes, dépendance inconnue ou en boucle ignorée et signalée ; un QA par tâche (D28)

## Lot 6 — Lire les profils d'agents (L2-agents-lire.md) — ébauches, maturité « suffisant »

- [x] T025 Contrat de l'outil `agents_lire` : entrées (aucune, ou `agent`), champs rendus, sources et leur nom, cas d'erreur · agent : architecte · dépend de : rien · fini : contrat écrit et relu, couvre US1 à US4
- [x] T026 Outil `agents_lire` en lecture seule : profils de l'app, `.claude/agents/` du projet et `~/.claude/agents/`, mode liste et mode détail, sources absentes ou illisibles signalées · agent : thor (backend) · dépend de : T025 · fini : CA1.1 à CA3.4 et CA4.2 vérifiés par des tests verts
- [x] T027 Ouvrir `agents_lire` aux conversations de neurone, visios d'agent, tête-à-tête de profil et « Créer avec Claude » · agent : thor (backend) · dépend de : T026 · fini : CA4.1 vérifié par un test vert
- [x] T028 Scénarios QA depuis les CA de L2-agents-lire.md, puis exécution et rapport · agent : qa-qualite · dépend de : rien pour les scénarios, T027 pour l'exécution · fini : rapport QA, verdict sur chaque CA
- [ ] T029 (ébauche) Skill `po-passation` : l'inventaire du mode Conseil passe par `agents_lire` (retirer « s'il existe ») · agent : PO · dépend de : T026 · fini : brouillon de skill déposé et installé par mentalyas
