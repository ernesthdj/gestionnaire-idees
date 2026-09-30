# Implementation Plan: Boîte à outils de la carte et mini-widgets

**Branch**: `004-widgets` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

## Summary

Clic droit sur la carte → panneau d'outils (idée, note, widget). Les notes et les widgets sont des **blocs** de la carte
(table `canvas_blocks` existante, prévue pour eux en 003) avec un `kind`. Un widget est généré par Claude (tâche
`widget`) en HTML + CSS + TypeScript, transpilé localement, puis servi par le main sur un protocole dédié
`gi-widget://` et exécuté dans un iframe isolé. Une chatbox par widget fait évoluer le code par versions.

## Technical Context

- **Stack** inchangée (Electron 44 / Node 24.21, React, React Flow, Drizzle/SQLCipher, Zod). **Aucune dépendance
  ajoutée** : transpilation par `stripTypeScriptTypes` de `node:module` (Node 24, mode « strip » : TypeScript
  effaçable uniquement — pas d'`enum`, de `namespace` ni de propriétés de paramètres ; la consigne l'impose).
- **Modèle** : `claude-sonnet-5-5` par défaut (nouveau réglage `widgetModel`), effort `medium`, `max_tokens` 32 000.
  Coût estimé : 3 000 à 6 000 jetons de sortie ≈ 3 à 6 centimes (Sonnet 5.5 : 2 $ / 10 $ par MTok).
- **Pas de repli local** : l'IA locale ne génère pas de code (`widget` routé Claude, `allowDegraded` faux).

## Architecture

```
Renderer (carte)                         Main
─────────────────                        ──────────────────────────────────────────────
ToolMenu (clic droit) ─ canvas:createBlock ─▶ CanvasService (kind note | widget)
NoteNode  ─ canvas:updateBlock (text)    ─▶ CanvasBlockRepository
WidgetNode
 ├ barre de titre (drag), Code, versions, supprimer
 ├ <iframe sandbox="allow-scripts"        protocol.handle('gi-widget')
 │    src="gi-widget://w/<id>?v=<ver>&theme=dark"> ◀── WidgetDocument.build(version, theme)
 │                                          en-têtes : CSP default-src 'none' …
 └ chatbox ─ widget:prompt ───────────────▶ WidgetService.prompt
                                             ├ AIGateway.run({ kind: 'widget', input: message anonymisé,
                                             │     verbatim: code courant (sortie de Claude, non anonymisée) })
                                             ├ transpile (stripTypeScriptTypes) + bornes
                                             └ WidgetRepository (version N+1, messages)
```

### Isolation (FOUNDATION §0.3-1, défense en profondeur)

1. `iframe sandbox="allow-scripts"` **sans** `allow-same-origin` / `allow-popups` / `allow-modals` /
   `allow-top-navigation` / `allow-forms` → origine opaque : ni `parent`, ni `top`, ni stockage, ni boîte de dialogue.
2. Document servi par `gi-widget://` (et non `srcdoc`, qui hériterait de la CSP de l'app et bloquerait le script) :
   CSP en **en-tête et en `<meta>`** : `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
   img-src data: blob:; font-src data:` — **aucun** `connect-src` / `frame-src`.
3. Filtre `session.webRequest.onBeforeRequest` : toute requête émise par un cadre `gi-widget:` vers un autre protocole
   est annulée (même si une CSP était contournée).
4. Prélude injecté avant le code : neutralise `RTCPeerConnection` & co. (WebRTC contourne la CSP) ; politique
   IP WebRTC `disable_non_proxied_udp`.
5. Pas de preload dans les sous-cadres (défaut Electron, `nodeIntegrationInSubFrames` faux) ; permissions refusées
   (déjà en place). CSP de l'app : ajout de `frame-src gi-widget:` uniquement.
6. Le code n'est **jamais** injecté dans le DOM de l'app : il n'existe que dans le document `gi-widget://`.
   L'onglet Code l'affiche comme texte (`<pre>`), jamais comme HTML.

### Anonymisation

Le **message** de l'utilisateur passe par l'anonymiseur comme toute entrée vers Claude. Le **code courant** du widget
est renvoyé tel quel (`verbatim`) : c'est une sortie de Claude (issue de messages déjà anonymisés), non modifiable par
l'utilisateur en v1 — rien de nouveau ne quitte la machine, et l'anonymiseur casserait le code (montants → fourchettes,
mots capitalisés masqués si l'IA locale est arrêtée).

## Data Model (migration 0011 + down)

- `canvas_blocks` + `kind` (`empty` | `note` | `widget`, défaut `empty`) + `text` (note) — les blocs existants restent `empty`.
- `widget_versions` : id, block_id → canvas_blocks (cascade), number, title, html, css, ts, js, summary, model, created_at.
- `widget_messages` : id, block_id (cascade), role (`user` | `assistant`), text, version_id?, created_at.
- `canvas_blocks.current_version_id` : version affichée (restauration = changement de pointeur).
- Réglage IA `widgetModel` (config IA, révision 3).

## Constitution Check — amendement 1.2.0 (MINOR) à faire valider

Principe **III. IA cadrée et vérifiable**, ajout :
> Exception unique au refus de produire du code : la tâche `widget` dispose de son **propre cadre système figé**
> (fichier unique HTML/CSS/TypeScript effaçable, aucune ressource externe, aucune API de l'app hors pont de capacités).
> Le code généré ne s'exécute **que** dans le bac à sable `gi-widget://` (§ Isolation) ; il n'est jamais évalué ni
> injecté dans l'app. Tant qu'un widget n'a aucune capacité, il peut s'exécuter sans revue préalable ; toute demande
> de capacité (spec 005) impose la revue du code et des capacités avant exécution.

Principes I (sécurité : isolement en 6 couches, tests d'évasion), II (aucune écriture sur les idées en v1), IV
(anonymisation du message, pas de réseau), V (tests d'abord), VI (réutilise blocs, passerelle, indicateur IA) : OK.

## Project Structure (ajouts)

```
src/main/application/widgets/WidgetService.ts        # prompt, restore, transpile, bornes
src/main/application/widgets/WidgetDocument.ts       # construit le document isolé (CSP, prélude, jetons de thème)
src/main/domain/widgets/transpile.ts                 # stripTypeScriptTypes + messages d'erreur
src/main/infrastructure/ai/WidgetFrame.ts            # cadre système de la tâche `widget`
src/main/infrastructure/db/repositories/WidgetRepository.ts
src/main/shell/widgetProtocol.ts                     # protocole gi-widget:// + filtre webRequest
src/main/ipc/widgetHandlers.ts                       # widget:get, widget:prompt, widget:restore
src/shared/ai/widgets.ts · src/shared/ipc/widgets.ts
src/renderer/src/canvas/ToolMenu.tsx · nodes/NoteNode.tsx · nodes/WidgetNode.tsx · widgets/*
```
