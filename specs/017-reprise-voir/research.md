# Research — 017 Reprise — Voir

Sources : `docs/brainstorm/L3-reprise-{import, analyse, explorateur}.md` (conception validée), vérifications du
2026-10-06 sur le registre npm et le code existant.

## R1 — Analyse syntaxique : `@vscode/tree-sitter-wasm`
- **Décision** : une seule dépendance, `@vscode/tree-sitter-wasm` 0.3.1 (MIT, Microsoft, dépôt
  `microsoft/vscode-tree-sitter-wasm`) : moteur `web-tree-sitter` (`wasm/tree-sitter.js` + `.wasm`) **et** grammaires
  précompilées compatibles entre elles — `tree-sitter-typescript`, `-tsx`, `-javascript`, `-c-sharp`, `-php`
  (~9 Mo de WASM utiles sur 22 Mo). Aucune dépendance d'exécution, aucun script d'installation.
- **Pourquoi** : les paquets de grammaires séparés (`tree-sitter-c-sharp`, `-php`, `-typescript`, MIT) lancent
  `node-gyp-build` à l'installation (code natif, recompilé par version d'Electron, comme `better-sqlite3`) ; leurs
  `.wasm` et `web-tree-sitter` 0.27 ne sont pas garantis de même version d'ABI. Le paquet de VS Code est construit
  ensemble et maintenu pour un usage en production.
- **Écartés** : `tree-sitter` natif (recompilation Electron) ; compilateur TypeScript + Roslyn + parseur PHP (trois
  mécaniques, .NET requis) ; `tree-sitter-wasms` (Unlicense, mainteneur unique, moteur non fourni).
- **Empaquetage** : seuls les 6 fichiers utiles sont copiés à côté du processus d'analyse (`out/main/grammars/`) ; ils
  sont chargés par chemin absolu calculé par le main, jamais par un chemin venu de l'interface.

## R2 — Où tourne l'analyse : `utilityProcess`
- **Décision** : un **processus utilitaire Electron** (`utilityProcess.fork`) lancé par le main, troisième point
  d'entrée du build (`analysis-worker`) ; messages typés validés par Zod dans les deux sens ; un fichier à la fois,
  délai par fichier (2 s), taille ≤ 1 Mo ; le processus ne reçoit que des chemins contrôlés sous la racine du projet et
  refuse les autres.
