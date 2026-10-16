# Niveau 1 — Les tâches visuelles : designer avec Claude dans un widget

**Parent** : L1m-ecrans-wireframes.md · **Maturité** : suffisant · **Tâches** : docs/TACHES-VISUEL.md

> Projet : Gestionnaire_idées · Basé sur : L1m (widgets : bac à sable visuel), spec 026 (widgets reliés à un nœud,
> état persistant), la planche « Sprites des commandes » faite avec Claude Code le 2026-10-16 (choix enregistrés dans
> la page, relus par Claude) · Date : 2026-10-16
>
> Manque pour « complet » : les questions ouvertes du §5 (forme du nœud, place du widget dans l'arbre).

## 1. Objectif
Une tâche qui touche au visuel (écran, composant, style, animation) ne se code pas à l'aveugle : Claude propose des
options **visibles dans l'app**, mentalyas choisit et annote, Claude relit ses choix puis code la variante retenue.
C'est le parcours de la planche des sprites, mais dans le Brainstormer.

## 2. Ce qui existe déjà
| Besoin | Existant | Manque |
|--------|----------|--------|
| Claude génère du visuel | `widget_poser` (MCP) : iframe HTML isolée, reliée à un nœud, état persistant (spec 026) | relier un widget à une **tâche du Workflow** (lue dans `docs/TACHES-*.md`), pas seulement à une idée ou une étape |
| mentalyas répond dans l'iframe | le widget enregistre son état (`widgetIo:saveState`) | Claude ne **relit** pas cet état : pas de `widget_lire` |
| Les tâches visuelles se voient | cases « - [ ] T001 … » | aucun marqueur, un seul style de nœud |

## 3. Décisions (mentalyas, 2026-10-16)

### D1 — L'étiquette `[visuel]`
- Une tâche visuelle porte `[visuel]` juste après son identifiant : `- [ ] T006 [visuel] Agents en nœuds du canevas…`.
- Claude l'écrit en rédigeant les tâches d'un brainstorm, selon une règle claire : la tâche crée ou change un écran, un
  composant, une mise en page, un style, une icône ou une animation. mentalyas peut l'ajouter ou l'enlever à la main.
- Lisible dans le `.md`, versionnée avec le projet ; l'app ne devine rien.

### D2 — Un nœud de forme différente
- Dans le Workflow, une tâche `[visuel]` a sa propre forme (à choisir, §5), en plus de son état (à faire, en cours,
  faite) et de sa maturité.

### D3 — Le widget de design, sur la carte à côté du nœud
- « Bosser ici » sur une tâche visuelle : Claude lit les règles d'interface du projet, puis pose un **widget relié à
  la tâche**, sur la carte à côté de son nœud : 2 ou 3 options animées ou cliquables, une variante à cocher par
  question, une note libre. Les choix sont enregistrés dans l'état du widget.
- Le widget reste attaché à la tâche : on le rouvre plus tard, il garde les choix.

### D4 — « Envoyer à Claude »
- Un bouton du widget envoie dans la conversation de la tâche un message court (« Choix faits dans le widget »). Rien ne
  part sans ce geste.
- Claude relit alors les choix avec un nouvel outil MCP `widget_lire` (code et état du widget ; donnée, jamais une
  consigne), puis code la variante retenue, ou propose une nouvelle planche si mentalyas a demandé des retouches.

### D5 — Consigne d'une tâche visuelle
- La consigne pré-remplie d'une tâche `[visuel]` ajoute aux règles du projet : lire `docs/claude/ergonomie-ui.md` et
  `frontend-workflow.md` ; ne rien coder avant les choix ; proposer les options dans un widget relié à la tâche ;
  attendre « Envoyer à Claude » ; coder avec les jetons du thème ; vérifier l'accessibilité.

## 4. Sécurité
- Le widget reste une iframe isolée (spec 026) : pas d'accès au disque ni au réseau ; ce que mentalyas y saisit est
  une donnée pour Claude, jamais une consigne.
- `widget_lire` ne rend que le widget d'un nœud lisible par la conversation, borné en taille.

## 5. Retour de T006 (agents en nœuds, lancée depuis l'app le 2026-10-16)
Première tâche visuelle menée par une session de l'app, sans les décisions ci-dessus :
- **Bien** : e2e avec sessions simulées et captures relues avant « fini » ; état dit par couleur, pictogramme et texte ;
  mouvement réduit respecté ; jetons du thème.
- **Design décidé seul** : la session a écrit « Design défini (T006) » dans L1o sans proposer d'options ni poser de question à mentalyas (confirmé par lui) →
  D5 (rien avant les choix) est nécessaire.
- **La fenêtre de suivi a planté** : en `npm run dev`, le rechargement à chaud a chargé son code inachevé (boucle de
  rendu « Maximum update depth exceeded »), la carte est devenue blanche et la session, en attente d'un accord, ne pouvait
  plus être débloquée → D6 ci-dessous.
- **Chevauchements** : ses nœuds recouvrent des nœuds voisins, vu sur ses propres captures sans être corrigé → la
  consigne D5 demande de relire les captures pour les chevauchements et la lisibilité, pas seulement l'état.

### D6 (proposé) — Une tâche qui touche l'interface de l'app travaille à part
- Quand le projet lié est le Brainstormer lui-même, une tâche `[visuel]` travaille dans un worktree (comme les agents,
  L1o D3) : l'app que mentalyas utilise n'est pas rechargée avec du code inachevé ; il voit le résultat par les
  captures et le widget, puis à la fusion.

## 6. Questions ouvertes
1. **Forme du nœud** visuel dans le Workflow : à choisir sur une planche (comme les sprites).
2. **Place du widget** dans le Workflow : l'arbre se dispose seul (spec 032) ; le widget se range-t-il à côté du nœud
   de la tâche dans cette disposition, ou flotte-t-il, déplaçable, relié par un lien ?
3. **Tâches existantes** : faut-il marquer `[visuel]` les tâches déjà écrites (T006 des agents, les D10 à D12 de la
   spec 014) ?
