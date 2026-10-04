# Implementation Plan: Neurone conversationnel (lot A — chat d'un neurone)

**Branch**: `008-neurone-conversationnel` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

## Summary
Double-clic sur une idée → panneau de chat. Le main lance une vraie conversation Claude Code (`claude -p` en flux
`stream-json`, session reprise), relaie le flux à l'interface, garde l'historique ; Claude écrit la fiche et la maturité
du neurone par trois nouveaux outils du pont MCP, qui connaît le neurone courant (`GI_NEURON_ID`). Détail : research.md.

## Technical Context
**Language/Version**: TypeScript 5 strict · Node 24 / Electron 44
**Primary Dependencies**: existantes (aucune nouvelle) ; CLI Claude Code 2.1.289+ (externe)
**Storage**: SQLite chiffré ; migration `0018_neuron_conversations` (+ down)
**Testing**: Vitest — parseur du flux (pur), contexte joint (pur), `ConversationService` avec un faux processus,
outils de fiche/maturité (intégration, base réelle), panneau de chat (renderer)
**Target Platform**: Windows 11
**Performance Goals**: premier texte < 5 s (SC-001) ; deltas relayés sans regroupement perceptible
**Constraints**: ≤ 3 processus ; contexte joint ≤ 24 000 car. ; fiche ≤ 12 000 car.

## Constitution Check (2.0.0) — PASS
| Principe | Vérification |
|----------|--------------|
| I | Seul `claude` (chemin résolu par le main), arguments fixes, `shell: false`, texte par stdin ; IPC `chat:*` validés Zod ; rendu texte |
| II | Écritures de fiche « par Claude » annulables (Historique) |
| III | Sorties des outils validées (Zod) ; aucun rôle imposé, cadre = contexte de l'app |
| IV | Claude via le CLI officiel ; outils restreints (`--tools`, `--allowedTools`, `--permission-prompts none`) ; aucun appel API |
| V | Logique pure testée ; processus simulé dans les tests (aucun `claude` réel) |
| VI | Réutilise jauge (`context_assessments`), Historique, pont ; pas de dépendance nouvelle |

## Project Structure
```text
src/main/domain/conversation/
├── streamEvents.ts      # ligne JSON du CLI → événement de conversation (pur)
├── contextBlock.ts      # bloc <contexte_brainstormer> (pur, borné)
└── sheet.ts             # schéma et fusion de la fiche (pur)
src/main/infrastructure/claude/
├── claudePath.ts        # where.exe claude
└── CliConversation.ts   # processus stream-json (spawn, stdin, lignes, kill)
src/main/application/conversation/
├── ConversationService.ts   # sessions, contexte, historique, événements, limites
└── frame.ts                 # cadre stable du Brainstormer
src/main/application/mcp/NeuronTools.ts   # neurone_contexte, fiche_ecrire, maturite_evaluer
src/main/infrastructure/db/repositories/ConversationRepository.ts
src/main/ipc/chatHandlers.ts
src/shared/ipc/chat.ts · src/shared/mcp/tools.ts (+3) · src/shared/mcp/protocol.ts (hello.neuron)
src/mcp-relay/relay.ts (GI_NEURON_ID) · src/main/infrastructure/mcp/PipeServer.ts (appelant)
src/renderer/src/chat/ (ChatPanel.tsx, useChat.ts, chat.css)
src/renderer/src/canvas/IdeasCanvas.tsx (double-clic) · nodes/NeuronNode.tsx (résumé de fiche)
```

## Complexity Tracking
| Écart | Pourquoi | Alternative écartée |
|-------|----------|---------------------|
| Processus long par conversation | Flux continu, réponse en direct, session vivante | Un `claude -p` par message : redémarrage à chaque tour (~2–3 s de plus) |
