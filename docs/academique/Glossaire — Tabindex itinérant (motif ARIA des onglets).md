---
type: glossaire
subject: Tabindex itinérant (roving tabindex) — un seul élément d'un groupe atteignable par Tab, les flèches déplacent le focus à l'intérieur ; motif ARIA tablist / tab / tabpanel
tags: [#glossaire, #accessibilite, #clavier, #aria, #ui]
date: 2026-10-12
niveau: intermédiaire
---

# Tabindex itinérant (motif ARIA des onglets)

> **En 30 secondes** — Dans un groupe de contrôles (onglets, barre d'outils, menu), **un seul** porte `tabIndex=0` : Tab entre dans le groupe **une fois**, puis les **flèches** passent d'un élément à l'autre et le `0` « voyage » avec le focus. Les autres portent `tabIndex=-1` (focalisables par le code, pas par Tab). Sans ça, dix onglets coûtent dix appuis sur Tab avant d'atteindre la conversation.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : au clavier (ou avec un lecteur d'écran), Tab parcourt **tout** ce qui est focalisable, dans l'ordre du document. Un groupe de 10 onglets transforme l'écran en couloir. Le motif ARIA dit : un groupe = **un arrêt** de Tab ; on navigue **dans** le groupe avec les flèches, Début et Fin.
- **Analogie** (multiprise) : la barre d'onglets est **une** multiprise branchée au mur (un seul arrêt de Tab). Les flèches choisissent **quelle prise** de la multiprise est alimentée ; il n'y en a qu'une à la fois.

## 2. Comment ça marche (sous le capot)
- Le navigateur tient une **liste de tabulation** : les éléments à `tabIndex ≥ 0`, dans l'ordre du DOM. `-1` les retire de la liste sans les rendre inertes : `element.focus()` marche encore.
- Le composant écoute `keydown` : il calcule l'index visé, change l'onglet affiché (l'état passe `tabIndex` à `0` sur le nouveau, `-1` sur l'ancien), puis appelle `.focus()` sur le nouveau bouton.
- Le lecteur d'écran annonce le **rôle** (`tab`), l'**état** (`aria-selected`), la **position** (« 2 sur 4 ») et le panneau lié (`aria-controls`). Un `tablist` ne doit contenir **que** des `tab` (règle `aria-required-children`, vérifiée par axe).

## 3. En pratique
```ts
// src/renderer/src/canvas/side/SideTabs.tsx — fonction pure : touche → index visé
export function targetIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null
  if (key === 'ArrowRight') return (current + 1) % count          // en boucle : après le dernier, le premier
  if (key === 'ArrowLeft') return (current - 1 + count) % count   // + count : jamais d'index négatif
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null                                                      // autre touche : on ne la consomme pas
}
// rendu : role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1}
```

## Utilisé dans ce cours
- [[Panneau fixe à onglets — une source de vérité, règles pures et façade gardée]] — barre d'onglets des conversations (spec 027), Suppr pour fermer.

## Retenir et vérifier
- **À retenir** : un groupe = un arrêt de Tab ; `0` sur l'élément actif, `-1` sur les autres ; les flèches déplacent **et** focalisent.
> **Q :** Pourquoi `(current - 1 + count) % count` et pas `(current - 1) % count` ? **R :** En JavaScript, `-1 % 4` vaut `-1` (le reste garde le signe) ; ajouter `count` ramène dans `0…count-1`.

**Pièges** : ⚠️ changer l'onglet sans appeler `.focus()` (le focus reste sur l'ancien, invisible) ; ⚠️ mettre un bouton × **dans** le `tablist` (enfant interdit — proposer Suppr et un bouton hors de la liste).
