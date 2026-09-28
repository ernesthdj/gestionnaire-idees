# Specification Analysis Report — 002 Moteur de neurones (v2)

> `/speckit-analyze` (lecture seule) du 2026-09-28 sur la révision « Brainstormer », sauvegardé manuellement.
> Remplace le rapport de la v1 (questionnaire linéaire), disponible dans l'historique git.

> **Remédiation appliquée le 2026-09-28** : U1 → dimensions de référence par nature (T027/T028) ;
> C1 → assertion d'ordre dans T011 ; F1 → `growthDepth` / `planDepth` nommés (T012, data-model). Couverture 28/28.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| U1 | Underspecification | MEDIUM | spec FR-003 « orientées selon la nature » · T028 | L'orientation exécution/exploration n'a pas de critère vérifiable | Définir dans ContextBuilder 2 listes de dimensions de référence (Action : quand, combien, comment, source, lieu ; Réflexion : pourquoi, options, critères, contraintes, risques) transmises à l'IA ; test : les dimensions des extensions reçues sont dans la liste de la nature (FakeProvider) |
| C1 | Coverage | LOW | spec SC-004 (« perçu comme instantané ») | Mesure du retour immédiat du sous-neurone non tracée | T014 renvoie le sous-neurone avant l'appel IA ; ajouter à T011 une assertion d'ordre (événement de création émis avant l'appel IA) |
| F1 | Inconsistency | LOW | data-model `neurons.depth ≤ 6` · plan profondeur ≤ 5 | Deux profondeurs différentes (croissance 6, plan 5) peuvent prêter à confusion | Assumé (deux arbres distincts) ; nommer explicitement `growth_depth` et `plan_depth` dans le code et la doc |
| D1 | Dependency | LOW | spec 001 T015/T026 | 002 suppose le cadre v2 et les TaskKind révisés de 001 | Déjà reporté dans 001 (révision du 2026-09-28) ; vérifier l'ordre d'implémentation |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs |
|-----------------|-----------|----------|
| FR-001–002 neurones, nature, catégorie | ✅ | T008, T009, T027 |
| FR-003–007 croissance | ✅ | T010–T015 |
| FR-008–009 jauge | ✅ | T016, T017 |
| FR-010–016 fusion | ✅ | T018–T024 |
| FR-017–018 liens | ✅ | T025, T026 |
| FR-019 moteur 001 + out_of_scope | ✅ | T011, T030 |
| FR-020 centimes | ✅ | T003, T019 |
| FR-021 retour immédiat | ✅ | T014 (voir C1) |
| SC-001 … SC-007 | ✅ | T010, T031, T019, T031, T020, T011, T031 |

**Constitution Alignment Issues:** aucune.
**Unmapped Tasks:** aucune.

## Metrics
- Requirements : 21 FR + 7 SC · Tasks : 32 · Coverage : 28/28 avec ≥ 1 tâche (1 critère d'orientation à préciser : U1)
- Ambiguity : 1 · Duplication : 0 · **Critical : 0**

## Next Actions
Corriger U1 (moyen) et C1/F1 (mineurs) avant l'implémentation ; D1 déjà traité.
