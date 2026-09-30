---
type: glossaire
subject: Empreinte SHA-256 (fonction de hachage cryptographique)
tags: [#glossaire, #securite, #integrite, #hachage]
date: 2026-09-28
niveau: intermédiaire
---

# Empreinte SHA-256

> **En 30 secondes** — SHA-256 transforme n'importe quelle donnée (un mot, un fichier de 50 Ko) en une **empreinte** fixe de 256 bits (64 caractères hexadécimaux). Même entrée → même empreinte ; un seul octet changé → empreinte totalement différente ; impossible en pratique de remonter de l'empreinte au contenu.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : vérifier qu'un fichier n'a pas été modifié ou tronqué, ou identifier une donnée de façon compacte, sans la comparer octet par octet ni la stocker en entier.
- **Analogie (restauration)** : le **scellé numéroté** sur un carton de livraison. Si le numéro du scellé correspond au bon de livraison, personne n'a ouvert le carton en route.

## 2. Comment ça marche (sous le capot)
Le contenu est découpé en blocs de 512 bits ; chaque bloc passe dans 64 tours d'opérations binaires (rotations, XOR, additions) sur un état interne de 256 bits. Calcul très rapide sur CPU. Attention : c'est une **empreinte**, pas un **chiffrement** (rien à déchiffrer) — et pas une méthode pour stocker des mots de passe (trop rapide ; on utilise bcrypt/Argon2 pour ça).

## 3. En pratique
```ts
import { createHash } from 'node:crypto'
// Intégrité d'un fichier importé
const digest = createHash('sha256').update(content).digest('hex')
if (manifest.sha256[file] !== digest) return { ok: false, error: `Empreinte incorrecte : ${file}` }
// Identité d'un lien (paire ordonnée + libellé normalisé) → jamais reproposé
createHash('sha256').update(`${a}|${b}|${normalizeLabel(label)}`).digest('hex')
```

## Utilisé dans ce cours
- [[Import de contexte — paquet vérifié, versionné, réversible]] — intégrité des fichiers du paquet.
- [[Liens entre idées — graphe local de mots-clés]] — empreinte d'un lien pour éviter les re-propositions.
- [[Widget branché — autorisation par empreinte et pont postMessage]] — *(30/09)* sceller une **autorisation** : `sha256(html, css, ts, capacités triées)` ; tout changement de code ou de droits produit une autre empreinte, donc plus d'autorisation.

## Retenir et vérifier
- **À retenir** : sortie fixe de 64 hex ; déterministe ; un bit change tout ; non réversible ; ≠ chiffrement.
> **Q :** Pourquoi normaliser le libellé avant de hacher l'empreinte d'un lien ? **R :** Pour que « Même budget » et « même  budget ! » donnent la même empreinte et soient reconnus comme le même lien.

**Pièges** : ⚠️ hacher des mots de passe avec SHA-256 seul — trop rapide à attaquer par force brute.
