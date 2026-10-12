---
type: glossaire
subject: Boucle d'événements de Node et du navigateur — un seul fil exécute le JavaScript, une tâche à la fois jusqu'au bout ; ce qui la bloque (code synchrone long, I/O synchrones) et comment céder la main (setImmediate, fs/promises, requestAnimationFrame)
tags: [#glossaire, #nodejs, #electron, #performance, #concurrence]
date: 2026-10-13
niveau: intermédiaire
---

# Boucle d'événements (synchrone, asynchrone, céder la main)

> **En 30 secondes** — Le JavaScript du main d'Electron (Node) et celui de l'interface (Chromium) tournent chacun sur **un seul fil**. Une **boucle d'événements** prend une tâche dans une file (un message IPC, une lecture disque terminée, un minuteur, un clic), l'exécute **jusqu'au bout**, puis prend la suivante. Une tâche de 3 s bloque tout le reste 3 s. **Céder la main**, c'est couper le travail pour laisser passer les autres tâches entre deux morceaux.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : un serveur ou une interface reçoit beaucoup d'événements, mais lancer un fil (thread) par événement coûte cher et oblige à des verrous. Node et le navigateur choisissent **un fil + une file** : simple, sans verrou, très efficace tant que **chaque tâche est courte** et que les attentes (disque, réseau) se font **hors** du fil.
- **Analogie** (restauration) : un **seul serveur** pour toute la salle. Il prend une commande, la porte en cuisine, et pendant que la cuisine cuit (le disque lit), il sert d'autres tables. S'il se met à **éplucher lui-même** 5 kg de pommes de terre (calcul synchrone long), toute la salle attend. Céder la main = éplucher par paquets de 10 et faire un tour de salle entre deux.

## 2. Comment ça marche (sous le capot)
- **Synchrone** (`readFileSync`, `better-sqlite3`, une boucle de calcul) : le fil attend lui-même le résultat ; rien d'autre ne passe.
- **Asynchrone** (`fs/promises.readFile`) : Node confie la lecture à sa **réserve de fils système** (libuv, en C) ; le fil JavaScript repart servir la file ; quand la lecture finit, une tâche « résultat prêt » est ajoutée à la file.
- **`setImmediate(cb)`** (Node) : place `cb` à la **fin** du tour courant de la boucle, **après** les entrées-sorties en attente. `await new Promise(r => setImmediate(r))` = « finis ma tâche ici, laisse passer les autres, reprends-moi ensuite ».
- **`requestAnimationFrame(cb)`** (navigateur) : appelle `cb` juste **avant la prochaine image** (≈ toutes les 16,7 ms à 60 Hz). Avec un **budget** (faire du travail pendant 6 ms puis s'arrêter), l'écran continue d'être dessiné à temps.
- ⚠️ Une **promesse résolue** (`await Promise.resolve()`) ne suffit **pas** : les microtâches passent **avant** les entrées-sorties ; l'IPC resterait bloqué.

## 3. En pratique
```ts
// main — src/main/application/reprise/AnalysisService.ts
const breathe = (): Promise<void> => new Promise((done) => setImmediate(done))
for (let start = 0; start < changed.length; start += 250) {
  graph.writeFiles(genesisId, changed.slice(start, start + 250))   // synchrone, mais court
  await breathe()                                                  // l'IPC de l'interface passe ici
}

// renderer — src/renderer/src/canvas/folder/folderArt.ts
const tick = (): void => {
  const until = performance.now() + 6                              // budget par image
  while (queue.length > 0 && performance.now() < until) { /* quelques lignes de pixels */ }
  if (queue.length > 0) requestAnimationFrame(tick)
}
```

## Utilisé dans ce cours
- [[Mesurer puis désengorger le main — banc par phases, bornes, différences et tranches]] — écriture du graphe par tranches, `workflow:read` asynchrone, budget de peinture.
- [[Glossaire — Throttle et debounce (regrouper des événements)]] — les minuteurs sont aussi des tâches de la boucle.
- [[Passerelle IA hybride — un seul point d'accès à l'IA]] — le sémaphore n'a pas besoin de verrou système grâce au fil unique.
- [[Architecture Electron — trois processus cloisonnés]] — chaque processus a **sa** boucle : bloquer le main ne fige pas le dessin de l'interface, mais fige toutes ses réponses IPC.

## Retenir et vérifier
- **À retenir** : une tâche longue bloque toutes les autres ; on coupe en morceaux et on **cède la main** entre eux, ou on fait faire l'attente hors du fil (I/O asynchrones, autre processus).
> **Q :** Pourquoi `await Promise.resolve()` ne débloque-t-il pas l'IPC alors que `setImmediate` le fait ? **R :** La promesse crée une **microtâche**, exécutée avant que la boucle ne regarde les entrées-sorties ; `setImmediate` attend la fin de la phase des entrées-sorties.
> **Q :** Pourquoi la résolution des liens (1,6 s) bloque-t-elle encore le main ? **R :** C'est un calcul pur et d'un seul tenant ; seul un autre processus (comme le processus d'analyse) le retirerait du fil.

**Pièges** : ⚠️ croire qu'`async` rend un calcul non bloquant (une boucle dans une fonction `async` bloque autant) ; ⚠️ un budget par image trop gros (> 10 ms) fait sauter des images.
