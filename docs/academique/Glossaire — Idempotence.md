---
type: glossaire
subject: Idempotence
tags: [#glossaire, #fiabilite, #architecture]
date: 2026-09-28
niveau: intermédiaire
---

# Idempotence

> **En 30 secondes** — Une opération est **idempotente** si la faire deux fois (ou dix) produit le **même résultat** qu'une seule fois. Indispensable dès qu'un double clic, une reprise après panne ou un rejeu de file peut renvoyer la même demande.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : l'utilisateur double-clique sur « Répondre », le réseau coupe au mauvais moment, la file locale rejoue une demande… Sans idempotence : deux sous-neurones, deux appels Claude payés, deux lignes de coût.
- **Analogie (restauration)** : le **numéro de bon** en cuisine. Si le serveur renvoie par erreur le même bon n° 42, le chef voit qu'il est déjà en préparation et ne cuit pas un deuxième plat.

## 2. Comment ça marche (sous le capot)
On attache à la demande une **clé unique** (identifiant de requête, identifiant de la question) et on mémorise ce qui a déjà été traité : en RAM (cache temporaire) ou, plus solide, en **base** via une contrainte d'unicité qui fait refuser le doublon par le moteur SQL lui-même.

## 3. En pratique
```ts
// 1) Passerelle IA : même requestId dans les 5 minutes → résultat mémorisé, pas de nouvel appel payant
const cached = this.recent.get(requestId)
if (cached !== undefined && Date.now() - cached.at < IDEMPOTENCE_TTL_MS) return { ok: true, value: cached.result }
// 2) Base : un seul sous-neurone par question (colonne UNIQUE)
fromExtensionId: text('from_extension_id').unique()
// 3) Verrouillage : une seule proposition en cours par idée → double verrouillage = même proposition
```

## Utilisé dans ce cours
- [[Passerelle IA hybride — un seul point d'accès à l'IA]] — cache de 5 minutes par `requestId`.
- [[Croissance d'un neurone — arbre, garde-fous et jauge]] — contrainte `UNIQUE` sur `from_extension_id`.
- [[Éclosion atomique — transaction, version et historique]] — une proposition en cours par idée.

## Retenir et vérifier
- **À retenir** : même demande → même effet ; clé unique + mémoire du déjà-fait ; la base est l'arbitre le plus fiable.
> **Q :** Pourquoi la contrainte `UNIQUE` est-elle plus sûre qu'un `if (déjà répondu)` en JavaScript ? **R :** Deux demandes concurrentes peuvent passer le `if` avant l'insertion ; la base, elle, refuse physiquement la seconde.

**Pièges** : ⚠️ générer un nouvel identifiant à chaque tentative — le rejeu n'est alors plus reconnu comme le même.
