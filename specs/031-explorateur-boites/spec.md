# Feature Specification: Explorateur en boîtes (spec 031)

**Feature Branch**: `main` · **Created**: 2026-10-14 · **Status**: Écrite (2026-10-14) — maquette validée par mentalyas,
lots à coder

> Refonte de l'explorateur d'un projet repris (spec 017 US2, D16). L'analyse statique, sa base et le panneau du code ne
> changent pas : seule la façon de voir et de parcourir la carte du code change. Référence visuelle et gestuelle :
> `maquette.html` (projet fictif « boutique », 7 fichiers réels du jeu de test, plus un module « Catalogue » de 20
> fichiers inventé). Spec légère (décisions, exigences, tâches), comme la 030.

## Problème

Retour de mentalyas (2026-10-14) sur l'explorateur actuel :

1. le style des rectangles ne ressemble pas au reste de l'app ;
2. les informations ne parlent pas (« Orchestration », « 0 dossier », « (racine) ») ;
3. ni l'architecture ni les liens ne se comprennent (un « 4 » sur un trait) ;
4. le zoom par paliers (Modules → Dossiers → Fichiers) remplace l'écran et fait perdre le fil.

Et depuis la spec 017 D23 : il veut consulter vite un fichier précis, dans un module de 20 fichiers comme dans un de 2.

## Décisions

