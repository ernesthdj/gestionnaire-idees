---
type: glossaire
subject: LLM (Large Language Model) — local (Ollama) vs distant (Claude)
tags: [#glossaire, #ia, #llm]
date: 2026-09-28
niveau: débutant
---

# LLM (grand modèle de langage)

> **En 30 secondes** — Un LLM (*Large Language Model*) est un réseau de neurones entraîné sur d'énormes quantités de texte, qui **prédit le prochain morceau de texte** (token) le plus probable. Enchaîner ces prédictions produit des réponses, des questions, du JSON. Il peut tourner **sur ta machine** (Ollama + `qwen3.5:9b`) ou **chez un fournisseur** (Claude, via API).

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : comprendre et produire du langage naturel (« aide-moi à réfléchir à cet achat ») sans écrire des milliers de règles à la main.
- **Analogie (restauration)** : un **commis local** (Ollama) — gratuit, discret, reste en cuisine, mais sait faire moins de choses ; un **chef consultant réputé** (Claude) — brillant, mais facturé à la minute et il faut lui envoyer les fiches (d'où l'anonymisation).

## 2. Comment ça marche (sous le capot)
Les **poids** du modèle (milliards de nombres) sont chargés en mémoire (VRAM du GPU pour Ollama : 37 s au premier appel, 0,7 s ensuite). Le texte d'entrée est découpé en tokens, transformé en vecteurs, passé à travers les couches du réseau (multiplications de matrices sur GPU) ; en sortie, une probabilité pour chaque token possible. On tire le suivant, on recommence. Le modèle **n'a pas de mémoire entre deux appels** : tout le contexte doit être renvoyé à chaque fois.

## 3. En pratique
```ts
// Routage du projet : tâches simples en local, raisonnement profond sur Claude
export const DEFAULT_ROUTING = { categoriser: 'ollama', anonymiser: 'ollama', etendre: 'claude', synthetiser: 'claude', /* … */ }
```

## Utilisé dans ce cours
- [[Passerelle IA hybride — un seul point d'accès à l'IA]] — choix du moteur par tâche.
- [[Anonymisation en deux couches]] — le LLM local liste les noms.
- [[Synthèse vérifiée — contrôles déterministes et provenance]] — pourquoi on vérifie ce qu'il produit (hallucinations).

## Retenir et vérifier
- **À retenir** : prédiction de tokens ; pas de mémoire entre appels ; local = privé et gratuit, distant = puissant et payant.
> **Q :** Pourquoi le petit modèle local est-il passé de 37 % à 90 % de bonnes catégories ? **R :** On lui a fourni des consignes par tâche (définitions + exemples) : il devine mal sans cadre.

**Pièges** : ⚠️ croire qu'un LLM « sait » : il produit du texte **plausible**, pas forcément vrai (hallucination) → toujours valider ce qui entre dans les données.
