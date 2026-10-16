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

- [ ] T006 Agents en nœuds du canevas, volet au clic (design à définir, D10) ; vue animée : liens entre eux, progression, couleurs validation/erreur, clic = chat, nœud vert à la validation

## Lot 4 — Extensions

- [ ] T007 Étendre à un module entier : le PO répartit les sous-nœuds dont la doc est prête entre les agents connectés
- [ ] T008 Personnages évolutifs des agents (idée à part, sans impact fonctionnel, à faire en dernier)
