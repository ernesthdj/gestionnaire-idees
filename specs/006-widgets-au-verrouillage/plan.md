# Implementation Plan: Widgets proposés au verrouillage

**Branch**: `006-widgets-au-verrouillage` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

## Summary

La réponse de synthèse (plan d'action ou fiche de réflexion) porte un champ facultatif `tools` : 0 à 3 propositions
d'outil. L'aperçu les affiche décochées ; « Confirmer » transmet les outils cochés et leur place sur la carte.
L'éclosion crée, **dans sa transaction et son lot d'historique**, un widget vide par outil coché et son branchement
d'entrée vers l'idée. Après la transaction, une génération par widget est lancée en arrière-plan avec le service de
widgets existant (spec 004), qui connaît déjà la structure des entrées branchées (spec 005). La revue avant
autorisation reste celle de la spec 005.

Recherche, modèle de données et contrats sont regroupés ici, comme pour les specs 004 et 005 (projet solo,
périmètre resserré) ; le `quickstart.md` est écrit avec le code.

## Technical Context

- **Stack** inchangée, **aucune dépendance ajoutée**. Une migration (0016, + down).
- **Réutilisé** : `ReflectionSummaryOut` / `ActionPlanOut` (champ facultatif tolérant, comme `overview`),
  `SynthesisApplier.confirm` (transaction + lot), `BlockRepository.insert`, `WidgetIoRepository.insertInput`,
  `WidgetService.prompt` (tâche `widget`, structure des entrées jointe), revue `WidgetReview`, cadre résultat (005 lot 2).
- **Coût IA** : proposer = ~30 à 60 jetons de sortie par outil proposé dans la réponse de synthèse (aucun appel en
  plus). Chaque outil coché = une génération `widget` (Sonnet 5.5 par défaut, ~3 à 6 centimes). Aucune génération
  sans case cochée.

## Décisions (recherche)

| # | Décision | Pourquoi | Écarté |
|---|----------|----------|--------|
| R1 | `tools` dans la sortie de synthèse existante (les deux natures), `lenientList(…, 3).optional().catch(undefined)` | FR-001/003 : zéro appel en plus ; une proposition fautive est écartée seule, jamais la synthèse | Appel séparé « proposer des outils » (coût, latence, contexte à renvoyer) |
| R2 | Le choix (cases cochées) part avec `fusion:confirm` : `tools: [{ index, x, y }]` | Aucune écriture avant « Confirmer » (principe II) ; pas d'état à synchroniser | Enregistrer les cases à chaque clic (état de plus, sans usage) |
| R3 | Places calculées par l'interface (`placeTools`, fonction pure), bornées et vérifiées par le main | Seule l'interface connaît les positions calculées des idées non épinglées et la taille des étiquettes ; le main contrôle bornes et nombre | Placement dans le main (il ignore la disposition physique) |
| R4 | Widgets et branchements créés dans la transaction d'éclosion, journalisés dans son lot (`canvas_block`, `widget_input`, `before: null`) | FR-005, SC-003 : l'annulation de l'éclosion les retire par le mécanisme d'historique existant | Lot séparé (deux annulations pour une action) |
| R5 | Génération hors transaction, séquentielle, par `WidgetService.prompt` ; le texte de la demande = la proposition | FR-006/007 : réutilise validation, transpilation, versions, conversation, indicateur IA ; la structure des entrées est déjà jointe (`inputShape`) | Chemin de génération dédié (doublon) |
| R6 | Table `widget_requests` : la proposition reste attachée au widget tant qu'il n'a aucune version | FR-010 : « Réessayer » après un échec ou un redémarrage relance la même demande | Relire la synthèse (elle n'est plus proposée, et l'aperçu a pu être corrigé) |
| R7 | En mode dégradé (synthèse par l'IA locale), `tools` est ignoré | FR-013 : la génération exige Claude ; une proposition locale donnerait des outils ingénérables | Garder les propositions et échouer à la génération |
| R8 | Anti-doublon : la consigne liste les outils déjà branchés (titre + résumé) ; l'application écarte en plus les titres déjà présents et les doublons de la réponse | FR-011 : double verrou, comme le seuil des idées suggérées | Consigne seule |

## Architecture

```
Verrouillage                        Main                                         Interface
────────────                        ────                                         ─────────
fusion:lock ─▶ FusionService.lock ── buildSynthesisInput(+ outils déjà branchés)
                                    └ Claude → payload { …, tools? }  ─ R7 : ignoré si dégradé ; R8 : dédoublonné
                                                                                SynthesisPreview : « Outils proposés »
                                                                                  cases (décochées) + « N générations »
Confirmer ─ fusion:confirm { synthesisId, tools: [{ index, x, y }] }            placeTools(idée, étape, blocs)
            └ SynthesisApplier.confirm — UNE transaction, UN lot :
                 document, absorption, état « éclose » (existant)
                 + par outil : bloc widget (x, y, titre) + widget_input(idée, parties annoncées) + widget_requests
            └ après la transaction : ToolGeneration.start(blocs) — séquentiel, en arrière-plan
                 WidgetService.prompt(bloc, texte de la proposition) ─ widget:thinking / widget:thought
                 succès → widget_requests supprimée ; échec → message d'échec dans la conversation (existant)
WidgetNode (sans version, demande en attente) : « Claude prépare cet outil… » ou raison + « Réessayer »
                                               ─ widget:generate { blockId }
```

## Data Model (migration 0016, avec down)

- `widget_requests` : `block_id` PK → `canvas_blocks` (cascade), `root_id` (idée d'origine), `title`,
  `description`, `produces_result` (booléen), `created_at`. Supprimée au succès de la génération ; un widget
  supprimé l'emporte (cascade à la purge ; masquée avec lui avant).
- Aucune autre table : le widget est un bloc `widget` (spec 004), le branchement une ligne `widget_inputs` (005).

### Proposition (sortie IA, `shared/ai/neurons.ts`)

```
ToolProposal = { title: 1..60, description: 1..200, parts: IdeaPart[] (filtrées, sans doublon), producesResult: boolean }
tools?: ToolProposal[] (≤ 3, élément invalide écarté)
```

## Contracts

| Canal | Entrée (Zod, `.strict()`) | Sortie | Règles |
|-------|---------------------------|--------|--------|
| `fusion:confirm` (étendu) | `{ synthesisId, tools?: [{ index: 0..2, x, y }] ≤ 3 }` | `ConfirmView` + `toolBlockIds` | `index` unique et présent dans la proposition ; coordonnées finies et bornées (±10⁶) ; `tools` ignoré si la synthèse est dégradée |
| `widget:generate` (nouveau) | `{ blockId }` | `WidgetView` | Seulement pour un widget sans version qui a une demande en attente ; refus si une génération est déjà en cours |
| `widget:get` (étendu) | inchangé | `WidgetView` + `request: { title, description } \| null` | — |

## Constitution Check

- **I Sécurité** : entrées validées (Zod) ; aucune capacité nouvelle ; le code généré tourne dans le bac à sable
  `gi-widget://` ; la revue 005 reste la seule porte vers les données. OK.
- **II Humain dans la boucle** : rien n'est créé sans case cochée + « Confirmer » ; création atomique, historisée,
  annulée avec l'éclosion. OK.
- **III IA cadrée** : `tools` validé par schéma ; exception `widget` inchangée ; aucune valeur des entrées envoyée
  (seulement la structure, SC-006). OK — **pas d'amendement**.
- **IV Local d'abord** : aucune génération sans Claude ni sans choix ; coût borné (3 propositions, 0 par défaut). OK.
- **V Qualité** : tests d'abord (schéma tolérant, dédoublonnage, transaction + annulation, génération en échec,
  placement, interface). OK.
- **VI Simplicité** : une table ; tout le reste réutilise 003/004/005. OK.

## Project Structure (ajouts et modifications)

```
src/shared/ai/neurons.ts                              # ToolProposal, champ tools
src/main/domain/widgets/toolProposals.ts              # dédoublonnage, texte de la demande de génération
src/main/application/neurons/SynthesisContextBuilder.ts   # outils déjà branchés dans la consigne
src/main/infrastructure/ai/TaskInstructions.ts        # règles de proposition d'outils
src/main/application/neurons/SynthesisApplier.ts      # outils cochés dans la transaction et le lot
src/main/application/widgets/ToolGeneration.ts        # file de générations en arrière-plan, Réessayer
src/main/infrastructure/db/repositories/WidgetRequestRepository.ts
src/main/infrastructure/db/migrations/0016_widget_requests.sql (+ down)
src/renderer/src/fusion/SynthesisPreview.tsx          # section « Outils proposés »
src/renderer/src/fusion/placeTools.ts                 # places autour de l'idée, sans recouvrement
src/renderer/src/canvas/nodes/WidgetNode.tsx          # en préparation / échec + Réessayer
```

## Lots

1. **Propositions** (US1) : schéma, consignes, outils déjà branchés, mode dégradé, dédoublonnage, section de
   l'aperçu. Test manuel : des propositions pertinentes apparaissent (ou aucune), rien n'est créé.
2. **Éclosion et génération** (US2, US3, US4) : migration 0016, confirmation étendue, placement, génération en
   arrière-plan, « Réessayer », annulation. Test manuel complet + mesure du coût (`scripts/ai-usage.cjs`).

Chaque lot se termine par un test manuel guidé, validé avant le suivant.
