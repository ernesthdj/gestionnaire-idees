---
type: glossaire
subject: Bundler (empaqueteur) et shim — l'étape de build transforme le code source ; les tests et le typecheck lisent la source, pas le paquet produit
tags: [#glossaire, #build, #electron, #tests, #outillage]
date: 2026-10-08
niveau: intermédiaire
---

# Bundler et shim (le code livré n'est pas le code testé)

> **En 30 secondes** — Un **bundler** (empaqueteur : Vite, esbuild, Rollup ; ici **electron-vite**) lit des dizaines de fichiers TypeScript, retire les types, résout les `import` et produit quelques fichiers JavaScript prêts à lancer (`out/main/index.js`). Un **shim** (cale) est un petit bout de code qu'il **insère** pour combler une différence d'environnement. Les tests (Vitest) et le typecheck (`tsc`) travaillent sur la **source** : un bug introduit par le build leur est invisible.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : le processus principal d'Electron tourne sous Node, en format **CommonJS** (`require`), alors que le code est écrit en **modules ES** (`import`). electron-vite insère un shim qui recrée `__dirname`, `require`… **juste après la dernière instruction `import`** du fichier.
- **Analogie (Satisfactory)** : la chaîne de montage (le build) prend les pièces (fichiers source) et sort un produit fini. Les contrôles qualité (tests) inspectent **les pièces avant la chaîne** : si une machine de la chaîne tord une pièce, personne ne le voit avant la livraison.

## 2. Comment ça marche (sous le capot)
Pour trouver « la dernière instruction `import` », le shim ne fait pas une vraie analyse syntaxique : il cherche un **motif de texte**. Le 08/10, la ligne `throw new AppError('…', "Skill inconnu dans cet import");` finissait par `import");` : le motif l'a prise pour un import, et le code du shim a été inséré **au milieu de la chaîne** → « Unterminated string literal » au lancement de `npm run dev`. Tests verts, typecheck vert, app qui ne démarre pas.

## 3. En pratique
```ts
// tests/unit/build-shims.test.ts — garde-fou ajouté : aucune ligne de code du main ne finit par «…import") »
.filter(({ text }) => /\bimport['"`]\);?\s*$/.test(text))
expect(offenders).toEqual([])
```
Et une règle de méthode : après un changement du processus principal, lancer **aussi** `npx electron-vite build` avant de proposer un test guidé.

## Utilisé dans ce cours
- [[Architecture Electron — trois processus cloisonnés]] — main, preload et renderer sont chacun empaquetés par electron-vite.
- [[Bibliothèque de skills — adresse contrôlée, clone sans hooks, copie par version et bascule de référence]] — le message d'erreur reformulé qui a révélé le problème (`SkillImportService.ts`).

## Retenir et vérifier
- **À retenir** : tests et typecheck lisent la source ; le build la **transforme** ; un outil qui cherche du code par motif de texte peut se tromper sur une chaîne.
> **Q :** Pourquoi le typecheck n'a-t-il rien vu ? **R :** Il analyse la source TypeScript, où la chaîne est correcte ; la corruption n'existe que dans le fichier produit par le build.

**Pièges** : ⚠️ conclure « tout est vert, donc ça marche » sans avoir lancé le build réel ; ⚠️ croire qu'un outil de build comprend toujours la syntaxe — certains raccourcis travaillent sur le texte.
