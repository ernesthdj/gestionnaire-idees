# Specification Analysis Report — 003 Interface MVP-1 « Brainstormer » (v2)

> `/speckit-analyze` (lecture seule) du 2026-09-28 sur la révision, sauvegardé manuellement.
> Remplace le rapport v1 (historique git).

> **Remédiation appliquée le 2026-09-28** : M1 → `fusion:editProposed` ajouté au contrat IPC de 002 (implémenté
> en 003 T031) ; C1 → badge « proposé par l'IA » + changement en un clic sur les nœuds (T020). D1 tranché par
> mentalyas : verrouillage forcé autorisé avec avertissement « résultat possiblement non optimal ». Couverture 33/33.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| M1 | Inconsistency | MEDIUM | 003 contracts `fusion:editProposed` · 002 ipc-neurons.md | Un canal du domaine « fusion » défini seulement dans la spec d'interface : dérive de contrat entre specs | Le déclarer dans le contrat de 002 (source de vérité du domaine), implémentation tracée en 003 T031 |
| C1 | Coverage | LOW | spec FR-008 · tasks T020/T028 | Catégorie/nature « proposées par l'IA, modifiables en un clic » : seulement depuis la plongée | Badge IA + menu contextuel sur les nœuds du canvas |
| D1 | Decision | LOW | 002/003 Assumptions (verrouillage forcé) | « Autorisé avec avertissement » reste une hypothèse non confirmée par mentalyas | À confirmer ; impact limité (FR-017/FR-010 002 : bouton actif ou bloqué avant « suffisant ») |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs |
|-----------------|-----------|----------|
| FR-001–005 coquille, réglages, clavier/AA | ✅ | T005–T010, T043, T044, T046 |
| FR-006–008 capture | ✅ | T011–T016, T020 |
| FR-009–012 écran Idées, dérive | ✅ | T017–T022, T008 |
| FR-013–016 plongée & croissance | ✅ | T023–T028 |
| FR-017–019 verrouillage, aperçu, fusion | ✅ | T029–T033 |
| FR-020–022 éclos : suivi, lecture, export, réouverture | ✅ | T034–T039 |
| FR-023–024 À valider, historique | ✅ | T040–T042 |
| FR-025 animations + mode réduit | ✅ | T008, T021, T026, T027, T033 |
| SC-001 … SC-008 | ✅ | T016, T049, T027, T049, tests composants, T008, T036, T040 |

**Constitution Alignment Issues:** aucune (export écrit par le main ; aucune IA appelée depuis l'interface ;
packaging en brouillon revu ; dépendances annoncées).
**Unmapped Tasks:** aucune (T029 spike rattaché à US4 / R3 ; T047 direction visuelle rattachée à FR-005/tokens).

## Metrics
- Requirements : 25 FR + 8 SC · Tasks : 49 · Coverage : 33/33 · Ambiguity : 0 · Duplication : 0 · **Critical : 0**
- Risque technique identifié et traité par un spike précoce : animation des positions React Flow (T029).

## Next Actions
MVP-1 « Brainstormer » entièrement spécifié (001 révisée, 002 v2, 003 v2). Confirmer D1, puis commit et reprise
de l'implémentation (001 Phase 2).
