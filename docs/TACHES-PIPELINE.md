# Tâches — Le pipeline en cinq phases

> Origine : `docs/brainstorm/L2-pipeline-optimal.md` (2026-10-17, maturité « complet »).

## Lot 1 — Vérifier par des faits

- [ ] T001 Commandes de vérification écrites par l'Architecte dans son contrat ; carte de validation par mentalyas (Valider / Modifier / Refuser) avant le départ des développeurs ; gardées avec le projet (D2, CA1.0) · agent : backend + frontend · dépend de : T006
- [ ] T002 Lancer les vérifications dans le worktree d'un agent après sa passe : sans shell, par chemin, délai et sortie bornés ; résultat gardé avec la passe (D2, CA1.1, CA1.4) · agent : backend · dépend de : T001
- [x] T003 Reprise de session d'un agent d'un tour à l'autre (`--resume`), vérifiée avec `--setting-sources ""` (D3) · agent : backend · dépend de : rien
- [ ] T004 Boucle rapide sans plafond : vérification rouge → le même développeur repart avec le log, dans sa session reprise (D3, CA1.2, CA1.3) · agent : backend · dépend de : T002, T003
- [ ] T005 [visuel] Résultats des vérifications dans la visio de l'agent et dans « Travail » (D2) · agent : frontend · dépend de : T002

## Lot 2 — Contrat et intégration

- [ ] T006 Étape Architecte : `contrat.md` (format `archi-contrat`), zones et aiguillage technique, renvoi au PO si la spec a un trou (D1, CA2.1–CA2.3) · agent : backend · dépend de : rien
- [ ] T007 Branche d'intégration d'une tâche : fusion des développeurs verts, vérifications sur le résultat fusionné, échec renvoyé au bon développeur (D4, CA3.1) · agent : backend · dépend de : T002
- [ ] T008 Conflit de fusion résolu par le développeur en conflit (session reprise, diff de l'autre côté), Architecte en recours (D4, CA3.2) · agent : backend · dépend de : T003, T007

## Lot 3 — Revue et fusion

- [ ] T009 QA sur intégration verte seulement, verdict trié (code / contrat / spec), amendement du document au lieu d'une réécriture (D5, CA4.1, CA4.2) · agent : backend · dépend de : T006, T007
- [ ] T010 Taille du pipeline selon la complexité (QA toujours), retouchable dans « Qui attend qui » (D6, CA5.1, CA5.2) · agent : backend + frontend · dépend de : T006
- [ ] T011 [visuel] Recommandation de fusion à côté du bouton (D7, CA6.1) · agent : frontend · dépend de : T009
- [ ] T012 Contexte par rôle et résumé des rapports en reprise (D9) · agent : backend · dépend de : T006

## Lot 4 — Lancer un lot

- [ ] T013 Un lot dans ce pipeline : sous-assemblage par tâche, groupes sans limite, un agent sur plusieurs tâches, rythme « une à une » / « tout le lot » (D8, CA7.1, CA7.2 ; remplace T024 de TACHES-AGENTS) · agent : backend + frontend · dépend de : T004, T007, T009
- [ ] T014 Sessions d'agent : vérifier ce qu'elles chargent, puis `--strict-mcp-config` avec le seul pont du Brainstormer, identité de l'agent, outils choisis (D11) · agent : backend · dépend de : rien

## Lot 5 — Consommation et bilan

- [x] T015 Relevé par passe : tokens (entrée, sortie, cache), coût indicatif, durée, tours, outils, raison du tour, tirés du flux de la session (D10) · agent : backend · dépend de : rien
- [ ] T016 [visuel] Jauge animée vert / jaune / orange / rouge par boucle, tâche et lot, seuils relatifs à la médiane du rôle (D12) : chambre de l'agent, visio, suivi du lot (D10, CA8.1) · agent : frontend · dépend de : T015
- [ ] T017 Historique archivé par lot et par tâche, consultable après exécution : quoi, où, pourquoi (D10, CA8.2) · agent : backend + frontend · dépend de : T015
- [ ] T018 Bilan d'un lot par Claude : améliorations du pipeline et des agents en cartes Accepter / Refuser (D10, CA8.3) · agent : backend + frontend · dépend de : T017
