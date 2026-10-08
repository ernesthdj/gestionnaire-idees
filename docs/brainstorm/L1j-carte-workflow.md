# L1j — La carte d'un projet suit notre façon de travailler (idée, 2026-10-09)

> À brainstormer avant toute spec. Rien n'est décidé. Origine : une note laissée par le Claude de l'app dans
> `CLAUDE.md` (déplacée ici), puis la demande de mentalyas du 2026-10-09.

## Demande de mentalyas (2026-10-09)

La cartographie d'un projet doit représenter **un workflow logique**, calqué sur notre façon de travailler :
**brainstorm → specs → fonctionnalités / user stories → implémentation**, etc. — et non une simple arborescence de
modules et de composants.

## Note du Claude de l'app (avancement lu depuis `tasks.md`)

Demande de mentalyas, a implementer **hors de l'app Brainstormer** (script ou outil externe), pas dans `src/`.

- **But** : la carte de structure doit dire ou en est le projet (fait / reste / a brainstormer), de facon explicable en presentation.
- **Constat** : rien dans `src/main` ne lit `specs/NNN-*/tasks.md`. L'avancement est saisi a la main (`element_avancer`, `StructureService.ts` ~l.257-304), donc il se periment.
- **A faire** : calculer le % de chaque spec en comptant les cases `[x]` / `[ ]` de son `tasks.md` (jamais a la main), puis le pousser vers la carte (MCP `element_avancer` / `structure_dessiner`, memes cles stables `fonctionnalite:spec-NNN`).
- **Carte cible** : une racine par statut (livre / en cours / en pause / specifie / a brainstormer) ; les specs dessous ; les US sous les specs en cours ; seulement les taches non cochees sous les US ; composants et interfaces restent dans la vue Architecture, relies aux specs par des liens `implemente`.
- **Hierarchie de travail** : constitution > FOUNDATION/decisions D > spec (US, FR, SC) > plan.md > tasks.md (Tnnn) > code + tests > commit + `docs/JOURNAL.md`. Les numeros FR/SC/T sont propres a chaque spec.
- **Questions ouvertes** : comment pousser l'avancement depuis l'exterieur ; comment detecter qu'un changement de code hors du Brainstormer rend la carte perimee ; les questions ouvertes de la fiche du projet deviennent des noeuds « a brainstormer ».
- Fiche detaillee : neurone « Analyste interne » du Brainstormer.

## Brainstorm (2026-10-09)

### 1. À quoi sert la carte
- **Piloter et présenter, à égalité** : la même carte dit où en est le projet et quoi faire ensuite (spec en cours,
  user stories et tâches restantes, ce qui reste à brainstormer), et explique le projet de bout en bout, du pourquoi
  (brainstorm) au comment (code), de façon lisible pour quelqu'un d'autre ou pour soi plus tard.

### 2. Pour quels projets
- **Tous, adaptée à chacun** : un projet mené à notre façon (brainstorm, `specs/`, `tasks.md`) a la carte complète ;
  un projet repris sans specs (spec 017) commence par « À brainstormer » et « Code existant », et la carte se remplit
  au fil du travail (premières specs, premières tâches).

