---
type: glossaire
subject: Verrou de fichier sous Windows — pourquoi un dossier ouvert ne se renomme pas (EPERM, EBUSY, EACCES) et comment concevoir sans renommage
tags: [#glossaire, #windows, #fichiers, #systeme, #fiabilite]
date: 2026-10-08
niveau: intermédiaire
---

# Verrou de fichier sous Windows (EPERM, EBUSY)

> **En 30 secondes** — Sous Windows, ouvrir un fichier le **réserve** par défaut : tant qu'il est ouvert, on ne peut ni le supprimer ni renommer **le dossier qui le contient**. Node.js remonte alors un code d'erreur système : `EPERM` (opération non permise), `EBUSY` (ressource occupée) ou `EACCES` (accès refusé). Linux et macOS, eux, le permettent. Conséquence : une recette « renommer un dossier » qui marche sur un Mac peut échouer chez l'utilisateur Windows.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : la bibliothèque de skills mettait à jour un dépôt en **renommant** l'ancienne copie puis la nouvelle. Le journal a montré `skills.import_failed {"code":"EPERM"}`, même après 10 s d'essais : l'app **lisait elle-même** un fichier de l'ancienne copie. Un antivirus qui analyse 4 000 fichiers, un Explorateur ouvert sur le dossier font pareil.
- **Analogie (logistique)** : une étagère dont un préparateur tient encore un colis ne peut pas être déplacée : le cariste attend… ou range la nouvelle marchandise sur l'étagère d'à côté.

## 2. Comment ça marche (sous le capot)
Quand un programme ouvre un fichier, il demande au noyau Windows un **handle** (poignée) avec un **mode de partage** (`FILE_SHARE_READ`, `_WRITE`, `_DELETE`). Sans `FILE_SHARE_DELETE` — le cas par défaut de la plupart des programmes —, toute opération qui changerait le **chemin** du fichier (suppression, renommage du fichier ou d'un dossier parent) est refusée tant que la poignée existe. Sous Linux, le nom n'est qu'une entrée de répertoire : on peut la changer, le programme garde son accès aux données.

## 3. En pratique
```ts
// ❌ Fragile sous Windows : suppose que personne ne lit l'ancienne copie
renameSync(oldDir, trashDir); renameSync(newDir, oldDir)

// ✅ Concevoir sans renommage : écrire à côté, basculer la référence, nettoyer au mieux
await clone({ target: `${repo}@${version}` })            // directement à sa place définitive
db.transaction(() => db.setCurrent(repo, version))       // la base dit où est la vérité
try { rmSync(previous, { recursive: true }) } catch (e) { log({ stage: 'nettoyage', code: e.code }) }
// … et au démarrage : supprimer toute copie que la base ne référence plus
```
Les essais répétés (`rmSync(..., { maxRetries, retryDelay })`) aident pour un verrou **bref** (antivirus) ; ils ne règlent pas un verrou **tenu** (l'app elle-même).

## Utilisé dans ce cours
- [[Bibliothèque de skills — adresse contrôlée, clone sans hooks, copie par version et bascule de référence]] — copie par version, bascule en base, `sweep` au démarrage.
- [[Glossaire — Écriture atomique (temporaire puis renommage)]] — la recette de renommage marche pour un **fichier** qu'on remplace, mais renommer un **dossier** lu échoue sous Windows.
- [[Brouillon puis installation — trois verrous, versions par empreinte et retour arrière]] — l'échange de dossier d'un skill, rarement ouvert, garde un retour en arrière si le renommage échoue.

## Retenir et vérifier
- **À retenir** : sous Windows, un dossier lu ne se renomme pas ; journaliser **l'étape et le code** (`EPERM`), jamais le chemin ; concevoir « à côté + bascule + nettoyage différé ».
> **Q :** Pourquoi 20 essais espacés de 500 ms n'ont-ils pas suffi ? **R :** Le verrou était tenu par l'app elle-même pendant toute la session : attendre ne le libère jamais.

**Pièges** : ⚠️ tester seulement sous macOS/Linux une logique de renommage ; ⚠️ `catch {}` muet dans un traitement de fond — sans le code système, impossible de diagnostiquer (JOURNAL 08/10).
