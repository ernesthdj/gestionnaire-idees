# Implementation Plan: Widgets branchés — entrées, sorties et cadre résultat

**Branch**: `005-widgets-entrees-sorties` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

## Summary

Un widget reçoit des données par des **branchements d'entrée** (idée → widget, résultat → widget) et émet un
**résultat** affiché dans un **cadre résultat** (bloc de la carte). Tout passe par un pont `postMessage` tenu par
l'app, qui ne transmet que ce qui a été autorisé pour une version figée du widget. Le résultat peut être attaché à
une idée par une proposition validée. Claude n'intervient que sur la **structure** des données.

## Technical Context

- **Stack** inchangée ; **aucune dépendance ajoutée**. Empreinte par `node:crypto` (SHA-256).
- **Coût IA** : aucun appel pour brancher, transmettre, émettre ou afficher la vue générique. Un appel `widget`
  (Sonnet 5.5, ~3 à 6 centimes) par mise en forme, uniquement sur demande, réutilisé tant que la structure est stable.

## Architecture

```
Carte (renderer)                                   Main
────────────────                                   ─────────────────────────────────────────────
lien idée → widget ── widgetIo:connect ──────────▶ WidgetIoService.connect (branchement, boucles)
WidgetReview (code, capacités, parties) ─ approve ▶ WidgetIoService.approve (empreinte de la version)
WidgetNode
 ├ iframe gi-widget://  ◀─ postMessage gi:inputs ── WidgetBridge (renderer) ◀─ widgetIo:inputs ── InputAssembler
 │   gi.inputs / gi.output(data)                                                (parties cochées seulement)
 └ postMessage gi:output ─▶ WidgetBridge ─ widgetIo:emit ─▶ WidgetIoService.emit (Zod, bornes, regroupement)
                                                           └ ResultRepository (dernier résultat, signature)
ResultNode (kind 'result')
 ├ iframe gi-widget://result/<bloc> : vue générique (code figé de l'app) ou mise en forme (version Claude)
 ├ « Mettre en forme avec Claude » ─ widgetIo:format ─▶ WidgetService.prompt (verbatim : signature de structure)
 └ lien résultat → idée ─ widgetIo:propose ─▶ ProposalService (principe II) ─▶ neuron_data + change_log
```

### Pont (`postMessage`)

