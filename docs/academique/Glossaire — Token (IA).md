---
type: glossaire
subject: Token (unité de texte d'un LLM)
tags: [#glossaire, #ia, #cout]
date: 2026-09-28
niveau: débutant
---

# Token (IA)

> **En 30 secondes** — Un token est le **morceau de texte** qu'un LLM lit et écrit : souvent un bout de mot (« brain », « storm »), un mot court, un signe. En français, compter grossièrement **~4 caractères par token**. C'est l'unité de **mesure du contexte** et l'unité de **facturation** de Claude.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : un réseau de neurones ne manipule que des nombres ; il faut découper le texte en unités numérotées (vocabulaire de quelques dizaines de milliers de tokens).
- **Analogie (Satisfactory)** : les tokens sont les **pièces** qui circulent sur le convoyeur. Le prix de l'usine dépend du nombre de pièces entrantes (entrée) et sortantes (sortie) — les pièces sortantes, plus élaborées, coûtent plus cher.

## 2. Comment ça marche (sous le capot)
Un *tokenizer* (algorithme de découpage, souvent BPE — *Byte-Pair Encoding*, fusion des paires de caractères les plus fréquentes) convertit le texte en liste d'entiers. L'API renvoie les compteurs dans `usage` : `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`.

## 3. En pratique
```ts
// Borne du contexte envoyé pour « etendre » : ~12 000 caractères ≈ 3 000 tokens
const MAX_INPUT_CHARS = 12_000
// Borne de la sortie par tâche (et donc du coût maximal)
const MAX_TOKENS = { categoriser: 256, etendre: 4000, synthetiser: 16000, /* … */ }
```

## Utilisé dans ce cours
- [[Budget IA — convertir des tokens en euros]] — tokens × tarif = coût.
- [[Liens entre idées — graphe local de mots-clés]] — fiches de 300 caractères (≈ 80 tokens) pour économiser.
- [[Injection de prompt — cadre figé et données balisées]] — tout, consignes comme données, n'est qu'une suite de tokens.

## Retenir et vérifier
- **À retenir** : ~4 caractères/token ; facturés en entrée, sortie, cache ; la sortie coûte ~5× l'entrée chez Claude.
> **Q :** Pourquoi `max_tokens` sert-il aussi le budget ? **R :** Il borne la sortie, donc le coût maximal d'un appel, utilisé comme majorant avant l'envoi.

**Pièges** : ⚠️ confondre caractères et tokens — les accents, chiffres et mots rares consomment plus de tokens que prévu.
