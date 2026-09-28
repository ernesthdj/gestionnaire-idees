# Research — 003 Interface MVP-1

> S'appuie sur 001 (outillage, sécurité, base, IPC) et 002 (modèle central).

## R1 — Fenêtres
- **Décision** : 2 fenêtres `BrowserWindow`, toutes durcies (contextIsolation, sandbox, CSP) :
  - **Capture** : créée au démarrage et **gardée cachée** (pré-chargée), `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`, ~560×120 px, positionnée au centre-haut de l'écran contenant le curseur (`screen.getCursorScreenPoint` + `getDisplayNearestPoint`).
  - **App complète** : créée à la demande, cachée (pas détruite) à la fermeture.
- **Rationale** : pré-charger la fenêtre de capture est la seule façon fiable d'atteindre un affichage « instantané » (SC-001).
- **Alternatives** : créer la fenêtre à chaque raccourci (≈ 300-800 ms, trop lent).

## R2 — Raccourci global & retour du focus
- **Décision** : `globalShortcut.register` (défaut `Control+Alt+Space`) ; en cas d'échec (raccourci pris) → notification + réglage. À la fermeture, `captureWindow.blur()` puis `hide()` : Windows rend le focus à la fenêtre active précédente. Vérification manuelle sur les apps courantes (navigateur, VS Code, Explorateur).
- **Alternatives** : module natif pour mémoriser/restaurer le handle de fenêtre (complexité injustifiée tant que le comportement natif suffit — à réévaluer si le test manuel échoue).

## R3 — Zone de notification & démarrage avec Windows
- **Décision** : `Tray` avec menu contextuel (Capturer, Ouvrir l'app, À valider (n), Quitter) et info-bulle ; badge « À valider » via le libellé du menu et l'icône (variante avec pastille). Démarrage : `app.setLoginItemSettings({ openAtLogin, args: ["--hidden"] })` ; lancé avec `--hidden` → aucune fenêtre ouverte. Instance unique : `app.requestSingleInstanceLock()`.

## R4 — État côté interface
- **Décision** : **TanStack Query** pour les données venant de l'IPC (cache, invalidation sur événements `proposal:created`, `tree:changed`…) ; **Zustand** pour l'état d'interface (section active, sélection, filtres) ; **React Hook Form + Zod** pour les formulaires (réglages, édition dans la revue). Navigation par état (Zustand) plutôt qu'un routeur : 4 sections + réglages, pas d'URL à partager.
- **Rationale** : conforme au standard frontend de mentalyas ; pas de routeur inutile (YAGNI).
- **Alternatives** : React Router (surdimensionné pour une app desktop à 5 écrans).

## R5 — Organigramme
- **Décision** : **React Flow** (`@xyflow/react`) avec types de nœuds personnalisés (idée, tâche, condition en losange, opportunité) ; mise en page automatique **dagre** (`@dagrejs/dagre`, graphe orienté haut → bas) à la première ouverture d'une idée, puis positions mémorisées ; `MiniMap`, `Controls`, `Background` ; idées repliées = 1 nœud, dépliées = sous-graphe. Performance : `onlyRenderVisibleElements`, nœuds mémoïsés.
- **Alternatives** : elkjs (plus puissant mais plus lourd), dessin manuel en SVG (des semaines de travail).

## R6 — Application d'une proposition (tout-ou-rien)
- **Décision** : `ProposalApplier` dans une **transaction SQLite unique** : (1) vérifier `base_version` = version courante (sinon `STALE`) ; (2) appliquer la sélection de l'utilisateur (éléments cochés + éditions) ; (3) convertir `ref` → uuid ; (4) insérer nœuds, dépendances, liens ; (5) recalculer les statuts ; (6) écrire `change_log` (avant/après) avec un `batch_id` ; (7) incrémenter `ideas.version`, statut `structured` ; (8) enregistrer l'exemple positif (001 `ExampleStore.record`). Toute exception → rollback.

## R7 — Annulation
- **Décision** : annulation par **lot** (`batch_id`) en rejouant `change_log` à l'envers dans une transaction ; avant de restaurer, vérifier pour chaque entité que son état actuel = `after_json` du lot ; sinon **conflit** → annulation refusée avec la liste des éléments modifiés depuis (FR-018). L'annulation écrit elle-même un lot (réversible).
- **Alternatives** : instantanés complets de l'idée (plus simple mais lourd, et masque les conflits).

## R8 — Propagation des statuts
- **Décision** : fonction pure `computeStatuses(nodes, dependencies, activeBranches)` : ordre topologique (Kahn, 002) ; une tâche est `blocked` si une dépendance `after_done` n'est pas `done`, si un `on_trigger` n'est pas atteint, ou si elle est dans une branche inactive (alors affichée grisée, statut conservé) ; sinon `ready` (sauf `in_progress`/`done`/`abandoned` fixés par l'utilisateur). Recalcul complet de l'idée à chaque changement (≤ 60 nœuds : négligeable).

## R9 — Catégorisation en arrière-plan
- **Décision** : `CaptureService` enregistre l'idée (`category = null`, statut `raw`) puis demande `categoriser` au moteur 001 **sans attendre** ; si l'IA locale est indisponible, la demande part dans la `LocalQueue` (001, T058) et sera rejouée. Le résultat n'est appliqué que si `category_source ≠ user`.

## R10 — Tâches périodiques
- **Décision** : au démarrage puis toutes les 6 h : archivage des propositions `pending` > 14 jours (statut `archived`) ; marquage `stale` des propositions dont l'idée a changé (filet de sécurité en plus de l'événement 002).

## R11 — Thème & accessibilité
- **Décision** : tokens CSS clair/sombre (`[data-theme]`) avec mode « système » (`nativeTheme.shouldUseDarkColors`) ; contrôle AA des couleurs de catégorie dans les deux thèmes ; tests d'accessibilité automatisés des composants avec `vitest-axe` (+ `@testing-library/react`) et vérification clavier manuelle.

## Dépendances annoncées (nouvelles par rapport à 001)
| Paquet | Rôle |
|--------|------|
| `@xyflow/react` | Organigramme interactif |
| `@dagrejs/dagre` | Mise en page automatique de l'arbre |
| `zustand` | État d'interface |
| `@tanstack/react-query` | Données IPC côté interface |
| `react-hook-form`, `@hookform/resolvers` | Formulaires validés par Zod |
| `@testing-library/react`, `vitest-axe`, `jsdom` | Tests de composants et d'accessibilité |
