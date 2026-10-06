---
type: glossaire
subject: Clé stable (clé naturelle) et upsert — mettre à jour au lieu de dupliquer quand on reçoit la même chose deux fois
tags: [#glossaire, #base-de-donnees, #idempotence]
date: 2026-10-06
niveau: intermédiaire
---

# Clé stable et upsert

> **En 30 secondes** — Une **clé stable** est un identifiant **choisi par celui qui décrit** l'objet (ex. `module-auth`), qui reste le même d'une description à l'autre. Avec elle, on peut faire un **upsert** (*update or insert*) : si la clé existe, on met à jour ; sinon, on insère. Recevoir deux fois la même carte ne crée donc pas de doublon.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : Claude cartographie un projet (spec 009, carte de structure), puis le recartographie une semaine plus tard. Avec des identifiants générés à chaque fois (UUID), chaque passage **doublerait** la carte. Il faut que « le module d'authentification » soit reconnu comme **le même** élément.
- **Analogie (restauration)** : la **référence produit** du fournisseur. Que la livraison arrive lundi ou jeudi, « TOM-001 » désigne toujours les tomates : on met à jour la ligne de stock au lieu d'en créer une nouvelle.

## 2. Comment ça marche (sous le capot)
La base garde deux identités : l'**identifiant interne** (UUID, pour les liens et l'Historique) et la **clé métier** (unique dans son périmètre, ici un projet). À la réception d'un lot, on cherche chaque clé : trouvée → `UPDATE`, absente → `INSERT`. Les éléments absents du nouveau lot **ne sont pas supprimés d'office** (ils ne partent que sur demande) : une carte partielle n'efface pas le reste.

## 3. En pratique
```ts
// domain/structure/resolve.ts — un lot structure_dessiner, résolu sans rien écrire
// clés uniques dans le lot ; parent = clé du lot OU d'un élément déjà enregistré ; aucun cycle de parents
if (inBatch.has(element.cle)) return invalid(`elements[${index}].cle : « ${element.cle} » apparaît deux fois`)
const known = (key: string): boolean => inBatch.has(key) || existing.has(key)
```

## Utilisé dans ce cours
- [[Plan d'attaque — étapes ordonnées, dépendances sans cycle et verrou]] — sa voisine, la carte de structure d'un projet (éléments `kind = 'element'`).
- [[Permissions relayées — l'humain dans la boucle d'un agent]] — la « clé du projet » (chemin réel en minuscules) retrouve les mêmes règles.

## Retenir et vérifier
- **À retenir** : identifiant interne pour la machine, clé stable pour le sens ; upsert = rejouer sans doubler (voir [[Glossaire — Idempotence]]).
> **Q :** Pourquoi ne pas utiliser le **titre** comme clé ? **R :** Un titre se reformule (« Auth » → « Authentification ») ; la clé doit rester fixe même quand le libellé change.

**Pièges** : ⚠️ supprimer tout ce qui n'est pas dans le nouveau lot — un lot partiel effacerait la carte.
