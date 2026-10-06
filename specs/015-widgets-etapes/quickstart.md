# Quickstart — validation de la spec 015

## Prérequis
`npm run dev` (redémarrer le main après chaque lot). Un genesis avec un plan d'au moins 2 niveaux ; une étape avec une
fiche remplie et un document annexé (spec 012) ; un widget sur la carte (ToolMenu › Widget, ou `widget_poser`).

## Scénarios
1. **Brancher une étape (US1)** — tirer un lien de l'étape « 1.2 » vers le widget → trait visible ; la revue s'ouvre
   avec « 1.2 · Titre » et 4 parties cochées ; rebrancher la même étape → refus « déjà branchée ». Tirer depuis un
   fantôme ou un livrable → rien.
2. **Contexte transmis (US2)** — autoriser ; demander à Claude (chat du widget) un widget qui affiche titre, fiche,
   chemin et documents → tout apparaît. Décocher « Chemin » → autorisation redemandée ; après autorisation, plus de
   chemin. Modifier la fiche de l'étape → le widget la reçoit à jour sans nouvelle autorisation.
3. **Idée (US3)** — brancher un genesis → parties identité, fiche, plan d'attaque, annexes. Un ancien widget branché
   sur une idée → autorisation redemandée une fois, puis données nouvelles. Ancienne « prochaine étape » → marquée
   « ancienne source ».

## Vérifications automatiques
`npm test` · `npm run typecheck` · `npm run lint` · `npm run build`.

4. **Construire depuis le nœud (US4)** — un widget vide (ToolMenu › Widget) ; brancher l'étape « Chiffrer le budget »
   (fiche avec 3 postes) → « Claude construit… », puis une version « À revoir » qui affiche les postes ; brancher une
   autre étape sur un widget déjà écrit → « Adapter au nœud » proposé, code inchangé avant le clic.
5. **Contexte préparé (US5)** — autoriser ; modifier la fiche → « Le nœud a changé — Actualiser » ; aucun échange avec
   Claude avant le clic (jauge de l'en-tête inchangée) ; cliquer → valeurs à jour.
