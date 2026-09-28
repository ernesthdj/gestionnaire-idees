# Specification Analysis Report — 003 Interface MVP-1

> Produit par `/speckit-analyze` (lecture seule) le 2026-09-28, sauvegardé manuellement.
> Artefacts : spec.md, plan.md, tasks.md, data-model.md, contracts/ipc-mvp1.md, constitution v1.0.0,
> + contrats de 002 (dépendance).

> **Remédiation appliquée le 2026-09-28** (validée par mentalyas) : I1 → `StructuringService.revise`
> (T052) + test T051, T025 mis à jour ; I2 → sémantique d'annulation d'acceptation (data-model, T022, T026) ;
> C1 → cas `map:overview` dans T033 ; C2 → mesure T053 ; C3 → cas plein écran dans T018.
> Couverture après remédiation : 36/36.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | MEDIUM | tasks T025 · 002 contracts `structuring:restructure` | « Corriger » une proposition passe par `structuring:restructure`, qui **refuse** une idée non encore structurée (`NOT_STRUCTURED`) : la correction d'une toute première décomposition échouerait | Ajouter `StructuringService.revise(proposalId, instruction)` : reprend les tours de la session d'origine + la consigne, produit une nouvelle proposition (même contrôles K1–K7), l'ancienne passe `superseded` ; test d'intégration dédié |
| I2 | Underspecification | MEDIUM | spec FR-018 · data-model transitions · tasks T022/T026 | L'effet d'une annulation d'**acceptation** sur la proposition et le statut de l'idée n'est pas défini (la proposition reste « acceptée » alors que l'arbre a disparu) | À l'annulation d'une acceptation : idée → statut et version d'avant (restaurés par le lot), proposition → `pending` si toujours à jour, sinon `stale` ; exemple positif retiré ; couvrir dans T022 |
| C1 | Coverage | LOW | spec FR-026 · tasks T035/T038 | Filtres, recherche et focus de l'organigramme sans test automatisé | Ajouter à T033 les cas `map:overview` (catégorie, statut, recherche, focus + voisines directes) |
| C2 | Coverage | LOW | spec SC-003 | « Revue d'une proposition ≤ 15 éléments en < 1 min » non mesurée | Ajouter à T041 (ou T050) une mesure manuelle sur 5 propositions fixtures |
| C3 | Coverage | LOW | spec Edge Cases (plein écran) | Capture au-dessus d'une app en plein écran sans vol durable du focus : non vérifié | Ajouter le cas au test manuel T018 (vidéo plein écran, jeu fenêtré) |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 tray + démarrage | ✅ | T005, T006, T044 | |
| FR-002 navigation | ✅ | T008, T009 | |
| FR-003 réglages | ✅ | T042, T043 | |
| FR-004 premier lancement | ✅ | T045, T046 | |
| FR-005 clavier + AA | ✅ | T009, T011, T031, T040, T048 | |
| FR-006 raccourci global | ✅ | T013, T014 | voir C3 |
| FR-007 touches de capture | ✅ | T011, T016 | |
| FR-008 confirmation + focus | ✅ | T014, T016, T018 | |
| FR-009 capture sans IA | ✅ | T010, T012 | |
| FR-010 catégorie IA modifiable | ✅ | T010, T017 | |
| FR-011 file À valider | ✅ | T028, T029 | |
| FR-012 revue ajout/modif/suppr | ✅ | T019, T029 | |
| FR-013 décocher / éditer / avertir | ✅ | T019, T029, T031 | |
| FR-014 tout-ou-rien | ✅ | T020, T024 | |
| FR-015 refus + exemples | ✅ | T021, T025 | |
| FR-016 correction IA | ⚠️ | T021, T025 | voir I1 |
| FR-017 périmée | ✅ | T020 | |
| FR-018 annulation | ⚠️ | T022, T026, T030 | voir I2 |
| FR-019 archivage 14 j | ✅ | T021, T027 | |
| FR-020–021 carte, dagre, positions | ✅ | T033, T037, T038 | |
| FR-022 statuts + propagation | ✅ | T032, T034 | |
| FR-023–025 branche, déclencheur, édition | ✅ | T033, T039 | |
| FR-026 filtres / recherche / focus | ⚠️ | T035, T038 | voir C1 |
| FR-027 panneau de détail | ✅ | T039 | |
| FR-028 historique | ✅ | T026, T030 | |
| SC-001 … SC-008 | ✅ sauf SC-003 | T018, T010, —, T020, T022, T041, T032, tests composants | voir C2 |

**Constitution Alignment Issues:** aucune. Point notable conforme : T049 (packaging) explicitement en brouillon soumis à revue ; nouvelles dépendances annoncées et validées avant installation (T001).

**Unmapped Tasks:** aucune.

## Metrics

- Total Requirements : 28 FR + 8 SC
- Total Tasks : 50
- Coverage : 32/36 complets, 3 partiels (FR-016, FR-018, FR-026), 1 non couvert (SC-003) → **100 % des FR avec ≥ 1 tâche**
- Ambiguity Count : 1 (I2)
- Duplication Count : 0
- Critical Issues Count : **0**

## Next Actions

- Aucun point critique. Corriger **I1 et I2** avant l'implémentation de US2 (ils touchent au cœur de la validation).
- C1–C3 : ajouts de cas de test, à intégrer dans la même passe.
- Le MVP-1 est entièrement spécifié : 001 → 002 → 003, prêt pour `/pipeline init it` ou `/speckit-implement`.
