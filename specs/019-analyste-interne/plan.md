# Implementation Plan: Analyste interne (spec 019)

**Branch**: `main` (spec `019-analyste-interne`) | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

## Summary

Donner au Brainstormer, quand il tourne depuis son dépôt source désigné, une **sonde** qui enregistre son
fonctionnement et son usage **sans contenu** (catalogue fermé, pseudonymes et empreintes HMAC à clé locale), un
**Analyste** (tâche `analyste` de l'`AIGateway`, `claude -p` avec les seuls outils `Read Glob Grep` dans le dépôt) qui
transforme un résumé de ces observations et l'analyse statique du dépôt (spec 017) en **propositions vérifiées**, une
**boîte Analyste** et des badges sur la carte de structure pour les trier, puis un circuit **Appliquer** : worktree
`analyste/*`, conversation Claude Code limitée au worktree, commit, vérifications `npm`, garder (fusion `--no-ff`, sans
push) / jeter / annuler (`git revert`). Un **rythme** automatique optionnel lance l'analyse.

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron (main, preload, renderer), React, React Flow, Zod, Drizzle ; Node `crypto` (HMAC) ;
git (`GitCli.runGit`, spec 016) ; **npm** (résolu par chemin absolu, constitution 4.2.0 I) ; Claude Code (`claude -p`)
via `AIGateway` (tâche) et `ConversationService` (codage). **Aucune dépendance npm nouvelle.**
**Storage**: migration `0030_analyste` (+ down) : tables `observations`, `analyses`, `proposals`, `analyst_updates`,
colonnes `input_fp` / `output_fp` sur `ai_calls` (data-model.md) ; réglages dans la table clé/valeur existante ; clé
HMAC dans `SecretStore`
**Testing**: Vitest — purs (catalogue et liste blanche, empreintes, agrégats, dossier d'analyse, contrôle des
propositions, transitions d'états, ordonnanceur avec horloge simulée, noms de branche) ; intégration (sonde sur un
parcours du profil démo + recherche de ses textes, arguments du CLI d'analyse, git réel sur un dépôt jetable :
worktree, commit, fusion, conflit, jeter, revert, inspection des commandes) ; renderer + axe (boîte, fiche, mise à
jour, réglages, observations, badge)
**Target Platform**: Windows 11, app lancée par `npm run dev` depuis le dépôt (aucun effet dans l'app installée)
**Performance Goals**: rafale de 10 000 événements sans blocage de l'interface > 100 ms (SC-008) ; dossier d'analyse
construit en < 2 s sur 50 000 observations
**Constraints**: 0 texte saisi gardé (SC-001) ; analyse sans écriture ni commande (SC-004) ; 0 push, 0 réécriture
(SC-005) ; noms de branche et chemins générés par l'app ; une analyse et un codage à la fois
**Scale/Scope**: ~22 fichiers main / shared, ~10 renderer ; 1 migration ; 1 fixture d'observations simulées

## Constitution Check (4.2.0)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | Catalogue fermé validé par Zod ; aucun message d'erreur ni texte gardé ; clé HMAC par `SecretStore` ; git et npm par chemin absolu, `shell: false`, arguments fixes, noms générés ; npm limité à `typecheck` / `lint` / `test` / `prettier --check` dans `<repo>/.analyste/worktrees/*` (4.2.0) ; dépôt désigné par dialogue natif + vérifications ; `app.isPackaged` ⇒ rien ; texte des propositions rendu en texte | ✅ |
| II Humain dans la boucle | Codage seulement sur « Accepter » ; garder exige vérifications vertes + confirmation ; commit / fusion / revert sur `analyste/*` seulement, jamais de push ni réécriture (4.2.0) ; commandes de Claude demandées ; demande sans réponse refusée ; rythme = propositions seulement | ✅ |
| III IA cadrée | Tâche `analyste` par l'`AIGateway` ; consigne figée ; dossier balisé = donnée ; sortie Zod fermée puis `ProposalChecker` (chemins, clés, preuves) ; codage = conversation (outils de Claude Code selon le mode) | ✅ |
| IV Local d'abord | Observations locales ; seuls des agrégats partent chez Claude ; tâche `analyste` seule tâche avec outils, lecture seule dans le dépôt (4.2.0) ; refus de lecture de `%APPDATA%` vérifié (research R1, bloquant) ; usage journalisé dans `ai_calls` | ✅ (R1 à prouver) |
| V Tests | Toute logique pure testée ; git réel sur dépôt temporaire ; CLI et npm simulés ; horloge injectable | ✅ |
| VI Simplicité | Aucune dépendance ; réutilise logger, registre IPC, `AIGateway`, `ConversationService`, `GitCli`, analyse 017, carte 009 ; pas de nouvelle fenêtre | ✅ |

## Project Structure

```text
src/shared/analyste/events.ts                      catalogue fermé (union Zod par événement, énumérations)
src/shared/ipc/analyste.ts                         vues et contrats (observations, analyses, propositions, mises à jour)
src/main/domain/analyste/                          pur : fingerprint.ts (JSON canonique + HMAC), aggregate.ts
                                                   (agrégats → clés obs:*), dossier.ts (construction bornée),
                                                   proposalCheck.ts, transitions.ts (états proposition / mise à jour),
                                                   branchName.ts, schedule.ts (décision du rythme)
src/main/application/analyste/ProbeService.ts      file, lots, purge, activation, vue des observations
src/main/application/analyste/RepoGuard.ts         désignation + vérifications du dépôt source
src/main/application/analyste/AnalysteService.ts   analyse (verrou, dossier, tâche, contrôle, enregistrement)
src/main/application/analyste/UpdateService.ts     worktree, conversation, commit, vérifications, garder/jeter/annuler
src/main/application/analyste/RhythmService.ts     minuterie persistée, conditions, notification
src/main/application/ai/AnalysteTask.ts            tâche `analyste` (schéma de sortie, consigne)
src/main/infrastructure/ai/AnalysteFrame.ts        consigne figée « Analyste interne »
src/main/infrastructure/ai/ClaudeCliProvider.ts    + option `tools: 'read-only'` + `cwd` (refusée hors tâche analyste)
src/main/infrastructure/analyste/NpmCli.ts         npm par chemin absolu, scripts fermés, délai
src/main/infrastructure/logging/logger.ts          + `teeSink` (stdout + sonde)
src/main/ipc/registry.ts                           + mesure `ipc.call` dans le dispatcher (sans toucher les routes)
src/main/ipc/analysteHandlers.ts
src/main/infrastructure/db/…                       migration 0030 (+ down), ObservationRepository, AnalysteRepository
src/renderer/src/analyste/probe.ts                 file renderer (lots 2 s / 100), erreurs globales, navigation
src/renderer/src/analyste/AnalystePage.tsx         boîte : onglets, filtres, liste 62 % + volet 38 %
src/renderer/src/analyste/ProposalPanel.tsx, UpdatePanel.tsx, EvidenceList.tsx
src/renderer/src/pages/settings/AnalysteSettings.tsx, ObservationsPage.tsx
src/renderer/src/canvas/nodes/ElementNode.tsx      + badge « N propositions »
tests/fixtures/analyste/observations-semaine.json  semaine simulée (fictive)
.gitignore, tsconfig*, vitest, eslint, prettier    exclure `.analyste/`
```

## Lots
1. **Socle + Sonde (US1)** : migration 0030 ; catalogue ; `teeSink` ; mesure `ipc.call` ; `ProbeService`,
   `RepoGuard` ; file renderer ; Réglages › Analyste + Observations ; garde `isPackaged`. Test SC-001. Test guidé.
2. **Analyse (US2)** : research R1 prouvé ; empreintes dans l'`AIGateway` ; agrégats ; dossier ; tâche `analyste` +
   option lecture seule du provider ; `ProposalChecker` ; `AnalysteService` ; progression. Test guidé.
3. **Tri (US3)** : boîte (onglets, filtres, badge de navigation), fiche (preuves en phrases, liens explorateur),
   décisions, mémoire des refus, « Demander plus », badges sur la carte, « Lier et cartographier ». Test guidé.
4. **Appliquer (US4)** : `NpmCli` ; `UpdateService` (pré-contrôles, worktree, jonction `node_modules`, neurone de mise
   à jour, commit, vérifications, diff, garder, jeter, conflits, nettoyage au démarrage, rechargement) ; « Essayer ».
   Test git réel. Test guidé.
5. **Annuler (US5)** : revert + abort ; onglet Gardées. Test guidé.
6. **Rythme (US6)** : `schedule.ts` + `RhythmService` ; réglages ; notification. Test guidé.
7. **Finitions** : démo (observations simulées dans `seed:demo`), FOUNDATION, CLAUDE.md, JOURNAL ; mesure SC-008.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Première tâche automatique avec outils (lecture) | Repérer code mort, cause d'un bug, ligne fautive exige de lire le code (D5) | Envoyer tout le code dans le prompt : trop gros, non borné ; sans code : propositions vagues |
| Worktree + jonction `node_modules` | L'app ouverte ne doit pas changer sous elle ; réinstaller les dépendances prendrait minutes et disque | Branche dans le dépôt principal : `checkout` change le code de l'app qui tourne |
| `npm` lancé par l'app (amendement I) | « Garder » exige des vérifications prouvées par l'app, pas déclarées par Claude | Laisser Claude les lancer : résultat non vérifiable par l'app |
| Empreintes HMAC + pseudonymes | Repérer répétitions et parcours sans garder de contenu (D2) | Hash simple : un texte court se retrouve par dictionnaire |
