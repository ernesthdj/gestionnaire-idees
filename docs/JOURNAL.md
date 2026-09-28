# Journal — Gestionnaire_idées

## Regles apprises

| # | Regle | Fichier(s) | Date |
|---|-------|-----------|------|
| _Aucune regle pour l'instant_ | | | |

## Historique

### SESSION 0 — 2026-09-28

### [2026-09-28 08:47] FEAT — init
**Fichiers :** `CLAUDE.md`, `docs/JOURNAL.md`, `src/`, `tests/`
**Resume :** Scaffolding initial via `/hub new`. Coquille vide creee — stack et dependances a definir apres brainstorm.

### [2026-09-28 09:50] DOCS — brainstorm niveaux 1 et 2
**Fichiers :** `CLAUDE.md`, `docs/academique/`, `docs/brainstorm/L1-fondation.md`, `docs/brainstorm/L2-*.md` (9 fichiers)
**Résumé :** Suivi académique activé. Niveau 1 terminé : vision « agenda organique / secrétaire personnel », IA hybride (Ollama local + Claude), validation humaine obligatoire, Outlook via Microsoft Graph (compte perso), compagnon tamagotchi pixel art à évolution RNG pondérée, stack Electron + React + TS. Livraison découpée MVP-1 (F1-F4, F9) / MVP-2 (F5-F8). Niveau 2 rédigé pour les 9 fonctionnalités ; niveau 3 recommandé pour F2, F6, F7, F8, F9.

### [2026-09-28 09:56] DOCS — brainstorm niveau 3
**Fichiers :** `docs/brainstorm/L3-structuration-ia.md`, `L3-moteur-ia.md`, `L3-synchro-outlook.md`, `L3-conseiller-proactif.md`, `L3-compagnon.md`
**Résumé :** Conception technique des 5 fonctionnalités flaguées : contrat IPC typé (pas d'API HTTP), schéma SQLite chiffré (Drizzle + better-sqlite3-multiple-ciphers, clé via safeStorage), contrat AIProvider + AIGateway (routage, anonymisation, budget, validation Zod), Claude via SDK TS (messages.parse + zodOutputFormat, claude-opus-5 par défaut configurable), MSAL Node autorité consumers + PKCE + Graph /me/events avec transactionId, résumé de situation anonymisé (alias + bandes de montants), tirage par roulette pondérée journalisé.

### [2026-09-28 10:04] DOCS — brainstorm niveau 4 + export
**Fichiers :** `docs/brainstorm/L4-parcours.md`, `docs/FOUNDATION.md`, `CLAUDE.md`
**Résumé :** Parcours UX (6 parcours, 11 écrans, maquettes ASCII, frictions). Export consolidé L1+L2+L3+L4 en `docs/FOUNDATION.md` (~1 800 lignes). Exceptions projet inscrites dans CLAUDE.md : Drizzle au lieu de Prisma, repo public sans données réelles, Opus 5 par défaut.

### [2026-09-28 10:15] CONFIG — Spec Kit initialisé
**Fichiers :** `.specify/`, `.claude/skills/speckit-*`, `.gitignore`, `CLAUDE.md`
**Résumé :** `specify init --here --integration claude --script ps` (Spec Kit 0.16.5). CLAUDE.md du projet non modifié par l'outil (vérifié). `.claude/settings.local.json` ajouté au .gitignore suite à l'avertissement de sécurité de Spec Kit.

### [2026-09-28 11:01] DOCS — Spec Kit : constitution + feature 001
**Fichiers :** `.specify/memory/constitution.md`, `specs/001-moteur-ia-hybride/` (spec, checklist, plan, research, data-model, contracts, quickstart, tasks, analysis-report)
**Résumé :** Constitution v1.0.0 (6 principes : sécurité, humain dans la boucle, IA cadrée, local d'abord, qualité/tests, simplicité). Feature 001 F9 : 5 user stories, 19 FR, 8 SC, 56 tâches. Analyse : 0 critique, 4 moyens (repli/rejeu file locale, vérif. coût réel, dépendance exemples→F3, parse+fallbacks à vérifier), 4 mineurs.

### [2026-09-28 11:23] DOCS — Spec Kit : remédiation 001 + feature 002
**Fichiers :** `specs/001-moteur-ia-hybride/{tasks,plan,data-model,analysis-report}.md`, `contracts/ipc-ai.md`, `specs/002-structuration-ia/` (complet)
**Résumé :** 001 : 7 correctifs d'analyse appliqués (file locale persistante T057/T058, vérif. coût réel T059, guidage Ollama T060, point d'intégration F3, unités de coût, arborescence, vérif. SDK) → couverture 27/27. 002 F2 : 5 user stories, 16 FR, 7 SC, 42 tâches, modèle de données central, garantie « ne jamais inventer » par contrôle de provenance déterministe. Analyse : 0 critique, 1 moyen (statut après abandon d'une restructuration), 4 mineurs.

### [2026-09-28 11:53] DOCS — Spec Kit : remédiation 002 + feature 003
**Fichiers :** `specs/002-structuration-ia/{spec,data-model,tasks,analysis-report}.md`, `specs/003-interface-mvp1/` (complet)
**Résumé :** 002 : 5 correctifs (statut restauré après abandon, table settings + limite configurable, test out_of_scope, dépendance coquille → 003, FR-007 reformulé) → 24/24. 003 Interface MVP-1 (coquille + F1 + F3 + F4) : 5 user stories, 28 FR, 8 SC, 50 tâches ; 6 nouvelles dépendances annoncées (React Flow, dagre, Zustand, TanStack Query, RHF) + 3 de test. Analyse : 0 critique, 2 moyens (correction d'une 1re décomposition impossible via restructure ; effet d'une annulation d'acceptation non défini), 3 mineurs. MVP-1 entièrement spécifié.
