---
type: pont
subject: TanStack Query (cache des données du main, invalidation par événements) et Zustand (état d'interface) ↔ cache mémoire, invalidation, magasin global observable
source: pont
seances: [2026-09-29]
tags: [#pont, #react, #etat, #cache, #tanstack-query, #zustand]
date: 2026-09-29
niveau: intermédiaire
statut: complet
---

# TanStack Query et Zustand ↔ cache de données et état d'interface

> **En 30 secondes** — L'interface manipule deux sortes d'état. Les **données du moteur** (idées, arbre, historique) appartiennent au main : l'interface n'en garde qu'une **copie en cache**, que **TanStack Query** relit quand le main annonce un changement (**invalidation**). L'**état d'interface** (écran affiché, idée plongée, notification, survol) n'existe que dans la fenêtre : **Zustand** le garde dans un petit magasin global observable. Règle : jamais une donnée du main dans Zustand, jamais un état d'écran dans le cache.

## 1. Vue Macro & Utilité
- **Problématique** : sans outil, chaque composant ferait son propre `call('neuron:getTree')`, garderait sa copie dans un `useState`, et les copies divergeraient (la carte montre l'idée éclose, la plongée pas encore). Et passer « quelle idée est plongée ? » de composant en composant (*prop drilling*) devient vite ingérable.
- **Emplacement dans la carte globale** : **renderer** uniquement, juste derrière le guichet IPC ([[IPC typé — le guichet unique entre interface et moteur]]). Décision R4 de `specs/003-interface-mvp1/research.md`.
- **Analogie** : le main est l'**entrepôt central** ; TanStack Query est la **réserve du restaurant** : on y garde une copie des produits, étiquetée (`['dive', rootId]`), et quand l'entrepôt appelle « la référence X a changé », on jette l'étiquette concernée et on se réapprovisionne. Zustand est le **tableau blanc de la salle** : quelle table est servie, quel plat est en cours — une info qui n'a aucun sens pour l'entrepôt.

## 2. Le Pont Systémique (sous le capot)
1. **Cache en RAM du renderer** : une `Map` clé → { données, date, statut }. `useQuery({ queryKey, queryFn })` lit la clé ; absente ou « périmée » → appelle `queryFn` (un `ipcRenderer.invoke` via le preload), stocke le résultat, **notifie** les composants abonnés, qui se redessinent.
2. **Invalidation par événements poussés** : le main émet `neuron:created`, `neuron:thought`, `synthesis:stale`, `links:suggested`… (`webContents.send`). `useMainEvents` traduit chaque événement en `invalidateQueries` sur des **préfixes de clés** (`['canvas']`, `['dive']`, `['history']`) : seules les requêtes **affichées** sont relues. C'est le patron **Observateur** à travers une frontière de processus.
3. **Écriture directe du cache** : quand une action `growth:*` renvoie déjà l'arbre à jour, `setQueryData(['dive', rootId], tree)` le pose dans le cache sans relecture — un aller-retour IPC économisé.
4. **Zustand** : un objet en mémoire + une liste d'abonnés ; `set()` remplace l'état (immuable) et prévient **seulement** les composants dont le *sélecteur* (`useUiStore((s) => s.navigate)`) a changé. Pas de routeur : la « navigation » est un champ `view` de ce magasin.

## 3. Correspondance

| Ce que fait l'outil | Le mécanisme « à la main » | Où dans le projet |
|---------------------|----------------------------|-------------------|
| `useQuery({ queryKey: ['dive', rootId], queryFn })` | `useState` + `useEffect(() => call(...))` + gestion chargement/erreur dans chaque composant | `dive/useDive.ts` |
| `invalidateQueries({ queryKey: ['canvas'] })` | vider une entrée d'un dictionnaire de cache et redemander | `app/useMainEvents.ts`, `app/useUndo.ts` |
| `setQueryData(key, tree)` | écrire soi-même dans le cache partagé | `useDive.ts` (`run`) |
| `create<UiState>()((set) => …)` | variable globale + liste de callbacks à rappeler à chaque changement (Observateur) | `app/uiStore.ts`, `canvas/hoverStore.ts` |
| `useUiStore((s) => s.view)` | s'abonner et comparer l'ancienne/nouvelle valeur pour éviter les rendus inutiles | `AppShell.tsx` |

**Ce que l'outil cache** : la **déduplication** (deux composants qui demandent la même clé en même temps → un seul appel IPC), les nouvelles tentatives, l'annulation des requêtes obsolètes ; le fait qu'une clé sans requête active est simplement ignorée par l'invalidation.
**Ce que l'outil fait mieux / différemment** : un seul endroit décide « quoi relire quand » (table `INVALIDATIONS`) ; `useUiStore` est l'un des 10 nœuds les plus connectés du graphe du projet (19 liens) — signe qu'il sert de colonne vertébrale à l'interface. **Limite** : une clé mal choisie (préfixe oublié) laisse un écran périmé sans erreur visible.

## 4. Synthèse & Prochaine Étape
**À retenir (3 puces max)** :
- Données du main → **cache** (TanStack Query), rafraîchi par **invalidation** sur événement.
- État d'écran → **magasin** (Zustand), jamais envoyé au main.
- Même mécanisme de fond : un stockage en RAM + des abonnés prévenus au changement (Observateur).

**Question d'oral probable** : « Pourquoi ne pas tout mettre dans Zustand ? » → Parce que les données du moteur ont une **source de vérité ailleurs** (la base, dans le main) : il faut les traiter comme un cache — savoir quand elles sont périmées et les relire — ce que Zustand ne fait pas.

**Lien avec la suite** : [[Plongée radiale — couronne sur un arc et affichage optimiste]] (cache + provisoire) et [[Annuler par lot — journal avant-après, conflit et lot inverse]] (invalidation de 5 écrans après annulation).
