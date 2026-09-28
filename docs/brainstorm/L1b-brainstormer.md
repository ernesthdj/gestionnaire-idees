# Niveau 1 (amendement) — De l'agenda au « Brainstormer »
> Projet : Gestionnaire_idées · Amende : L1-fondation.md (§1 vision, §2 fonctionnalités, §2ter cadre IA), L4b-neurones.md
> Date : 2026-09-28 · Statut : décisions validées par mentalyas (4 arbitrages)

## 1. Nouvelle vision
L'app n'est plus seulement un agenda organique : c'est **le Brainstormer de mentalyas** — un espace pour
**réfléchir à n'importe quoi avec Claude**, en gardant une **vision neuronale** de tout ce qui est en cours
(achats, projets IT, concepts photo, décisions, sorties…). L'agenda (tâches, planning, Outlook, rappels)
devient **une sortie possible** d'un neurone, pas la finalité.

## 2. Un seul réseau, deux natures de neurones (décidé)
| Nature | But | Croissance | Sortie à la fusion |
|--------|-----|------------|--------------------|
| **Action** | Quelque chose à réaliser | Questions orientées exécution (quand, combien, comment, source d'argent) | Plan organisé : tâches, conditions, dépendances, dates (→ Planning / Outlook en MVP-2) |
| **Réflexion** | Quelque chose à explorer | Questions orientées exploration (pourquoi, options, pour/contre, contraintes, critères) | Synthèse structurée : pistes retenues, décisions, arguments, questions ouvertes |

- L'IA **propose la nature** à la capture ; modifiable à tout moment.
- Une Réflexion peut **engendrer des neurones Action** (bouton « Passer à l'action »).
- Tous les neurones partagent le **même moteur** : croissance (≥ 3 questions, sans maximum), jauge de contexte,
  fusion par synthèse IA + confirmation, réseau et liens suggérés (L4b).

## 3. Cadre de l'IA élargi (décidé : tout sujet, en mode réflexion)
- **Périmètre** : n'importe quel sujet, avec un rôle fixe de **partenaire de brainstorm** : poser des questions,
  proposer des pistes, arguments pour/contre, critères de décision, synthèses, plans d'action.
- **Hors périmètre** (refus poli + recentrage) : produire des **œuvres finies** — images, poèmes/prose créative,
  code complet, textes longs rédigés. L'IA aide à **y réfléchir** (structure, idées, critères), pas à les produire.
- Règles inchangées : ne jamais inventer un fait chiffré ou daté personnel (demander / investigation), texte
  utilisateur = donnée, sorties structurées validées, anonymisation avant envoi, validation humaine.
- *Remplace* le cadre « organisation d'idées et de tâches uniquement » (L1 §2ter, L3-moteur-ia, spec 001).

## 4. Sorties d'un neurone Réflexion (décidé : les 4)
| Sortie | Livraison |
|--------|-----------|
| Synthèse structurée (dans le neurone éclos) | **MVP-1** |
| Export Markdown (arbre + synthèse ; lisible par Claude Code, `/brainstorm`, Obsidian, NotebookLM) | **MVP-1** |
| Conversion en plan d'action (« Passer à l'action » → neurones Action) | **MVP-2** |
| Pont vers le hub (neurone « projet » éclos → `/hub new` + FOUNDATION pré-remplie) | **v2** |

## 5. Plan de livraison révisé (décidé : moteur générique dès le MVP-1)
- **MVP-1 — Le Brainstormer** : capture (F1) · moteur IA (F9) · **neurones Action + Réflexion** : croissance,
  jauge, fusion/synthèse, plongée (F2 révisée) · écran Idées incubateur + réseau, liens suggérés, suivi des
  neurones Action (F3/F4 révisées) · **export Markdown**.
- **MVP-2 — Le secrétaire** : Planning (F5) · Outlook (F6) · Conseiller proactif (F7) · Compagnon (F8) ·
  « Passer à l'action ».
- **v2** : pont vers le hub ProjectMaster ; compagnon vivant sur le bureau ; mobile.

## 6. Points ouverts
- [x] Verrouillage forcé avant `suffisant` : **autorisé, avec avertissement « résultat possiblement non optimal »** + liste des manques (décidé 2026-09-28).
- [ ] Nom de l'app : « Brainstormer » ? (le dépôt `gestionnaire-idees` peut garder son nom ou être renommé plus tard)
- [ ] Budget API : le brainstorm sollicite davantage Claude → plafond 10 €/mois à réévaluer après mesure.
