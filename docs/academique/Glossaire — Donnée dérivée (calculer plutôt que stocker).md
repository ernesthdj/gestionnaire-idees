---
type: glossaire
subject: Donnée dérivée — une information qu'on recalcule à partir d'une source unique plutôt que de la stocker en double (source de vérité unique)
tags: [#glossaire, #base-de-donnees, #conception, #normalisation]
date: 2026-09-30
niveau: intermédiaire
---

# Donnée dérivée (calculer plutôt que stocker)

> **En 30 secondes** — Une **donnée dérivée** se déduit d'une autre (la **source de vérité**). Si on la **stocke** aussi, on a deux exemplaires qui peuvent **diverger**. Si on la **recalcule** à chaque lecture, elle ne peut pas mentir. On ne stocke que ce qui ne se déduit pas — par exemple l'endroit où l'utilisateur l'a posée.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la « prochaine étape » d'une idée est écrite dans son document (synthèse ou plan). Si on la copiait dans une table, il faudrait penser à la mettre à jour à chaque nouveau verrouillage, à chaque annulation d'éclosion, à chaque tâche terminée… Un oubli, et la carte affiche une étape périmée. C'est le problème classique de la **redondance** que la **normalisation** des bases (vue en SQL) cherche à éviter.
- **Analogie (restauration)** : le **nombre de couverts restants** ne s'écrit pas sur un tableau à part : il se **compte** sur le plan de salle. Celui qui tient un tableau séparé finira par annoncer une table libre qui ne l'est plus. En revanche, **où** tu as rangé la chaise d'appoint, ça, il faut le noter : ça ne se déduit de rien.

## 2. Comment ça marche (sous le capot)
- **Stocker** = une écriture de plus à chaque changement de la source, et un risque d'incohérence si l'une échoue sans l'autre (hors transaction).
- **Dériver** = un calcul (souvent une fonction **pure**, testable seule) à chaque lecture. Coût CPU minime ici ; si le calcul devenait cher, on ajouterait un **cache** *invalidé* quand la source change — c'est ce que fait le résumé local de l'idée de départ (« mémorisé et recalculé seulement quand l'idée change », journal 30/09 13:45).

## 3. En pratique
```ts
// domain/neurons/nextStep.ts (légèrement condensé) — l'étape n'est JAMAIS stockée : elle se lit dans le document
export function nextStepOf(result: HatchedResultView | null): string | null {
  if (result === null) return null
  if (result.type === 'reflection_summary') return result.nextStep?.trim() || null
  const open = result.nodes.filter((n) => n.type === 'task' && n.activeBranch)
  return (open.find((n) => n.status === 'in_progress') ?? open.find((n) => n.status === 'ready'))?.title ?? null
}
// Seule sa PLACE est enregistrée (table idea_steps), et seulement si l'utilisateur l'a glissée.
```

| Dans le projet | Source de vérité | Dérivé (non stocké) | Stocké quand même |
|----------------|------------------|---------------------|-------------------|
| Prochaine étape (T071) | document de l'idée | texte de l'étape (`nextStepOf`) — d'où « non modifiable » | position, si glissée (`idea_steps`) |
| Cadre résultat (spec 005) | `canvas_blocks.source_block_id` | « quel cadre pour ce widget » (`resultBlockOf`) | — pas de `result_block_id` |
| Trait d'une idée née d'une étape | lien en base idée ↔ idée | trait **dessiné** depuis l'étiquette de l'étape (`buildGraph.ts`) | — le lien en base ne change pas |
| Entrée « étape » d'un widget | document de l'idée | `assembleStep` relit l'étape à chaque remise | le branchement seul |

## Utilisé dans ce cours
- [[Widget branché — autorisation par empreinte et pont postMessage]] — une étape branchée suit d'elle-même le nouveau document ; disparue, elle ne transmet plus rien.
- [[Cadre résultat — sortie bornée, vue figée et rafales regroupées]] — le cadre se retrouve par `source_block_id`.
- [[Carte des idées — simulation de forces et croisements de liens]] — l'étape sur la carte et son trait (bloc « Évolution du 30/09 (soir) »).
- [[TanStack Query et Zustand ↔ cache de données et état d'interface]] — le cache côté interface est lui aussi une copie dérivée, invalidée par événements.

## Retenir et vérifier
- **À retenir** : une information = un seul endroit où elle est écrite ; tout le reste se calcule ; on stocke ce qui ne se déduit pas (choix de l'utilisateur).
> **Q :** Pourquoi l'étiquette « prochaine étape » n'est-elle pas modifiable sur la carte ? **R :** Parce qu'elle n'existe pas en tant que donnée : c'est une **lecture** du document. La modifier voudrait dire modifier le document (nouveau verrouillage).

**Pièges** : ⚠️ « dénormaliser pour aller plus vite » sans mesurer — on paie en bugs d'incohérence ; ⚠️ confondre **affichage** et **donnée** : dessiner un trait depuis l'étape ne doit pas réécrire le lien en base (graines de liens et Historique en dépendent).
