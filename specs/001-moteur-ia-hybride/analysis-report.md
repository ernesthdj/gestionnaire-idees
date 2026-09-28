# Specification Analysis Report — 001 Moteur IA hybride & contexte

> Produit par `/speckit-analyze` (lecture seule) le 2026-09-28, sauvegardé manuellement
> (le skill n'écrit aucun fichier). Artefacts analysés : spec.md, plan.md, tasks.md, constitution v1.0.0.

> **Remédiation appliquée le 2026-09-28** (validée par mentalyas) : C1 → T057/T058 + table
> `ai_pending_requests` ; C2 → T059 ; C3 → T049 (point d'intégration F3) + note de dépendance ;
> B1 → vérification intégrée à T024 ; F1 → unités de coût dans contracts/ipc-ai.md ;
> F2 → arborescence plan.md complétée ; U1 → T060. B2 reste accepté tel quel.
> Couverture après remédiation : 27/27 exigences couvertes.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | MEDIUM | spec FR-013 · tasks T020/T025 | Le repli optionnel vers Claude (`allow_claude_fallback`) et le **rejeu** des demandes `QUEUED` (qui les relance, quand) n'ont pas de tâche explicite | Ajouter une tâche US1 : « file persistante des demandes locales en attente + rejeu au retour d'Ollama + repli Claude si autorisé » avec test |
| C2 | Coverage | MEDIUM | spec SC-004 · tasks T034 | L'écart ≤ 5 % avec la facturation réelle n'est vérifié par aucune tâche (T034 ne teste que le calcul) | Ajouter en Polish une vérification manuelle : comparer le cumul `ai_calls` à la console Anthropic sur une série d'appels de test |
| C3 | Coverage | MEDIUM | spec FR-017 · tasks T046/T049 | Les exemples « propositions acceptées/refusées » sont produits par F3, pas encore construite ; seul le stockage est planifié | Noter la dépendance dans tasks.md ; exposer `ExampleStore.record()` pour F3 ; en attendant, exemples via import uniquement |
| B1 | Ambiguity | MEDIUM | research R3 · tasks T024 | Combinaison `messages.parse` + fallbacks serveur (beta) marquée « à vérifier » | Inclure dans T024 une vérification contre la doc SDK ; à défaut, gérer `refusal` sans fallback serveur (échec propre `AI_REFUSAL`) |
| B2 | Ambiguity | LOW | research R6 · spec FR-006 | Heuristique « mot capitalisé » pour les noms en repli : faux positifs probables (noms de magasins, marques) | Accepté (sur-anonymiser est sans risque) ; ajouter 5 cas « marque/magasin » au jeu T028 pour mesurer |
| F1 | Inconsistency | LOW | data-model `cost_millicents` · contracts `spentCents` · L3 `cost_cents` | Unités de coût différentes selon les documents | Stockage en millicentimes, exposition IPC en centimes arrondis — préciser dans contracts/ipc-ai.md |
| F2 | Inconsistency | LOW | tasks T014, T052 · plan § Structure | `tests/support/` et `docs/context/` absents de l'arborescence du plan | Ajouter ces deux dossiers à plan.md § Source Code |
| U1 | Underspecification | LOW | spec FR-012 · tasks T041/T042 | Le « guidage d'installation » d'Ollama n'a pas de critère vérifiable | Critère : message avec les 3 étapes (installer, télécharger le modèle, revérifier) + bouton « Revérifier » fonctionnel |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 point d'accès unique | ✅ | T025 | |
| FR-002 routage configurable | ✅ | T017, T021 | |
| FR-003 validation + 1 retry | ✅ | T018, T025 | |
| FR-004 assemblage contexte | ✅ | T019, T022 | |
| FR-005 cadre de base | ✅ | T015, T019 | |
| FR-006 anonymisation | ✅ | T028–T033 | |
| FR-007 journal sans contenu | ✅ | T016, T020, T025 | |
| FR-008 plafond / alerte / blocage | ✅ | T035, T037 | |
| FR-009 estimation + imputation | ✅ | T034–T037 | |
| FR-010 clé API chiffrée | ✅ | T008, T040, T041 | |
| FR-011 choix modèles / tests | ✅ | T041, T042 | |
| FR-012 détection + guidage Ollama | ✅ | T041, T042 | voir U1 |
| FR-013 file locale / pas de repli par défaut | ⚠️ partiel | T020, T025 | voir C1 |
| FR-014 version dégradée | ✅ | T038 | |
| FR-015 import de contexte | ✅ | T044, T045, T047, T048 | |
| FR-016 versions + rollback | ✅ | T045, T048 | |
| FR-017 exemples | ⚠️ partiel | T046, T049 | voir C3 |
| FR-018 concurrence | ✅ | T020, T025 | |
| FR-019 refus distinct | ✅ | T018, T024 | voir B1 |
| SC-001 sorties invalides rejetées | ✅ | T018 | |
| SC-002 0 donnée identifiante | ✅ | T028–T030 | |
| SC-003 < 3 s local | ✅ | T027 | |
| SC-004 écart coût ≤ 5 % | ❌ | — | voir C2 |
| SC-005 0 appel après plafond | ✅ | T035 | |
| SC-006 clé jamais en clair | ✅ | T040 | |
| SC-007 changement de moteur par config | ✅ | T017 | |
| SC-008 import invalide jamais activé | ✅ | T045 | |

**Constitution Alignment Issues:** aucune. Principes I–VI couverts (T007/T053 sécurité Electron ; T001 dépendances annoncées ; tests obligatoires avec FakeProvider ; aucune écriture métier sans validation).

**Unmapped Tasks:** aucune tâche orpheline (Setup/Foundational/Polish = transverses, attendus).

## Metrics

- Total Requirements : 19 FR + 8 SC (tous « buildable »)
- Total Tasks : 56
- Coverage : 25/27 entièrement couverts, 2 partiels (FR-013, FR-017), 1 non couvert (SC-004) → **93 % complet, 100 % des FR avec ≥ 1 tâche**
- Ambiguity Count : 2
- Duplication Count : 0
- Critical Issues Count : **0**

## Next Actions

- Aucun point CRITICAL : l'implémentation peut démarrer.
- Recommandé avant de coder : corriger C1, C2 et C3 (ajouts de tâches) et F1/F2 (précisions de documentation) — 5 petites modifications de `tasks.md`, `plan.md` et `contracts/ipc-ai.md`.
- B1 sera tranché pendant T024 (vérification SDK).
