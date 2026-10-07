# Quickstart — Git et GitHub (spec 021)

Guide de validation. Prérequis : git pour Windows ; GitHub CLI installé et connecté (`gh auth login`) pour §2, §3 et §6
;
un compte GitHub de test conseillé (dépôts **privés**, noms fictifs). Dépôts de démonstration fictifs :
`npx tsx tests/support/gitRepos.ts <dossier> <scénario>` (scénarios `trois-auteurs`, `conflit`, `secret-ancien`,
`hook-temoin`, `licences`) ; ils n'utilisent que des auteurs et e-mails fictifs (`ana-dev@example.invalid`…).
Contrats : [contracts/interfaces.md](contracts/interfaces.md) ; données : [data-model.md](data-model.md).

## §1 Dépôt local (US1)
1. `npm run dev` → un projet lié à un dossier git (ou `scénario hook-temoin`). Attendu : badge `⎇ main · N modifiés`
   sur le genesis ; clic (ou `Ctrl+Maj+G`) → volet Dépôt, onglet Changements, **aucun fichier coché**.
2. Modifie 3 fichiers, un faux `.env` : `.env` verrouillé « fichier sensible ». Coche 2 fichiers, clic sur l'un → diff.
3. « Proposer un message » → `type(scope): …`, sans ligne de co-auteur ; corrige un mot ; **Commiter (2 fichiers)**.
   Attendu : commit des 2 seuls fichiers, le 3ᵉ reste modifié. **Chronométrer SC-001 (< 30 s).**
4. Pendant que 2 fichiers sont cochés, `git add` un autre fichier en terminal puis Commiter → refus « la sélection a
   changé », liste rafraîchie.
5. Dépôt `hook-temoin` **non** de confiance : commit → le hook ne laisse aucune trace. Marque le projet de confiance
   (réglages, spec 014) : le hook s'exécute ; un hook en échec bloque et montre sa sortie, sans bouton pour passer
   outre.
6. Onglet Branches : crée `essai/volet`, reviens sur `main` ; avec un fichier modifié qui serait écrasé → refus
   expliqué.
7. Onglet Historique : « Annuler ce commit » sur le dernier → un commit `Revert "…"` apparaît.
8. Genesis lié à un dossier sans git → « Initialiser git » (spec 016).
9. Automatique : `npm test -- git/args git/parse git/sensitive git/risky-config git/git-service git/message-task`.

## §2 Publier, tirer, pousser (US2)
1. Projet local sans remote → **Publier sur GitHub** : compte affiché, **Privé** coché ; « Public » demande une seconde
   confirmation. Publier → « En ligne : <compte>/<nom> » ; le dépôt est privé sur GitHub.
2. Ferme `gh` (renomme-le dans le PATH, ou `gh auth logout` sur le compte de test) → message avec `gh auth login`,
   aucun champ d'identifiant.
3. Fais un commit sur GitHub (interface web) → ⟳ : « ↓1 à tirer (vérifié à HH:MM) » ; **Tirer** → la branche avance.
4. Commit des deux côtés → **Fusionner** (jamais de rebase) ; avec un conflit (avant US4) → fusion annulée proprement,
   explication, dépôt intact (`git status` propre).
5. **Pousser (n)** → récapitulatif dépôt, branche, commits → la branche est poussée.
6. `scénario secret-ancien` (faux `.env` dans un ancien commit) relié à un dépôt de test → push **bloqué** sans
   contournement, commit et fichier cités ; un faux préfixe de jeton dans un fichier de test → « ce n'est pas un
   secret » ligne par ligne.
7. Dépôt d'un autre compte où tu n'as que le droit d'écriture : push sur sa branche par défaut → refus + « Créer une
   branche ». Dépôt d'organisation où tu as le droit `admin` ou `maintain` : push sur la branche principale permis,
   après le récapitulatif (D11).
8. Automatique : `npm test -- git/push-rules git/sensitive-scan git/sync git/push git/publish git/gh-args` (SC-002,
   SC-003).

