# Niveau 4 (amendement) — Mécanique « neurones » : navigation, croissance, fusion
> Projet : Gestionnaire_idées · Amende : L4-parcours.md (E3, E4, E5, E6), L2/L3-structuration-ia, L2-organigramme
> Date : 2026-09-28 · Source : idée et maquettes de mentalyas (`docs/design/neurones-dispositions-2a-2b-2c.png`)
> Statut : décisions validées (4 arbitrages) — à répercuter dans FOUNDATION.md et les specs 002/003

## 1. Principe
L'écran **Idées** devient la mécanique centrale : une **carte mentale minimaliste** où chaque idée est un
**neurone** qui **pousse** au fil des questions de l'IA, puis **fusionne** en une idée organisée et
**s'interconnecte** aux autres. Le questionnaire linéaire (L2 F2) est remplacé par cette croissance.

## 2. Cycle de vie d'un neurone
| État | Aspect | Comportement |
|------|--------|--------------|
| **Brut** | Cercle en pointillés, texte seul | Dérive lentement dans l'incubateur, sans lien |
| **En développement** | Cercle plein, sous-neurones reliés, extensions « + » | Propose des extensions (questions IA) ; chaque réponse fait pousser un sous-neurone |
| **Éclos** | Double anneau + halo | Idée complète et organisée ; migre de l'incubateur vers le réseau ; reliable aux autres |

### Croissance (décision : 3 questions **minimum**)
- À l'ouverture, Claude propose **au moins 3 extensions** (questions) pertinentes pour le neurone.
- Il n'y a **pas de maximum** : si l'idée est complexe, Claude **creuse plus loin** (nouvelles extensions sur
  les sous-neurones, profondeur 2, 3…), et **l'utilisateur peut ajouter ses propres branches** à tout moment.
- Clic sur une extension → un **sous-neurone** pousse ; l'utilisateur y répond (réponses rapides ou texte,
  « je ne sais pas » → sous-neurone d'investigation, règle « ne jamais inventer » inchangée).
- Types de sous-neurones : réponse simple (ex. « Modèle 27" »), **condition** (◇ Budget ?) avec branches,
  **opportunité** (€ Mission mariage 1 250 €), **investigation**.

### Jauge de contexte (décision)
- Une **jauge de progression** indique si le neurone a **assez de contexte pour être verrouillé**.
- Calcul proposé : Claude évalue à chaque réponse les **dimensions couvertes / manquantes** de l'idée
  (ex. quoi, quand, combien, comment, source d'argent) → niveau `insuffisant` · `suffisant` · `complet`,
  affiché comme une barre + la liste des manques ; plancher déterministe : ≥ 3 questions répondues.
- « Verrouiller » est actif dès `suffisant`. *(À valider : verrouillage forcé avant `suffisant` possible avec avertissement ?)*

### Fusion (décision : synthèse IA puis confirmation)
1. « Verrouiller l'idée 🔒 » → Claude **organise l'arbre** (tâches, conditions, dépendances, déclencheurs, dates).
2. **Aperçu compact** de la synthèse (ajouts / changements) → l'utilisateur confirme ou corrige.
3. Confirmation → **animation de fusion** (les sous-neurones se résorbent dans le neurone principal) → le neurone
   devient **éclos** et migre vers le réseau.
Principe constitutionnel II respecté : rien n'est écrit sans confirmation. La synthèse garde les contrôles
K1–K7 et la provenance (spec 002).

### Interconnexion
- Les neurones éclos du réseau sont reliés par des liens libellés (financement, photo, mobilité…).
- L'IA **suggère** des liens (« lien budget ? » ✓ / ✗) — acceptés ou refusés comme toute proposition.

## 3. Disposition (décision : 2c + plongée 2b)
- **Accueil « Idées » = deux zones** : **Incubateur** (gauche : bruts + en développement) · **Réseau** (droite : éclos reliés).
  En-tête : compteurs (« 3 brutes · 1 en dév. · 2 écloses »), action principale « Développer « … » ».
- **Double-clic sur un neurone → plongée (2b)** : zoom dans le neurone, **fil d'Ariane** (Idées › 2e écran › Budget ?),
  badge de profondeur, parent estompé (clic = remonter), **panneau latéral** : question de l'IA, réponses rapides,
  champ libre, jauge de contexte, « Verrouiller l'idée 🔒 ».
- Un neurone éclos s'ouvre aussi en plongée pour le **suivi** : statuts des tâches, choix de branche, déclencheurs, cocher.
- « + Une idée ? » en bas de l'incubateur ; zoom −/+ et « Recentrer ».

## 4. Navigation (décision : fusion avec l'Organigramme)
Navigation latérale : **Idées · À valider · Planning · Historique** (l'onglet Organigramme disparaît : le réseau
+ la plongée le remplacent). « À valider » garde les suggestions de liens et du conseiller (F7) et les synthèses
en attente.

## 5. Animations
| Animation | Durée indicative | Remarque |
|-----------|------------------|----------|
| Dérive des bruts | continue, très lente | Ambiante ; suspendue si l'utilisateur interagit |
| Pousse d'un sous-neurone | 250 ms | Standard « normal » |
| Plongée / remontée (zoom) | 400 ms | Standard « lent » |
| Fusion (résorption des sous-neurones) | ~600–800 ms | **Dérogation** au 400 ms max — moment « récompense », unique par idée |
| Éclosion + migration vers le réseau | ~600 ms | Enchaînée après la fusion |
| Halo des éclos | pulsation lente | Discrète |
| Suggestion de lien | 150 ms (apparition) | Pointillés jusqu'à acceptation |
**Accessibilité** : si « réduire les animations » est activé (Windows / `prefers-reduced-motion`), toutes les
animations deviennent des transitions instantanées ou des fondus courts ; la dérive est désactivée.

## 6. Impacts
| Élément | Impact |
|---------|--------|
| Spec 001 (moteur IA) | Aucun (nouveaux types de demande : `etendre_neurone`, `evaluer_contexte`, `synthetiser` via AIGateway) |
| Spec 002 (structuration) | Refonte du cœur : session linéaire → **arbre de questions** ; jauge ; synthèse à la fusion |
| Spec 003 (interface MVP-1) | Refonte : écran Idées neurones (2c + 2b), fusion, réseau = ancien organigramme, navigation à 4 entrées, animations |
| Coût IA | 1 appel court (effort bas) par extension + évaluation de contexte ; synthèse à la fusion (effort haut) — plafond mensuel inchangé |
