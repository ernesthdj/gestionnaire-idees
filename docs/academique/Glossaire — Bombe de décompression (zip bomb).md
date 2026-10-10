---
type: glossaire
subject: Bombe de décompression — un petit fichier compressé qui explose en gigaoctets une fois décompressé, et la borne de sortie qui l'arrête
tags: [#glossaire, #securite, #compression, #memoire]
date: 2026-10-10
niveau: intermédiaire
---

# Bombe de décompression (zip bomb)

> **En 30 secondes** — La compression remplace les répétitions par des renvois. Un fichier fait **uniquement** de répétitions (des milliards de zéros) se compresse en quelques Ko… et se **décompresse** en gigaoctets. Lire sans borne un contenu compressé, c'est laisser n'importe qui remplir ta RAM. Parade : **limiter la taille de sortie** pendant la décompression.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : on borne souvent ce qui **entre** (« 20 Mo maximum »). Mais pour un contenu compressé, la taille d'entrée ne dit **rien** de la taille de sortie : 10 Ko peuvent donner 10 Go.
- **Analogie (logistique)** : un colis sous vide de 2 kg qui contient une tente auto-gonflante… de la taille d'un entrepôt. Le contrôle à la réception a pesé le colis : 2 kg, accepté. Le problème apparaît **à l'ouverture**. La parade : ouvrir le colis **dans une cage** de taille fixe — s'il dépasse, on arrête.

## 2. Comment ça marche (sous le capot)
- **DEFLATE** (l'algorithme de gzip et zip) code « répète les 258 octets précédents » en quelques bits. Une longue suite identique atteint des taux de **1 000 pour 1** ; en imbriquant des archives, bien plus.
- **Mémoire** : `gunzipSync` accumule la sortie dans un `Buffer` en **RAM** (le tas du processus). Sans borne, le processus main d'Electron grossit jusqu'à l'échec d'allocation : l'app plante.
- **La borne** : `maxOutputLength` fait **lever une erreur** dès que la sortie dépasse la limite — la décompression s'arrête avant d'avoir tout produit.

## 3. En pratique
```ts
// domain/brainstorms/snapshot.ts — relire un point de sauvegarde
json = JSON.parse(gunzipSync(packed, { maxOutputLength: SNAPSHOT_LIMITS.raw }).toString('utf8'))  // 100 Mo au plus
// erreur → AppError('CORRUPT', 'Ce point de sauvegarde est illisible.')
```
Le BLOB vient de la base de l'app (chiffrée), donc d'une source plutôt fiable ; la borne protège aussi d'une **corruption** et rend le comportement prévisible.

## Utilisé dans ce cours
- [[Points de sauvegarde — instantané compressé, point caché avant retour et colonnes épargnées]] — 20 Mo compressés en entrée, 100 Mo décompressés en sortie.
- [[Bibliothèque de skills — adresse contrôlée, clone sans hooks, copie par version et bascule de référence]] — même logique de borne « au risque » (1 Go, 15 min) pour un clone.

## Retenir et vérifier
- **À retenir** : pour un contenu compressé, borner **l'entrée ET la sortie**.
> **Q :** Pourquoi la borne de 20 Mo à l'écriture ne suffit-elle pas à la relecture ? **R :** Elle limite la taille **compressée** ; un contenu très répétitif (ou abîmé) peut se décompresser en bien plus — seule une borne de **sortie** l'arrête.

**Pièges** : ⚠️ décompresser « en flux » sans compter les octets produits revient au même que sans borne — le flux finit toujours quelque part en mémoire ou sur disque.
