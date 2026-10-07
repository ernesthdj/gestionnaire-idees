---
type: glossaire
subject: Ne jamais transmettre une information par la couleur seule (WCAG 1.4.1) — doubler chaque couleur d'une forme, d'une icône ou d'un texte
tags: [#glossaire, #accessibilite, #ui, #wcag]
date: 2026-10-07
niveau: débutant
---

# Information sans la couleur seule (accessibilité)

> **En 30 secondes** — Une couleur ne doit **jamais** être le seul moyen de comprendre une information. Le statut « bloquée » n'est pas seulement **rouge** : il a une icône ⛔, un libellé, un contour pointillé. C'est le critère **WCAG 1.4.1** (*Web Content Accessibility Guidelines*, règles internationales d'accessibilité du web, niveau A).

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : environ 1 homme sur 12 voit mal certaines couleurs (daltonisme rouge-vert surtout). Un écran en plein soleil, une impression en noir et blanc, un lecteur d'écran pour aveugles : dans tous ces cas, « rouge = bloqué, vert = livré » disparaît.
- **Analogie (restauration)** : sur un bon de commande, « allergie » n'est pas seulement surligné en rouge : c'est écrit **ALLERGIE** en toutes lettres et entouré. Le surligneur peut baver, le mot reste.

## 2. Comment ça marche (sous le capot)
Le navigateur dessine la couleur en pixels ; un lecteur d'écran, lui, lit l'**arbre d'accessibilité** (textes, rôles, `aria-label`). Une information portée **seulement** par un `background: red` n'existe pas dans cet arbre. On la double donc : une **forme** (bande, contour, icône) pour l'œil, un **texte** (libellé accessible) pour la machine. Les tests de l'app le vérifient avec `axe` (`expectNoAxeViolations`).

## 3. En pratique
| Où (carte de structure) | Couleur | Doublée par |
|---|---|---|
| Statut d'un élément (D19) | bleu, vert, rouge, gris | pastille avec **icône** (◐, ✓, ⛔, ○) + **libellé** ; bande de 4 px ; **contour pointillé** si bloquée ; statut dans le libellé accessible du nœud |
| Dépendance interdite (D20) | trait rouge | libellé **« ⚠ sens interdit »** sur le lien |
| Avancement (D21) | barre bleue, verte à 100 % | **pourcentage** écrit dans le pied du nœud |
| Contenu (D18) | fond « page » ou « éditeur » | badge **« 📄 Doc »** ou **« </> Code »** + libellé « contient de la documentation / du code » |

## Utilisé dans ce cours
- [[Carte de structure ordonnée — ordre de progression, tri par dépendances et disposition alternée]] — bloc « Évolution du 07/10 (soir) » (D18, D19).
- [[Vue Architecture — règle de dépendance, couches déduites et deux dispositions pures]] — le libellé des violations.
- [[Avancement vivant — agrégation récursive, outil dédié et consigne au bon endroit]] — barre + pourcentage.

## Retenir et vérifier
- **À retenir** : couleur + forme + texte ; le texte doit aussi exister pour les lecteurs d'écran.
> **Q :** Imprime la carte en noir et blanc : comment reconnais-tu un élément bloqué ? **R :** Icône ⛔, mot « bloquée », contour pointillé.

**Pièges** : ⚠️ ajouter une icône sans libellé accessible (le lecteur d'écran lit « image ») ; ⚠️ choisir rouge **et** vert comme seule paire de contraste.
