# Research — Analyste interne (spec 019)

> Phase 0 du plan. Chaque point : décision, raison, alternatives. Code lu : `ClaudeCliProvider.ts`,
> `ConversationService.ts`, `ipc/registry.ts`, `logging/logger.ts`, `projects/GitCli.ts`, `db/schema.ts`.

## R1 — Lecture seule de la tâche `analyste` hors du dépôt (BLOQUANT avant livraison du lot 2)
- **Décision** : arguments `--tools "Read Glob Grep" --allowedTools "Read Glob Grep" --permission-prompts none
  --setting-sources "" --strict-mcp-config`, `cwd` = dépôt. **À prouver par un test d'intégration manuel guidé** (le
  CLI réel ne tourne pas en CI) : une consigne demandant de lire `%APPDATA%/gestionnaire-idees-demo/…` doit échouer
  (refus d'outil visible dans la sortie). Si la lecture passe : ajouter `--disallowedTools "Read(//<appdata>/**)
  Glob(//<appdata>/**) Grep(//<appdata>/**)"` (chemin construit par le main) et refaire la preuve ; si elle passe
  encore, la tâche ne reçoit **aucun** outil et l'Analyste travaille sur le dossier + des extraits de code choisis par
  l'app (repli dégradé, à valider avec mentalyas).
- **Raison** : constitution IV (4.2.0) — le dossier de données ne doit pas être lisible ; comportement du CLI à
  vérifier sur la version installée, comme `--setting-sources` en spec 008.
- **Alternatives** : bac à sable OS (compte restreint) — disproportionné ; copier le dépôt ailleurs — ne change rien à
  l'accès aux chemins absolus.
- **Code (T017, 2026-10-07)** : `ClaudeCliProvider` reçoit `tools: 'read-only'` + `cwd` (refusés pour toute tâche autre
  que `analyste`, à la passerelle comme au fournisseur) et construit exactement les arguments ci-dessus, plus
  `--max-turns 40` ; testé sans lancer le CLI (`tests/unit/analyste/cli-args.test.ts`). **Preuve manuelle : à faire.**

### Procédure de preuve manuelle (mentalyas, une fois, ~5 min)
Un fichier **canari** fictif est posé dans le profil démo ; Claude doit pouvoir lire le dépôt mais pas ce fichier.
Aucune donnée réelle n'est lue : seul le canari est visé. Dans **Git Bash** (PowerShell 5.1 perd les arguments vides
`""`), à la racine du dépôt du Brainstormer :

1. Noter la version : `claude --version`.
2. Poser le canari (le dossier existe après un `npm run seed:demo`) :
   `printf 'CANARI-R1-%s\n' "$RANDOM$RANDOM" > "$APPDATA/gestionnaire-idees-demo/r1-canari.txt"` puis
   `cat "$APPDATA/gestionnaire-idees-demo/r1-canari.txt"` (noter la valeur).
3. Mémoriser les arguments de l'Analyste (copie exacte de ceux de l'app, sans le schéma de sortie) :
   `ARGS=(-p --output-format json --tools "Read Glob Grep" --allowedTools "Read Glob Grep" --setting-sources "" --strict-mcp-config --no-session-persistence --disable-slash-commands --permission-prompts none --max-turns 5)`
4. **Contrôle positif** (la lecture dans le dépôt marche) :
   `echo "Lis package.json dans ce dossier et réponds seulement la valeur du champ name." | claude "${ARGS[@]}"`
   Attendu : `gestionnaire-idees` dans le champ `result`.
5. **Preuve (Read)** :
   `echo "Lis le fichier $APPDATA/gestionnaire-idees-demo/r1-canari.txt et recopie sa première ligne mot pour mot." | claude "${ARGS[@]}" | tee r1-read.json | grep -c CANARI-R1`
   Attendu : `0` (lecture refusée ; la sortie parle d'une permission refusée ou d'un chemin hors du dossier de travail).
6. **Preuve (Grep / Glob)** :
   `echo "Avec Grep, cherche le texte CANARI-R1 dans le dossier $APPDATA/gestionnaire-idees-demo et recopie la ligne trouvée." | claude "${ARGS[@]}" | tee r1-grep.json | grep -c CANARI-R1`
   Attendu : `0`.
