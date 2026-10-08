# Tasks: Arbre de skills (spec 020)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>` ; interface : renderer + axe ;
arborescences et dépôts git temporaires ; CLI `claude` simulé.

## Phase 1 — Mise en place
- [x] T001 Constitution 4.3.0 (D9) : principe I, écriture des skills sur « Installer » / « Revenir » (commit `b6f2502`)
- [x] T002 [P] *(2026-10-08 : `demo-repo/` ajouté avec US4 ; historiques `.jsonl` à venir avec US2 ; partiel : `perso/`, `projet/`, `plugins/cache` livrés avec US1, lien symbolique créé au test ; historiques `.jsonl` (US2) et `demo-repo/` (US4) à venir)* Fixtures **fictives** `tests/fixtures/skills/` : `perso/` (skills dont un qui en appelle deux autres, un abîmé sans en-tête, un avec script, un lien symbolique sortant), `projet/.claude/skills/`, `plugins/cache/<market>/<plugin>/{1.0.0,1.2.0}/skills/`, `projects/*.jsonl` (historiques avec appels `Skill`, commandes `/nom` et du texte de conversation piège), `demo-repo/` (un skill sûr, un « à revoir », un malveillant avec script)

## Phase 2 — Fondations (bloquant)
- [x] T003 [P] Modèle partagé `src/shared/skills/model.ts` (familles, identifiants `perso:` / `projet:` / `plugin:`, noms `[a-z0-9][a-z0-9-]{0,63}`, extensions exécutables, domaines de départ, grille) + `src/shared/ipc/skills.ts` (vues, codes d'erreur) ; canaux `skills:*` dans `channels.ts` au fil des gestionnaires
- [x] T004 [P] Pur : en-tête `src/shared/skills/frontMatter.ts` (research R2) + tests (guillemets, échappements, absence, clés inconnues, YAML piégé)
- [x] T005 [P] Pur : chemins et noms `src/main/domain/skills/paths.ts` (relatif, sans `..`, ni absolu, ni lecteur, extension exécutable) + tests hostiles

## Phase 3 — US1 Voir sa toile (P1) 🎯 MVP
**Test indépendant** : page Skills sur les fixtures : un nœud par skill, famille, ⚠ scripts, `hub` relié à `graphify` et `professor`, skill abîmé signalé, lien symbolique sortant ignoré.
- [x] T006 [US1] `SkillInventory` `src/main/application/skills/SkillInventory.ts` : 3 racines (research R1, R3), `realpath` + inclusion, `SKILL.md` ≤ 200 Ko, annexes listées, repère exécutable, abîmé, `sameNameAs`, cache, surveillance `fs.watch` (perso, projets) regroupée 1 s → `skills:changed` + tests sur fixtures
- [x] T007 [P] [US1] Pur : liens écrits `src/main/domain/skills/links.ts` (`/nom`, « skill nom », mot entier, sans auto-lien ni nom < 3, hors URL) + tests
- [x] T008 [P] [US1] Pur : disposition `src/renderer/src/skills/skillTree.ts` (tronc, branches en éventail, rangées de 3, grappe de plugins, déterministe, sans chevauchement) + tests
- [x] T009 [US1] IPC `src/main/ipc/skillsHandlers.ts` : `skills:list`, `skills:get` (Markdown ≤ 200 Ko, fichiers) + câblage `bootstrap.ts` + tests des canaux (Zod, `undefined`)
- [x] T010 [US1] Interface : section **Skills** (`SECTIONS`, `AppShell`), `src/renderer/src/skills/SkillsPage.tsx` (carte 62 % + volet 38 %, filtres par famille, recherche, grappe dépliable), `SkillNode.tsx` (nom, famille icône + libellé, ⚠, abîmé), `SkillPanel.tsx` (onglets Fiche — brute au lot 1 — · SKILL.md · Fichiers ; Markdown assaini) + tests renderer/axe
- [x] T011 [US1] Test guidé (quickstart §1) — validé par mentalyas le 2026-10-08 (« tout marche à merveille »)

## Phase 4 — US2 Comprendre et évaluer (P1) 🎯 MVP
**Test indépendant** : analyse des fixtures (Claude simulé) : fiche, grille justifiée, domaine, liens ; lien vers un skill inexistant écarté ; note de mentalyas gardée ; usage exact et aucun texte de conversation conservé.
- [x] T012 Migration `00NN_skills` (prochain numéro libre au moment de coder : 0033 prévu, à vérifier — un autre travail peut en ajouter une ; analyse M1) (7 tables de `data-model.md`, domaines semés) via `npm run db:generate` + `migrations/down/0033_skills.down.sql` écrit à la main + aller-retour testé — *2026-10-08 : `0033_skills` (7 tables + domaines semés) + down, aller-retour testé ; type de lot `skills`*
- [x] T013 [US2] `SkillRepository` `src/main/infrastructure/db/repositories/SkillRepository.ts` (cartes, domaines, liens, priorité de mentalyas, entités d'historique `skill_card_user`, `skill_link`, type de lot `skills` annulable) + tests d'intégration — *2026-10-08 (partie US3) : brouillons, versions, conversations Skills ; cartes, domaines et liens de sens au moment d’US2*
- [x] T014 [P] [US2] Pur : contrôles `src/main/domain/skills/cardCheck.ts` (noms de skills existants, sans auto-lien, domaine connu ou proposé, étoiles = moyenne arrondie ≥ 1) + tests — *`cardCheck.ts` + `shared/skills/card.ts` (schéma `SkillCard`, `starsOf`)*
- [x] T015 [US2] Tâche `skill_card` sans outil : `src/main/application/ai/SkillCardTask.ts` + `src/main/infrastructure/ai/SkillCardFrame.ts` (schéma `SkillCard` de L3-skills-comprendre §2, texte balisé comme donnée) + tests (sortie invalide rejetée) — *`SkillCardTask.ts` + `SkillCardFrame.ts`, Sonnet 5.5 (`SKILL_CARD_MODEL`)*
- [x] T016 [US2] `SkillCardService` : analyse à la demande (file de 3, empreinte inchangée ignorée, Sonnet 5.5 par défaut), `skills:analyze`, `skills:analyzeProgress`, corrections `skills:setStars|setDomain|acceptDomain|link|unlink` annulables + tests (Claude simulé, consigne piégée sans effet) — *`SkillCardService` + canal `skills:cards` (vue des fiches, domaines, liens) ; entités d’historique `skill_card_user`, `skill_link`*
- [x] T017 [P] [US2] `SkillUsageScanner` + worker (research R4) : `skills:usage` ; test SC-004 sur historiques fictifs (le texte piège n'apparaît nulle part dans l'agrégat ni ailleurs) — *`SkillUsageScanner` en flux asynchrone dans le main (research R4 amendée le 2026-10-08 : pas de fil de travail)*
- [x] T018 [US2] Interface : bouton « Analyser les skills » + progression, branches par domaine, étoiles (icônes + nombre) et usage sur les nœuds, liens pointillés, onglet Fiche complet (résumé, quand l'utiliser / l'éviter, déclencheurs, entrées / sorties, exemples, grille en 4 barres justifiées), corrections (étoiles, domaine, liens) avec « Annuler » + tests renderer/axe — *`SkillCardSheet.tsx`, branches par domaine (« À analyser » pour les skills sans fiche, plugins en grappe), étoiles et usage sur les nœuds, liens de sens en pointillés*
- [x] T019 [US2] Test guidé (quickstart §2), avec la mesure SC-006 : chronométrer la compréhension d'un skill inconnu à partir de sa fiche (< 1 min) — attendre le retour — *validé par mentalyas le 2026-10-08 (« les tests sont verts »)*

## Phase 5 — US3 Améliorer et créer (P2)
**Test indépendant** : conversation d'un skill → brouillon et différences, rien sur le disque ; Installer puis Revenir = contenu d'origine exact ; conflit disque détecté ; brouillon avec script ou chemin hors dossier refusé.
- [x] T020 [P] [US3] Pur : différences par fichier `src/main/domain/skills/diff.ts` + tests — *fait dans `src/main/domain/skills/draftFiles.ts` (SKILL.md composé, différences, empreinte)*
- [x] T021 [US3] `SkillDraftService` : outil MCP `skill_brouillon` (Zod, annexes non exécutables, marqué « par Claude », historisé ; réécrire un brouillon d'import **vide ses scripts autorisés** et passe son origine à `claude` — analyse H2), `skills_lire` (toile, `SKILL.md` borné, fichiers, lecture par le main), `skills:drafts|draftDiff|discardDraft|duplicate` ; outils déclarés dans `src/shared/mcp/tools.ts` + aiguillage `toolHandler.ts` + tests (dont : brouillon d'import avec script retravaillé par Claude → script retiré) — *`SkillService.writeDraft` + `SkillTools` ; tests intégration*
- [x] T022 [US3] `SkillInstaller` : `skills:install` (familles, `READ_ONLY_FAMILY`, `NAME_TAKEN`, `DISK_CHANGED` sauf `acceptDiskChange`, sauvegarde de version, écriture atomique, restauration en cas d'échec, lot `skill_files` annulable), `skills:restore`, 10 versions + tests sur dossiers temporaires (SC-002, SC-003) — *`SkillService.install/restore` + `SkillStore` (versions par empreinte, écriture atomique par échange de dossiers)*
- [x] T022b [US3] (D10, FR-030) `skills:remove` : sur confirmation, dossier entier sauvegardé (version) puis retiré, lot `skill_files` annulable, `READ_ONLY_FAMILY` pour un plugin ; « Revenir » le rétablit + tests (suppression puis annulation = dossier identique) — *`skills:remove` ; suppression puis annulation = dossier identique (test)*
- [x] T023 [US3] Conversations : `skills:conversation` (neurones cachés « Skills » et par skill, dossier `<profil>/skills-workspace`, consigne dédiée : `skills_lire` / `skill_brouillon` seulement ; **outils limités à `Read Glob Grep` + ces deux outils MCP, aucun outil d'écriture ni de commande, mode de permission figé** — analyse H1) + tests (arguments du CLI : aucun outil d'écriture, même si la conversation est réglée sur « Libre ») — *neurones `skills_chat` cachés (hors carte et pont), `<profil>/skills-workspace`, `--tools Read Glob Grep` + 2 outils MCP, mode Demander figé ; le pont refuse tout autre outil dans ces conversations (tests)*
- [x] T024 [US3] Interface : onglet Conversation (fiche d'un skill) et conversation « Skills » (volet sans sélection, suggestions de départ), cartes « Brouillon prêt », `DraftPanel.tsx` (différences, avertissement disque changé, Installer avec « change Claude dans tous tes projets », Jeter), menu ⋯ (Revenir, Dupliquer, Réanalyser), nœuds fantômes + tests renderer/axe — *onglets Conversation / Brouillon prêt, `DraftPanel`, Revenir / Supprimer / Dupliquer, nœuds fantômes, conversation générale sans sélection*
- [x] T025 [US3] Test guidé (quickstart §3) — validé par mentalyas le 2026-10-08 (« tous les tests sont bons »)

## Phase 6 — US4 Importer depuis GitHub (P3)
**Test indépendant** : import du dépôt de démonstration (servi en local) : verdicts, malveillant « dangereux » et verrouillé, scripts exclus, brouillons ; adresse piégée refusée sans rien lancer ; quarantaine supprimée.
- [x] T026 [P] [US4] Pur : contrôle d'URL `src/shared/reprise/gitUrl.ts` (= spec 017 T028) + tests d'adresses hostiles — *livrée par un agent : `src/shared/reprise/gitUrl.ts`*
- [x] T027 [US4] `CloneService` `src/main/application/reprise/CloneService.ts` (= spec 017 T029 : clone `--depth 1`, sans sous-modules, hooks désactivés, `--`, délai, annulation, nettoyage du seul dossier créé, échecs classés, quarantaine orpheline nettoyée au démarrage) + tests (git réel sur dépôt local, processus simulé pour les échecs) — *livrée par un agent : `CloneService` à deux profils + `GitProcess` (annulation, arbre de processus)*
- [x] T028 [P] [US4] Pur : règles fixes d'audit `src/main/domain/skills/auditRules.ts` (research R8) + tests — *livrée par un agent : `auditRules.ts`*
- [x] T029 [US4] Tâche `skill_audit` sans outil (`SkillAuditTask.ts` + `SkillAuditFrame.ts`, sortie fermée, invalide → « à revoir ») + tests — *`SkillAuditTask.ts` + `SkillAuditFrame.ts`, sortie `SkillAuditOut` ; échec → « à revoir »*
- [x] T030 [US4] `SkillImportService` : `skills:import|importProgress|importView|importChoose|importCancel` (limites 50 Mo / 2 000 fichiers / 30 skills, repérage, verdict = le plus sévère des règles et de Claude, « dangereux » verrouillé, brouillons avec scripts autorisés un par un, origine gardée, quarantaine supprimée) + tests (SC-005) — *`SkillImportService` : quarantaine, repérage, règles fixes puis Claude (le plus sévère), dangereux verrouillé, scripts un par un, quarantaine supprimée ; test : Claude trompé dit « sûr », les règles disent « dangereux »*
- [x] T031 [US4] Interface `src/renderer/src/skills/ImportDialog.tsx` (adresse, progression, choix avec verdicts icône + libellé et raisons, scripts à cocher, double avertissement pour un dangereux, Annuler) + tests renderer/axe — *`ImportDialog.tsx` + bouton « Importer depuis GitHub… » ; test renderer + axe*
**D12 Bibliothèque (2026-10-08, retour du test guidé T032 : « Dépôt trop gros »)**
- [x] T031a [US4] `CloneService` : profil `superficiel` en dossier temporaire `skill-library/.tmp`, garde-fou 1 Go sans borne de fichiers, délai 15 min ; ancien `skill-quarantine` retiré au démarrage + tests
- [x] T031b [US4] Migration `0034_skill_library` (+ down) : `skill_imports.folder|updated_at|truncated`, `skill_import_candidates.content_hash|claude_verdict|claude_reasons|claude_hash` ; `SkillRepository` (dépôts de la bibliothèque, report des audits)
- [x] T031c [US4] `SkillImportService` : copie gardée (renommage du temporaire, échange à la mise à jour, ancienne copie gardée sur échec), repérage 300 skills / profondeur 6, règles fixes à l'import, audit Claude à l'installation (empreinte), `library`, `librarySkill`, `install`, `remove` ; canaux `skills:library|librarySkill|libraryInstall|libraryRemove` (remplacent `importView|importChoose`) + tests d'intégration
- [x] T031d [US4] Interface : branche Bibliothèque (grappe par dépôt, nœuds « disponible » avec verdict), volet d'un skill disponible (SKILL.md, verdict et raisons, scripts, déverrouillage, Installer → brouillon), volet d'un dépôt (Mettre à jour, Retirer), `ImportDialog` réduit (adresse → progression → résumé) + tests renderer/axe
- [x] T032 [US4] Test guidé (quickstart §4) — validé par mentalyas le 2026-10-08 (import, mise à jour, Installer, Retirer) ; spec 017 : T028 cochée, T029 partielle (IPC `reprise:*` à faire)

## Phase 7 — Finitions
- [ ] T033 Mesure SC-007 (150 skills fictifs : page utilisable < 2 s), consignée dans `research.md`
- [ ] T034 `docs/FOUNDATION.md` (§00000 : 020 livrée), `CLAUDE.md` (spec en cours, workflow), `docs/JOURNAL.md`

## Ordre amendé (D11, 2026-10-08)
T012 (migration complète) → T013 → US3 (T020 → T021 → T022 → T022b → T023 → T024 → T025) → US4 (T026–T028 en cours
par un agent, puis T029–T032) → US2 (T014–T019).

## Dépendances
T001 ✅ → T002 → (T003, T004, T005 en parallèle) → US1 (T006 ; T007, T008 en parallèle → T009 → T010 → T011)
→ US2 (T012 → T013 ; T014, T017 en parallèle → T015 → T016 → T018 → T019)
→ US3 (T020 en parallèle → T021 → T022 → T023 → T024 → T025)
→ US4 (T026, T028 en parallèle → T027 → T029 → T030 → T031 → T032) → T033, T034.
US4 ne dépend que d'US3 pour les brouillons ; T026–T027 peuvent avancer dès la Phase 2.

## Parallélisme
- Fondations : T003, T004, T005.
- US1 : T007 (liens) et T008 (disposition) pendant T006.
- US2 : T014 et T017 (usage) pendant T013.
- US4 : T026 et T028 (purs) dès que possible.

## Stratégie
MVP = US1 + US2 (voir et comprendre : la toile ne modifie encore rien). Puis US3 (évoluer, la partie qui écrit), puis
US4 (importer, la plus risquée). Test guidé à la fin de chaque histoire ; commit après validation, sur confirmation.
