# Analysis Report — spec 021 « Git et GitHub » (/speckit-analyze, 2026-10-08)

Analyse en lecture seule : **aucune remédiation appliquée** (en attente de la validation de mentalyas).

| ID | Catégorie | Gravité | Emplacement | Constat | Recommandation |
|----|-----------|---------|-------------|---------|----------------|
| C1 | Constitution I | CRITICAL | research R11 ; `ProjectService.initGit` (spec 016) | `commit -m <message>` (message en argument) laissé hors du socle ; la constitution I impose les messages par stdin | Dans T008, passer `initGit` à `commit -F -` ; garder `add --all` (dossier neuf) en le documentant |
| H1 | Sécurité / ambiguïté | HIGH | Edge Cases, FR-005 ; R3 ; T009 | Une clé non neutralisable (`filter.*`, `include.*`, `core.sshCommand`) exécute du code dès une lecture ; la spec ne bloque que l'écriture, le plan bloque tout | Amender l'edge case et FR-005 : toute commande bloquée hors confiance |
| H2 | Sécurité / constitution II | HIGH | US6-5, T048 ; FR-005 | Dépôt de confiance avec hooks suivis (`.husky`) : passer sur `pr/<n>` puis commiter exécute un hook écrit par l'auteur de la PR | Profil sans hooks tant que HEAD est sur `pr/*` ; test dans T048 |
| H3 | Exigence / décision | HIGH | FR-015, US2-7 ; R10 ; T019 | Un dépôt d'organisation n'a jamais mentalyas pour propriétaire → push sur la branche principale toujours refusé, même avec droit `admin` | Décider : propriétaire = compte connecté **ou** droit `admin` / `maintain` ; amender FR-015 |
| H4 | Conflit spec / plan | HIGH | US5-2, FR-027 ; R13 ; T041 | Clone partiel par défaut : `--numstat` téléchargerait tout l'historique ; le plan compte les commits à la place | Valider le repli (affiché, lignes après « Tout télécharger ») ou accepter le téléchargement |
| M1 | Ambiguïté | MEDIUM | US3-4 ; R7 ; T028 | git ne se met pas en pause à 500 Mo | Reformuler : question Continuer / Annuler, le téléchargement continue |
| M2 | Incohérence | MEDIUM | FR-017 ; R8 | Le plan accepte `ssh://git@…`, absent de FR-017 | Retirer `ssh://` de R8, ou l'ajouter à FR-017 |
| M3 | Sous-spécification | MEDIUM | Edge case « fusion hors app » ; `GitStatusView.operation` | `merge` ne distingue pas une fusion de l'app d'une fusion lancée en terminal | `merge` seulement si une session correspond, sinon `other` ; T012 / T036 |
| M4 | Couverture | MEDIUM | FR-040 ; T021, T023, T024 | Aucun test explicite « rien modifié » après réseau coupé, délai ou identifiants refusés | Ajouter ces tests aux trois tâches |
| M5 | Incohérence | MEDIUM | US2-7 ; T025 | « Créer une branche » désactivé avant US6 alors qu'il existe dès US1 | L'activer dès US2 ; PR mentionnée en texte jusqu'à US6 |
| M6 | Duplication inter-specs | MEDIUM | FR-022 ; T027–T028 ; 017 T028–T031 ; 020 T026–T027, R7 | Le même clone figure dans 3 listes ; 020 R7 décrit encore un seul profil | Reporter « `CloneService` à profils » dans 017 et 020 au moment de T028 |
| M7 | Sous-spécification | MEDIUM | FR-007 ; T013, T016 | Revert exigé sans scénario d'acceptation | Ajouter un scénario US1-8 |
| L1 | Incohérence brainstorm | LOW | FR-038 ; R12 ; L3 | Le L3 routait le « Local uniquement » vers le modèle local ; la spec (suivie) donne des propositions vides | Aucun |
| L2 | Incohérence brainstorm | LOW | L2 GC-6 ; R7 | Seuil de 100 000 commits abandonné | Aucun |
| L3 | Périmètre | LOW | `git:restoreFile` ; R15 | « Rétablir un fichier » écarté | Aucun |
| L4 | Données | LOW | `git_clones_running.target_dir` | Seul chemin absolu stocké, le temps du clone | Ne jamais le journaliser |
| L5 | Granularité | LOW | T016, T043, T050 | Tâches d'interface larges | Découper au moment de coder |
| L6 | Coordination | LOW | T010 | Numéro de migration | Déjà traité (prochain numéro libre) |

