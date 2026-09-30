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

## Lot 2 — Sorties

Préparer : un widget vide (clic droit dans le vide → Widget IA). Aucune idée n'a besoin d'être branchée.

### Premier résultat

- [ ] Demander au widget : « Fais un petit budget : je saisis des lignes (libellé, montant), tu affiches le total.
      Publie le résultat avec gi.output : le total et la liste des lignes. »
- [ ] Saisir une première ligne → un **cadre résultat** apparaît à droite du widget, relié à lui par un trait bleu,
      titré « Résultat · (nom du widget) ».
- [ ] Le cadre montre le total et, en dessous, les lignes dans un **tableau** (une colonne par champ, montants
      alignés à droite).
- [ ] Ajouter, modifier, supprimer des lignes dans le widget : le cadre se met à jour tout seul ; il n'y a
      toujours qu'un seul cadre.

### Un bloc comme les autres

- [ ] Déplacer le cadre résultat par sa barre de titre, le redimensionner par ses bords : place et taille sont
      gardées après avoir quitté puis rouvert l'écran Idées.
- [ ] Fermer l'app, la relancer : le cadre résultat est toujours là, relié à son widget. (Un widget garde son état
      en mémoire seulement : s'il republie au démarrage, le cadre montre ce nouveau résultat, sinon le dernier.)
- [ ] Changer de thème (clair / sombre) : le cadre suit.

### Suppression

- [ ] × sur le cadre résultat → il disparaît, notification « Annuler » ; l'annulation le ramène avec son contenu.
- [ ] Le supprimer de nouveau, puis modifier une ligne dans le widget : un cadre résultat est recréé.
- [ ] Supprimer le **widget** : son cadre résultat disparaît avec lui ; « Annuler » ramène les deux.

### Autres formes

- [ ] Widget « Pile ou face : publie seulement le dernier tirage (un texte) » → le cadre affiche la valeur en grand.
- [ ] Widget « Liste de courses : publie la liste des articles (des textes) » → le cadre affiche une liste numérotée.

### Résultat refusé

- [ ] Demander : « Ajoute un bouton de test qui publie un résultat de 300 000 caractères. » Cliquer → un bandeau
      « Résultat refusé : … » s'affiche en bas du widget ; le cadre résultat garde le résultat précédent.

### Isolation (SC-002, partie sorties)

- [ ] Demander : « Ajoute une ligne dont le libellé est <img src=x onerror=alert(1)><b>gras</b>. » Dans le cadre
      résultat, le libellé s'affiche tel quel, en texte : ni image, ni gras, ni boîte de dialogue.
- [ ] Un widget qui publie en boucle (« publie le résultat 100 fois par seconde ») ne ralentit pas la carte ; le
      cadre se met à jour environ deux fois par seconde.