- Le cadre est d'origine opaque : l'app envoie avec `targetOrigin '*'` et **identifie le cadre par
  `event.source === iframe.contentWindow`** (jamais par l'origine). Messages hors contrat ignorés.
- Prélude du document (spec 004) étendu : `window.gi = { inputs, onInputs(cb), output(data) }`, figé
  (`Object.freeze`), injecté avant le code du widget. Le prélude ne fait que relayer : il n'est pas une barrière.
- La barrière est côté main : `widgetIo:inputs` ne renvoie des données que si l'empreinte de la version affichée
  est approuvée, et seulement pour les branchements et les parties autorisés. Le renderer ne choisit rien.
- CSP inchangée (`default-src 'none'`) : `postMessage` n'est pas une connexion réseau.

### Revue et empreinte

`sha256(html ∥ css ∥ ts ∥ capacités triées)` stockée à l'approbation (`widget_approvals`). Afficher une version
non approuvée d'un widget branché = cadre affiché **sans données** + bandeau « À revoir ». Un widget sans
branchement garde le comportement 004.

### Signature de structure (pour Claude)

Fonction pure `shapeOf(json)` : types, noms de champs, longueurs de listes, profondeur — aucune valeur. Exemple :
`{ total: number, lignes: [{ libelle: string, montant: number }] × 12 }`. Sert à (1) décrire les entrées à Claude
quand on fait évoluer un widget branché, (2) demander la mise en forme d'un résultat, (3) décider si une mise en
forme est réutilisable (égalité de signature, tailles exclues).

Limite connue : les **noms de champs** partent chez Claude. Ils viennent du code du widget (écrit par Claude) ou de
notre propre format d'idée, pas de la saisie de l'utilisateur ; ils passent malgré tout par l'anonymiseur.

### Cadre résultat

Bloc `kind: 'result'` relié à son widget (`source_block_id`). Document servi par `gi-widget://result/<bloc>` :
- sans mise en forme : vue générique, **code figé de l'app** (tableau / liste / arbre / valeur), données reçues par le pont ;
- avec mise en forme : version générée par Claude (mêmes tables `widget_versions` / `widget_messages`, rattachées au bloc résultat), qui lit `gi.inputs`.
Un cadre résultat n'a qu'une capacité : lire le résultat de son widget. Pas de revue (il ne lit aucune idée directement) ; il hérite de l'approbation du widget source.

### Écriture vers une idée

Lien résultat → idée = ligne `widget_proposals` (état `pending`), visible sur la carte et dans « À valider ».
Validation → `neuron_data` (copie figée du résultat, provenance) + `change_log` (lot annulable). Aucune écriture
directe : le widget n'a pas de capacité d'écriture, c'est l'utilisateur qui tire le lien et valide.

## Data Model (une migration par lot, chacune avec son down ; lot 1 = 0014)

- `widget_inputs` : id, block_id → canvas_blocks (cascade), source_kind (`idea` | `result` | `step`), source_id, parts (JSON, liste), created_at, deleted_at.
- `widget_approvals` : block_id (cascade) + fingerprint (clé), approved_at. L'empreinte couvre le code de la version ET la liste exacte des sources et parties lues : changer l'un ou l'autre redemande la revue.
- `widget_results` (lot 2, migration 0015) : block_id (le widget, cascade) PK, data_json, updated_at. Le cadre se retrouve par `canvas_blocks.source_block_id` (pas de `result_block_id` en double) ; `shape` arrive au lot 3.
- `neuron_data` : id, root_id → neurons (cascade), title, data (JSON), source_block_id, source_version_id, created_at, deleted_at.
- `widget_proposals` : id, result_block_id, target_root_id, data (JSON), status (`pending` | `accepted` | `rejected`), created_at.
- `canvas_blocks.kind` accepte `result` ; `canvas_blocks.source_block_id` (cadre résultat → widget).

## Constitution Check

- **I** : le pont ne transmet que l'autorisé, décidé par le main ; tests d'évasion SC-002. OK.
- **II** : toute écriture dans une idée est une proposition validée, journalisée, annulable. OK.
- **III** : revue du code et des capacités avant toute transmission (déjà prévu en 1.2.0 — **pas d'amendement**). OK.
- **IV** : aucune valeur vers Claude ; aucun réseau dans les cadres. OK.
- **V** : tests d'abord. **VI** : réutilise blocs, liens de la carte, `WidgetService`, propositions, Historique. OK.

## Project Structure (ajouts)

```
src/main/domain/widgets/shape.ts                      # shapeOf, égalité de signature
src/main/domain/widgets/resultLimits.ts               # bornes d'un résultat
src/main/application/widgets/WidgetIoService.ts       # connect, approve, inputs, emit, propose
src/main/application/widgets/InputAssembler.ts        # parties d'une idée → données transmises
src/main/application/widgets/GenericResultView.ts     # document de la vue générique
src/main/infrastructure/db/repositories/WidgetIoRepository.ts
src/main/ipc/widgetIoHandlers.ts                      # widgetIo:*
src/shared/ipc/widgetIo.ts
src/renderer/src/widgets/WidgetBridge.ts              # postMessage ↔ IPC
src/renderer/src/widgets/WidgetReview.tsx             # revue avant exécution
src/renderer/src/canvas/nodes/ResultNode.tsx
src/renderer/src/canvas/edges/IoEdge.tsx              # liens idée → widget, widget → résultat, résultat → idée/widget
```

## Lots

1. **Entrées** (US1) : branchement, revue, empreinte, pont en lecture, `gi.inputs`.
2. **Sorties** (US2) : `gi.output`, cadre résultat, vue générique.
3. **Mise en forme** (US3) : signature de structure, tâche `widget` sur le cadre résultat.
4. **Réinjection** (US4) : proposition vers une idée, données attachées, chaînage résultat → widget, nouvelle idée.

Chaque lot se termine par un test manuel guidé, validé avant le suivant.
