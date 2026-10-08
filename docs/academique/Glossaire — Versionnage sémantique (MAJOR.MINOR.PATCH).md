---
type: glossaire
subject: Versionnage sémantique — un numéro MAJOR.MINOR.PATCH dont chaque position dit la nature du changement ; appliqué aux logiciels, aux schémas et à la constitution du projet
tags: [#glossaire, #methode, #versions]
date: 2026-10-07
niveau: débutant
---

# Versionnage sémantique (MAJOR.MINOR.PATCH)

> **En 30 secondes** — Un numéro de version en trois parties, `MAJOR.MINOR.PATCH`, où **chaque position a un sens** : `MAJOR` monte quand on **casse** quelque chose d'existant, `MINOR` quand on **ajoute** sans casser, `PATCH` quand on **clarifie ou corrige** sans rien changer au comportement promis. En lisant `4.2.0 → 4.2.1`, on sait sans ouvrir le document que rien d'important n'a bougé.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : « version 7 » ne dit rien. Est-ce que mon code, ma spec, mon plan restent valables ? Le versionnage sémantique (*SemVer*, *Semantic Versioning*) encode la **réponse** dans le numéro.
- **Analogie (cuisine)** : la carte d'un restaurant. **MAJOR** : on retire un plat ou on change sa recette de fond (les habitués doivent être prévenus). **MINOR** : on ajoute un plat. **PATCH** : on corrige une faute d'orthographe sur la carte.

## 2. Comment ça marche (sous le capot)
Règles de la constitution du projet (section *Governance*) :
| Position | Quand | Exemple réel |
|----------|-------|--------------|
| **MAJOR** | Retrait ou redéfinition d'un principe | 2.0.0 → 3.0.0 (05/10) : plus d'API Anthropic, de budget ni d'anonymisation |
| **MINOR** | Principe ou section ajouté(e) ou élargi(e) | 4.1.0 → 4.2.0 (07/10) : commits sur `analyste/*`, tâche `analyste` avec outils de lecture, `npm` de vérification |
| **PATCH** | Clarification | 4.2.0 → 4.2.1 (07/10) : « `npm` est un programme Node, lancé par `node` + `npm-cli.js` sans shell » |

Quand une position monte, les suivantes **repartent à 0** (`4.1.3 → 4.2.0`). Chaque amendement s'accompagne d'un **Sync Impact Report** (en-tête du fichier) : version, principes touchés, specs à revoir.

## 3. En pratique
```text
<!-- Sync Impact Report
- Version change: 4.2.0 → 4.2.1 (2026-10-07, clarification, /speckit-analyze spec 019 C1 — validée par mentalyas)
- Modified principles: I (npm est un programme Node : lancé par `node` avec `npm-cli.js` …)
- Impact : spec 019 research R7 / T031 conformes ; aucun retrait
-->
```
Pourquoi PATCH et pas MINOR ? La règle I interdisait déjà tout « interpréteur intermédiaire ni shell » ; la 4.2.1 **précise** que lancer `node npm-cli.js` n'en est pas un — aucun droit nouveau.

## Utilisé dans ce cours
- [[Du brainstorm au code — spécifications et constitution]] — la constitution versionnée et amendée avant le code.
- [[Widget généré par Claude — effacement de types, versions par pointeur et échec sans dégât]] — versions de widget (numérotation simple, pas sémantique : à ne pas confondre).
- [[Import de contexte — paquet vérifié, versionné, réversible]] — un paquet porte la version de son format.

## Retenir et vérifier
- **À retenir** : MAJOR casse, MINOR ajoute, PATCH clarifie ; les positions suivantes repartent à 0.
> **Q :** On ajoute à la constitution un principe VII. Quelle version après 4.2.1 ? **R :** 4.3.0 (ajout = MINOR, PATCH remis à 0).

**Pièges** : ⚠️ monter MINOR pour « un gros changement » qui retire une règle — c'est MAJOR ; ⚠️ croire que `4.10.0 < 4.9.0` — on compare position par position, en nombres.

## Évolution du 07→08/10 — quatre amendements en une nuit
`4.2.1 → 4.3.0` (MINOR : droit **ajouté**, écrire dans les dossiers de skills sur Installer / Revenir) → `4.4.0` (MINOR : git et `gh` sur clic) → `4.4.1` (PATCH : « dépôt tiers » **défini** — ni au compte connecté, ni avec droits `admin` / `maintain` ; aucun droit nouveau, une lecture rendue explicite) → `4.5.0` (MINOR : « Supprimer » un skill). Aucun MAJOR : rien n'a été **retiré**. → [[Du brainstorm au code — spécifications et constitution]]
