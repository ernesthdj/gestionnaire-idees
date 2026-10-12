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

## R9 — Mesures SC-004 / SC-005 (T036, 2026-10-12)
- **Banc** : `tests/e2e/reprise-bench.e2e.ts`, dans l'app réelle (Electron + Playwright, analyse dans le processus
  séparé), sur le poste de mentalyas. Projet fictif généré (`tests/support/benchProject.ts`, déterministe, jamais
  versionné) : 5 002 fichiers de code (3 000 TS en 10 paquets npm, 1 251 C# en 5 projets .NET, 751 PHP PSR-4 et
  routes Laravel) qui s'importent et s'appellent ; 31 502 symboles, 37 901 liens. Résultats bruts :
  `test-results/e2e/reprise-bench.json`.

| Critère | Mesure | Seuil |
|---|---|---|
| SC-004 analyse complète | **42,9 s** | < 2 min |
| SC-004 réanalyse après la modification d'un fichier | **3,6 s** | < 10 s |
| SC-004 app utilisable pendant l'analyse | aller-retour avec le main : 6 ms (95ᵉ centile), 1,6 s au pire une fois en fin d'analyse ; images de l'interface : 7 ms (95ᵉ centile) | — |
| SC-005 passage d'un niveau à l'autre | **85 ms** (modules → dossiers), **64 ms** (retour) ; choix d'un module : 37 ms | < 1 s |
| SC-005 carte fluide | glisser la carte : 7,1 ms par image (95ᵉ centile) | — |

- **Plan B WebGL (`sigma.js`)** : **non nécessaire**, React Flow tient largement (≤ 150 nœuds par niveau).
- **Défauts trouvés et corrigés par la mesure** :
  1. **Cibles possibles sans borne** : un lien incertain gardait *toutes* les cibles de même nom (jusqu'à 3 000 pour
     `Run`, `handle`) : ~90 Ko par lien, **≈ 1,2 Go** écrits dans la base chiffrée à chaque analyse (28 s sur 37) et
     des listes géantes envoyées à l'IA par « Préciser les liens ». Borne `MAX_CANDIDATES = 20`
     (`domain/reprise/resolve.ts`) : au-delà, le lien reste incertain avec le nombre de cibles, sans liste à
     trancher. Analyse 37,5 s → 8,6 s (hors Electron), réanalyse 48,6 s → 6,5 s.
  2. **Réanalyse qui réécrivait tout** : `CodeGraphRepository` promettait de ne réécrire que les fichiers modifiés,
     mais recevait tous les fichiers et remplaçait tous les liens. Désormais `changedFiles` et `edgeChanges`
     comparent à la base (empreinte de chaque ligne, ordre des colonnes ignoré) et seules les différences sont
     écrites ; comparer à la base, pas à une copie en mémoire, garde le comportement (un lien précisé par l'IA
     redevient incertain à la réanalyse, comme avant).
  3. **Main bloqué en fin d'analyse** (3,6 s) : assemblage et écriture du graphe d'une traite. Écriture par tranches
     (250 fichiers, 2 000 liens, chacune en transaction) et `setImmediate` entre les phases : 1,6 s au pire.
  4. Deux boucles quadratiques de `AnalysisService.write` (points d'entrée par fichier, nettoyage du cache)
     remplacées par des tables d'index.
- **Reste observé, non bloquant** : un double-clic envoyé dans la première seconde après l'ouverture de
  l'explorateur sur ce projet est perdu (le niveau se dessine encore) ; un clic ensuite répond en 37 ms. Les 1,6 s
  du main en fin d'analyse viennent de la résolution des liens (calcul pur, en mémoire) : la déplacer dans le
  processus d'analyse les supprimerait, si l'usage le demande.

## R10 — SC-002 / SC-003 sur tout le parcours (T035, 2026-10-12)
- **Test** : `tests/integration/reprise/local-only-end-to-end.test.ts`, services composés comme dans `bootstrap.ts`,
  projet piégé (`hostile-app` + `.env`, `node_modules/.bin`, hook git, `core.fsmonitor`, filtre `clean`) repris
  « Local uniquement » ; deux réglages de l'IA (modèle local en marche ; modèle local arrêté avec repli vers Claude
  autorisé). Sorties vers Claude enregistrées : moteur Claude de la passerelle, lancement de `claude -p`, réponses du
  pont MCP ; un marqueur unique semé dans tout le projet ne doit jamais en sortir. **Chaque outil public du pont** est
  appelé avec les identifiants du projet à toutes les places possibles, par une session externe, par la conversation
  d'un autre projet et par les nœuds du projet ; un outil ajouté sans cas fait échouer le test.
- **Fuites trouvées et corrigées** :
  1. **Widget branché sur le projet** (spec 005, 026) : « Wireframe », « Parcours », « Adapter » ou une demande
     envoyaient le contexte complet du nœud à Claude. `WidgetService` reçoit `localOnly` (un nœud branché appartient
     à un projet local → modèle local imposé, jamais de repli).
  2. **Garde du pont limitée à `id`, `projet`, `document`** : `element_avancer` (champ `element`) modifiait un élément
     du projet et renvoyait son titre ; `dessiner` (`ancre`, `parent`, liens) et `widget_poser` (`source`)
     écrivaient dans le projet. La garde examine désormais **tout identifiant** des arguments (clés `wf:…`
     comprises).
  3. **Catégorisation du genesis d'un projet repris** : lancée avant que la confidentialité soit enregistrée, elle
     pouvait envoyer le nom du dossier à Claude si le repli était autorisé. Le genesis d'une reprise n'est plus
     catégorisé, et `NeuronService` impose le modèle local pour un genesis local.
- **Git** : sur le dépôt piégé non de confiance, la lecture de l'état ne déclenche pas `core.fsmonitor` (témoin
  absent, alors qu'un `git status` sans le préfixe sûr de l'app le déclenche) ; un filtre `clean` bloque toute
  commande (`RISKY_CONFIG`).