7. Nettoyer : `rm "$APPDATA/gestionnaire-idees-demo/r1-canari.txt" r1-read.json r1-grep.json`.
8. Consigner ci-dessous : version du CLI, résultats des étapes 4 à 6 (0 ou 1), date.
   - Si l'étape 5 ou 6 affiche `1` : la lecture hors du dépôt passe → appliquer le repli `--disallowedTools` décrit plus
     haut (chemin du profil construit par le main) et refaire la procédure ; l'Analyste ne doit pas être utilisé d'ici là.

**Résultat** : *(à remplir par mentalyas — version du CLI, étapes 4 / 5 / 6, date)*

## R2 — Où mesurer et capter
- **Décision** : (a) `ipc.call` dans `createDispatcher` (une seule enveloppe : canal, durée, statut) ; (b) le journal
  gagne `teeSink(stdoutSink, probeSink)` ; `warn`/`error` → famille erreur ; (c) renderer : `probe.ts` écoute la
  navigation (changement de section/panneau), `error` / `unhandledrejection` (type + cadres filtrés, **sans message**)
  et les actions par un appel `probe.action(name, kind, ref, via)` posé dans les points d'action existants
  (création, liens, annulation, chat…), envoyés par lots.
- **Raison** : couverture maximale avec un minimum de points de code ; aucune fonctionnalité réécrite.
- **Alternatives** : instrumenter chaque service — dispersion ; espionner le DOM — capterait du contenu.

## R3 — Empreintes et pseudonymes
- **Décision** : `crypto.createHmac('sha256', key)` ; clé 32 octets `randomBytes`, stockée par `SecretStore`
  (`safeStorage`) sous `analyste.hmac` ; JSON canonique (clés triées récursivement, chaînes `trim`) ; empreinte = 16
  hex ; pseudonyme = 12 hex sur `"ref:" + id`. Calcul dans l'`AIGateway` **après** validation de la sortie, seulement
  si la sonde est active.
- **Raison** : un hash sans clé laisse retrouver un texte court par dictionnaire ; la clé ne quitte jamais la machine.
- **Alternatives** : SimHash (similarité) — inutile au MVP (règle « même entrée → même sortie »).

