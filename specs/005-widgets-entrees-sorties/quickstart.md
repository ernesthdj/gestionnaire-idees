# Test manuel guidé — 005 Widgets branchés

Lancer `npm run dev`. Claude doit être configuré (Réglages → IA). Cocher au fur et à mesure ; noter tout écart.

## Lot 1 — Entrées

Préparer : une idée déjà travaillée (quelques réponses, idéalement éclose pour avoir une prochaine étape) et un
widget vide (clic droit dans le vide → Widget IA).

### Brancher une idée

- [ ] Survoler l'idée : un point d'accroche apparaît à droite de l'hexagone. Le tirer jusqu'au widget (rond bleu sur
      son bord gauche) → un trait bleu relie l'idée au widget et la **revue** s'ouvre.
- [ ] La revue dit « Lire l'idée « … » », liste les parties transmises (toutes cochées) et, tant que le widget n'a
      pas de code, explique que l'autorisation sera demandée pour la version que Claude écrira. « Plus tard ».
- [ ] Dans le widget, demander : « Affiche le titre de l'idée branchée, puis la liste de ses questions et réponses
      dans un tableau. S'il n'y a pas d'idée branchée, dis-le. »
- [ ] Le widget généré affiche l'invitation à brancher / rien : il n'a encore **rien reçu**. Un bandeau « À revoir »
      est affiché, et le bouton ⇢ 1 de sa barre de titre est en rouge.
- [ ] « Revoir » → la revue montre le code (onglets HTML / CSS / TypeScript, en texte) → « Autoriser cette version ».
- [ ] Le widget affiche maintenant le titre de l'idée et ses questions / réponses. Le bandeau a disparu.

### Régler ce qui est transmis

- [ ] ⇢ 1 → revue → décocher « Questions et réponses » : le bandeau « À revoir » revient (l'autorisation portait sur
      l'ancienne liste). Autoriser de nouveau → le tableau est vide, le titre reste.
- [ ] Recocher, autoriser : les réponses reviennent.

### Nouvelle version

- [ ] Demander une évolution au widget (« ajoute le texte d'origine de l'idée en haut ») → nouvelle version → le
      bandeau « À revoir » revient, rien n'est transmis avant l'autorisation.
- [ ] Revenir à la version 1 par le sélecteur : elle fonctionne sans nouvelle revue (déjà autorisée).

### Données à jour

- [ ] Répondre à une nouvelle question de l'idée, puis ↻ sur le widget : la réponse apparaît.

### Prochaine étape

- [ ] Tirer le point d'accroche de l'étiquette « Prochaine étape » vers le widget → second trait, revue (« Lire la
      prochaine étape de « … » »), autoriser. Demander au widget d'afficher aussi les étapes reçues.

### Débrancher

- [ ] Revue → « Débrancher » une source → le trait disparaît, notification « Annuler » ; l'annulation la rebranche.
- [ ] Supprimer l'idée branchée : le trait disparaît, le widget reçoit une liste vide (↻).

### Isolation (SC-002, partie entrées)

Demander au widget : « Ajoute un panneau de diagnostic : essaie de lire une autre idée en appelant
parent.postMessage({ type: 'gi:inputs' }, '*'), parent.postMessage({ type: 'gi:steal' }, '*'), window.api, et
affiche ce que tu obtiens. »

- [ ] Aucune donnée en plus de ce qui est branché ; `window.api` absent ; l'app reste utilisable.
- [ ] Un second widget, non branché, ne reçoit rien (`gi.inputs` vide).
