# Quickstart — Carte Workflow (spec 023)

## Prérequis
- `npm run typecheck`, `npm run lint`, `npx prettier --check src tests`, `npm test` verts.
- `npm run seed:demo` (le lot 5 ajoute un genesis de démo lié à un petit dossier de specs fictif) ou, en dev, un
  genesis lié au dossier du Brainstormer lui-même.

## Scénarios
1. **Bascule (US1)** — Sur un genesis lié : la barre montre « Workflow | Progression | Architecture ». Choisir Workflow
   → quatre branches sous le genesis ; revenir à Progression → la carte de structure est inchangée.
2. **Statuts (US1)** — Sur le dépôt du Brainstormer : 022 sous « En cours » avec la jauge des cases de son `tasks.md` ;
   US1 et US3 repliées « livrées » ; 021 sous « À venir » (planifiée) ; une spec marquée « Livrée » dans sa ligne Status
   sous « Livrées » malgré ses cases restantes (reliquats dans sa carte).
3. **Projet vide (US1)** — Genesis lié à un dossier sans `specs/` : message « comment la carte se remplit ».
4. **Discuter (US2)** — Clic sur une tâche → carte (spec, US, description, fichiers) ; « Discuter » → la conversation du
   projet s'ouvre avec la consigne pré-remplie, rien n'est envoyé ; après l'envoi, quand Claude coche la case, la tâche
   disparaît et la jauge avance à la fin du tour.
5. **Présenter (US3)** — Carte du genesis : résumé de la fondation, lisible dans le lecteur ; carte d'une spec :
   intention, nombre de décisions, US avec priorité, documents de brainstorm ouvrables.
6. **Pont (US4)** — Carte d'une tâche citant un fichier couvert → « Voir dans la structure » bascule en Progression et
   ouvre la carte de l'élément ; un chemin inexistant est grisé.
7. **Fichiers hostiles (SC-006)** — Tests d'intégration : HTML et instructions affichés comme texte ; `..`, lien
   symbolique sortant, fichier de 2 Mo, binaire : ignorés ou refusés, vue non bloquée.
8. **Performance (SC-002)** — Dépôt du Brainstormer : vue affichée en moins de 2 s ; relecture après un tour sans
   à-coup.
