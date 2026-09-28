# Specification Analysis Report — 002 Structuration IA

> Produit par `/speckit-analyze` (lecture seule) le 2026-09-28, sauvegardé manuellement.
> Artefacts : spec.md, plan.md, tasks.md, data-model.md, contracts/, constitution v1.0.0.

> **Remédiation appliquée le 2026-09-28** (validée par mentalyas) : I1 → `previous_idea_status` +
> FR-017 + T010 ; C1 → cas `out_of_scope` dans T011 ; C2 → table `settings` (`structuring.question_limit`)
> + T003/T010 ; U1 → dépendance à la spec 003 notée dans tasks.md ; F1 → FR-007 reformulé.
> Couverture après remédiation : 24/24 exigences (17 FR + 7 SC) entièrement couvertes.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | MEDIUM | data-model.md § Transitions · spec US5 | « Abandon → idée retour `raw` » : faux pour une **restructuration** — une idée déjà structurée repasserait à `raw` et perdrait son statut | Abandon → retour au statut **d'avant la session** (`raw` pour une décomposition, `structured` pour une restructuration) ; ajouter le cas au test T010 |
| C1 | Coverage | LOW | spec FR-015 · tasks T010/T011 | La réponse IA `out_of_scope` (recentrage) n'a pas de test automatisé (seulement manuel, quickstart #5) | Ajouter à T011 : FakeProvider renvoie `out_of_scope` → message de recentrage affiché, compteur de questions inchangé |
| C2 | Coverage | LOW | spec FR-005 « limite configurable » | Aucune tâche ne rend la limite de 8 questions modifiable | Stocker `question_limit` dans une table de réglages (clé `structuring.question_limit`, 3..15) lue au `start` ; exposition dans les réglages reportée à la spec « interface MVP-1 » |
| U1 | Underspecification | LOW | tasks T018/T019 · plan | Les écrans Idées et Questionnaire supposent une coquille d'app (navigation latérale, routage) qu'aucune feature ne possède encore | Noter la dépendance : la coquille (navigation 5 entrées, L4) sera portée par la spec « interface MVP-1 » ; d'ici là, route provisoire |
| F1 | Inconsistency | LOW | contracts/ai-outputs.md K5 · spec FR-007 | FR-007 parle de « contrôler » les idées liées ; K5 **retire** le lien invalide au lieu de rejeter la proposition | Assumé (retirer est plus doux et sans risque) ; préciser dans FR-007 « liens vers des idées non candidates retirés » |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 idées CRUD/liste | ✅ | T007–T009, T018 | |
| FR-002 1 session / idée | ✅ | T011, T015 | |
| FR-003 question + réponses | ✅ | T005, T015, T019 | |
| FR-004 persistance + reprise | ✅ | T011, T015, T016 | |
| FR-005 limite 8 + décompose maintenant | ⚠️ | T010 | limite non configurable (C2) |
| FR-006 contenu de la proposition | ✅ | T005, T021, T025 | |
| FR-007 contrôles + retry | ✅ | T020–T025 | voir F1 |
| FR-008 ne jamais inventer | ✅ | T028–T031 | |
| FR-009 opportunité | ✅ | T032–T034 | |
| FR-010 pas d'application | ✅ | T022 | |
| FR-011 périmée | ✅ | T039 | |
| FR-012 restructuration | ✅ | T035–T037 | voir I1 |
| FR-013 abandon | ✅ | T010, T015, T017 | voir I1 |
| FR-014 centimes | ✅ | T003, T028 | |
| FR-015 via moteur 001 + hors périmètre | ⚠️ | T014, T015, T040 | test `out_of_scope` manquant (C1) |
| FR-016 retour immédiat | ✅ | T017, T019 | |
| SC-001 … SC-007 | ✅ | T041, T029, T020/T021, T041, T041, T011, T022 | |

**Constitution Alignment Issues:** aucune (II respecté : aucune écriture d'arbre ; III : K1–K7 + provenance ; V : tests d'abord).

**Unmapped Tasks:** aucune.

## Metrics

- Total Requirements : 16 FR + 7 SC
- Total Tasks : 42
- Coverage : 21/23 complets, 2 partiels (FR-005, FR-015) → **100 % des FR avec ≥ 1 tâche**
- Ambiguity Count : 0
- Duplication Count : 0
- Critical Issues Count : **0**

## Next Actions

- Aucun point critique : implémentable après la feature 001.
- Recommandé : corriger I1 (moyen) + C1, C2, U1, F1 (mineurs) — 5 petites modifications de `data-model.md`, `tasks.md` et `spec.md`.
- Spec suivante suggérée : **003 « interface MVP-1 »** (coquille + F1 capture, F3 revue/validation, F4 organigramme).
