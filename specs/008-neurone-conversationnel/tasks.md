---
description: "Task list — 008 Neurone conversationnel (lot A)"
---

# Tasks: Neurone conversationnel — lot A (chat d'un neurone)

**Input**: `specs/008-neurone-conversationnel/` · **Prerequisites**: spec 007 (pont MCP)
**Tests**: obligatoires (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>`.
Lots B (entonnoir) et C (bascule) : tâches produites à leur tour.

## Phase 0 : Gouvernance
- [x] T000 Spec, L2/L3 validés par mentalyas (2026-10-04) ; aucune dépendance nouvelle

## Phase 1 : Fondation
- [x] T001 Migration `0018_neuron_conversations` (+ down) : `neurons.session_id`, `session_started`, `sheet_json` ; table `neuron_messages` ; `schemaNeurons.ts`
- [x] T002 [P] Tests purs : `parseStreamLine` (init, delta texte, bloc texte, tool_use, rate_limit_event, result succès/erreur, ligne invalide) dans `tests/unit/conversation/stream-events.test.ts`
- [x] T003 [P] Tests purs : fiche (schéma, fusion de sections, borne 12 000) et bloc de contexte (contenu, borne 24 000) dans `tests/unit/conversation/sheet-context.test.ts`
- [x] T004 `src/main/domain/conversation/streamEvents.ts`, `sheet.ts`, `contextBlock.ts`
- [x] T005 Résolution de `claude` (`claudePath.ts`) et processus `CliConversation.ts` (spawn, lignes stdout, stdin JSON, kill)

## Phase 2 : US1 — outils de fiche et de maturité (pont)
- [x] T006 [P] Tests intégration : `fiche_ecrire` (sections remplacées, Historique `neuron_sheet` annulable, autre arbre refusé, borne), `maturite_evaluer` (ligne d'évaluation → `contextLevel` de la carte), `neurone_contexte` dans `tests/integration/conversation/neuron-tools.test.ts`
- [x] T007 `hello.neuron` (protocole, relais `GI_NEURON_ID`, `PipeServer` → appelant), 3 outils dans `src/shared/mcp/tools.ts`, `NeuronTools.ts`, câblage du gestionnaire d'outils

## Phase 3 : US1 — conversation
- [x] T008 [P] Tests : `ConversationService` avec faux processus — `--session-id` puis `--resume` après un premier tour, contexte joint au seul premier message d'un processus, messages enregistrés (user, assistant, tool), événements émis, un tour à la fois, `stop`, ≤ 3 processus (le plus ancien inactif fermé), `claude` introuvable / non connecté / limite atteinte, arguments fixes (outils restreints, `--setting-sources project`) dans `tests/unit/conversation/conversation-service.test.ts`
- [x] T009 `ConversationService`, `frame.ts`, `ConversationRepository`, `chatHandlers.ts`, `shared/ipc/chat.ts`, canaux et événements, `bootstrap.ts` (arrêt à la fermeture)
- [x] T010 Vérification réelle sans interface (2026-10-04) : vrai `claude` lancé avec les arguments du service — pont connecté, abonnement (`apiKeySource: none`), seuls Read/Glob/Grep/WebSearch + outils du pont disponibles (pas de Bash), flux et quota reçus. L'écriture par le pont attend le redémarrage de l'app (l'instance ouverte tourne sur l'ancien code)

## Phase 4 : US1 — interface
- [x] T011 [P] Tests renderer : panneau de chat (historique, flux de deltas, pastilles, envoi bloqué pendant un tour, Arrêter, erreurs, bandeau de quota, fiche affichée) dans `tests/unit/renderer/chat-panel.test.tsx`
- [x] T012 `src/renderer/src/chat/` (`ChatPanel`, `useChat`), double-clic sur une idée → chat dans le volet, `uiStore` (`chatNeuronId`), résumé de fiche sur `NeuronNode` (`CanvasNeuronView.sheetSummary`)

## Phase 4b : Ajouts demandés par mentalyas (2026-10-04)
- [x] T015 Ollama ne brainstorme plus : clic ou double-clic sur une idée → conversation Claude Code ; plus de développement automatique à l'ouverture de l'ancien panneau (accessible par le menu de l'idée) ; tests adaptés
- [x] T016 Consommation dans le chat : abonnement (session 5 h, semaine — dernier relevé `rate_limit_event`, gardé dans `settings`) et Brainstormer (jetons et échanges : semaine, total, neurone — `ai_calls` kind `conversation`, coût nul) ; `UsageMeter`
- [x] T017 Dossier de projet lié : migration `0019_neuron_project_dir` (+ down) ; « Lier un dossier de projet… » (chat et menu de l'idée) → sélecteur natif du main ; la conversation s'ouvre dans ce dossier (lecture du CLAUDE.md, des docs et du code), nouvelle session, fiche gardée ; dossier disparu → message
- [x] T018 Nom du canal du pont indépendant de la forme du chemin du profil (`C:/…` = `C:\…`)

## Phase 5 : Finitions
- [x] T013 typecheck, lint, tests, build ; JOURNAL ; CLAUDE.md
- [x] T014 Test manuel guidé — validé par mentalyas (2026-10-04) : chat, contexte de projet récupéré via un dossier lié
