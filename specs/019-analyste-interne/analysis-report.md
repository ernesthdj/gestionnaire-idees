# Analysis Report — spec 019 « Analyste interne » (/speckit-analyze, 2026-10-07)

Artefacts : `spec.md`, `plan.md`, `tasks.md`, `research.md` · constitution 4.2.0 · code vérifié :
`src/main/index.ts:99` (`requestSingleInstanceLock`), `package.json` (`seed:demo`).

| ID | Catégorie | Gravité | Emplacement | Constat | Recommandation |
|----|-----------|---------|-------------|---------|----------------|
| C1 | Constitution | CRITICAL | research R7, T031 ; constitution I | I exige « sans interpréteur intermédiaire ni shell » ; R7 lance `node npm-cli.js` | Clarification 4.2.1 de I (npm est un programme Node : `node` + `npm-cli.js` par chemins absolus, sans shell) |
| I1 | Incohérence | HIGH | FR-032, T035, quickstart §4 | « Essayer » sur le profil démo : verrou d'instance unique + même base que l'app ouverte | Profil d'essai distinct ; vérifier la portée du verrou |
| I2 | Incohérence | HIGH | research R4, T028 ; spec 017 T009 | « Lier et cartographier » via import repris refusé (`ALREADY_LINKED`) si un genesis lie déjà le dépôt | Analyse statique sur le dossier lié sans nouvel import |
| U1 | Sous-spécifié | MEDIUM | R6, T032 | Jonction `node_modules` dans le worktree : écriture possible dans le `node_modules` du dépôt principal | Refus des écritures sous `node_modules` (hook d'avant-écriture) + test |
| U2 | Sous-spécifié | MEDIUM | R5, data-model, T032 | Marqueur « neurone de mise à jour non affiché » non tranché | Le fixer dans la migration 0030 |
| G1 | Couverture | MEDIUM | FR-019, T021 | Règle ≥ 5 répétitions non contrôlée | `ia_vers_code` exige une clé `obs:ia:*` |
| G2 | Couverture | MEDIUM | Edge case dépôt déplacé | Aucune pause de la sonde | Revérification au démarrage (T008, T010) |
| G3 | Couverture | MEDIUM | SC-009 | Aucune mesure | 3 analyses sur la semaine simulée (T042) |
| I3 | Incohérence | LOW | contracts §Sonde | Phrase contradictoire sur l'identifiant brut | Reformuler (jamais stocké) |
| A1 | Ambiguïté | LOW | T012 | Points d'action non listés | Lister à l'implémentation |
| D1 | Duplication | LOW | FR-027 / FR-043 | Redite volontaire | Aucune action |
| T1 | Terminologie | LOW | spec / plan | copie de travail / worktree | Glossaire |
| L1 | Constitution II | LOW | data-model | Refus non réversible | `refused → new` |

**Métriques** : 52 exigences (43 FR + 9 SC), 43 tâches, couverture 98 %, ambiguïtés 1, doublons 1, CRITICAL 1, HIGH 2.

**Next Actions** : C1 bloque `/speckit-implement` (constitution 4.2.1) ; I1, I2 à amender avant US3 / US4 ; MEDIUM et
LOW corrigés dans les artefacts.

## Remédiation
Appliquée le 2026-10-07 après validation de mentalyas : C1 → constitution 4.2.1 ; I1 → FR-032, scénario US4-8,
research R11, T035, quickstart §4, contrat `update:try` ; I2 → research R4, T023, T028 ; U1, U2 → research R5,
data-model (`neurons.hidden`), T004, T032 ; G1 → T021 ; G2 → research R12, edge case, T008, T010 ; G3 → T042 ;
I3 → contrat Sonde ; T1 → glossaire de la spec ; L1 → FR-018, transition `refused → new`, T025. A1 et D1 : sans
changement (A1 traité à l'implémentation de T012).
