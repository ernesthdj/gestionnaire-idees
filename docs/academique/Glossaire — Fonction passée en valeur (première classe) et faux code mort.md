---
type: glossaire
subject: Fonction de première classe — une fonction passée en valeur (argument, attribut JSX, propriété d'objet) est utilisée sans être appelée à cet endroit ; un graphe d'appels qui ne compte que les appels `f()` la croit morte
tags: [#glossaire, #analyse-statique, #graphe, #typescript, #analyste]
date: 2026-10-12
niveau: intermédiaire
---

# Fonction passée en valeur (première classe) et faux code mort

> **En 30 secondes** — En TypeScript (comme en C# avec les délégués), une fonction est une **valeur** : on peut la donner à une autre sans l'appeler — `setInterval(flush, 1000)`, `onClick={analyze}`, `{ run: start }`. À cet endroit, il n'y a **pas** de parenthèses `flush()`. Un analyseur qui ne repère que les appels conclut « personne n'appelle `flush` » : **faux code mort**. Correction du 12/10 : compter ces passages comme des **références faibles**, seulement si le nom désigne une fonction connue.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : l'Analyste interne proposait de supprimer du code « mort » qui servait (proposition « Faux code mort : les fonctions passées en valeur ne sont pas comptées », codée par l'app elle-même sur une branche `analyste/*`, puis fusionnée). Supprimer `onError` parce qu'il n'est « jamais appelé » casserait la gestion d'erreur.
- **Analogie** (multiprise) : un appel `f()` est un appareil **branché et allumé**. Passer `f` en valeur, c'est **donner la rallonge** à quelqu'un qui la branchera plus tard (le minuteur, le bouton). Compter seulement les appareils allumés fait croire que la rallonge ne sert à rien.

## 2. Comment ça marche (sous le capot)
- **En mémoire** : une fonction est un objet sur le **tas** ; son nom est une variable qui contient une **référence** (une adresse). `setInterval(flush)` copie cette référence dans la file des minuteurs du moteur JavaScript ; le moteur l'appellera à chaque échéance. Le code source ne contient jamais `flush()`.
- **Dans l'analyseur** (`src/analysis-worker/extract.ts`, arbre syntaxique tree-sitter) : quatre formes de nœuds sont maintenant lues comme références — `arguments`, `jsx_expression` dans un attribut, `pair` (valeur d'une propriété), `shorthand_property_identifier` (`{ start }`) ; `this.run` compte aussi (récepteur `this`).
- **Filtre anti-bruit** : une référence n'est gardée que si le nom est celui d'une fonction, méthode ou classe **du fichier** ou d'un **import** — `setTimeout(delay)` où `delay` est un nombre n'est pas un appel.
- **Portée lexicale** (`resolve.ts`) : une fonction locale (`const onError = …` dans un bloc) est cherchée dans le bloc de l'appel puis dans les blocs qui l'englobent, en remontant les parents ; trouvée → lien « sûr ».

## 3. En pratique
```ts
function onError(e: Error): void { /* … */ }      // déclaration
window.addEventListener('error', onError)          // référence faible : comptée (argument)
<button onClick={analyze}>Analyser</button>        // référence faible : comptée (attribut JSX)
const handlers = { run: start, stop }              // deux références : pair + raccourci
setTimeout(delay)                                  // delay = 300 : PAS une fonction connue → ignoré
```

## Utilisé dans ce cours
- [[Glossaire — Graphe d'appels (appelants et appelés)]] — le graphe devient plus juste (bloc « Évolution du 12/10 »).
- [[Analyste en lecture seule — moindre privilège et propositions vérifiées]] — la proposition est venue de l'Analyste ; son entrée « code mort » dépend de ce graphe.
- [[Mise à jour réversible — worktree, branche, fusion no-ff et git revert]] — les commits `18c1ec5` puis la fusion `c925d51` en sont l'application réelle.

## Retenir et vérifier
- **À retenir** : « jamais appelée » ≠ « jamais utilisée » ; une fonction passée en valeur est une dépendance réelle ; filtrer par noms connus évite de prendre une variable pour un appel.
> **Q :** Pourquoi la référence est-elle dite « faible » ? **R :** L'analyseur sait qu'elle **peut** être appelée (le receveur la garde), pas **quand** ni **si** : c'est une utilisation, pas un appel observé.

**Pièges** : ⚠️ supprimer une fonction « sans appelant » sans chercher son **nom** seul (sans parenthèses) ; ⚠️ croire que l'analyse statique voit tout — une fonction choisie par une chaîne (`handlers[name]()`) reste invisible.
