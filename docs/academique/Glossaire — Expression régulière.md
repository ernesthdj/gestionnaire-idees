---
type: glossaire
subject: Expression régulière (regex)
tags: [#glossaire, #texte, #regex]
date: 2026-09-28
niveau: intermédiaire
---

# Expression régulière

> **En 30 secondes** — Une expression régulière (*regex*) est un **motif** qui décrit une famille de textes : « deux lettres majuscules puis deux chiffres puis des groupes de 4 » décrit un IBAN. Le moteur regex parcourt le texte et trouve, remplace ou valide tout ce qui correspond.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : repérer des formats (e-mails, téléphones, montants, dates, balises) dans du texte libre, de façon **déterministe** et rapide, sans IA.
- **Analogie (cuisine)** : un **emporte-pièce** : on le pose partout sur la pâte (le texte) et il découpe exactement les formes qui correspondent.

## 2. Comment ça marche (sous le capot)
Le motif est compilé une fois en automate en mémoire ; le moteur avance caractère par caractère (avec retours en arrière si besoin). Drapeaux utiles : `g` (toutes les occurrences), `i` (casse ignorée), `u` (Unicode : `\p{L}` = toute lettre, `\p{Lu}` = majuscule, `\p{M}` = accent combiné). Les *lookarounds* `(?<!…)` / `(?!…)` vérifient ce qui précède/suit sans le consommer.

## 3. En pratique
```ts
// Neutraliser TOUTES les variantes d'une balise fermante (casse, espaces)
text.replace(/<\s*\/\s*donnees_utilisateur\s*>/giu, '<\\/donnees_utilisateur>')
// Retirer les accents : é → e + ◌́ (NFD) puis supprimer les marques
text.normalize('NFD').replace(/\p{M}/gu, '')
// Clé de base : exactement 64 caractères hexadécimaux, rien d'autre (^ et $ = tout le texte)
const HEX_KEY = /^[0-9a-f]{64}$/
```

## Utilisé dans ce cours
- [[Anonymisation en deux couches]] — couche 1 entièrement en regex.
- [[Injection de prompt — cadre figé et données balisées]] — neutralisation de la balise.
- [[Stockage local chiffré — SQLite, SQLCipher et DPAPI]] — validation de format de la clé.
- [[Croissance d'un neurone — arbre, garde-fous et jauge]] — normalisation des questions.

## Retenir et vérifier
- **À retenir** : motif compilé → recherche déterministe ; `u` pour l'Unicode ; ancrer avec `^…$` pour valider un format complet.
> **Q :** Pourquoi `/^[0-9a-f]{64}$/` rend-il le `PRAGMA key` sûr ? **R :** Aucun guillemet ni caractère spécial ne peut passer : la valeur ne peut pas modifier l'instruction SQL.

**Pièges** : ⚠️ oublier `^` et `$` (le motif valide alors n'importe quel texte **contenant** une clé) ; ⚠️ le drapeau `i` rend `\p{Lu}` inopérant — d'où la construction lettre par lettre des types de voie dans `anonymizationRules.ts`.
