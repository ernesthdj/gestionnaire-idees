# Tasks: Wireframes et parcours dans les widgets (spec 026)

- [x] T001 Cadre `WidgetFrame` v4 : constructions Wireframe, Parcours, Adapter ; état persistant (`gi.state`, `gi.onState`, `gi.saveState`)
- [x] T002 `WidgetIoService.inputContext` (contexte complet en JSON) ; `WidgetService.build` + contexte et état dans `prompt` ; canal `widget:build` + tests
- [x] T003 Migration `widget_states` (+ down), dépôt, `widget:state` / `widget:saveState` (bornes 64 Ko) + tests
- [x] T004 Prélude du document isolé : `gi.state`, `gi.onState`, `gi.saveState` ; pont renderer (remise à l'ouverture, envoi regroupé) + tests
- [x] T005 Interface : barre d'actions du widget (Wireframe, Parcours, Adapter), invitation sans nœud + tests renderer/axe
- [x] T006 e2e sur l'app réelle ; JOURNAL, CLAUDE.md, statut de la 015 (T012, T013, T016 absorbées)
- [x] T007 [US3] Domaine `shared/widgets/settings.ts` (déclaration Zod, valeurs ramenées à la déclaration) + tests
- [x] T008 [US3] Migration `widget_settings` (+ down), bloc `settings`, `WidgetIoService` (déclarer, lire, écrire), canaux + tests
- [x] T009 [US3] Prélude `gi.settings` / `gi.onSettings`, pont, nœud « ⚙ Réglages » (champs dessinés par l'app), cadre v5 (wireframe → `gi.settings`) + tests renderer/axe
- [x] T010 [US3] e2e : déclaration → panneau, changement en direct, gardé après réouverture
- [x] T011 [D8] Plein écran (`widgets/WidgetFullscreen.tsx`) : cadre à taille réelle, réglages à droite, demande en bas, Échap + tests renderer/axe, e2e (échelle 1)
- [x] T012 [D8] Délai du widget à 10 minutes, raison réelle d'un échec du moteur (`AIGateway`) + test
