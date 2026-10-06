# Implementation Plan: Claude libre — parité avec le terminal (spec 014)

**Branch**: `014-claude-libre` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

## Summary

Les conversations `claude -p` passent des outils maison confinés (spec 013 : `fichier_*`, scripts approuvés) aux
**outils natifs de Claude Code**, gouvernés par un **mode de permission** par conversation. Les demandes de permission
sont relayées dans le chat par l'outil documenté `--permission-prompt-tool`, pointé sur un outil du pont MCP
(`permission_demander`) qui attend la réponse de mentalyas. Un hook `PreToolUse` injecté par l'app (`--settings`)
garde le contenu d'avant chaque écriture pour reconstituer le livrable d'une action finale. Le fil lit les
`tool_result` pour dire « refusé » / « échoué ». « Commiter l'étape » envoie à Claude une demande cadrée ; le commit
est une commande `git` ordinaire, soumise au mode.

## Technical Context

**Language/Version**: TypeScript 5 strict
**Primary Dependencies**: Electron, React, Claude Code CLI 2.1.291 (`--permission-mode`, `--permission-prompt-tool`,
`--add-dir`, `--settings`, `--setting-sources`), `@modelcontextprotocol/sdk` (relais) — aucune nouvelle dépendance
**Storage**: migration `0027_claude_libre` (+ down) : mode et dossiers par conversation, règles « Toujours » par projet,
dépôts de confiance, commit d'une action finale
**Testing**: Vitest (purs, intégration avec faux processus CLI, renderer + axe) ; test guidé avec le vrai CLI
**Target Platform**: Windows 11
**Constraints**: aucune réponse de permission sans mentalyas hors règles qu'il a posées ; dossier de données jamais
ouvert ; arguments du CLI construits par le main
**Scale/Scope**: ~15 fichiers main/shared, ~8 renderer ; retrait de l'outillage confiné de la spec 013

## Constitution Check (4.0.0 — proposée avec la spec, à ratifier au lot 1)

| Principe | Vérification | Statut |
|---|---|---|
| I Sécurité | CLI et éditeur seuls programmes lancés par l'app ; arguments construits par le main (mode : enum Zod ; dossiers : dialogue natif + `realpath`, dossier de données refusé) ; relais MCP authentifié inchangé ; aucun contenu de fichier ni commande dans les logs | ✅ |
| II Humain dans la boucle | Mode Demander par défaut ; chaque demande attend une réponse ; sans réponse → refus ; Libre confirmé après avertissement ; règles « Toujours » visibles et révocables | ✅ |
| III IA cadrée | Tâches automatiques inchangées (sans outils) ; contenu de la carte et des fichiers = donnée ; fil fidèle | ✅ |
| IV Local | Réglages utilisateur et dépôt de confiance sur option seulement | ✅ |
| V Tests | Purs (règles, arguments, fil), intégration (permission bout en bout avec faux CLI), renderer/axe | ✅ |
| VI Simplicité | Réutilise le pont MCP asynchrone, le circuit de session reprise (changement de modèle) ; retire `CommandService`, `CommandRunner`, `fichier_*` | ✅ |

## Project Structure

```text
src/shared/ipc/chat.ts                       PermissionMode, ChatPermissionRequest, statut des outils, dossiers
src/shared/mcp/tools.ts                      outil permission_demander (interne, non listé dans les instructions)
src/main/domain/conversation/permissions.ts  (nouveau) règles « Toujours » : correspondance, clé de projet ; pur
src/main/domain/conversation/streamEvents.ts tool_use id + input résumé ; tool_result (erreur/succès) ; permission_denied
src/main/application/conversation/PermissionService.ts (nouveau) demandes en attente, règles, décisions, annulation
src/main/application/conversation/ConversationService.ts  arguments (mode, outils, add-dir, settings, hook), mode/dossiers par conversation
src/main/application/finals/DeliverableTracker.ts (nouveau) avant/après des écritures (hook) → livrable de l'action
src/main/application/finals/ExecutionService.ts  plus de droits « pendant l'exécution » ; EXECUTE_MESSAGE ; commit
src/mcp-relay/relay.ts                       permission_demander : délai long ; mode hook (PreToolUse → pipe)
src/main/infrastructure/db/…                 migration 0027, dépôts (conversation, règles, confiance, commit)
src/renderer/src/chat/ChatPanel.tsx          sélecteur de mode, cartes de permission, dossiers, statut des outils
src/renderer/src/canvas/FinalPanel.tsx       « Commiter l'étape », état commité ; retrait CommandsSection
src/renderer/src/pages/settings/…            réglages Claude Code : mode par défaut, mes réglages, règles, confiance
Retirés : FinalTools (fichier_*), CommandService, CommandRunner, CommandRepository, CommandsSection, commande_lancer
```

## Lots
1. **P1 — Socle permission (US1, US3)** : constitution 4.0.0, `permission_demander` + relais longue attente,
   `PermissionService`, arguments CLI (mode Demander, outils natifs), cartes dans le chat, fil fidèle. Test guidé.
2. **P2 — Modes (US2)** : sélecteur, mode par conversation (redémarrage repris), avertissement Libre, défaut réglable.
3. **P3 — Actions finales (US4, US7)** : hook `PreToolUse` → livrable, retrait de l'outillage confiné, cadre ACTION
   FINALE réécrit, « Commiter l'étape », état commité. Test guidé.
4. **P4 — Dossiers et réglages (US5, US6)** : `--add-dir` (dialogue natif), dossier de données refusé, mes réglages,
   dépôts de confiance, page de règles « Toujours ».
5. **Finitions** : démo, FOUNDATION, CLAUDE.md (commande et mises en garde), JOURNAL.

## Complexity Tracking
| Écart | Pourquoi | Alternative plus simple écartée |
|---|---|---|
| Hook `PreToolUse` injecté par l'app | Seul moyen fiable d'avoir le contenu d'avant une écriture dans tous les modes (Libre compris) | Lire le fichier à l'événement `tool_use` : course avec l'écriture ; git seul : exclut les projets sans git |
| Outil MCP de permission qui attend longtemps | Une demande attend mentalyas (minutes) | Refus après 30 s : rendrait le mode Demander inutilisable |
