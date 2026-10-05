# Quickstart — valider la spec 012

Prérequis : `npm run dev` relancé (Ctrl+C puis relance : le main ne se recharge pas à chaud), pont MCP enregistré.

## Automatique
- `npm test` : nom de fichier (titres hostiles `..`, `/`, `\`, `con`, 300 caractères, collisions), dossier (projet lié,
  profil, lien symbolique sortant refusé), écriture atomique et borne 500 Ko, versions et empreintes, version
  `externe` à la lecture, conflit d'édition, Historique (création → corbeille, version précédente), outils MCP
  (arbre, refus), disposition dans `planLayout`, nœud `document` (rendu sûr, défilement, édition, a11y).
- `npm run typecheck && npm run lint && npm run build`.

## Manuel (test guidé)
1. Chat d'une étape → « Rédiger un document » : un nœud fichier apparaît à droite de l'étape, rendu Markdown.
2. Le fichier existe dans `docs/brainstormer/` du projet lié (ou `documents` du profil) ; l'ouvrir dans Obsidian.
3. Le modifier dans Obsidian → le nœud se met à jour.
4. « Modifier » dans le nœud, changer une ligne, « Terminé » → fichier à jour ; Historique → Annuler → ancienne version.
5. Redimensionner le nœud, faire défiler dedans (la carte ne zoome pas), fermer et rouvrir : même taille.
6. Annuler la création dans l'Historique : le nœud disparaît, le fichier est dans `documents/.corbeille/`.
