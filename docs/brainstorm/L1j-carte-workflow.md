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