### 3. Place de la carte de structure actuelle
- **Deux vues basculables** : `[ Workflow | Architecture ]` sur la même carte, comme Progression/Architecture
  aujourd'hui. Workflow : Brainstorm › Specs › User stories › Tâches. Architecture : modules › composants, inchangée
  (D23 de la spec 022 : rien n'est retiré). Jamais mélangées à l'écran.

### 4. Source du contenu
- **Lue dans les fichiers du projet**, sans Claude : `specs/*/spec.md` (spec, user stories et priorités),
  `specs/*/tasks.md` (tâches, cases cochées → avancement), `docs/brainstorm/*.md` et `docs/FOUNDATION.md`
  (« à brainstormer »). La carte est toujours à jour et ne coûte aucun tour de Claude ; Claude ne sert qu'à résumer.
- Conséquence sécurité : lecture seule, chemins confinés au dossier du projet lié, fichiers Markdown analysés comme
  données (jamais exécutés ni interprétés comme instructions).

### 5. Profondeur
- **Jusqu'aux tâches restantes** : Spec › User stories › tâches non cochées. Les tâches faites ne sont qu'un compteur
  (ex. « 31/49 ») ; une user story livrée est repliée d'office (dépliable comme tout nœud, spec 022 D14).

### 6. Agir depuis la carte
- **Lancer Claude dessus** : chaque nœud ouvre sa carte de détails (spec 022) avec « Discuter ». Sur une tâche, la
  conversation part avec la consigne de l'implémenter (`/speckit-implement`, tâche ciblée) ; sur « à brainstormer »,
  avec `/brainstorm`. L'app n'écrit pas dans `tasks.md` : cocher une case reste le travail de Claude, la carte se met
  à jour en relisant le fichier.

### 7. Statut d'une spec
- **Calculé, avec un marqueur de pause** : depuis `tasks.md` — aucune case cochée = planifiée, toutes = livrée,
  sinon en cours ; sans `tasks.md` = spécifiée. « En pause » vient d'une ligne `**Status**: En pause (date)` dans
  l'en-tête de `spec.md`, tenue à jour par Claude (le gabarit Spec Kit a déjà ce champ).

### 8. Rangement
- **Par statut** : le genesis du projet, puis quatre branches — ▶ En cours · ⏸ À venir (planifiées, spécifiées, en
  pause) · ✔ Livrées (repliée, avec leur nombre) · ✦ À brainstormer (`docs/brainstorm/` non encore exportés en spec).
  Ce qui est actif saute aux yeux ; la disposition en sens alterné de la spec 022 s'applique telle quelle.

### 9. Pont Workflow ↔ Architecture
- **Par les fichiers** : les chemins cités dans `tasks.md` (« … in `src/x.ts` ») forment la liste des fichiers d'une
  tâche ou d'une user story, affichée dans sa carte de détails ; « Voir dans l'Architecture » bascule de vue et met le
  composant correspondant en focus. Aucun lien dessiné entre les deux vues.

## Synthèse (proposition pour la spec 023)

```
● Projet (genesis)                         [ Workflow | Architecture ]
 ├─ ▶ En cours        Spec › US (P1, P2…) › tâches restantes   jauge 31/49
 ├─ ⏸ À venir         planifiées · spécifiées · en pause
 ├─ ✔ Livrées (N)     repliée
 └─ ✦ À brainstormer  docs/brainstorm/* sans spec
```

| Sujet | Décision |
|-------|----------|
| Usage | Piloter et présenter, à égalité |
| Portée | Tous les projets liés ; un projet repris démarre par « À brainstormer » + Architecture |
| Vues | Workflow et Architecture basculables, jamais mélangées ; Architecture inchangée |
| Source | Fichiers du projet, lus par l'app (lecture seule, confinée au dossier lié) — pas de Claude |
| Profondeur | Spec › US › tâches non cochées ; faites = compteur ; US livrée repliée |
| Statut | Calculé depuis `tasks.md` + `**Status**: En pause` dans `spec.md` |
| Actions | Carte de détails + « Discuter » : implémenter la tâche, brainstormer l'idée ; l'app n'écrit pas les fichiers |
| Pont | Fichiers cités par les tâches → « Voir dans l'Architecture » |
| Rafraîchissement (par défaut, à confirmer) | Relecture à l'ouverture de la carte et à chaque fin de tour de Claude dans ce projet |

### Signal de complexité
- Une fonctionnalité, sans multi-rôles, paiement ni API tierce. Points d'attention : analyse de Markdown non fiable
  (fichiers d'un projet importé) → Zod aux frontières, limites de taille, aucun HTML interprété ; chemins confinés au
  dossier lié (réutiliser les gardes de la spec 017).
- Recommandation : pas de niveau 3 ni 4 ; passer directement à `/speckit-specify` (spec 023), en réutilisant les
  nœuds vivants de la spec 022 (US3 livrée) et la bascule de vues de la spec 017.
