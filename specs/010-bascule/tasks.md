# Tasks: Bascule (lot C + F11)

- [x] T000 Décisions D1–D3 validées par mentalyas (2026-10-04)

## C1 — Moteur CLI et réglages
- [x] T001 [P] Tests : `ClaudeCliProvider` avec faux processus (arguments fixes, stdin, `structured_output` validé, relance, délai, absent / non connecté)
- [x] T002 `ClaudeCliProvider`, routage `widget` → CLI, modèles par usage (`ai_config`), `ConversationService` (modèle genesis / élément / surcharge)
- [x] T003 Retrait : `@anthropic-ai/sdk`, `ClaudeProvider`, recherche web, `BudgetGuard`, coût, `Anonymizer`, cadre `out_of_scope`, canaux et événement de clé / budget, secret supprimé au démarrage
- [x] T004 Réglages › IA refait + choix du modèle dans le chat ; tests renderer
- [x] T005 Test guidé C1 — **validation mentalyas**

## C2 — Conversion et retrait de l'ancien moteur
- [ ] T006 [P] Tests : conversion (réponses, document de réflexion, plan d'action, prochaine étape → fiche ; idempotente ; annulable)
- [ ] T007 Conversion au démarrage
- [ ] T008 Retrait de l'ancien moteur (main, IPC, interface, tests)
- [ ] T009 Test guidé C2 — **validation mentalyas**

## C3 — Finitions
- [ ] T010 Profil démo réécrit
- [ ] T011 Constitution 3.0.0, FOUNDATION résumée, CLAUDE.md, JOURNAL
- [ ] T012 typecheck, lint, tests, build ; mesure des lignes retirées
