---
type: glossaire
subject: Demande à nonce — une commande déposée dans un état partagé avec un numéro unique, exécutée une seule fois par celui qui sait la faire (ici « Centrer sur le nœud »)
tags: [#glossaire, #react, #etat, #evenements, #ui]
date: 2026-10-12
niveau: intermédiaire
---

# Demande à nonce (exécutée une seule fois)

> **En 30 secondes** — Un composant veut qu'un **autre** fasse une action (le panneau veut que la carte centre un nœud), mais ne peut pas l'appeler directement. Il **dépose une demande** dans un état partagé : `{ nodeId, nonce }`, où le **nonce** (*number used once*, numéro à usage unique) change à chaque clic. Le destinataire l'exécute s'il ne l'a **pas encore vue**, puis note son numéro. Deux clics sur le même nœud = deux nonces = deux centrages ; un nouveau rendu = même nonce = rien.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : en React, l'état décrit **ce qui est**, pas **ce qui se passe**. Mettre `focus: 'n12'` ne dit pas « centre maintenant » : au second clic sur le même nœud, l'état ne change pas (aucun effet relancé) ; et à chaque rendu, l'effet pourrait recentrer alors que l'utilisateur a déplacé la carte. Il faut transformer un **événement** en donnée **distinguable**.
- **Analogie** (restauration) : le serveur pique un **bon numéroté** sur le rail de la cuisine. Le cuisinier prépare chaque numéro **une fois** et note le dernier fait. Deux bons « 1 café » ont deux numéros : deux cafés. Relire le rail ne refait pas le café déjà servi.

## 2. Comment ça marche (sous le capot)
- **Émetteur** : un compteur de module (`let nonce = 0`, en RAM du renderer) s'incrémente à chaque demande ; l'état reçoit un **nouvel objet** `{ nodeId, nonce }`, donc les abonnés sont prévenus même si `nodeId` est identique.
- **Récepteur** : un `useRef` garde le dernier nonce traité (il survit aux rendus sans en provoquer). L'effet compare, exécute, enregistre.
- **Exécution différée** : si le nœud n'est pas encore dessiné (autre vue), le récepteur bascule la vue et garde une demande **en attente** avec une échéance (4 s), retentée à chaque nouveau graphe, puis abandonnée avec un message.

## 3. En pratique
```ts
// émetteur — src/renderer/src/canvas/side/sidePanelStore.ts
let nonce = 0
export function requestFocus(state: SidePanelState, nodeId: string): SidePanelState {
  nonce += 1
  return { ...state, focus: { nodeId, nonce } }          // nouvel objet → abonnés prévenus
}

// récepteur — src/renderer/src/canvas/IdeasCanvas.tsx (extrait)
const handledFocus = useRef(0)
useEffect(() => {
  if (focus === null || focus.nonce === handledFocus.current) return   // déjà faite
  handledFocus.current = focus.nonce                                    // notée AVANT d'agir
  if (centerOn(focus.nodeId)) return
  /* sinon : basculer la vue, demande en attente 4 s au plus */
}, [focus /* … */])
```

## Utilisé dans ce cours
- [[Panneau fixe à onglets — une source de vérité, règles pures et façade gardée]] — « ◎ Centrer sur le nœud » (spec 027 D4).
- Parenté : [[Glossaire — Idempotence]] (rejouer ne refait pas l'effet) et [[Glossaire — Clé stable et upsert]] (une identité pour reconnaître le déjà-fait).

## Retenir et vérifier
- **À retenir** : un événement mis dans l'état doit porter une **identité unique** ; le récepteur garde la dernière traitée dans un `ref`, pas dans l'état.
> **Q :** Pourquoi `handledFocus` est-il un `useRef` et pas un `useState` ? **R :** Le mettre à jour ne doit pas provoquer de rendu ; un `ref` garde la valeur entre les rendus, silencieusement.

**Pièges** : ⚠️ mettre seulement l'id visé dans l'état (le second clic identique est perdu) ; ⚠️ noter le nonce **après** une action asynchrone (un rendu intermédiaire la relancerait).