**Couverture** : FR-001–008 → T004, T006, T008, T009, T012–T016 ; FR-009–016 → T011, T018–T025 ; FR-017–022 → T027–T032 ;
FR-023–026 → T034–T038 ; FR-027–029 → T040–T043 ; FR-030–034 → T018, T045–T050 ; FR-035–036 → T052–T054 ;
FR-037–040 → T011, T014, T035, T042, T046, T047, T056 (FR-040 partielle, M4) ; SC-001/007/008 → T017/T039/T044 ;
SC-002 → T004, T018, T056 ; SC-003 → T006, T022 ; SC-004 → T042, T056 ; SC-005 → T027, T028, T056 ; SC-006 → T057.
Tâches sans exigence : aucune.

**Métriques** : 48 exigences (40 FR + 8 SC), 58 tâches, couverture 100 % (FR-040 partielle), ambiguïtés 3, duplication 1,
CRITICAL 1, HIGH 4, MEDIUM 7, LOW 6.

## Prochaines actions
1. Avant `/speckit-implement` : résoudre C1, trancher H3 et H4, amender la spec pour H1 et H2.
2. MEDIUM : amender la spec et le contrat (M1, M2, M3, M5, M7) ; ajouter les tests M4 ; reporter M6 au moment de T028.

## Remédiation
**Non appliquée.** Sur validation : `spec.md` (H1, H2, H3, H4, M1, M2, M7), `research.md` (C1, H2, H3, H4, M2),
`contracts/interfaces.md` (M3), `tasks.md` (T008, T048, T012/T036, T021/T023/T024, T025, T028).

## Remédiation appliquée (2026-10-08)
Validée par mentalyas. Décisions : **H3** → D11 (propriétaire = dépôt à son compte **ou** droit `admin` / `maintain`) ;
**H4** → D12 (clone partiel : auteur principal au nombre de commits, « par commits », lignes après « Tout
télécharger ») ; le reste tel que recommandé.

| ID | Fichier | Sections modifiées |
|----|---------|--------------------|
| C1 | `research.md` · `tasks.md` | R11 (`initGit` → `commit -F -`, `add --all` documenté) · T008 |
| H1 | `spec.md` · `research.md` · `tasks.md` | FR-005, Edge Cases (configuration à risque) · R3 · T009 |
| H2 | `spec.md` · `research.md` · `contracts/interfaces.md` · `tasks.md` · `plan.md` | FR-005 (pas de hooks sur `pr/*`) · R2 · `GitStatusView.onPrBranch` · T008, T048 (test `.husky`) · Constitution Check II |
| H3 | `spec.md` · `research.md` · `contracts/interfaces.md` · `tasks.md` · `quickstart.md` · `plan.md` | Décisions D11, US2-7, FR-015 · R10 · `PushPreview.ownedByViewer` · T019 (tests des deux cas) · §2 étape 7 · Constitution Check II et re-vérification |
| H4 | `spec.md` · `research.md` · `contracts/interfaces.md` · `data-model.md` · `tasks.md` · `quickstart.md` | Décisions D12, US5-2, FR-027 · R13 (+ `git:fetchAll`) · canal `git:fetchAll`, commandes · `git_operations.kind` `fetch_all` · T041, T043 · §5 étape 2 |
| M1 | `spec.md` · `research.md` | US3-4 (question, le téléchargement continue) · R7 |
| M2 | `research.md` | R8 (`https://` et `git@` seulement, `ssh://` refusé) ; FR-017 inchangée (déjà stricte) |
| M3 | `contracts/interfaces.md` · `tasks.md` | `GitStatusView.operation` (commentaire) · T012, T036 |
| M4 | `tasks.md` | T021, T023, T024 (tests FR-040 : rien modifié localement) |
| M5 | `tasks.md` | T025 (« Créer une branche » actif dès US2), T050 |
| M6 | `research.md` · `tasks.md` | R6 (report au début de T028) · T028, T058 |
| M7 | `spec.md` · `tasks.md` | US1-8 (revert) · T013 |

`checklists/requirements.md` revérifié : tous les items restent vrais (note ajoutée). LOW L1–L6 : aucun changement.
**Point ouvert** : D11 lit « dépôt tiers » du principe II comme « dépôt sans droit `admin` / `maintain` » ; une
clarification (PATCH) de la constitution est à décider par mentalyas. La constitution n'a pas été modifiée.
