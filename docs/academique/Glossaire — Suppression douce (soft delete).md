---
type: glossaire
subject: Suppression douce (soft delete)
tags: [#glossaire, #base-de-donnees, #historique, #undo]
date: 2026-09-30
niveau: débutant
---

# Suppression douce (soft delete)

> **En 30 secondes** — Au lieu d'effacer une ligne (`DELETE`), on la **marque** comme supprimée (une colonne `deleted_at` reçoit la date). Toutes les lectures ignorent les lignes marquées : pour l'utilisateur l'objet a disparu, mais il est **récupérable** en vidant la colonne. C'est ce qui rend « Annuler » possible après une suppression.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : un vrai `DELETE` détruit la ligne **et**, par cascade, tout ce qui en dépend (les versions et la conversation d'un widget). Pour l'annuler il faudrait avoir recopié tout ce contenu ailleurs avant.
- **Analogie (restauration)** : un plat **retiré de la carte** n'est pas effacé du classeur de recettes. On le barre sur le menu ; le remettre demain ne demande pas de réinventer la recette.

## 2. Comment ça marche (sous le capot)
Une suppression douce est un `UPDATE` d'**une cellule** : la page disque de la ligne est réécrite, rien d'autre ne bouge — les lignes enfants (`widget_versions`, `widget_messages`) restent en place puisque la clé étrangère `ON DELETE CASCADE` ne se déclenche que sur un vrai `DELETE`. Le prix : chaque requête de lecture doit ajouter le filtre `deleted_at IS NULL`, et la base grossit (rien n'est libéré).

## 3. En pratique
Extrait de `src/main/infrastructure/db/repositories/BlockRepository.ts` et `CanvasService.ts` :
```ts
softDelete(id: string): boolean {
  return this.db.update(canvasBlocks)
    .set({ deletedAt: new Date().toISOString() })                       // marquer, pas effacer
    .where(and(eq(canvasBlocks.id, id), isNull(canvasBlocks.deletedAt))) // déjà supprimé → 0 ligne changée
    .run().changes > 0
}
// Service : la marque ET la ligne d'historique dans la même transaction
blocks.transaction(() => {
  blocks.softDelete(id)
  blocks.log(batchId, [{ kind: 'delete', entity: 'canvas_block', entityId: id, before: { kind: current.kind }, after: null }])
})
```
L'annulation (`HistoryRepository`) remet simplement `deleted_at` à `null` ; rétablir la suppression le remplit à nouveau.

## Utilisé dans ce cours
- [[Annuler par lot — journal avant-après, conflit et lot inverse]] — l'entité `canvas_block` du journal (« avant » = présent, « après » = `null`).
- [[Widget généré par Claude — effacement de types, versions par pointeur et échec sans dégât]] — un widget restauré revient avec ses versions ; le protocole `gi-widget://` répond 404 pour un widget marqué supprimé.
- [[Carte des idées — simulation de forces et croisements de liens]] — même esprit pour les idées : « supprimer » une idée l'**archive** (lot `delete`, 29/09).

## Retenir et vérifier
- **À retenir** : marquer au lieu d'effacer ; filtrer **toutes** les lectures ; c'est la condition d'une suppression annulable.
> **Q :** Pourquoi le `WHERE` de `softDelete` contient-il `deleted_at IS NULL` ? **R :** Pour qu'une deuxième suppression du même bloc ne change rien et ne réécrive pas la date : l'opération devient idempotente ([[Glossaire — Idempotence]]).

**Pièges** : ⚠️ oublier le filtre dans **une** requête — l'objet « supprimé » réapparaît à cet endroit ; ⚠️ croire que la donnée est détruite — elle est toujours dans le fichier (à retenir si un jour un vrai effacement est exigé, par exemple pour des données personnelles).
