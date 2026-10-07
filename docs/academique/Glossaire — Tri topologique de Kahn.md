---
type: glossaire
subject: Tri topologique (algorithme de Kahn) et détection de cycle
tags: [#glossaire, #algorithmique, #graphes]
date: 2026-09-28
niveau: intermédiaire
---

# Tri topologique de Kahn

> **En 30 secondes** — Dans un graphe orienté (« A doit être fait avant B »), un **tri topologique** donne un ordre où chaque étape vient après ses prérequis. L'algorithme de **Kahn** le construit en retirant, un par un, les nœuds qui n'ont plus de prérequis. S'il reste des nœuds impossibles à retirer, le graphe contient une **boucle** (cycle) : le plan est inexécutable.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : un plan d'action proposé par l'IA peut contenir « acheter l'écran attend la paie » **et** « la paie attend l'achat de l'écran ». Personne ne peut commencer. Il faut le détecter **avant** de l'enregistrer.
- **Analogie (cuisine)** : l'ordre de préparation d'un menu. On commence par ce qui ne dépend de rien (faire bouillir l'eau) ; chaque étape terminée « libère » les suivantes. Si à la fin il reste des étapes qui s'attendent mutuellement, la recette est impossible.

## 2. Comment ça marche (sous le capot)
1. Compter, pour chaque nœud, ses arêtes **entrantes** (nombre de prérequis).
2. Mettre dans une pile tous les nœuds à 0.
3. Retirer un nœud, compter +1 « visité », décrémenter ses successeurs ; ceux qui tombent à 0 entrent dans la pile.
4. Fin : `visités === nombre de nœuds` → pas de cycle. Coût : O(nœuds + arêtes) — linéaire, très rapide en mémoire (`Map`).

## 3. En pratique
Extrait de `src/main/domain/neurons/planChecks.ts` :
```ts
export function isAcyclic(ids: readonly string[], edges: readonly (readonly [string, string])[]): boolean {
  const incoming = new Map(ids.map((id) => [id, 0]))                 // ① degrés entrants
  /* … remplir incoming et outgoing … */
  const ready = ids.filter((id) => incoming.get(id) === 0)            // ② sans prérequis
  let visited = 0
  while (ready.length > 0) {
    const id = ready.pop(); visited++
    for (const next of outgoing.get(id) ?? []) {                      // ③ libérer les suivants
      const remaining = (incoming.get(next) ?? 0) - 1
      incoming.set(next, remaining); if (remaining === 0) ready.push(next)
    }
  }
  return visited === ids.length                                       // ④ tous visités ⇔ aucun cycle
}
```

## Utilisé dans ce cours
- [[Synthèse vérifiée — contrôles déterministes et provenance]] — contrôle P4 (dépendances) et hiérarchie du plan.

## Retenir et vérifier
- **À retenir** : retirer ce qui n'a plus de prérequis ; s'il reste des nœuds, il y a une boucle ; coût linéaire.
> **Q :** Graphe A→B, B→C, C→A. Combien de nœuds visités ? **R :** Zéro : aucun n'a 0 prérequis au départ, donc cycle détecté.

**Pièges** : ⚠️ confondre « arbre » (un seul parent, jamais de cycle par construction) et « graphe de dépendances » (plusieurs prérequis possibles, cycles possibles).

## Évolution du 07/10 — la variante stable, qui ne refuse pas les cycles
Le tri revient dans la carte de structure (spec 017 D17, `canvas/structureOrder.ts`) pour **ordonner des frères** par dépendances. Deux différences avec la version « détecteur de cycle » ci-dessus :
- **Stable** : parmi les nœuds prêts, on prend toujours **le premier dans l'ordre du dessin** (au lieu de « n'importe lequel de la pile ») → même entrée, même ordre.
- **Tolérante** : s'il ne reste que des nœuds bloqués (cycle), on **fait passer le premier dessiné** au lieu de rejeter — une carte à **lire** doit toujours s'afficher, contrairement à un plan à **exécuter**.

→ [[Carte de structure ordonnée — ordre de progression, tri par dépendances et disposition alternée]]
