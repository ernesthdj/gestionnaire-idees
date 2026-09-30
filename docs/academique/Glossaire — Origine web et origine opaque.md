---
type: glossaire
subject: Origine web (same-origin policy) et origine opaque
tags: [#glossaire, #securite, #web, #iframe]
date: 2026-09-30
niveau: intermédiaire
---

# Origine web et origine opaque

> **En 30 secondes** — Pour un navigateur, l'**origine** d'une page est le triplet **protocole + hôte + port** (`https://exemple.org:443`). Règle de base (*same-origin policy* — politique de même origine) : deux pages ne peuvent lire le contenu l'une de l'autre que si leurs origines sont **identiques**. Une **origine opaque** est une origine « anonyme » : elle n'est égale à **aucune** autre, pas même à elle-même d'un chargement à l'autre.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : sans cette règle, n'importe quel site ouvert dans un onglet pourrait lire ta messagerie ouverte dans un autre. L'origine est la **carte d'identité** qui décide qui peut lire quoi (DOM, cookies, stockage).
- **Analogie (multiprise)** : chaque origine est un **circuit électrique séparé** avec son propre disjoncteur. Deux appareils sur le même circuit partagent le courant (stockage, accès au document) ; sur deux circuits, rien ne passe. Une origine opaque est un appareil sur **batterie** : il fonctionne, mais n'est branché sur aucun circuit.

## 2. Comment ça marche (sous le capot)
Chromium attache une origine à chaque document. À chaque accès sensible (`parent.document`, `localStorage`, cookies), il **compare** l'origine de l'appelant à celle de la cible ; différent → exception `SecurityError`. Le stockage lui-même est rangé **par origine** sur le disque.

Une `<iframe sandbox>` **sans** le mot `allow-same-origin` reçoit une origine opaque, quelle que soit son adresse. Conséquences directes : aucun accès au parent, pas de `localStorage` ni de cookies (il n'y a pas de « tiroir » où les ranger), et ses requêtes partent avec l'origine `null`.

## 3. En pratique
```html
<!-- src/renderer/src/canvas/nodes/WidgetNode.tsx (rendu simplifié) -->
<iframe src="gi-widget://widget/<bloc>/<version>" sandbox="allow-scripts"></iframe>
<!-- allow-scripts : le JavaScript tourne.  Pas de allow-same-origin : origine opaque. -->
```
```js
// Dans le widget :
parent.document        // SecurityError : origines différentes
localStorage.getItem   // SecurityError : pas de stockage pour une origine opaque
```

## Utilisé dans ce cours
- [[Bac à sable des widgets — iframe isolée, origine opaque et protocole gi-widget]] — la première des cinq barrières.
- [[Glossaire — CSP (Content Security Policy)]] — `'self'` dans une CSP veut dire « mon origine ».
- [[Architecture Electron — trois processus cloisonnés]] — `webSecurity: true` garde cette règle active dans l'app.

## Retenir et vérifier
- **À retenir** : origine = protocole + hôte + port ; même origine = accès, sinon refus ; origine opaque = aucun accès, aucun stockage.
> **Q :** `https://a.org` et `http://a.org` ont-elles la même origine ? **R :** Non : le protocole diffère (et donc le port par défaut).

> **Q :** Pourquoi un protocole personnalisé (`gi-widget:`) ne suffit-il pas à isoler le widget ? **R :** Il lui donne une origine *différente* de l'app, mais stable : il pourrait garder du stockage. C'est l'attribut `sandbox` qui la rend opaque.

**Pièges** : ⚠️ confondre **origine** et **site** (`a.exemple.org` et `b.exemple.org` : même site, origines différentes) ; ⚠️ `postMessage` traverse volontairement les origines — c'est un canal à valider, pas une faille (il servira au pont de capacités prévu en spec 005).
