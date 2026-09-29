---
type: glossaire
subject: Générateur pseudo-aléatoire à graine (PRNG — Pseudo-Random Number Generator)
tags: [#glossaire, #algorithme, #tests, #determinisme]
date: 2026-09-29
niveau: intermédiaire
---

# Générateur pseudo-aléatoire à graine (PRNG)

> **En 30 secondes** — Un ordinateur ne sait pas tirer au sort : il **calcule** une suite de nombres qui *ressemble* à du hasard. Cette suite dépend entièrement d'un nombre de départ, la **graine** (*seed*). Même graine → **même suite**, à chaque exécution, sur chaque machine. C'est exactement ce qu'on veut pour des tests et des dispositions reproductibles.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : `Math.random()` change à chaque appel et ne se règle pas. Une carte d'idées disposée avec lui **bougerait** à chaque rendu, un jeu de démonstration serait différent à chaque création, et un test qui échoue « une fois sur dix » serait impossible à rejouer.
- **Analogie (cuisine)** : une **recette** de mélange de cartes. Le paquet de départ et la recette (« coupe à 17, intercale, coupe à 42… ») sont écrits : deux cuisiniers qui suivent la même recette avec le même paquet obtiennent **exactement** le même ordre. L'ordre *paraît* aléatoire à qui ne connaît pas la recette.

## 2. Comment ça marche (sous le capot)
Un PRNG garde un **état** (un entier en RAM). À chaque appel, il applique une formule arithmétique à cet état (multiplication, addition, décalages de bits, modulo 2³²), stocke le nouvel état et renvoie `état / 2³²` → un nombre entre 0 et 1. Ce ne sont que quelques instructions CPU sur des entiers 32 bits : très rapide, mais **prévisible** — donc à ne jamais utiliser pour de la sécurité (clés, jetons : là, `crypto.randomUUID()` / `crypto.getRandomValues()` qui puisent dans l'entropie du système).

## 3. En pratique
```ts
// src/renderer/src/canvas/forceLayout.ts — générateur congruentiel linéaire (LCG)
function lcg(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
}
forceSimulation(nodes).randomSource(lcg(42 + start))   // d3 tire « au hasard »… toujours pareil

// src/main/infrastructure/db/demo/seedDemo.ts — mulberry32 (mélange de bits, meilleure qualité)
const random = seededRandom(20260928)                   // graine = une date : 100 idées fictives identiques
```

## Utilisé dans ce cours
- [[Carte des idées — simulation de forces et croisements de liens]] — la simulation d3-force reçoit un LCG à graine : mêmes idées → mêmes positions.
- `seedDemo.ts` (profil `--demo`) — le jeu de 100 idées / 50 liens est identique à chaque `seed:demo:reset`, donc les captures d'écran et tests restent comparables.

## Retenir et vérifier
- **À retenir** : graine = point de départ ; même graine = même suite ; prévisible donc **jamais** pour la sécurité.
> **Q :** Pourquoi la carte change-t-elle de graine (`42 + start`) lors des redémarrages anti-croisements ? **R :** Pour explorer un autre départ, tout en restant reproductible : le départ n° 2 donne toujours le même résultat.

**Pièges** : ⚠️ Utiliser un PRNG pour générer un identifiant ou un secret (il se devine) ; ⚠️ partager un même générateur entre deux usages — l'ordre des appels change alors les deux résultats.
