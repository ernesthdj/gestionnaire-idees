---
description: "Task list — 004 Boîte à outils de la carte et mini-widgets"
---

# Tasks: Boîte à outils de la carte et mini-widgets

**Input**: `specs/004-widgets/` (spec.md, plan.md) · **Prerequisites**: 003 (carte, blocs, passerelle IA)

**Tests**: obligatoires (constitution V), écrits d'abord ; `should_<comportement>_when_<condition>`.

## Phase 0 : Gouvernance

- [x] T001 Amendement de constitution 1.2.0 (principe III, exception `widget`) — **validation mentalyas**

## Phase 1 : Lot 1 — Boîte à outils + notes (US1, US2)

- [x] T002 Migration 0011 (+ down) : `canvas_blocks.kind`, `text`, `current_version_id` ; tables `widget_versions`, `widget_messages`
- [x] T003 [P] Tests : création de note / widget au point voulu, texte de note borné, suppression annulable
- [x] T004 `canvas:createBlock` accepte `kind` ; `canvas:updateBlock` accepte `text` (note) ; bornes par type
- [x] T005 [P] Tests renderer : clic droit dans le vide → panneau, clavier, `Échap`, pas de panneau sur un objet
- [x] T006 `ToolMenu` (clic droit sur le vide) : Nouvelle idée · Note · Widget IA
- [x] T007 `NoteNode` : édition au double-clic, redimensionnement borné, suppression

## Phase 2 : Lot 2 — Widget isolé (US3 sans IA)

- [x] T008 [P] Tests : document isolé (CSP en en-tête et `<meta>`, prélude WebRTC, jetons de thème, `</script>` neutralisé)
- [x] T009 [P] Tests : transpilation (types retirés, `enum` converti — mode `transform` —, code invalide refusé avec message clair)
- [x] T010 `WidgetDocument`, `transpile`, protocole `gi-widget://` + filtre `webRequest` + CSP de l'app (`frame-src gi-widget:`)
- [x] T011 `WidgetNode` : barre de titre (drag), iframe `sandbox="allow-scripts"`, redimensionnement borné 240×160 → 1600×1200, cadre inerte pendant le geste (déplacement et redimensionnement), bouton Relancer (arrête un widget bloqué)

## Phase 3 : Lot 3 — Génération par Claude (US3)

- [x] T012 [P] Tests : sortie `widget` (Zod, bornes 100 Ko), routage Claude seul, pas de repli local, `verbatim` non anonymisé, modèle `widgetModel`
- [x] T013 Tâche `widget` : cadre système dédié `WidgetFrame`, consigne, schéma, `maxTokens`/effort, `widgetModel` (réglages IA, révision 3)
- [x] T014 [P] Tests : `WidgetService.prompt` (version N+1, messages, échec de transpilation → version précédente conservée), `restore`
- [x] T015 `WidgetService` + `WidgetRepository` + `widget:get|prompt|restore`
- [x] T016 Chatbox (indicateur IA + moteur, figée pendant la génération), versions, onglet Code (texte)
- [x] T017 [P] Tests d'évasion (SC-002) sur le document construit et le filtre de requêtes (`widget-escape.test.ts`) + test manuel guidé (`quickstart.md` § 4)
- [x] T018 JOURNAL, checklist de test manuel (`quickstart.md`) — **validation manuelle de mentalyas en attente**
