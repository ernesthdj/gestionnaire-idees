---
type: glossaire
subject: Traversée de chemin (path traversal), lien symbolique et jonction, realpath
tags: [#glossaire, #securite, #fichiers, #owasp]
date: 2026-10-06
niveau: intermédiaire
---

# Traversée de chemin et lien symbolique

> **En 30 secondes** — Une **traversée de chemin** consiste à faire sortir une écriture ou une lecture de son dossier prévu, en glissant `..` ou un chemin absolu dans un nom (`../../Windows/x`). Un **lien symbolique** (ou une **jonction** sous Windows) fait le même effet sans aucun `..` visible : un dossier qui « pointe » ailleurs. La défense : construire le chemin soi-même, puis vérifier sur le **chemin réel** (`realpath`) qu'on est toujours dedans.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : dès qu'une donnée extérieure (titre donné par une IA, chemin proposé par Claude, contenu d'un dépôt cloné) participe à un chemin, elle peut viser un fichier sensible. OWASP la range dans les contrôles d'accès défaillants (A01).
- **Analogie (restauration)** : un livreur a le droit d'entrer dans **ta** chambre froide. « Chambre froide/../bureau du patron » le mène ailleurs par le couloir ; un lien symbolique, c'est une **porte de chambre froide qui donne directement chez le voisin** — l'étiquette dit « chambre froide », la pièce n'est pas la tienne.

## 2. Comment ça marche (sous le capot)
`path.join` se contente de **calculer une chaîne** (il résout les `..` textuellement). Le système de fichiers, lui, suit les liens au moment de l'accès. `fs.realpathSync` lui demande le chemin **final** après tous les liens. Ensuite `path.relative(parent, enfant)` : s'il commence par `..` ou est absolu, l'enfant est **hors** du parent.

## 3. En pratique
```ts
function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && !path.startsWith('..') && !isAbsolute(path)
}
isInside(realpathSync(projectDir), realpathSync(join(projectDir, 'docs', 'brainstormer')))
// et pour un chemin proposé par Claude (checkProjectPath) : relatif, sans segment '', '.', '..', sans ':' ni nom réservé
```

## Utilisé dans ce cours
- [[Fichiers écrits par l'app — chemin choisi par le main, écriture atomique, corbeille]] — documents, dossier de projet, chemins des actions finales.
- [[Lancer un programme sans shell — chemin absolu, arguments séparés, listes blanches]] — fichier passé en argument à l'éditeur.

## Retenir et vérifier
- **À retenir** : ne jamais faire confiance à un nom ; vérifier sur `realpath` ; `relative()` plutôt que `startsWith`.
> **Q :** Un chemin sans aucun `..` peut-il sortir du projet ? **R :** Oui, si l'un de ses dossiers est un lien symbolique ou une jonction ; seul `realpath` le révèle.

**Pièges** : ⚠️ `startsWith('C:\\projet')` accepte `C:\\projet-bis` ; ⚠️ vérifier puis écrire longtemps après — le lien peut être créé entre-temps (on vérifie juste avant d'écrire).

## Évolution du 07/10 — une jonction voulue, et son garde-fou
La spec 019 (conçue) **crée** volontairement une jonction : `<worktree>/node_modules` → `node_modules` du dépôt principal, pour ne pas réinstaller les dépendances dans chaque copie de travail (`fs.symlink(cible, chemin, 'junction')` : une jonction ne demande pas de droits administrateur, contrairement à un lien symbolique sous Windows, mais ne vise que des **dossiers locaux**). Revers attendu : écrire dans `<worktree>/node_modules` écrirait **chez l'app ouverte** → le hook d'avant-écriture refuse tout chemin sous `node_modules` (constat U1), et la jonction est retirée **avant** `git worktree remove`. → [[Mise à jour réversible — worktree, branche, fusion no-ff et git revert]]
