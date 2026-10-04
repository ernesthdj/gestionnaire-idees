# Niveau 1 (amendement) — Le Brainstormer, outil de chirurgie de projet
> Projet : Gestionnaire_idées · Amende : L1d-neurone-conversation.md (types de neurones, recettes), L1c (permissions
> du chat, n°10), spec 008 · Date : 2026-10-04 · Statut : vision et 5 arbitrages validés, plan de livraison validé

> « Le Brainstormer devient un outil de chirurgie qui décortique un projet, le segmente en nœuds, le structure, et
> permet de travailler de manière chirurgicale sur des parties du projet ou sur un ensemble, de manière visuellement
> précise — sans oublier l'intervention des widgets par après. » — mentalyas

## 1. Constat
Avec un dossier lié (spec 008, T017), la conversation d'un genesis récupère le contexte complet d'un projet réel. Le
neurone question-réponse ne suffit plus : sur un projet existant, un nœud doit être **un élément du projet** sur lequel
on brainstorme, conçoit, **construit** (code, tests, build).

## 2. Deux recettes, un même neurone
| Genesis | Recette | Ce que la carte montre |
|---------|---------|------------------------|
| **Sans dossier** (une idée) | **Entonnoir** (L1d) : vision → aspects → approfondissements → parcours | La maturation d'une idée |
| **Lié à un dossier de projet** | **Carte de structure** (ce document) | L'anatomie du projet, et le travail en cours dessus |
Un entonnoir exporté (`FOUNDATION.md`) peut devenir un projet, puis une carte de structure : la boucle est fermée.

## 3. Types de nœuds de la carte de structure (première version)
| Type | Représente | Affiche | Exemple (Brainstormer) |
|------|-----------|---------|------------------------|
| ◉ **Projet** | Le genesis lié au dossier | Vision, stack, état, avancement | Gestionnaire_idées |
| ▣ **Module** | Grande partie de l'architecture | Rôle, nb de fichiers, dépendances | main, renderer, relais MCP |
| ◆ **Fonctionnalité** | Capacité du produit (souvent une spec) | Statut idée → spécifiée → en cours → livrée, avancement des tâches | Pont MCP, Chat des neurones |
| ▢ **Composant** | Fichier ou petit groupe de fichiers | Chemin(s), rôle, tests liés | ConversationService.ts |
| ⛁ **Donnée** | Table, entité, schéma | Champs clés, qui lit / écrit | neurons, map_links |
| ⇄ **Interface** | Contrat entre deux parties | Canaux, entrées / sorties | IPC `chat:*`, outils MCP |
| ☐ **Tâche** | Travail à faire | Statut, nœud concerné | Lot B : entonnoir |
| ◇ **Décision / question** | Arbitrage ou point ouvert | Choix, raisons | Transport du pont |
| ✚ **Opération** | Intervention sur un ensemble de nœuds | Nœuds concernés, statut, changements faits | Refactor du pont |
**Liens typés** : dépend de · appelle · lit / écrit · implémente · teste · bloque.
Chaque nœud garde **sa conversation** (spec 008) et **sa fiche** ; il porte en plus ses **chemins** dans le projet.

## 4. Arbitrages (2026-10-04)
| # | Sujet | Décision |
|---|-------|----------|
| 20 | Pouvoirs d'un nœud de projet | **Construire, avec validation** : Claude peut modifier des fichiers et lancer des commandes **dans le dossier lié** ; chaque action sensible est demandée dans le chat (Autoriser / Refuser), via l'outil de demande de permission du CLI branché sur le pont. Remplace, pour les genesis liés, la restriction « lecture seule » (L1c n°10). |
| 21 | Création et mise à jour de la carte | **Claude cartographie à la liaison** (lit le projet, dessine les nœuds typés et leurs liens) ; quand une conversation modifie le code, **Claude propose la mise à jour** des nœuds touchés ; « Recartographier » toujours disponible. |
| 22 | Lisibilité | **Niveaux qui se déplient** (zoom sémantique) : d'abord Projet + modules + fonctionnalités ; déplier un module montre ses composants, données, interfaces ; les liens entre parties pliées restent visibles, regroupés. |
| 23 | Chirurgie sur un ensemble | **Une opération nommée** : « Opérer sur la sélection » crée un nœud ✚ **Opération** (ex. « Refactor du pont ») relié aux nœuds choisis, avec sa propre conversation (contexte : projet + nœuds sélectionnés + leurs fichiers) ; l'intervention et son historique restent sur la carte. |
| 24 | Ordre de livraison | **P1 → P2 → P3 → B**, puis P4 (widgets) et C (bascule). |

## 5. Ce qui ne change pas
- Pont MCP (spec 007), conversation par neurone, fiche, consommation, dossier lié (spec 008 lot A).
- Les écritures de Claude sur la **carte** restent directes et annulables ; les écritures dans le **projet** passent par
  ta validation (n°20) et restent visibles dans git.
- Widgets : bac à sable et revue inchangés ; ils viendront **se brancher sur les nœuds** (tests, métriques, état du
  build…) dans un lot ultérieur.

## 6. Plan de livraison proposé
| Lot | Contenu | Test avec mentalyas |
|-----|---------|---------------------|
| **P1 — Carte de structure** | Nœuds typés (tous des neurones : chacun sa conversation), liens typés, outil MCP pour dessiner une structure typée, « Cartographier ce projet » à la liaison, niveaux qui se déplient, conversation d'un nœud centrée sur son élément (contexte : projet + nœud + ses fichiers) | Lier `gestionnaire-idees` → la carte du Brainstormer apparaît, on déplie `main`, on ouvre la conversation de `ConversationService` |
| **P2 — Construire** | Permissions dans le chat (Autoriser / Refuser / Toujours pour cette conversation), écriture et commandes dans le dossier lié, mise à jour proposée des nœuds touchés | Demander une petite modification à un composant, valider, voir le nœud mis à jour |
| **P3 — Chirurgie sur une sélection** | Conversation sur un ensemble de nœuds | Sélectionner 3 nœuds → « Opérer sur la sélection » |
| **P4 — Widgets sur les nœuds** | Widgets branchés sur un nœud de projet (tests, métriques, état) | Un widget « tests » sur une fonctionnalité |
| **B — Entonnoir** | Recette des genesis sans dossier (L1d) | Faire mûrir une idée sur 3 couches |
| **C — Bascule** | Conversion des anciennes idées, retrait de l'ancien moteur | — |

## 7. Points ouverts
- [ ] Granularité d'un composant (fichier seul ou regroupement) et nombre maximal de nœuds par niveau.
- [ ] Où vit la carte : uniquement dans l'app, ou aussi un fichier dans le projet (ex. `docs/brainstormer-map.json`) versionné avec git ?