- **Pourquoi** : un plantage ou une boucle du WASM n'emporte ni le main ni l'interface ; le main reste fluide (SC-004).
- **Écartés** : fil principal (gèle l'app) ; `worker_threads` (même processus que le main).
- **Constitution I** : ce n'est pas un programme externe — c'est le code de l'app (même binaire Electron).

## R3 — Extraction et résolution par langage
- **Requêtes tree-sitter** (`.scm` dans le code, figées) par langage : définitions (classes, interfaces, fonctions,
  méthodes), imports (`import`, `require`, `using`, `use`), appels, points d'entrée.
- **TypeScript / JavaScript** : imports relatifs (extensions et `index` essayés), `paths` / `baseUrl` du
  `tsconfig.json`, `exports` / `main` d'un `package.json` de l'espace de travail ; un appel est sûr s'il vise un
  symbole importé ou local.
- **C#** : `namespace` + `using` + noms de types du projet ; `AddScoped / AddTransient / AddSingleton<IX, X>` relie
  l'interface à son implémentation ; un appel sur une variable typée par une interface vise ses implémentations
  (une seule = sûr ; plusieurs = ambigu).
- **PHP / Laravel** : PSR-4 du `composer.json` ; `use` ; routes `routes/*.php`
  (`Route::get('/x', [XController::class, 'm'])`) → méthode de contrôleur ; modèles Eloquent (`extends Model`).
- **Modules** : paquets npm (`package.json` hors racine, `workspaces`), projets `.csproj`, sinon dossiers de premier
  niveau de `src/`, `app/` ou la racine.
- **Catégories** (règles, ordre) : plomberie (logs, JSON, utilitaires génériques, getters / setters), orchestration
  (contrôleurs, routes, middlewares, `Program.cs`, `main`, handlers), infrastructure (ORM / accès BDD, HTTP, fichiers,
  cache, files d'attente), sinon métier. Corrigeables par mentalyas (prime), reclassables par l'IA (justifiée).

## R4 — Import, clone, secrets
- **Clone** : `git` résolu par chemin absolu (`resolveGit`, spec 016), sans shell,
  `-c protocol.allow=never -c protocol.https.allow=always -c protocol.ssh.allow=always -c core.hooksPath=NUL clone
  --no-recurse-submodules --progress -- <url> <cible>`, `GIT_TERMINAL_PROMPT=0`, délai 30 min, progression lue sur
  stderr ; annulation = arrêt + suppression de la cible créée par l'app (absente avant, vérifié).
- **URL** : `https://hôte/chemin` ou `git@hôte:chemin`, sans espace ni caractère de contrôle ; identifiants
  (`user:mdp@`) retirés avant stockage, affichage et journal.
- **Fichiers sensibles** : la liste de `checkProjectPath` (spec 013 : `.env*`, clés, certificats, identifiants) +
  `appsettings.*.json`, `web.config`, `*.publishsettings`, `secrets.json` ; jamais lus.
- **Exclusions** : `.git/`, `node_modules/`, `vendor/`, `bin/`, `obj/`, `dist/`, `build/`, `.next/`, `out/`,
  `coverage/` + `.gitignore` de la racine (motifs simples : dossiers, extensions, chemins ; négations ignorées → plus
  d'exclusion, jamais moins de sécurité).

## R5 — Confidentialité : une garde unique
- **Décision** : `ConfidentialityGuard.claudeAllowed(neuronId)` remonte au genesis et lit son niveau ; appelée avant
  **chaque** envoi possible à Claude : `ConversationService.send` (code `LOCAL_ONLY`), tâches IA de la reprise, futurs
  outils MCP du graphe. Test d'intégration : sur tout le parcours d'un projet local, aucune tâche ni conversation
  Claude n'est lancée (SC-002).
- **Niveau** : `claude` | `local` ; changement local → claude confirmé (`CONFIRM_REQUIRED`), claude → local immédiat.

## R6 — Tâches d'IA de la reprise
- **Décision** : deux tâches de l'`AIGateway` (constitution III) : `reprise_resolution` (lots de 50 appels ambigus →
  `{ edgeId, targetId | null, reason }`) et `reprise_guide` (graphe résumé + README / docs / configs bornés → guide en 9
  sections + résumé-analogie par module). Routage : Claude (`claude -p`, sans outils) si le projet est « Claude
  autorisé », **sinon Ollama** (amendement 4.1.0, principe IV) ; sorties validées par Zod (identifiants parmi ceux
  envoyés ; sources du guide vérifiées sur le disque).
- **Analogies de l'explorateur** : au niveau **module**, produites avec le guide ; aux niveaux fichier et fonction,
  le panneau montre ce que dit l'analyse (catégorie, liens) — une explication à la demande est hors périmètre (v2,
  « questions au projet »).

## R7 — Explorateur
- **Décision** : React Flow (déjà dans l'app) ; agrégation dans le main (SQL `GROUP BY` sur l'ancêtre visible) ;
  ≤ 150 nœuds et 400 liens envoyés ; mise en page en colonnes par catégorie (orchestration → métier → infrastructure),
  ordre dans la colonne par barycentre des voisins ; positions mémorisées. Plan B mesuré : `sigma.js` (WebGL) si la
  fluidité de SC-005 n'est pas atteinte.
- **Vue** : nouvelle vue plein écran `explorer` (navigation par état existante, `uiStore`), ouverte depuis le genesis
  du projet repris ; carte 62 % / panneau 38 % ; vue liste équivalente.

## R8 — Constitution 4.1.0 (D8, validée)
- I : « l'app peut lancer git, résolu par chemin absolu dans le PATH, sans shell, arguments fixes construits par le
  main » (régularise la spec 016) ; II inchangé ; IV : « pour un projet repris marqué *Local uniquement*, le modèle
  local remplace Claude ; rien du projet n'est envoyé à Claude » ; Contraintes techniques : `@vscode/tree-sitter-wasm`.
