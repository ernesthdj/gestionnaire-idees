# Niveau 2 — Le pipeline en cinq phases (conception, architecture, exécution, boucle rapide, fusion)

**Parent** : L1o-agents-assembles.md · **Maturité** : complet · **Tâches** : docs/TACHES-PIPELINE.md

> Projet : Gestionnaire_idées · Basé sur : analyse du pipeline actuel (`PipelineEngine.ts`, `AgentSession.ts`,
> `AssemblyService.ts`) et workflow en cinq phases proposé par mentalyas, conversation du 2026-10-17 · Date : 2026-10-17
>
> Complet le 2026-10-17 : les six questions ouvertes ont leur réponse (§ 8).

## 1. Objectif
Faire du pipeline d'agents un vrai pipeline d'ingénierie : le PO dit **quoi**, l'Architecte dit **comment** (contrat
figé avant le parallèle), les développeurs travaillent en parallèle, l'app **vérifie par des faits** (tests lancés par
elle) et renvoie directement l'erreur à qui l'a faite, le QA juge ce que les tests ne couvrent pas, et mentalyas fusionne.
Moins de tours inutiles, moins de tokens, plus de qualité ; la taille du pipeline suit celle de la tâche.

## 2. Constat (pipeline actuel)

### Forces à garder
- Un worktree et une branche par agent ; rien sur `main` sans l'accord de mentalyas ; fichiers ajoutés par leur nom,
  jamais `--no-verify`.
