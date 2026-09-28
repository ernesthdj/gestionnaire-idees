---
type: glossaire
subject: IPC (Inter-Process Communication)
tags: [#glossaire, #electron, #systeme]
date: 2026-09-28
niveau: débutant
---

# IPC (communication entre processus)

> **En 30 secondes** — Deux programmes en cours d'exécution (processus) ont chacun leur mémoire, fermée à l'autre. L'IPC (*Inter-Process Communication*) est l'ensemble des moyens de s'envoyer des **messages** malgré cette séparation : tuyaux, sockets, mémoire partagée, messages système.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : l'OS isole la mémoire de chaque processus (sécurité, stabilité : un crash ne contamine pas l'autre). Mais une application découpée en plusieurs processus doit bien coopérer.
- **Analogie (multiprise)** : deux appareils branchés sur des circuits électriques séparés ne partagent pas de courant ; pour communiquer, il faut un **câble de données** dédié entre eux, avec des prises bien définies (les canaux).

## 2. Comment ça marche (sous le capot)
L'expéditeur **sérialise** ses données (objet → octets), l'OS ou le runtime les transporte (ici via Chromium/Mojo), le destinataire les **désérialise** dans sa propre mémoire. On échange donc des **copies**, jamais des références : une fonction, une classe ou une connexion de base ne traverse pas.

## 3. En pratique
```ts
// renderer (via le preload) — demande
const result = await window.api.invoke('neuron:create', { text: 'Acheter un 2e écran' })
// main — réponse
ipcMain.handle('neuron:create', (event, payload: unknown) => dispatch('neuron:create', payload))
```

## Utilisé dans ce cours
- [[IPC typé — le guichet unique entre interface et moteur]] — le protocole complet (liste blanche, Zod, IpcResult).
- [[Architecture Electron — trois processus cloisonnés]] — pourquoi il y a plusieurs processus.

## Retenir et vérifier
- **À retenir** : processus = mémoire isolée ; IPC = messages sérialisés ; on reçoit une **copie**.
> **Q :** Peut-on passer une instance de `NeuronService` au renderer par IPC ? **R :** Non : seules des données sérialisables passent ; les méthodes et références sont perdues.

**Pièges** : ⚠️ considérer un message IPC comme fiable — il vient d'un autre processus, potentiellement compromis : **valider**.
