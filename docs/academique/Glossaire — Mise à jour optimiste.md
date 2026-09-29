---
type: glossaire
subject: Mise à jour optimiste (optimistic UI)
tags: [#glossaire, #ui, #ux, #asynchrone]
date: 2026-09-29
niveau: intermédiaire
---

# Mise à jour optimiste

> **En 30 secondes** — Afficher **tout de suite** le résultat attendu d'une action, **avant** que le serveur (ici le processus main) l'ait confirmée, puis remplacer par la vraie réponse — ou revenir en arrière si elle échoue. L'utilisateur voit une réaction en moins de 200 ms même si l'écriture ou l'IA prend plus longtemps.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : entre le clic et la confirmation il y a un aller-retour IPC, une transaction SQLite et parfois un appel à l'IA (secondes). Attendre sans rien montrer donne l'impression que l'app est figée (heuristique de Nielsen n° 1 : visibilité de l'état).
- **Analogie (restauration)** : le serveur **pose les couverts** dès que tu commandes, sans attendre que la cuisine confirme le plat. Si la cuisine annonce « rupture », il retire les couverts et s'excuse.

## 2. Comment ça marche (sous le capot)
1. Au clic, l'interface ajoute un élément **provisoire** dans son état local (RAM du renderer).
2. L'appel part vers le main (`ipcRenderer.invoke`) ; le main écrit en base dans une transaction.
3. Succès → le main renvoie/annonce la donnée réelle ; l'interface **remplace** le provisoire (relecture du cache).
4. Échec → l'interface **retire** le provisoire et affiche l'erreur.
La vérité reste toujours celle du main : le provisoire n'est qu'un décor en attendant.

⚠️ À ne pas confondre avec la **concurrence optimiste** ([[Éclosion atomique — transaction, version et historique]]) : même mot, autre sujet — là, on écrit sans verrou et on vérifie la version au moment d'enregistrer.

## 3. En pratique
```ts
// src/renderer/src/dive/useDive.ts — répondre à une question de l'IA
answer: (extensionId, dimension, answer) => {
  setPending([{ extensionId, title: `${dimension} : ${value}` }])   // ① provisoire affiché tout de suite
  return run('growth:answer', { extensionId, answer })              // ② IPC ; `finally` → setPending([])
}
// ③ à l'événement `neuron:created`, le cache ['dive', rootId] est relu : le vrai sous-neurone remplace le provisoire
```

## Utilisé dans ce cours
- [[Plongée radiale — couronne sur un arc et affichage optimiste]] — sous-neurone provisoire après une réponse.
- [[Coquille de bureau — zone de notification, instance unique et fenêtres cachées]] — la capture crée l'idée **sans attendre l'IA** (nature/catégorie ajoutées ensuite) : même esprit, « d'abord la réaction, ensuite l'enrichissement ».

## Retenir et vérifier
- **À retenir** : montrer vite, confirmer ensuite, **toujours** prévoir le retour arrière.
> **Q :** Pourquoi n'est-ce pas risqué pour la cohérence des données ? **R :** Parce que rien n'est écrit côté interface : seul l'affichage anticipe ; la base n'est modifiée que par le main, et l'affichage est ensuite aligné sur elle.

**Pièges** : ⚠️ Oublier de retirer le provisoire en cas d'erreur (l'écran ment) ; ⚠️ utiliser l'optimisme pour une action irréversible ou coûteuse (paiement, suppression définitive).
