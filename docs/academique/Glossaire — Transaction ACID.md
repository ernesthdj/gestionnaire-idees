---
type: glossaire
subject: Transaction ACID
tags: [#glossaire, #base-de-donnees, #sql]
date: 2026-09-28
niveau: intermédiaire
---

# Transaction ACID

> **En 30 secondes** — Une transaction regroupe plusieurs écritures en **une seule opération indivisible** : soit tout est enregistré (`COMMIT`), soit rien (`ROLLBACK`). ACID résume ses quatre garanties : **A**tomicité, **C**ohérence, **I**solation, **D**urabilité.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : un virement = débiter A **et** créditer B. Une panne entre les deux fait disparaître l'argent. Toute opération métier qui touche plusieurs lignes/tables a ce problème.
- **Analogie (restauration)** : l'envoi d'une **table complète** — tous les plats partent ensemble ou aucun ; une fois servis, on ne les reprend pas (durabilité).

## 2. Comment ça marche (sous le capot)
- **Atomicité** : SQLite écrit les changements dans un journal (ici WAL) ; tant que le `COMMIT` n'est pas écrit, le fichier principal n'est pas considéré comme modifié → en cas de crash, les changements partiels sont ignorés.
- **Cohérence** : les contraintes (clés étrangères, `UNIQUE`, `NOT NULL`) sont vérifiées ; une violation annule l'opération.
- **Isolation** : les autres lecteurs ne voient pas l'état intermédiaire.
- **Durabilité** : après `COMMIT`, les données sont sur disque (synchronisation `fsync`) et survivent à une coupure.

## 3. En pratique
```ts
repository.transaction(() => {
  repository.retireCurrentResults(rootId)
  this.writePlan(row, plan)                // plusieurs INSERT
  repository.setRootState(rootId, 'hatched')
  repository.log(batchId, changes)         // si ceci lève une erreur → ROLLBACK de TOUT ce qui précède
})
```

## Utilisé dans ce cours
- [[Éclosion atomique — transaction, version et historique]] — l'éclosion en une transaction.
- [[Croissance d'un neurone — arbre, garde-fous et jauge]] — insertion du sous-neurone + résolution de la question ensemble.
- [[Drizzle ORM ↔ SQL paramétré et migrations]] — `db.transaction()` = `BEGIN … COMMIT`.

## Retenir et vérifier
- **À retenir** : tout ou rien ; contraintes respectées ; état intermédiaire invisible ; persistant après `COMMIT`.
> **Q :** Comment le projet a-t-il vérifié l'atomicité de l'éclosion ? **R :** En injectant une panne à chaque étape et en vérifiant qu'aucune table n'avait changé.

**Pièges** : ⚠️ faire un appel réseau (IA) **dans** une transaction — on bloquerait la base pendant des secondes ; le projet appelle l'IA avant ou après, jamais pendant.