## §3 Cloner et suivre (US3)
1. **Reprendre un projet** → **Depuis un lien GitHub** → colle l'adresse d'un petit dépôt public → « ✓ Adresse valide »
   → Choisir le dossier (sélecteur natif, pré-positionné) → **Cloner**. Attendu : progression par phase, puis aperçu et
   confidentialité (spec 017), genesis créé, reprise lancée ; projet **non** de confiance ; absent du registre du hub.
2. Adresses piégées (`ext::sh -c x`, `file:///C:/`, `-u x`, `https://exemple.invalid/a b`) → refus immédiat, aucun
   programme lancé.
3. Adresse avec identifiant fictif (`https://utilisateur:faux@github.com/…`) → affichée sans identifiant, nulle part en
   base ni dans les journaux.
4. Annule un clone en cours → seul le dossier créé disparaît ; ferme l'app pendant un clone → au redémarrage, dossier
   supprimé.
5. Gros dépôt (> 500 Mo) → question « Continuer / Annuler » (le téléchargement continue pendant la question).
6. Quelques jours plus tard (ou après un commit sur le dépôt de test) : badge « ✦ N nouveautés » ; Historique →
   « Depuis ta dernière visite » ; **Marquer comme vu** → badge retiré.
7. Automatique : `npm test -- reprise/git-url reprise/clone git/updates git/file-to-node` (SC-005).

## §4 Conflits (US4)
1. `scénario conflit` relié à un dépôt nu local → **Tirer** → **Fusionner** → la vue de résolution remplace la carte.
2. Fichier en conflit : trois colonnes, proposition et explication de Claude ; choisis bloc par bloc ; « Terminer la
   fusion » grisé tant qu'un fichier reste. **Chronométrer SC-007 (< 3 min).**
3. Ferme l'app au milieu → elle reprend où tu en étais.
4. Recommence et **Abandonner** → `git status` et `git log` identiques à l'état d'avant le pull.
5. Projet « Local uniquement » → aucune proposition, résolution à la main.
6. Automatique : `npm test -- git/split-hunks git/conflict-service git/conflict-task`.

## §5 Historique (US5)
1. `scénario trois-auteurs` → onglet Historique : 3 lignes (couleur + initiales), légende ; flèches = commit précédent /
   suivant.
2. **Rejouer sur la carte** → explorateur en mode Rediffusion ; déplace le curseur : couleur + initiales par nœud.
   Sur un projet cloné (clone partiel) : légende « par commits » ; **Tout télécharger** → la légende passe « par
   lignes » (D12).
   **Chronométrer SC-008 (< 5 s pour nommer l'auteur principal d'un nœud).**
3. Fusionne deux identités du même auteur fictif → une seule ligne ; « Annuler » rétablit.
4. « Raconter la période » → récit avec les vrais noms affichés ; le test automatique vérifie que Claude n'a reçu que
   des alias.
5. Automatique : `npm test -- git/authors git/replay git/history-service git/story-task`.

## §6 PR, issues, fork (US6)
1. Dépôt de test GitHub → onglet PR : liste, une PR → description en texte, diff ; « Relire avec Claude » →
   commentaires dans l'app ; « Publier ce commentaire » → récapitulatif → clic.
2. **Nouvelle PR** depuis une branche poussée : titre et description proposés, modifiables → **Ouvrir la PR**.
3. Onglet Issues : crée une issue depuis un nœud ; relie `#n` à un nœud → pastille ; « Annuler ».
4. Dépôt d'autrui → **Forker** → `origin` = ton fork, `upstream` = l'original (`git remote -v`).
5. Une description contenant un lien hors GitHub : non cliquable, copiable ; aucune image distante chargée.
6. Automatique : `npm test -- git/github-service git/github-markdown git/pr-tasks` (aucune approbation, fusion ni
   fermeture constructible).

## §7 Extraire (US7)
1. `scénario licences` → explorateur → ⋯ « Extraire vers ma bibliothèque » sur un fichier MIT : licence affichée,
   destination `snippets/<dossier>/`, aperçu avec en-tête → **Extraire** → fichier écrit avec l'en-tête.
2. Même geste sur le dépôt sans licence → seule « Note d'étude » est proposée (`techno/`).
3. Automatique : `npm test -- git/license git/attribution git/extract-service` (destination hors des deux dossiers
   refusée).