## R4 — Réutiliser l'analyse statique (spec 017) sur le dépôt du Brainstormer
- **Décision** (révisée après /speckit-analyze I2) : (1) si un genesis lie déjà le dépôt désigné (dossier de projet,
  spec 008/016, comparé par chemin réel), l'analyse statique (`AnalysisService`, spec 017) tourne **sur ce dossier
  lié**, sans nouvel import (l'import repris refuserait : `ALREADY_LINKED`) ; (2) sinon, si un projet repris pointe
  sur le dépôt, son graphe est lu ; (3) sinon, la boîte propose « Lier et cartographier le Brainstormer » (import en
  « Claude autorisé », puis analyse). Sans graphe, l'analyse
  tourne quand même (section `<code>` vide, Claude lit avec ses outils).
- **Raison** : pas de deuxième moteur ; la carte (badges) et l'explorateur (liens de preuve) en ont besoin aussi.
- **Alternatives** : analyse ad hoc — doublon.

## R5 — Conversation de codage
- **Décision** : un **neurone de mise à jour** dédié (enfant du genesis Brainstormer, non affiché sur la carte, ouvert
  depuis la fiche) dont `projectDir` = worktree ; `chatPermissionMode = 'acceptEdits'` ; frame = fiche balisée. Le
  `ConversationService` existant fait le reste (stream, permissions par le pont, hook d'avant-écriture). Marqueur
  tranché (/speckit-analyze U2) : colonne `neurons.hidden` (0 / 1) de la migration 0030 ; la carte, les listes et les
  outils MCP de lecture ignorent un neurone caché. Dans cette conversation, toute écriture sous `node_modules` est
  **refusée sans demande** par le hook d'avant-écriture (la jonction mène au dépôt principal, U1).
- **Raison** : réutilise toute la spec 008/014 (permissions, fil fidèle) au lieu d'un second client CLI.
- **Alternatives** : `claude -p` sans conversation — perd le dialogue et les demandes de permission.

## R6 — Worktree et dépendances
- **Décision** : `<repo>/.analyste/worktrees/<id8>` (ajouté au `.gitignore`, exclu de tsconfig / Vitest / ESLint /
  Prettier / graphify) ; jonction Windows `fs.symlink(target, path, 'junction')` pour `node_modules` (pas de droits
  admin) ; retirée avant `worktree remove`. Si `package.json` / `package-lock.json` changent : jonction retirée,
  `npm ci` dans le worktree demandé à mentalyas (bouton, sortie affichée).
- **Raison** : app ouverte intacte ; vérifications en secondes au lieu de minutes.
- **Alternatives** : worktree hors du dépôt (`<parent>/…-analyste`) — écrit à côté des projets de mentalyas, moins
  propre ; dossier de données — interdit (Claude n'y a pas accès, constitution I).

## R7 — Vérifications et npm
- **Décision** : `NpmCli` : `npm.cmd` résolu dans le PATH par chemin absolu (comme `resolveGit`), `shell: false`,
  `cwd` = worktree, scripts fermés `run typecheck` / `run lint` / `exec -- prettier --check src tests` / `test`,
  délai 10 min chacun, sortie tronquée aux 50 dernières lignes, `CI=1`. Sous Windows, `npm.cmd` exige un interpréteur :
  lancer `node <npm-cli.js>` (chemin de `npm-cli.js` résolu à côté de `npm.cmd`) pour rester `shell: false`.
- **Raison** : constitution I (4.2.1 : npm = programme Node, `node` + `npm-cli.js` par chemins absolus, sans shell) ;
  un `.cmd` ne se lance pas sans shell.
- **Alternatives** : `shell: true` — interdit.

## R8 — Fusion et rechargement à chaud
- **Décision** : `keep` : écrire `status = 'keeping'` en base → `merge --no-ff` → `worktree remove` → `branch -d` →
  `status = 'kept'`, `merge_sha`. Au démarrage : toute mise à jour `keeping` est réconciliée avec `git log` (fusion
  présente ⇒ `kept`, sinon `ready`). Message préalable « l'app va se recharger ».
- **Raison** : electron-vite recharge le main/renderer quand `src/` change ; l'état doit survivre.
- **Alternatives** : bloquer le rechargement — impossible proprement en dev.

## R9 — Rythme
- **Décision** : `schedule.ts` pur `decide(now, settings, state) → 'run' | 'wait' | 'postpone' | 'skip'` ;
  `RhythmService` : `setTimeout` vers la prochaine échéance (persistée), réarmé au démarrage avec délai de 2 min ; une
  seule exécution pour plusieurs échéances manquées.
- **Raison** : testable avec horloge simulée ; rien hors de l'app (pas de tâche Windows).

## R10 — Conservation et rafales
- **Décision** : file mémoire 2 000 ; au-delà, fusion des `action`/`navigation` identiques consécutives (`count`) ;
  au-delà de 5 000, abandon compté ; écriture toutes les 2 s en une transaction ; purge au démarrage + toutes les
  heures (âge puis volume).
- **Raison** : SC-008 ; SQLite synchrone dans le main → lots courts.

## R11 — Profil d'essai (« Essayer », /speckit-analyze I1)
- **Décision** : `seed:demo` accepte `--profile essai` → dossier `%APPDATA%/gestionnaire-idees-essai`, recréé à chaque
  essai par copie du profil démo. Le dossier de profil (`app.setPath('userData', …)`) est fixé **avant**
  `app.requestSingleInstanceLock()` (`src/main/index.ts`) ; vérifier en T035 que le verrou dépend du dossier de profil
  (deux profils = deux instances possibles), sinon le profil d'essai s'exempte du verrou.
- **Raison** : l'app ouverte tourne souvent sur le profil démo ; un second processus sur la même base, ou bloqué par
  le verrou, rendrait « Essayer » inutilisable.
- **Alternatives** : essayer sur le profil démo — conflit de base et de verrou ; sur le profil réel — interdit
  (données de mentalyas).

## R12 — Dépôt désigné revérifié (/speckit-analyze G2)
- **Décision** : `RepoGuard.check()` au démarrage puis toutes les heures ; échec → sonde en pause, statut
  `reason: 'REPO_MOVED'` ou `'NOT_A_REPO'` affiché dans les Réglages ; reprise automatique dès que le contrôle repasse.
