---
type: glossaire
subject: File en mémoire et écriture par lots (batching) — accumuler des petits événements puis les écrire en une seule transaction, avec des bornes (taille, fusion, abandon compté)
tags: [#glossaire, #performance, #sqlite, #flux]
date: 2026-10-07
niveau: intermédiaire
---

# File et écriture par lots (batching)

> **En 30 secondes** — Au lieu d'écrire chaque petit événement sur le disque dès qu'il arrive, on le pose dans une **file en mémoire** et on écrit **tout le lot** d'un coup, à intervalle fixe (ici toutes les 2 s). Une transaction de mille lignes coûte à peu près le prix d'**une** synchronisation disque, mille transactions d'une ligne en coûtent mille.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la sonde peut recevoir des rafales (des centaines d'actions en quelques secondes). `better-sqlite3` est **synchrone** : chaque écriture bloque le fil du main, donc l'interface attend. Objectif SC-008 : 10 000 événements sans bloquer plus de 100 ms.
- **Analogie (Satisfactory)** : un camion ne part pas pour **chaque** lingot ; il attend d'être plein (ou l'heure de départ), puis fait **un** trajet. Le quai de chargement est la file ; s'il déborde, on regroupe ou on refuse — en le **comptant**.

## 2. Comment ça marche (sous le capot)
- **Mémoire** : un tableau JavaScript sur le tas (*heap*) ; ajouter = `push`, coût négligeable.
- **Disque** : SQLite garantit qu'une transaction validée est sur le disque (`fsync`, une attente du matériel). Grouper N lignes dans **une** transaction = **une** attente au lieu de N.
- **Bornes** : sans limite, une rafale remplirait la RAM. Trois paliers dans `ProbeService` : jusqu'à 2 000, tout est gardé ; au-delà, deux actions **identiques consécutives** fusionnent (`count + 1`) ; au-delà de 5 000, abandon **compté** (`dropped()`), jamais silencieux.
- **Deux files** : l'interface a **sa** file (lots de 100 ou toutes les 2 s → un seul message IPC), le main a la sienne (une transaction toutes les 2 s). Le coût IPC est lui aussi groupé.

## 3. En pratique
```ts
// src/main/application/analyste/ProbeService.ts (extrait)
flush(): void {
  if (this.queue.length === 0) return
  const batch = this.queue; this.queue = []          // on échange la file : les nouveaux événements vont dans la nouvelle
  try { this.deps.repository.insertBatch(batch) }    // une transaction, N INSERT préparés
  catch { this.droppedCount += batch.length }        // l'échec est compté, jamais remonté à l'app
}
stop(): void { /* annule les minuteries */ this.flush() }   // à la fermeture, on vide la file
```

## Utilisé dans ce cours
- [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — deux files (interface, main) et la transaction toutes les 2 s.
- [[Glossaire — Throttle et debounce (regrouper des événements)]] — cousin : regrouper dans le **temps** pour limiter le débit ; le batching regroupe pour réduire le **coût par élément**.
- [[Glossaire — Transaction ACID]] — un lot est tout ou rien.

## Retenir et vérifier
- **À retenir** : grouper amortit le coût fixe (disque, IPC) ; toujours **borner** la file ; une perte doit être **comptée**.
> **Q :** Que perd-on si l'app plante entre deux écritures ? **R :** Au plus ~2 s d'observations encore en mémoire — acceptable pour de la télémétrie, inacceptable pour une idée de l'utilisateur (qui, elle, est écrite immédiatement).

**Pièges** : ⚠️ oublier de vider la file à l'arrêt (`stop()` → `flush()`) ; ⚠️ fusionner des événements **différents** (la fusion compare événement, écran, type, pseudonyme et moyen).
