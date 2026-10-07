---
type: glossaire
subject: Préoccupation transverse — un besoin qui concerne toutes les fonctionnalités (mesure, journal, sécurité) traité à un point unique de passage (dispatcher) ou par dérivation d'un flux (tee)
tags: [#glossaire, #architecture, #observabilite, #journal]
date: 2026-10-07
niveau: intermédiaire
---

# Préoccupation transverse (point unique et tee)

> **En 30 secondes** — Une **préoccupation transverse** (*cross-cutting concern*) est un besoin qui touche **tout** le programme : mesurer les durées, journaliser, contrôler l'accès. Au lieu de l'ajouter dans chaque fonctionnalité, on le pose **une fois** là où **tout passe** (un dispatcher), ou on **dérive** un flux existant vers une seconde sortie (un **tee**, comme la pièce en T d'un tuyau).

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la sonde doit mesurer la durée de **chaque** canal IPC (plus de cent) et recevoir **chaque** avertissement du journal du main. Toucher cent handlers = cent oublis possibles et du bruit dans le code métier.
- **Analogie (Satisfactory)** : pour compter tout ce qui sort d'une usine, on ne pose pas un compteur sur chaque machine : on en pose **un** sur le **convoyeur principal** (le dispatcher). Et pour envoyer une partie du minerai vers un deuxième atelier sans couper le premier, on pose un **séparateur** (le tee). *Où ça boite* : le séparateur du jeu **partage** le flux ; le tee **copie** chaque élément vers les deux sorties.

## 2. Comment ça marche (sous le capot)
- **Point unique** : `createDispatcher` (registre IPC) est la seule fonction par laquelle passe tout appel du renderer. On y lit l'horloge haute résolution (`performance.now()`) avant et après `route.run`, puis on appelle un **observateur** injecté — `(canal, durée, ok)` — sans jamais lui donner la charge utile.
- **Tee** : le journal écrit chaque enregistrement dans une **fonction de sortie** (*sink*). `teeSink(a, b)` renvoie une sortie qui appelle `a` puis `b`, chacune dans son propre `try/catch` : une sortie défaillante ne casse ni l'app ni l'autre sortie.

## 3. En pratique
```ts
// src/main/infrastructure/logging/logger.ts
export function teeSink(...sinks) {
  return (record) => { for (const sink of sinks) { try { sink(record) } catch { /* jamais propagé */ } } }
}
// src/main/bootstrap.ts : le journal stdout est inchangé, la sonde reçoit une copie (niveau + nom d'événement)
const logger = createLogger(teeSink(stdoutSink, (r) => probeRef.current?.recordLog(r.level, r.event)))
// src/main/ipc/registry.ts : la mesure, posée une seule fois
const started = performance.now()
const measure = (ok) => observe?.(channel, Math.round(performance.now() - started), ok)
```
`probeRef` est une **référence différée** (la sonde est créée après le journal) — même astuce que `neuronsRef` dans [[Clean Architecture — domaine, application, infrastructure]].

## Utilisé dans ce cours
- [[Sonde sans contenu — télémétrie minimisée, empreintes HMAC et pseudonymes]] — mesure `ipc.call` et erreurs du main.
- [[IPC typé — le guichet unique entre interface et moteur]] — le dispatcher, déjà point unique de validation et de traduction des erreurs.

## Retenir et vérifier
- **À retenir** : poser le transverse là où **tout passe** ; un observateur ne doit **jamais** pouvoir casser ni ralentir ce qu'il observe ; ne lui donner que le **minimum** (pas la charge utile).
> **Q :** Pourquoi `ProbeService.recordCall` ignore-t-il les canaux `analyste:*` ? **R :** Sinon chaque lot envoyé à la sonde produirait une mesure, donc un nouvel événement : la sonde s'observerait elle-même en boucle.

**Pièges** : ⚠️ passer la charge utile à l'observateur « pour plus tard » (fuite de contenu) ; ⚠️ un tee sans `try/catch` par sortie : une sonde en panne ferait taire le journal.
