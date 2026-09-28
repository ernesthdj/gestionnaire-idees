# Niveau 4 (amendement) — Blocs et mini-widgets générés par Claude
> Projet : Gestionnaire_idées · Amende : L4b-neurones.md (canvas), L1b-brainstormer.md (cadre IA, plan de livraison)
> Date : 2026-09-28 · Source : idée de mentalyas · Statut : décisions validées (3 arbitrages)

## 1. Idée
La toile de l'écran Idées accepte, en plus des neurones, des **blocs** placés librement. Dans un bloc,
l'utilisateur demande à Claude de générer un **mini-widget** (HTML, CSS, TypeScript) : calculateur de budget,
comparateur, compte à rebours, check-list… Le widget **interagit avec les idées** (lit des neurones, propose des
modifications). Le Brainstormer devient un espace de travail programmable.

## 2. Décisions
| Sujet | Décision |
|-------|----------|
| Livraison | **v2** (après le MVP-2). **La toile du MVP-1 prévoit dès maintenant un type de nœud « bloc »** (conteneur vide, déplaçable, redimensionnable) pour éviter une refonte. |
| Sécurité | Modèle proposé, validé tel quel (§3). |
| Portée | **Uniquement les données de l'app** : aucun accès Internet, aucune fuite possible vers l'extérieur. |

## 3. Modèle de sécurité (non négociable)
1. **Isolation** : chaque widget tourne dans un `iframe` `sandbox="allow-scripts"` (sans `allow-same-origin`),
   contenu en `srcdoc`, CSP stricte (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`,
   **aucun `connect-src`**) : pas d'accès à Node, au disque, au réseau, au DOM de l'app ni à `window.api`.
2. **Capacités** : le widget ne communique que par `postMessage` avec un pont côté app qui applique un contrat de
   capacités **accordées widget par widget** (ex. `neurons.read:<id>`, `proposals.create`). Messages validés par Zod.
3. **Écritures = propositions** : toute modification demandée par un widget devient une proposition soumise à
   validation (principe constitutionnel II).
4. **Transparence** : avant la première exécution, l'utilisateur voit le code et les capacités demandées ; le widget
   est enregistré dans une **version figée** (empreinte) ; toute régénération repasse par cette étape.
5. **Génération** : exception **strictement limitée** au cadre de l'IA — Claude peut produire du code **uniquement**
   pour un widget, dans un format encadré (fichier unique, API de capacités imposée, aucune ressource externe).
   Le cadre système v2 sera amendé en conséquence au moment de la v2 (amendement de constitution à prévoir).

## 4. Impact immédiat (MVP-1)
- Spec 003 : la toile gère un type de nœud générique **« bloc »** (conteneur vide, sans exécution de code),
  persistant sa position et sa taille. Aucun widget exécutable avant la v2.
