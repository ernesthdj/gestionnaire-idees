# Tasks: Claude libre — parité avec le terminal (spec 014)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>`.

## Phase 1 — Socle permission (US1, US3) 🎯
- [x] T001 Constitution 4.0.0 ratifiée (Sync Impact Report, version, date)
- [x] T002 [P] Pur : règles « Toujours » (clé de projet, correspondance écriture / commande exacte / outil) dans `domain/conversation/permissions.ts` + tests
- [x] T003 [P] Pur : `parseStreamLine` — id des `tool_use`, résumé d'entrée, `tool_result` (erreur), `permission_denied` + tests
- [x] T004 Migration `0027_claude_libre` (+ down) et dépôts (mode, dossiers, règles, confiance, commit, journal des décisions) + aller-retour
- [x] T005 `PermissionService` : demande en attente, annonce, décision (allow / always / deny), règle appliquée, annulation (chat fermé, arrêt, app fermée), journal + tests
- [x] T006 Outil MCP `permission_demander` (relais : attente 30 min ; appelant vérifié) ; `conversationArgs` : `--permission-prompt-tool`, `--permission-mode default`, `--tools default`, sans `--permission-prompts none` + tests
- [x] T007 Interface : cartes de permission dans le chat (écriture : chemin + aperçu ; commande : texte exact + dossier) ; statut des outils dans le fil + tests renderer/axe
- [x] T008 Test guidé (quickstart §1, §3) — attendre le retour

## Phase 2 — Modes (US2)
- [ ] T009 Mode par conversation (redémarrage repris), défaut réglable, avertissement Libre (`CONFIRM_REQUIRED`) ; IPC + tests
- [ ] T010 Interface : sélecteur de mode dans l'en-tête du chat (Libre distinct), réglage du défaut + tests renderer/axe
- [ ] T011 Test guidé (quickstart §2)

## Phase 3 — Actions finales (US4, US7)
- [ ] T012 Hook `PreToolUse` : relais `--hook`, `--settings` injecté ; `DeliverableTracker` (avant/après, créé/modifié/supprimé) pour toute conversation d'action finale + tests
- [ ] T013 Retrait : `fichier_*`, `commande_lancer`, `CommandService`/`Runner`/`Repository`, `CommandsSection`, canaux `commands:*` ; `EXECUTE_MESSAGE` et cadre ACTION FINALE réécrits (pas de nouvelle action finale sur une action finale) + tests
- [ ] T014 « Commiter l'étape » : `final:commit`, `COMMIT_MESSAGE`, détection du commit (`tool_result`), `committed` sur l'action ; disponibilité (git, livrable) + tests
- [ ] T015 Interface : bouton « Commiter l'étape », état « commité abc1234 » sur l'action et le livrable + tests renderer/axe
- [ ] T016 Changements faits par des commandes (projet sous git) : `git status` en fin de tour, sans shell + tests
- [ ] T017 Test guidé (quickstart §4)

## Phase 4 — Dossiers et réglages (US5, US6)
- [ ] T018 `--add-dir` : ajout par dialogue natif, retrait, dossier de données refusé (`realpath`) + tests
- [ ] T019 « Utiliser mes réglages Claude Code », dépôts de confiance (`--setting-sources`) + tests
- [ ] T020 Interface : dossiers de la conversation, réglages Claude Code (défaut, mes réglages, règles « Toujours » révocables, confiance) + tests renderer/axe
- [ ] T021 Test guidé (quickstart §5)

## Phase 5 — Finitions
- [ ] T022 Démo, `docs/FOUNDATION.md`, `CLAUDE.md` (mises en garde du mode Libre), `docs/JOURNAL.md`

## Dépendances
T001–T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 →
T019 → T020 → T021 → T022. T002, T003 parallélisables.