- Ordonnancement en graphe (un agent part quand ceux qu'il attend ont fini ; sans lien, en parallèle), git en file.
- Traçabilité : spec versionnée, rapports, journal, passes numérotées, commits étiquetés.
- Un accord unique de fusion, dans un worktree temporaire (un conflit ne change rien).
- Sessions sûres : arguments fixes, aucun réglage ni hook chargé, consigne par l'entrée standard.
- Profils riches (modèle, effort, permissions, skills en plugin) ; pannes contenues (un agent arrêté bloque ceux qui
  l'attendent, motif clair).

### Faiblesses
1. **Agents sans mémoire** : chaque passe ouvre une session neuve ; une correction repart de zéro.
2. **Aucun échange pendant le travail** : tout passe par des fichiers, en fin de passe ; un agent qui doute devine.
3. **Le PO est un goulot** : tout renvoi réécrit la spec entière, puis une ligne `AGENTS:` stricte (sinon arrêt).
4. **QA binaire et tardif** : un verdict texte en fin de chaîne ; il ne distingue pas erreur de code et spec ambiguë.
5. **Aucune vérification par l'app** : le moteur ne lance que git ; tout repose sur le jugement du QA.
6. **Boucle QA ↔ PO sans plafond** : un désaccord tourne jusqu'à l'annulation.
7. **Conflits non traités** : un conflit entre branches attendues arrête l'agent.
8. **Contexte mal calibré** : brief mince au départ, rapports entiers des autres en reprise.
9. **Suivi en mémoire** : l'app fermée, l'assemblage perd son état (les branches restent).
10. **(supposé, à vérifier)** les sessions d'agent n'ont pas `--strict-mcp-config` : elles chargeraient les serveurs
    MCP personnels de mentalyas, dont le Brainstormer, sans identité de conversation.

## 3. Le workflow retenu

```
[1 Conception]     PO ──► spec fonctionnelle (critères d'acceptation, complexité, aiguillage)
                    ▲ trou dans la spec
[2 Architecture]   Architecte ──► contrat figé (API, modèle de données, interfaces, découpage, zones)
                    ▲ contrat faux
[3 Exécution]      Dev A ∥ Dev B ∥ …  (worktree + branche chacun, session reprise d'un tour à l'autre)
                      │ après chaque dev : l'APP lance les vérifs du projet (tests, typecheck, lint)
                      │   échec → log d'erreur direct au dev concerné (boucle rapide, consommation suivie)
                      ▼
[3b Intégration]   l'APP fusionne les branches sur la branche d'intégration et relance les vérifs
                      │   conflit → le dev en conflit le résout ; échec → retour au dev concerné
                      ▼
[4 Revue]          QA (tests verts) : critères d'acceptation, régressions, cas oubliés
                      │   erreur de code → dev · contrat faux → Architecte · spec ambiguë → PO
                      ▼
[5 Fusion]         recommandation résumée ──► accord de mentalyas ──► main (cases cochées)
                      ▼
[6 Bilan]          historique de consommation du lot ──► ce qui a coûté et pourquoi ──► améliorations
```

## 4. Décisions

### D1 — Le PO dit quoi, l'Architecte dit comment (2026-10-17)
- Le PO garde la spec fonctionnelle (critères d'acceptation, hors périmètre, complexité), l'équipe recommandée et le
  conseil de rythme.
- Nouvelle étape **Architecte** entre le PO et les développeurs : contrat écrit dans `docs/pipeline/<tâche>/contrat.md`
  (format du skill `archi-contrat` : décisions, signatures, schémas, interfaces figées pour le parallèle, fichiers par
  agent, risques, matrice critère → vérification). Il fixe aussi les **zones** de chaque développeur et l'aiguillage
  technique (qui attend qui) ; le PO ne fait plus que proposer l'équipe.
- Les développeurs lisent la spec **et** le contrat ; ils ne modifient ni l'un ni l'autre.
- L'Architecte qui trouve un trou dans la spec la renvoie au PO (avec la question précise) avant d'écrire le contrat.

### D2 — L'app lance les vérifications, pas un agent (2026-10-17, précisé le même jour)
- Les **commandes de vérification** (ex. `npm run typecheck`, `npm run lint`, `npm test`) sont écrites par
  l'**Architecte dans son contrat** (choix de mentalyas), dans une section dédiée, une commande par ligne.
- mentalyas les **vérifie et les valide à ce moment-là** : le pipeline attend son accord (carte « Commandes de
  vérification » : la liste exacte, Valider / Modifier / Refuser) avant que les développeurs partent. Sans accord, rien
  n'est lancé. Une commande validée pour ce projet n'est pas redemandée tant qu'elle ne change pas.
- En complexité basse (sans Architecte, D6), les dernières commandes validées du projet servent ; s'il n'y en a pas,
  mentalyas les saisit au lancement.
- Lancées par l'app dans le worktree de l'agent après chacune de ses passes : programme par chemin, `shell: false`,
  arguments fixes, délai maximal, sortie bornée. Jamais une commande écrite par un agent.
- Le résultat (vert, ou log d'erreur réduit aux échecs) est gardé avec la passe et montré dans la visio de l'agent.

### D3 — Boucle rapide : l'échec va droit au développeur (2026-10-17, précisé le même jour)
- Vérifications rouges après la passe d'un développeur : **lui** repart aussitôt, avec le log d'erreur, sans passer par
  le QA ni le PO.
- **Pas de plafond** (choix de mentalyas) : la boucle continue ; à la place, sa **consommation se voit** en direct
  (D10), et mentalyas l'arrête s'il le juge (« Arrêter », comme aujourd'hui).
- Le développeur **reprend sa session** (`--resume`) d'un tour à l'autre : il garde son raisonnement et son contexte.

### D4 — Intégration par l'app (2026-10-17)
- Quand les développeurs d'une tâche ont fini (vérifications vertes), l'app fusionne leurs branches sur
  `agents/<tâche>/integration` et relance les vérifications **sur le résultat fusionné** (chaque branche peut passer
  seule et casser une fois réunie).
- Échec après fusion : le log va au développeur dont les fichiers sont en cause (d'après les fichiers du log), sinon à
  l'Architecte.
- Conflit de fusion (tranché par Claude, à la demande de mentalyas) : le **développeur dont la branche entre en
  conflit** le résout, dans sa **session reprise** (D3), sur sa branche mise à jour avec l'intégration ; il reçoit le
  diff de l'autre côté, la spec et le contrat ; l'app revérifie. Il connaît son code et garde son raisonnement : pas de
  nouveau profil. L'**Architecte** prend la main si le conflit touche une interface fixée par le contrat, ou si la
  résolution laisse les vérifications rouges. Pas d'agent « Git Manager » : le git reste fait par l'app.

### D5 — Le QA juge ce que les tests ne couvrent pas, et trie (2026-10-17)
- Le QA ne passe que sur une intégration **verte** ; il vérifie les critères d'acceptation, les régressions, les cas
  oubliés, contre la spec et le contrat, sur le diff de l'intégration.
- Son verdict classe chaque erreur : `code` (→ développeur nommé), `contrat` (→ Architecte), `spec` (→ PO). Le PO et
  l'Architecte **amendent** leur document (sections touchées, version suivante) au lieu de le réécrire en entier.
- Les renvois du QA n'ont pas de plafond non plus ; leur consommation entre dans la jauge de la tâche (D10).

### D6 — La taille du pipeline suit la tâche (2026-10-17, précisé le même jour)
- Le **QA est toujours là** (choix de mentalyas) : il juge ce que les tests ne couvrent pas, même sur une petite tâche.
- Complexité **basse** (notée par le PO) : un développeur, la boucle rapide, le QA ; pas d'Architecte (commandes de
  vérification du projet, D2). **Moyenne** : les développeurs choisis, le QA ; un contrat de l'Architecte seulement si
  plusieurs développeurs travaillent en parallèle. **Haute** : la chaîne complète.
- Proposé par le PO dans l'aiguillage, modifiable par mentalyas dans « Qui attend qui » (son choix prime).

### D7 — mentalyas fusionne, toujours (2026-10-17)
- Le PO (ou l'Architecte) rédige une **recommandation de fusion** : ce qui est fait, vérifications, points
  d'attention, risques. Elle s'affiche à côté du bouton ; la fusion sur `main` reste le clic de mentalyas (règle du
  CLAUDE.md et de la constitution).

### D8 — Un lot dans ce pipeline (2026-10-17, remplace T024 de TACHES-AGENTS)
- Une tâche du lot = un sous-assemblage (`<lot>-T004`) qui suit D1 à D7 ; spec de la tâche = sa section de la spec du
  lot ; contrat par tâche.
- Les groupes de tâches indépendantes (L1o D28) partent ensemble, **sans limite** de nombre (choix de mentalyas) ; un
  même agent peut travailler sur deux tâches à la fois (une session par tâche, choix de mentalyas).
- Rythme (L1o D28) : « une à une » groupe par groupe, un accord par tâche ; « tout le lot » : chaque tâche validée
  rejoint `agents/<lot>/lot`, les groupes suivants en partent, un accord final.

### D10 — Consommation visible, archivée, et bilan du lot (2026-10-17, demande de mentalyas)
- **En direct** : chaque boucle (un développeur et ses tours, une tâche, le lot) a une **jauge animée et ludique** dont
  la couleur dit le coût : **vert** économique, **jaune** moyen, **orange** inquiétant, **rouge** hors de prix. Visible
  sur la chambre de l'agent (sa boucle en cours), dans la visio, et dans le suivi du lot.
- **Relevé** : pour chaque passe, l'app garde ce que la session rend (tokens d'entrée, de sortie, de cache, coût
  indicatif, durée, nombre de tours de boucle, outils appelés, raison du tour : initiale, correction, renvoi du QA…).
- **Archivé** : un historique par lot et par tâche, consultable après l'exécution (Historique, ou le nœud du lot) : ce
  qui a coûté, où (agent, phase, tour), et **pourquoi** (log d'erreur qui a relancé, renvoi du QA, conflit…).
- **Bilan** : à la demande, Claude lit l'historique d'un lot et propose des **améliorations** — du pipeline (taille,
  ordre, vérifications) ou des **agents** (consignes, skills, modèle, effort) — en cartes Accepter / Refuser ; une
  amélioration d'agent passe par sa fiche (comme L1o D16), jamais appliquée sans clic.

### D11 — Un accès MCP choisi pour les agents (2026-10-17, accord de mentalyas)
- Les sessions d'agent ne chargent plus les serveurs MCP personnels de mentalyas (`--strict-mcp-config`) : seul le
  **pont du Brainstormer** leur est donné, avec l'**identité de l'agent** (sa tâche, son profil) pour que l'app sache
  qui appelle.
- Outils ouverts, en **lecture** : `agents_lire`, `carte_lire`, `noeud_lire`, `structure_lire`, `code_graphe_lire`,
  `document_lire`. En écriture, seulement ce qui sert le pipeline et reste annulable : `widget_poser` relié à **sa**
  tâche (spec 026 D10). Aucun outil qui écrit ailleurs sur la carte.
- À vérifier d'abord (T014) : ce que charge aujourd'hui une session d'agent (point 10 du constat).

### D12 — Les seuils de la jauge (2026-10-17, validé par mentalyas)
- **Unité** : la part de la jauge des 5 h de l'abonnement consommée par la boucle (ce qui bloque mentalyas quand elle
  se vide).
- **Repère relatif** à l'historique du projet, par rôle : **vert** jusqu'à la médiane des boucles passées du même rôle,
  **jaune** jusqu'à 2 × la médiane, **orange** jusqu'à 4 ×, **rouge** au-delà. La couleur dit « plus cher que
  d'habitude ».
- **Au départ** (moins de 5 boucles archivées pour ce rôle) : seuils fixes à 2 %, 5 % et 10 % de la jauge des 5 h.

### D9 — Contexte par rôle (2026-10-17)
- PO : nœud, documents liés, profils. Architecte : spec, code concerné (graphe de code s'il existe). Développeur :
  spec de sa tâche, contrat, sa zone. QA : spec, contrat, **diff** de l'intégration, résultats des vérifications.
- En reprise : le **résumé** des rapports des autres (pas leur texte entier).

## 5. User stories et critères d'acceptation

### US1 — Vérifier par des faits (D2, D3)
- **CA1.0** Étant donné un contrat de l'Architecte avec ses commandes de vérification, alors le pipeline attend que
  mentalyas les valide (liste exacte affichée) avant de lancer les développeurs ; refusées, rien n'est lancé.
- **CA1.1** Étant donné des commandes validées, quand un développeur finit sa passe, alors l'app les lance dans son
  worktree et garde le résultat avec la passe.
- **CA1.2** Étant donné une vérification rouge, quand la passe se termine, alors le même développeur repart avec le log
  d'erreur, dans sa session reprise, sans passe du QA ni du PO.
- **CA1.3** Étant donné des tours rouges qui s'enchaînent, alors la boucle continue sans plafond et sa jauge de
  consommation passe du vert au rouge selon son coût ; « Arrêter » l'interrompt.
- **CA1.4** Étant donné une commande de vérification, alors elle est lancée sans shell, par chemin, avec un délai
  maximal ; une commande proposée par un agent n'est jamais lancée.

### US2 — Un contrat avant le parallèle (D1)
- **CA2.1** Étant donné une tâche de complexité haute, quand le PO a signé la spec, alors l'Architecte écrit
  `contrat.md` avant que les développeurs partent.
- **CA2.2** Étant donné un trou dans la spec, alors l'Architecte la renvoie au PO avec sa question, sans écrire de contrat.
- **CA2.3** Étant donné un contrat, alors chaque développeur le reçoit avec sa zone, et les zones fixées par
  l'Architecte remplacent celles déclarées à la main (signalé).

### US3 — Intégrer avant de juger (D4)
- **CA3.1** Étant donné deux développeurs aux vérifications vertes, alors l'app fusionne leurs branches sur la branche
  d'intégration et relance les vérifications.
- **CA3.2** Étant donné un conflit de fusion, alors le développeur dont la branche entre en conflit le résout dans sa
  session reprise ; résolu et vert, le pipeline continue ; conflit sur une interface du contrat, ou vérifications
  rouges après résolution : l'Architecte prend la main.

### US4 — Un QA qui trie (D5)
- **CA4.1** Étant donné une intégration rouge, alors le QA ne passe pas.
- **CA4.2** Étant donné un renvoi du QA, alors chaque erreur va à son destinataire (développeur, Architecte, PO) et seuls
  eux repartent ; le PO et l'Architecte amendent leur document (version suivante).

### US5 — Le bon pipeline pour la bonne tâche (D6)
- **CA5.1** Étant donné une tâche de complexité basse, alors un développeur, les vérifications et le QA tournent,
  sans Architecte.
- **CA5.2** Étant donné une retouche de mentalyas dans « Qui attend qui », alors elle prime sur la taille proposée.

### US6 — Fusionner en connaissance de cause (D7)
- **CA6.1** Étant donné un assemblage validé, alors une recommandation de fusion s'affiche à côté du bouton ; rien ne va
  sur `main` sans le clic de mentalyas.

### US8 — Voir ce que coûte un lot, et l'améliorer (D10)
- **CA8.1** Étant donné une boucle en cours, alors sa jauge (vert, jaune, orange, rouge) suit sa consommation en direct
  sur la chambre de l'agent, dans la visio et dans le suivi du lot.
- **CA8.2** Étant donné un lot terminé, alors son historique montre, par tâche, agent, phase et tour, ce qui a été
  consommé et la raison de chaque tour.
- **CA8.3** Étant donné un historique de lot, quand mentalyas demande le bilan, alors Claude propose des améliorations
  du pipeline ou des agents en cartes Accepter / Refuser ; rien n'est appliqué sans clic.

### US7 — Lancer un lot (D8)
- **CA7.1** Étant donné un lot aiguillé, quand mentalyas le lance, alors chaque tâche devient un sous-assemblage et les
  tâches indépendantes partent ensemble.
- **CA7.2** Étant donné le rythme « tout le lot », alors chaque tâche validée rejoint la branche du lot et un seul accord
  fusionne le tout ; « une à une » : un accord par tâche, le groupe suivant après la fusion du groupe.

## 6. Hors périmètre
- Un agent « Git Manager » : le git reste fait par l'app.
- Une fusion sur `main` décidée par un agent.
- Les tests de bout en bout qui demandent une interface graphique ou un service externe (pas lançables sans tout
  installer) : listés comme « non vérifiés » dans la recommandation de fusion.

## 7. Contraintes et risques
- **Sécurité** : les commandes de vérification s'exécutent sur le poste ; validées par mentalyas une fois, lancées sans
  shell, dans le worktree, avec un délai et une sortie bornés. Un dépôt repris non fiable peut cacher du code dans ses
  tests : rappel à la validation.
- **Coût** : la boucle rapide sans plafond et le parallèle sans limite consomment l'abonnement ; la jauge de chaque
  boucle (D10) et les jauges 5 h / 7 j le montrent, mentalyas arrête. Risque : un lot lancé sans surveillance peut
  vider la jauge des 5 h.
- **Temps** : des tests longs rallongent chaque tour ; délai réglable par projet.
- **Reprise de session** (`--resume`) : à vérifier avec `claude -p` et `--setting-sources ""` (D3).

## 8. Questions ouvertes
1. ~~Plafond de la boucle rapide~~ → pas de plafond, consommation visible et archivée (D3, D10).
2. ~~Qui écrit les commandes de vérification~~ → l'Architecte dans son contrat, validées par mentalyas à ce moment (D2).
3. ~~Qui résout les conflits~~ → le développeur en conflit, l'Architecte en recours (D4, tranché par Claude).
4. ~~QA en complexité basse~~ → toujours un QA (D6).
5. ~~MCP dans les sessions d'agent~~ → un accès choisi au pont du Brainstormer, avec l'identité de l'agent (D11).
6. ~~Seuils de la jauge~~ → part de la jauge des 5 h, relatif à la médiane du rôle, seuils fixes au départ (D12).

## 9. Équipe recommandée
- **Architecte** : écrire le contrat de ce brainstorm (formats de `contrat.md`, des verdicts triés, des commandes de
  vérification, de l'accès MCP des agents).
- **Backend** (« thor ») : moteur (boucle rapide, intégration, reprise de session, tri des renvois).
- **Frontend** : visio (résultats des vérifications), « Qui attend qui » (taille du pipeline), recommandation de fusion.
- **QA** : scénarios depuis les critères d'acceptation ci-dessus.
