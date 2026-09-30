---
type: glossaire
subject: CSP (Content Security Policy)
tags: [#glossaire, #securite, #web, #xss]
date: 2026-09-28
niveau: débutant
---

# CSP (Content Security Policy)

> **En 30 secondes** — La CSP (*Content Security Policy* — politique de sécurité du contenu) est une liste de règles donnée au navigateur : « n'exécute des scripts que s'ils viennent de tel endroit, ne charge rien d'autre ». Même si un attaquant réussit à glisser du HTML dans la page, son script est **refusé**.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : l'XSS (*Cross-Site Scripting* — injection de script dans une page) est l'une des failles web les plus courantes. Échapper chaque sortie est indispensable, mais un oubli suffit ; la CSP est un **deuxième filet**.
- **Analogie (restauration)** : la liste des **fournisseurs agréés** affichée à la réception : tout colis d'un fournisseur non listé est refusé à la porte, quel que soit son contenu.

## 2. Comment ça marche (sous le capot)
Le moteur de rendu (Chromium) lit la politique (en-tête HTTP ou balise `<meta>`) **avant** d'exécuter quoi que ce soit ; à chaque ressource (script, style, image, requête réseau), il compare l'origine à la liste autorisée et bloque le reste, avec un message dans la console.

## 3. En pratique
Extrait de `src/renderer/index.html` :
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; object-src 'none';
           base-uri 'none'; form-action 'none'; frame-ancestors 'none'; …" />
<!-- 'self' = uniquement les fichiers de l'app ; pas de script inline, pas de CDN, pas d'iframe -->
```

## Utilisé dans ce cours
- [[Architecture Electron — trois processus cloisonnés]] — le 4e verrou du renderer.

## Retenir et vérifier
- **À retenir** : CSP = liste blanche d'origines appliquée par le navigateur ; filet de sécurité contre l'XSS.
> **Q :** Pourquoi `script-src 'self'` bloque-t-il un `<script>alert(1)</script>` injecté ? **R :** Un script *inline* n'est pas un fichier de l'origine `'self'` ; sans `'unsafe-inline'`, il est refusé.

**Pièges** : ⚠️ ajouter `'unsafe-inline'` ou `'unsafe-eval'` à `script-src` « pour que ça marche » — c'est désactiver la protection. (Ici, `'unsafe-inline'` n'est autorisé que pour `style-src`.)


## Évolution du 30/09 — deux politiques, deux sens
- **CSP de l'app** (`src/renderer/index.html`) : une seule ouverture ajoutée, `frame-src gi-widget:` — l'app accepte d'emboîter un cadre, uniquement de ce protocole.
- **CSP d'un widget** (`WIDGET_CSP`) : `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; …` envoyée **en en-tête HTTP et en `<meta>`**. Ici la CSP ne sert plus à empêcher une injection (tout le document est du code non fiable) mais à **empêcher de sortir** : aucun `connect-src`, donc aucun réseau. `default-src` est la valeur de repli de toute directive de chargement absente.
- Le piège « jamais `'unsafe-inline'` » ci-dessus vaut pour l'app ; dans le bac à sable c'est un choix assumé → [[Bac à sable des widgets — iframe isolée, origine opaque et protocole gi-widget]].
