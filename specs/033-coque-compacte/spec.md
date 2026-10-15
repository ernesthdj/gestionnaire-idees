# Feature Specification: La coque compacte — un maximum de canevas (spec 033)

**Feature Branch**: `main` · **Created**: 2026-10-15 · **Status**: Livrée (2026-10-15) — maquette « A + B » validée par mentalyas
dans l'artifact de brainstorm (canevas « Progression et Architecture — brainstorm », rangée « La coque »)

> Demande de mentalyas (2026-10-15) : les bandeaux autour de la carte (menu de gauche, en-tête, barre du projet, bandeau
> d'ouverture, barre d'outils) prennent ≈ 280 px en haut et 224 px à gauche. Il les veut discrets, minimalistes, sans
> perdre un accès, pour que la carte prenne le maximum d'espace. Quatre pistes maquettées (A rail, B dock, C onglets,
> D coins), puis la fusion A + B validée. Spec légère (décisions, exigences, tâches), comme la 032.

## Problème

1. La carte n'a qu'une partie de la fenêtre : menu de 224 px, en-tête, barre du projet, bandeau d'ouverture et barre
   d'outils empilés au-dessus.
2. Des doublons : « Explorateur » refait la vue Architecture (spec 032 D14, la même page) ; le bandeau d'ouverture et le
   badge git mènent tous deux au volet Dépôt.
3. Des boutons rares occupent la barre : « + Bloc », « Liens d'analyse » (mal compris : les liens d'un élément
   s'affichent déjà à son survol).

## Décisions

| # | Décision |
|---|----------|
| D1 | **Rail de 48 px à gauche** (piste A) : les sections (Projets, Idées, À valider, Historique, Skills, Analyste s'il est actif) en icônes, avec infobulle et nom accessible (pas de pastille sur « À valider » : la section n'a encore rien à compter) ; en bas, **Thème** (menu des 4 thèmes) et **⚙ Réglages**. |
| D2 | **Une barre fine de 32 px en haut** (piste B) : le fil « Section / projet ▾ » ; sur un projet ouvert, la **pastille git** et les **mini-jauges Claude** (5 h, 7 j, détail en infobulle). L'en-tête, la barre du projet et le bandeau d'ouverture disparaissent. |
| D3 | **Menu du projet** (le ▾ du fil) : « ← Tous les projets », le chemin du dossier, « Points de sauvegarde (N) », « Analyser le code… » tant que le code n'est pas analysé. |
| D4 | **Plus d'« Explorateur »** (choix de mentalyas) : la vue Architecture est l'explorateur, dans l'ordre Workflow → Progression → Architecture. Les autres portes vers l'explorateur plein écran (conversation d'un projet repris, « Rejouer sur la carte » et « Voir sur la carte » de l'historique git) **ouvrent la vue Architecture** du projet, avec la rediffusion ou les nouveautés. |
| D5 | **Git : une seule pastille** « ⎇ branche », avec une icône **⚠** quand des fichiers ne sont pas commités ou des commits pas poussés (le compte en infobulle et en nom accessible). Un clic ouvre le **volet Dépôt**. Le bandeau d'ouverture est retiré (choix de mentalyas). |
| D6 | **Le volet Dépôt reprend ce que disait le bandeau** : en tête, « N fichiers non commités · N commits non poussés · le distant a N commits d'avance » et, si `/hub work` en a relevé, la session ouverte ; puis les **dernières entrées du JOURNAL** (repliables). |
| D7 | **Dock d'outils** (piste B) : flottant en bas, au centre de la carte ; les compteurs d'idées, **Chercher** (le champ se déplie), **Filtrer** (natures, catégories, en popover), « Fermer les cartes (N) » s'il y en a, « Reprendre un projet existant » là où il était, **Réorganiser**, **Recentrer** ; chaque outil a une icône et un **libellé court** dessous. |
| D8 | **Clic droit dans le vide** (la boîte à outils de la spec 004) : s'y ajoutent **« Bloc libre »** (l'ancien « + Bloc », posé au point du clic) et **« Liens d'analyse au repos »** (interrupteur, coché quand ils sont montrés ; au survol, les liens d'un élément s'affichent toujours, 017 D15). |
| D10 | **La barre des vues monte dans la barre fine** (2026-10-15, demande de mentalyas) : « Workflow \| Progression \| Architecture », Relire, ✦ Nouveau brainstorm, Lancer…, ↻ Mettre à jour se placent juste à droite de la pastille git, en pastilles arrondies comme elle ; elle n'est plus dessinée au-dessus du genesis du projet (à défaut, du premier genesis de la carte qui en a une : un projet repris a son propre genesis). Ce qui est « à reporter » (023 D23, D28) devient une pastille ⚠ qui ouvre ses deux actions. Les panneaux Progression et Architecture n'ont plus leur propre bascule (la barre fine reste visible au-dessus d'eux). Un autre genesis lié du même canevas garde sa barre sur la carte. |
| D11 | **Zoom fluide dans Progression et Architecture** (2026-10-15, demande de mentalyas) : la molette et les boutons « + » / « − » y suivent le zoom amorti de la carte (spec 022 D20 : la vue rejoint sa cible par petits pas, le point sous la souris reste en place ; instantané en animations réduites) ; « Tout afficher » de la Progression glisse vers son cadre. Glisser le canevas de la Progression déplace la vue sans sélectionner de texte. |
| D12 | **L'abandonné en rouge** (2026-10-15, demande de mentalyas) : une spec ou un fichier de tâches abandonné est cerné de rouge dans le Workflow (son nom aussi) ; dans la Progression, son étape « ✕ Abandonnée » et ses briques sont rouges (jeton `con`). |
| D9 | Rien d'autre ne change : les gestes, les raccourcis (Ctrl+Maj+G pour le Dépôt), les vues, le panneau de droite. Icônes en SVG intégré, jetons du thème, aucune dépendance nouvelle. |

## Exigences

- **FR-001** Le rail (D1) est une navigation accessible : chaque section a un nom accessible, la section courante
  `aria-current="page"`.
- **FR-002** La barre fine (D2) fait 32 px ; le menu du projet (D3) et le panneau du thème (D1) s'ouvrent d'un bouton
  (`aria-expanded`) et se ferment par Échap (le focus revient au bouton) ou par un clic ailleurs.
- **FR-003** La pastille git (D5) dit l'état en mots (jamais la couleur ni l'icône seules) ; dossier introuvable ou git
  absent : dit en clair, comme le badge actuel.
- **FR-004** Aucun accès n'est perdu : chaque action des anciennes barres a sa place (rail, barre fine, menu du projet,
  dock, clic droit, volet Dépôt).
- **FR-005** Tests renderer et vérification d'accessibilité (axe) du rail, de la barre fine, du dock et du volet
  Dépôt ; e2e qui cliquaient sur les anciens boutons mis à jour.

## Critères de réussite

- **SC-001** Sur une fenêtre de 1 280 × 800, la carte d'un projet ouvert occupe au moins 1 200 × 740 px (contre
  ≈ 1 040 × 520 avant).
- **SC-002** Toutes les actions de FR-004 restent atteignables en deux clics au plus.
