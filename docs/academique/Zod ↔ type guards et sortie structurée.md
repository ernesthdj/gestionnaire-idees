---
type: pont
subject: Zod ↔ validation manuelle (type guards TypeScript) et sortie structurée des LLM (JSON Schema)
source: pont
seances: [2026-09-28]
tags: [#pont, #zod, #typescript, #validation, #ia, #json-schema]
date: 2026-09-28
niveau: intermédiaire
statut: complet
---

# Zod ↔ type guards et sortie structurée

> **En 30 secondes** — TypeScript vérifie les types **à la compilation**, puis disparaît : à l'exécution, rien ne garantit que le JSON reçu (de l'interface ou d'une IA) a la bonne forme. Zod est un **schéma exécutable** qui fait les deux : il **valide** à l'exécution (`safeParse`) et **produit le type** TypeScript (`z.infer`). Le même schéma sert trois fois dans le projet : valider l'IPC, **dire à l'IA** quel JSON produire (converti en JSON Schema), et **vérifier** ce qu'elle a renvoyé.

## 1. Vue Macro & Utilité
- **Problématique** : deux frontières de confiance nulle — l'IPC (renderer potentiellement compromis) et les LLM (qui peuvent renvoyer un JSON incomplet, un champ en trop, une chaîne au lieu d'un nombre). Écrire à la main des *type guards* (fonctions `(x: unknown): x is T`) pour chaque forme serait long, répétitif, et divergerait du type déclaré.
- **Emplacement dans la carte globale** : aux **frontières** — `ipc/registry.ts` (entrée) et `AIGateway` / providers (retour IA).
- **Analogie** : faire soi-même le contrôle qualité avec un pied à coulisse pour chaque pièce (type guard manuel) ↔ un **gabarit de contrôle** (Zod) : une seule forme découpée qui sert à la fois de **plan de fabrication** envoyé au fournisseur (JSON Schema pour l'IA) et de **calibre** à la réception (`safeParse`).

## 2. Le Pont Systémique (sous le capot)
1. `z.object({ persons: z.array(z.string().max(60)).max(20), … })` crée en mémoire un **objet décrivant la forme** (pas une simple annotation effacée).
2. **Vers l'IA locale** : `z.toJSONSchema(schema)` le traduit en JSON Schema, passé à Ollama dans `format` ; le moteur **contraint sa génération** token par token pour respecter la grammaire (décodage contraint).
3. **Vers Claude** : `betaZodOutputFormat(schema)` (SDK officiel) fait de même via `output_config.format` ; la réponse arrive dans `parsed_output`.
4. **Au retour** : `schema.safeParse(JSON.parse(texte))` parcourt l'objet et renvoie `{ success: true, data }` (typé) ou `{ success: false, error }`. Le JSON invalide donne `null` → statut `invalid` → **un** nouvel essai avec la consigne « respecte strictement le format ».
5. Un **refus** du modèle (`stop_reason: 'refusal'`) est distingué d'une sortie invalide : pas de nouvel essai inutile.

## 3. Correspondance

| Ce que fait Zod | Le mécanisme « à la main » | Où dans le projet |
|-----------------|----------------------------|-------------------|
| `const CategoryOut = z.object({ categorySlug: z.enum([...]), nature: z.enum(['action','reflection']) })` | `interface CategoryOut {…}` **+** `function isCategoryOut(x: unknown): x is CategoryOut { typeof … }` | `src/shared/ai/schemas.ts` |
| `type CategoryOut = z.infer<typeof CategoryOut>` | maintenir l'interface à la main, en double | idem |
| `input.safeParse(payload)` | type guard + message d'erreur maison | `defineRoute` (IPC) |
| `z.toJSONSchema(schema)` | écrire un JSON Schema séparé pour l'IA | `OllamaProvider.ts` |
| `z.string().min(1).max(300)` | `if (s.length < 1 \|\| s.length > 300)` | `OutOfScope.message` |
| `.strict()` | refuser les clés inconnues à la main | `ImportedExample` (import de contexte) |

**Ce que l'outil cache** : `safeParse` **copie** et nettoie l'objet (clés inconnues retirées par défaut) — la donnée validée n'est pas l'objet reçu ; un schéma valide ne garantit **pas** la cohérence métier (un plan peut boucler — voir [[Synthèse vérifiée — contrôles déterministes et provenance]]).
**Ce que l'outil fait mieux / différemment** : une seule source de vérité pour type + validation + consigne IA. **Pièges rencontrés** : un tableau de routes aux types hétérogènes ne se typait pas proprement en Zod 4 → encapsuler dans `run(payload: unknown)` (règle 6) ; ajouter une valeur à un `z.enum` utilisé comme clés d'un `z.record` (exhaustif en Zod 4) **invalidait** la configuration déjà enregistrée → compléter avec les valeurs par défaut avant validation (règle 19) ; la recherche web (citations) est incompatible avec la sortie structurée → appel séparé en texte libre (règle 20).

## 4. Synthèse & Prochaine Étape
**À retenir (3 puces max)** :
- Les types TypeScript disparaissent à l'exécution ; Zod valide **pendant** l'exécution et fournit le type.
- Un même schéma : validation IPC, consigne de format à l'IA (JSON Schema), vérification de la réponse.
- Schéma valide ≠ contenu cohérent : les contrôles métier restent nécessaires.

**Question d'oral probable** : « Pourquoi ne pas faire confiance à la sortie structurée de Claude puisqu'elle est contrainte ? » → Parce que la contrainte vient d'un service externe (et Ollama peut renvoyer autre chose), qu'un refus ou une troncature (`max_tokens`) reste possible, et que la constitution III impose de valider toute réponse IA avant usage — défense en profondeur.

**Lien avec la suite** : [[IPC typé — le guichet unique entre interface et moteur]] et [[Passerelle IA hybride — un seul point d'accès à l'IA]] — les deux frontières où ce schéma travaille.

## Évolution du 29/09 — sortie tolérante : réparer ou élaguer plutôt que tout rejeter
**Constat réel** (qwen3.5:9b, profil démo sans clé Claude) : Ollama impose la **structure** JSON mais pas les **motifs** (`regex`) — le modèle renvoyait `"neuronRef": "[s2]"` ou `"expectedDate": "2023-11"`, et **toute** la réponse était rejetée (1 essai sur 3 accepté).
**Correction** (`src/shared/ai/neurons.ts`), sans changer le JSON Schema envoyé au modèle :

| Outil Zod | Effet | Exemple |
|-----------|-------|---------|
| `z.preprocess(fn, schema)` | transformer la valeur **avant** validation | `unbracket` : « [s2] » → « s2 » |
| `lenientList(item, max)` | filtrer les éléments invalides **un par un**, puis borner | une question mal formée est écartée, les autres gardées |
| `.catch(undefined)` | remplacer une valeur facultative invalide par « absente » | date `2023-11` ignorée au lieu de tout rejeter |

Résultat mesuré : **5 réponses sur 5** acceptées. **Limite volontaire** : on ne répare que ce qui est **sans risque** (champ facultatif, élément de liste indépendant) ; les champs obligatoires et les contrôles métier restent stricts. Règle apprise : *une sortie d'IA imparfaite se répare ou s'élague élément par élément quand c'est sans risque ; mesurer sur le vrai modèle avant de conclure.*

## Évolution du 30/09 (soir) — obligatoire à l'envoi, tolérant à la lecture
**Constat réel** (spec 006, retour de test de mentalyas) : après verrouillage, Claude ne proposait **jamais** d'outil. Cause mesurée sur le format envoyé (`betaZodOutputFormat`) : le champ `tools` était écrit `lenientList(…).optional().catch(undefined)` → **absent** de la liste `required` du JSON Schema. Avec les sorties structurées, un champ facultatif est un champ que le modèle peut ignorer — et il l'ignorait.

**Un même schéma Zod a deux lectures** :

| Lecture | Qui la fait | Ce qui compte |
|---------|-------------|---------------|
| **Contrat** (JSON Schema envoyé à Claude) | `betaZodOutputFormat(schema)` | `.optional()` retire le champ de `required` ; sans `.optional()`, il y est |
| **Parseur** (au retour) | `schema.safeParse(...)` | `.catch(valeur)` remplace un champ absent ou invalide, **sans** le rendre facultatif dans le contrat |

**Correction** (`src/shared/ai/neurons.ts`) : `tools: lenientList(ToolProposal, 3).catch([])` et `toolsNote: z.string().trim().min(1).max(200).catch('')` — plus de `.optional()`. Claude **doit** répondre `tools` (liste vide permise) **et** dire en une phrase pourquoi (`toolsNote`) ; l'IA locale et les anciennes synthèses, qui n'ont pas ces champs, restent lisibles (`[]`, `''`). Un test verrouille la décision : `format.schema.required` doit contenir `tools` et `toolsNote` (`tests/integration/neurons/tool-proposals.test.ts`).

Règle à retenir : *pour qu'un modèle pense à un champ, rends-le obligatoire dans le contrat ; pour ne pas tout rejeter, rends-le tolérant dans le parseur.* Application complète → [[Outils proposés au verrouillage — créer dans la transaction, générer hors transaction]].

## Évolution du 04→05/10 — un schéma, trois usages de plus
- **Vers le CLI** : `z.toJSONSchema(schéma)` produit le JSON Schema passé à `claude -p --json-schema` ; la réponse est revalidée par **le même** schéma.
- **Protocole du pont** : chaque trame du canal nommé est un `z.strictObject` (`HelloFrame`, `RequestFrame`, `ResponseFrame`) — un champ en trop suffit à refuser.
- **Outils MCP** : le même schéma d'entrée sert au SDK MCP (côté relais) et à la revalidation dans le main. Voir [[Pont MCP — relais stdio, canal nommé et secret partagé]].
