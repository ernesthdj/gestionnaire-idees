# Tasks: Arbre de skills (spec 020)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/interfaces.md](contracts/interfaces.md), [quickstart.md](quickstart.md)
**Tests** : demandés (constitution V) — nommage `should_<comportement>_when_<condition>` ; interface : renderer + axe ;
arborescences et dépôts git temporaires ; CLI `claude` simulé.

## Phase 1 — Mise en place
- [x] T001 Constitution 4.3.0 (D9) : principe I, écriture des skills sur « Installer » / « Revenir » (commit `b6f2502`)
- [ ] T002 [P] *(partiel 2026-10-08 : `perso/`, `projet/`, `plugins/cache` livrés avec US1, lien symbolique créé au test ; historiques `.jsonl` (US2) et `demo-repo/` (US4) à venir)* Fixtures **fictives** `tests/fixtures/skills/` : `perso/` (skills dont un qui en appelle deux autres, un abîmé sans en-tête, un avec script, un lien symbolique sortant), `projet/.claude/skills/`, `plugins/cache/<market>/<plugin>/{1.0.0,1.2.0}/skills/`, `projects/*.jsonl` (historiques avec appels `Skill`, commandes `/nom` et du texte de conversation piège), `demo-repo/` (un skill sûr, un « à revoir », un malveillant avec script)

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
- [ ] T012 Migration `00NN_skills` (prochain numéro libre au moment de coder : 0033 prévu, à vérifier — un autre travail peut en ajouter une ; analyse M1) (7 tables de `data-model.md`, domaines semés) via `npm run db:generate` + `migrations/down/0033_skills.down.sql` écrit à la main + aller-retour testé
- [ ] T013 [US2] `SkillRepository` `src/main/infrastructure/db/repositories/SkillRepository.ts` (cartes, domaines, liens, priorité de mentalyas, entités d'historique `skill_card_user`, `skill_link`, type de lot `skills` annulable) + tests d'intégration
- [ ] T014 [P] [US2] Pur : contrôles `src/main/domain/skills/cardCheck.ts` (noms de skills existants, sans auto-lien, domaine connu ou proposé, étoiles = moyenne arrondie ≥ 1) + tests
- [ ] T015 [US2] Tâche `skill_card` sans outil : `src/main/application/ai/SkillCardTask.ts` + `src/main/infrastructure/ai/SkillCardFrame.ts` (schéma `SkillCard` de L3-skills-comprendre §2, texte balisé comme donnée) + tests (sortie invalide rejetée)
- [ ] T016 [US2] `SkillCardService` : analyse à la demande (file de 3, empreinte inchangée ignorée, Sonnet 5.5 par défaut), `skills:analyze`, `skills:analyzeProgress`, corrections `skills:setStars|setDomain|acceptDomain|link|unlink` annulables + tests (Claude simulé, consigne piégée sans effet)
- [ ] T017 [P] [US2] `SkillUsageScanner` + worker (research R4) : `skills:usage` ; test SC-004 sur historiques fictifs (le texte piège n'apparaît nulle part dans l'agrégat ni ailleurs)
- [ ] T018 [US2] Interface : bouton « Analyser les skills » + progression, branches par domaine, étoiles (icônes + nombre) et usage sur les nœuds, liens pointillés, onglet Fiche complet (résumé, quand l'utiliser / l'éviter, déclencheurs, entrées / sorties, exemples, grille en 4 barres justifiées), corrections (étoiles, domaine, liens) avec « Annuler » + tests renderer/axe
- [ ] T019 [US2] Test guidé (quickstart §2), avec la mesure SC-006 : chronométrer la compréhension d'un skill inconnu à partir de sa fiche (< 1 min) — attendre le retour

## Phase 5 — US3 Améliorer et créer (P2)
**Test indépendant** : conversation d'un skill → brouillon et différences, rien sur le disque ; Installer puis Revenir = contenu d'origine exact ; conflit disque détecté ; brouillon avec script ou chemin hors dossier refusé.
- [ ] T020 [P] [US3] Pur : différences par fichier `src/main/domain/skills/diff.ts` + tests
- [ ] T021 [US3] `SkillDraftService` : outil MCP `skill_brouillon` (Zod, annexes non exécutables, marqué « par Claude », historisé ; réécrire un brouillon d'import **vide ses scripts autorisés** et passe son origine à `claude` — analyse H2), `skills_lire` (toile, `SKILL.md` borné, fichiers, lecture par le main), `skills:drafts|draftDiff|discardDraft|duplicate` ; outils déclarés dans `src/shared/mcp/tools.ts` + aiguillage `toolHandler.ts` + tests (dont : brouillon d'import avec script retravaillé par Claude → script retiré)
- [ ] T022 [US3] `SkillInstaller` : `skills:install` (familles, `READ_ONLY_FAMILY`, `NAME_TAKEN`, `DISK_CHANGED` sauf `acceptDiskChange`, sauvegarde de version, écriture atomique, restauration en cas d'échec, lot `skill_files` annulable), `skills:restore`, 10 versions + tests sur dossiers temporaires (SC-002, SC-003)
- [ ] T023 [US3] Conversations : `skills:conversation` (neurones cachés « Skills » et par skill, dossier `<profil>/skills-workspace`, consigne dédiée : `skills_lire` / `skill_brouillon` seulement ; **outils limités à `Read Glob Grep` + ces deux outils MCP, aucun outil d'écriture ni de commande, mode de permission figé** — analyse H1) + tests (arguments du CLI : aucun outil d'écriture, même si la conversation est réglée sur « Libre »)
- [ ] T024 [US3] Interface : onglet Conversation (fiche d'un skill) et conversation « Skills » (volet sans sélection, suggestions de départ), cartes « Brouillon prêt », `DraftPanel.tsx` (différences, avertissement disque changé, Installer avec « change Claude dans tous tes projets », Jeter), menu ⋯ (Revenir, Dupliquer, Réanalyser), nœuds fantômes + tests renderer/axe
- [ ] T025 [US3] Test guidé (quickstart §3) — attendre le retour

## Phase 6 — US4 Importer depuis GitHub (P3)
**Test indépendant** : import du dépôt de démonstration (servi en local) : verdicts, malveillant « dangereux » et verrouillé, scripts exclus, brouillons ; adresse piégée refusée sans rien lancer ; quarantaine supprimée.
- [ ] T026 [P] [US4] Pur : contrôle d'URL `src/shared/reprise/gitUrl.ts` (= spec 017 T028) + tests d'adresses hostiles
- [ ] T027 [US4] `CloneService` `src/main/application/reprise/CloneService.ts` (= spec 017 T029 : clone `--depth 1`, sans sous-modules, hooks désactivés, `--`, délai, annulation, nettoyage du seul dossier créé, échecs classés, quarantaine orpheline nettoyée au démarrage) + tests (git réel sur dépôt local, processus simulé pour les échecs)
- [ ] T028 [P] [US4] Pur : règles fixes d'audit `src/main/domain/skills/auditRules.ts` (research R8) + tests
- [ ] T029 [US4] Tâche `skill_audit` sans outil (`SkillAuditTask.ts` + `SkillAuditFrame.ts`, sortie fermée, invalide → « à revoir ») + tests
- [ ] T030 [US4] `SkillImportService` : `skills:import|importProgress|importView|importChoose|importCancel` (limites 50 Mo / 2 000 fichiers / 30 skills, repérage, verdict = le plus sévère des règles et de Claude, « dangereux » verrouillé, brouillons avec scripts autorisés un par un, origine gardée, quarantaine supprimée) + tests (SC-005)
- [ ] T031 [US4] Interface `src/renderer/src/skills/ImportDialog.tsx` (adresse, progression, choix avec verdicts icône + libellé et raisons, scripts à cocher, double avertissement pour un dangereux, Annuler) + tests renderer/axe
- [ ] T032 [US4] Test guidé (quickstart §4) — attendre le retour ; cocher aussi T028–T029 de la spec 017 (livrées ici)

## Phase 7 — Finitions
- [ ] T033 Mesure SC-007 (150 skills fictifs : page utilisable < 2 s), consignée dans `research.md`
- [ ] T034 `docs/FOUNDATION.md` (§00000 : 020 livrée), `CLAUDE.md` (spec en cours, workflow), `docs/JOURNAL.md`

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