| # | Décision |
|---|----------|
| D1 | **Un seul niveau, des boîtes (piste A)** : la carte d'ensemble range les modules de gauche à droite dans le sens des appels. Plus de paliers, de zoom sémantique, de nœuds dossier à onglets, de « (racine) » ni de « 0 dossier ». |
| D2 | **Une boîte dit à quoi sert le module** : sa couche (Démarrage, Entrée, Règles, Données et outils), son nom, son rôle en une phrase (celui du guide de reprise), son nombre de fichiers et de lignes. Le point d'entrée (`Program.cs`, `main.ts`…) devient « Démarrage ». |
| D3 | **Clic : la boîte s'ouvre sur place** et montre ses fichiers (nom, rôle) ; au-delà de 6 fichiers, une liste compacte, complète et filtrable, qui défile dans la boîte ; un point marque les fichiers reliés à un autre module. Un trait arrive sur le fichier exact quand son module est ouvert ; les appels entre fichiers d'un module ouvert sont tracés (couleur d'accent). **Un clic dans le vide** referme les boîtes ouvertes (pas après avoir fait glisser le fond). |
| D4 | **Double-clic : entrer dans le module.** L'intérieur est construit tout de suite ; à chaque image, la carte d'ensemble (copie figée) et l'intérieur cadrent leur nœud dans le même rectangle, qui va de la boîte au cadre final : le nœud et ses fichiers grandissent ensemble, à la même échelle (rapport fichier/cadre constant). La boîte et le cadre se relaient en fondu (opacités complémentaires, calées sur le temps) ; les fichiers sont visibles bien avant la fin ; le titre glisse de la boîte à sa place dans le cadre (calque de titres, relais au pixel près). Durée de l'ordre de 0,7 s. **Échap** (ou double-clic dans le vide, ou le fil d'Ariane) fait l'inverse exact et rend la carte au zoom d'avant. |
| D5 | **Dedans, seulement l'intérieur** : un cadre à la taille de son contenu, avec de l'air (fichiers de largeur fixe lisible, colonnes et lignes espacées) ; les fichiers rangés par profondeur d'appel (qui appelle à gauche), au plus 4 colonnes de 7 ; les fonctions de chaque fichier sur sa boîte ; les appels internes en couleur d'accent ; les appels vers l'extérieur réduits à des **amorces** sur les bords (« ← Controllers » à gauche pour qui l'appelle, « Logging → » à droite pour ce qu'il appelle). En entrant, la vue se cadre sur tout l'intérieur sans descendre sous 80 %. |
| D6 | **Clic sur une amorce : même logique que le double-clic** — le module voisin grandit depuis l'amorce avec ses fichiers, l'intérieur actuel zoome vers elle et s'efface en fondu, le nom de l'amorce devient le titre. |
| D7 | **Des liens qui se lisent** : au survol, la phrase de l'appel (« `OrdersController.Post` appelle `OrderService.Place` »), certain ou deviné ; un appel deviné (pointillé) dit pourquoi (« `Save` sans type : 3 cibles possibles »). La flèche va de celui qui demande vers celui qui fait ; l'épaisseur compte les appels. |
| D8 | **Fiche à droite** (panneau existant, 38 %) : un module → rôle, « Utilise », « Utilisé par » en mots, contenu ; un fichier → ses fonctions, ce qu'il appelle et qui l'appelle, puis son code (panneau du code de la spec 017). |
| D9 | **Recherche Ctrl+K** : un fichier ou une fonction, où qu'il soit ; Entrée entre dans son module et sélectionne le fichier. |
| D10 | **Gestes** : molette = zoom continu et amorti, centré sur le curseur (40 % à 300 %) ; glisser le fond = se déplacer ; glisser un module **ou un fichier** = le poser ailleurs, chacun seul, ses traits suivent (positions gardées par vue : la carte, l'intérieur de chaque module) ; « Ranger » = disposition automatique ; « Recadrer » = vue d'origine (dedans : cadrage d'ensemble). Un clic ne devient un déplacement qu'au-delà de 4 px. |
| D11 | **Animations** : aucune image de transition ne montre un élément hors de sa place ; les traits ne sont recréés que si les liens changent (sinon seules leurs courbes bougent) ; la hauteur de la carte ne change pas pendant une transition ; `prefers-reduced-motion` : transitions instantanées. |
| D12 | **Validé par mentalyas le 2026-10-14** : (a) le rôle d'un fichier est écrit par Claude dans la même passe que le guide, pour un projet « Claude autorisé » ; en « Local uniquement », la boîte montre le chemin et les fonctions, sans phrase ; (b) la « Vue liste » reste, équivalent clavier et lecteur d'écran de la carte ; (c) des filtres actuels ne restent que « Masquer la plomberie » et les langages, dans un menu. |
| D13 | Ce qui reste : l'analyse (spec 017), la confidentialité, le guide de reprise, la levée des ambiguïtés, la rediffusion git et « Depuis ta dernière visite » (spec 021, rebranchées sur les clés de modules et de fichiers), le bouton « Explorateur » et « Analyser le code… » (017 D23). |

## Exigences

- **FR-001** IPC `explorer:map` `{ genesisId }` (Zod) : toute la carte en une réponse — modules (clé, nom, couche, rôle,
  fichiers, lignes), fichiers (chemin relatif, module, dossier d'origine, rôle ou `null`, fonctions, lignes), appels de
  fichier à fichier (nombre, fiabilité, phrase, cibles possibles d'un appel deviné). Chemins relatifs seulement ; jamais
  de fichier sensible ; lecture seule. Borné (fichiers et appels plafonnés, signalé si tronqué).
- **FR-002** Domaine pur : couche d'un module (catégories de la spec 017 + point d'entrée) ; profondeur d'appel des
  fichiers d'un module ; disposition de la carte (colonnes dans le sens des appels) et de l'intérieur (D5).
- **FR-003** Positions : `explorer:savePosition` gardé, clés de vue `carte` et `dedans:<module>` ; « Ranger » efface
  celles de la vue affichée.
- **FR-004** Renderer : carte React Flow (zoom, déplacement, glisser-déposer, nœuds contenant des nœuds), transitions
  D4 à D6, fiche D8, recherche D9 ; accessibilité (noms accessibles des modules, fichiers et traits ; Entrée ouvre,
  Maj+Entrée entre ; Échap sort) et `expectNoAxeViolations`.
- **FR-005** Rediffusion git et nouveautés (spec 021) : marques posées sur les modules et les fichiers visibles.

## Critères de réussite

- **SC-001** Depuis un projet repris, un fichier précis s'ouvre (code à droite) en 2 gestes au plus (Ctrl+K, Entrée) ou
  3 clics, sans changer d'écran.
- **SC-002** Pendant l'entrée dans un module, le rapport largeur d'un fichier / largeur du cadre reste constant, la somme
  des opacités boîte + cadre reste 1 et le titre passe du calque au cadre sans écart (mesuré en e2e).
- **SC-003** Un module de 20 fichiers s'ouvre sans chevauchement de fichiers, noms lisibles (≥ 80 %).
- **SC-004** Les liens d'un module se lisent en mots au survol, deviné compris.
