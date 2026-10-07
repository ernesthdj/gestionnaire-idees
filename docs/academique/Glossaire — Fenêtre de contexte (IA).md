---
type: glossaire
subject: Fenêtre de contexte d'un modèle de langage (num_ctx d'Ollama, troncature silencieuse, budget d'entrée)
tags: [#glossaire, #ia, #llm]
date: 2026-10-07
niveau: intermédiaire
---

# Fenêtre de contexte (IA)

> **En 30 secondes** — La **fenêtre de contexte** est la quantité de texte, comptée en tokens, qu'un modèle de langage peut « avoir sous les yeux » d'un coup : consignes + données + sa propre réponse. Ce qui dépasse n'existe pas pour lui. Certains moteurs **coupent sans prévenir** ; il faut donc borner ce qu'on envoie, et parfois **demander** une fenêtre plus grande.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : un modèle calcule chaque mot de sa réponse en regardant **tous** les tokens précédents. Plus la fenêtre est grande, plus il faut de mémoire (sur la carte graphique pour un modèle local) et de calcul. Chaque moteur fixe donc une limite.
- **Analogie** (logistique) : le **plan de travail** d'une cuisine. Tout ce qui sert à la recette doit y tenir : la fiche (consignes), les ingrédients (données) et l'assiette en cours (réponse). Si tu poses trop de cagettes, celles du bout tombent par terre — et le cuisinier cuisine avec ce qui reste, sans te le dire.

## 2. Comment ça marche (sous le capot)
- Le texte est découpé en **tokens** (morceaux de mots, ≈ 4 caractères en moyenne) → [[Glossaire — Token (IA)]].
- Le modèle garde, pour chaque token de la fenêtre, des vecteurs intermédiaires en mémoire (le « cache KV », clés et valeurs de l'attention) : la mémoire nécessaire grandit avec la taille de la fenêtre. C'est pourquoi **Ollama** démarre avec une fenêtre modeste par défaut et laisse l'appelant la régler (`options.num_ctx`).
- Dépasser la fenêtre n'est pas forcément une erreur : Ollama **tronque** l'entrée et répond quand même, sur un texte amputé. Claude, lui, a une fenêtre très large ; la borne utile y est plutôt le coût et la clarté.

## 3. En pratique
```ts
// domain/ai/routing.ts — une fenêtre et un délai propres à une seule tâche longue
const CONTEXT_TOKENS: Partial<Record<TaskKind, number>> = { reprise_guide: 32768 }
// infrastructure/ai/OllamaProvider.ts — envoyé seulement si la tâche le demande
options: { num_predict: request.maxTokens, ...(request.contextTokens === undefined ? {} : { num_ctx: request.contextTokens }) }
```
Une entrée de 40 000 caractères ≈ 10 000 tokens, plus le cadre et jusqu'à 16 000 tokens de réponse : 32 768 laisse de la marge.

## Utilisé dans ce cours
- [[Guide de reprise — contexte borné, sections fixes et sources vérifiées]] — entrée bornée à 40 000 caractères, `num_ctx` demandé à Ollama.
- [[Synthèse vérifiée — contrôles déterministes et provenance]] — la borne 12 000 → 40 000 caractères du 30/09 : au-delà, c'étaient les réponses récentes qui étaient coupées.
- [[Passerelle IA hybride — un seul point d'accès à l'IA]] — où se règlent fenêtre, délai et nombre de tokens de sortie par tâche.

## Retenir et vérifier
- **À retenir** : la fenêtre contient **tout** (consignes, données, réponse) ; un dépassement peut être **silencieux** ; on borne l'entrée **dans l'ordre d'utilité** et on dit ce qui a été omis.
> **Q :** Pourquoi ne pas mettre `num_ctx` à 128 000 pour toutes les tâches locales ? **R :** La mémoire (cache KV) grandit avec la fenêtre : sur une carte graphique grand public, le modèle ralentirait ou ne tiendrait plus en mémoire, pour des tâches courtes qui n'en ont pas besoin.

**Pièges** : ⚠️ compter en **caractères** et oublier que la limite est en **tokens** ; ⚠️ oublier que la **réponse** consomme aussi la fenêtre.
