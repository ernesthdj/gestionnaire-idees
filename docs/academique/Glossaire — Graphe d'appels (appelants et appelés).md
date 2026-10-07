---
type: glossaire
subject: Graphe d'appels — symboles reliés par « appelle / importe / implémente », lu dans les deux sens (appelants et appelés), agrégé par ancêtre
tags: [#glossaire, #graphe, #analyse-statique]
date: 2026-10-07
niveau: intermédiaire
---

# Graphe d'appels (appelants et appelés)

> **En 30 secondes** — Un **graphe d'appels** relie les morceaux de code (fonctions, méthodes, classes) par des flèches « A appelle B ». Lu dans un sens, il répond à « **que fait** cette fonction ? » (ses **appelés**) ; dans l'autre, à « **qui dépend** d'elle ? » (ses **appelants**). C'est la carte qu'un développeur se construit dans la tête en découvrant un projet.

## 1. C'est quoi, et pourquoi ça existe ?
- **Problématique** : avant de modifier une fonction d'un projet inconnu, il faut savoir **ce qui casse** si on la change (ses appelants) et **ce dont elle a besoin** (ses appelés). Le chercher à la main dans 5 000 fichiers est impossible.
- **Analogie** (multiprise) : chaque fonction est une **prise**. « Appelle » = un câble qui part d'elle vers une autre prise. Les **appelés** d'une prise sont ce qu'elle alimente ; ses **appelants** sont ce qui l'alimente. Couper une prise très alimentée (beaucoup d'appelants) éteint beaucoup de choses.

## 2. Comment ça marche (sous le capot)
- **Construction** (analyse statique, sans exécuter) : un analyseur syntaxique lit chaque fichier en arbre ; chaque appel `foo()` est rattaché au symbole qui le contient, puis on cherche **quel** `foo` est visé. Quand plusieurs candidats existent, le lien est marqué moins fiable (« déduit », « incertain ») ; s'il vise une bibliothèque externe, il n'a pas de cible (`toSymbolId: null`) et est seulement **compté**.
- **Stockage** : une table de liens `(de, vers, type, nombre, fiabilité)` — une **liste d'arêtes**. Pour répondre vite dans les deux sens, on peut en tirer deux **listes d'adjacence** (sortants par symbole, entrants par symbole).
- **Agrégation** : en remplaçant chaque extrémité par son ancêtre (fichier, dossier, module), on obtient le graphe des **dépendances entre dossiers ou modules** : les nombres s'additionnent, la fiabilité retenue est la plus faible.

## 3. En pratique
```text
Order.Place  ──appelle──▶  Order.Validate   (syntaxe, ×1)
Order.Place  ──appelle──▶  Mailer.Send      (déduit, ×2)
Order.Place  ──appelle──▶  (externe)        ×3, compté seulement

Volet du bloc « Order.Validate » :  ← appelé par  Order.Place
Volet du bloc « Order.Place »    :  → appelle     Order.Validate, Mailer.Send ×2 ; 3 appels externes
```

## Utilisé dans ce cours
- [[Explorateur de code — du module au bloc, appelants et appelés]] — volet de code (deux sens par bloc) et flèches agrégées de la carte.
- [[Guide de reprise — contexte borné, sections fixes et sources vérifiées]] — les symboles connus servent à vérifier les sources `fichier#symbole`.
- [[Plan d'attaque — étapes ordonnées, dépendances sans cycle et verrou]] — un autre graphe orienté du projet (dépendances entre étapes).

## Retenir et vérifier
- **À retenir** : un lien se lit dans **deux sens** ; un graphe d'appels **statique** est une **estimation** (appels dynamiques, réflexion, injection de dépendances lui échappent en partie) ; agréger = additionner et garder la fiabilité la plus faible.
> **Q :** Quelle question répond la liste des **appelants** d'une fonction ? **R :** « Qui est touché si je la modifie ? » — l'impact d'un changement.

**Pièges** : ⚠️ croire le graphe statique complet (un appel construit dynamiquement, `$obj->$method()` en PHP, n'y figure pas toujours) ; ⚠️ confondre « importe » (dépendance de fichier) et « appelle » (exécution).
