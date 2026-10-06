# Research — 013 Actions finales

## R1 — Le confinement est appliqué par l'app : écriture par outils MCP, pas par les outils Write/Edit du CLI
- **Décision** : Claude **n'a pas** les outils intégrés `Write`, `Edit`, `Bash` (liste `--tools` inchangée :
  `Read,Glob,Grep,WebSearch`). Il écrit par deux outils du pont MCP, implémentés dans le main :
  `fichier_ecrire { chemin, contenu }` (créer ou remplacer) et `fichier_modifier { chemin, ancien, nouveau }`
  (remplacement exact et unique, comme `Edit`). Le main résout et contrôle chaque chemin (R2), garde le contenu d'avant,
  écrit de façon atomique et trace l'appel.
- **Pourquoi** : FR-005/FR-006 et SC-002 exigent un confinement que l'app **vérifie elle-même** ; les règles de
  permission du CLI (`Edit(./**)`) dépendent de son interprétation des chemins et des liens, et ne donnent ni le contenu
  d'avant (différence, retour arrière) ni la trace. Sans `Bash`, aucune commande n'est possible, même si un fichier du
  projet contient une consigne piégée (injection de prompt).
- **Écartées** : outils `Write`/`Edit` + `--allowedTools "Edit(./**)"` + `--disallowedTools` pour `.env` (confinement
  délégué au CLI, pas de trace exploitable : les hooks sont coupés par `--setting-sources ""`) ; copie du projet dans un
  bac à sable puis fusion (lourd, conflits, et ce n'est pas ce qu'a choisi mentalyas en D2).

## R2 — Contrôle des chemins (pur + système de fichiers)
- **Entrée** : chemin **relatif** au dossier du projet lié, séparateurs `/` ou `\`, 260 caractères au plus.
- **Refus purs** (domaine, testés avec des chemins hostiles) : absolu (`C:`, `\\`, `/`), segment `..` ou `.` vide,
  caractères interdits Windows, noms réservés (`con`, `nul`, `com1`…), flux alternatifs (`:`), segment finissant par
  `.` ou espace ; **liste noire** insensible à la casse : `.git/` (tout segment), `node_modules/`, `vendor/`, `.env`,
  `.env.*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `id_rsa*`, `.npmrc`, `.claude/` (réglages d'agents du projet), et les
  fichiers binaires connus (`.exe`, `.dll`, `.zip`…).
- **Refus disque** (infrastructure) : le parent existant le plus proche est résolu par `realpath` ; il MUST rester sous
  le `realpath` du projet (`path.relative` sans `..`) — ainsi un lien symbolique ou une jonction qui sort du projet est
  refusé ; si la cible existe et est un lien, refus. Dossiers intermédiaires créés au besoin (`mkdir` récursif, après
  contrôle).
- **Écriture** : temporaire dans le même dossier puis `rename` ; contenu texte UTF-8 ≤ 1 Mo ; refus si le fichier
  existant n'est pas du texte (octet nul) ou dépasse 1 Mo.
- **Lecture** : `Read`/`Glob`/`Grep` du CLI restent bornés par leur dossier de travail (cwd = dossier du projet, spec
  008) ; inchangé.

## R3 — Écriture autorisée seulement pendant une exécution
- **Décision** : les outils `fichier_*` répondent `NON_MODIFIABLE` (« aucune exécution en cours ») si la conversation
  appelante (identifiée par `GI_NEURON_ID`, spec 007) n'a pas d'exécution `en_cours`. Le droit est donc un **état côté
  app**, pas un argument du CLI : la conversation ordinaire reste en lecture seule (hypothèse de la spec) et le
  processus n'a pas besoin d'être relancé.
- **Bornes par passe** : 40 fichiers distincts, 1 Mo par fichier, 15 minutes ; au-delà, refus de l'outil (fichiers) ou
  arrêt du tour (durée) — l'exécution se termine « arrêtée » et le livrable montre ce qui a été fait.
- **Une exécution à la fois par genesis** (FR-012) : `final:execute` refuse `BUSY` si une autre action du même genesis
  est en cours.

## R4 — Une exécution = un tour de la conversation de l'action
- **Décision** : « Exécuter » envoie dans la conversation de l'action (session reprise) un message fixe
  `EXECUTE_MESSAGE` précédé du **dossier d'exécution** (R5). La fin du tour (`chat:turnEnd`) termine l'exécution :
  `terminee` (tour normal), `arretee` (« Arrêter » ou borne), `interrompue` (processus perdu, app fermée — détecté au
  démarrage : toute exécution sans fin devient `interrompue`). « Demander une correction » = nouvelle exécution avec le
  message de mentalyas.
- **Pourquoi** : réutilise tout le moteur de conversation (spec 008) — flux visible dans le chat, reprise, arrêt,
  usage ; le compte rendu de Claude est son dernier message (US2 sc. 6).
- **Écartée** : processus `claude -p` séparé, sans session (perd le dialogue qui a mûri l'action).

## R5 — Dossier d'exécution (contexte, FR-004)
- Bloc délimité (donnée, jamais instruction — principe III) joint au message : chemin genesis → action (titres, rangs,
  fiches figées, déjà fourni par `contextBlock` pour une étape), **livrable annoncé** et **raison**, étapes dont l'action
  dépend (titre, statut, fichiers de leur livrable), documents annexés sur le chemin (titre + `document_lire` pour les
  lire), fichiers du livrable courant (en correction), message de correction, bornes. Tronqué comme `contextBlock`
  (fiches du milieu d'abord).
- Sans dossier lié (FR-011) : le dossier le dit, `fichier_*` refusent, le cadre demande `document_ecrire` sur l'action.

## R6 — Livrable cumulé et différence
- **Décision** : table `deliverable_files` (une ligne par fichier et par action) : chemin relatif, contenu **d'avant la
  première exécution** (`null` = créé), contenu courant écrit par Claude, empreintes. Une correction met à jour le
  contenu courant, jamais le contenu d'avant (US3 sc. 3).
- **Différence** : calculée à l'affichage par une fonction pure de diff ligne à ligne (algorithme de Myers, O(ND)) dans
  `src/shared/diff/` ; au-delà de 5 000 lignes modifiées ou 1 Mo, résumé (tailles avant/après).
  « Modifié depuis » : à l'ouverture du livrable, le main relit le fichier ; empreinte ≠ contenu écrit → la différence
  est calculée sur le disque et signalée (US3 sc. 4).
- **Écartée** : dépendance `diff` (jsdiff) — utile mais une fonction de ~80 lignes testée suffit (VI) ; à reconsidérer
  si l'affichage mot à mot devient nécessaire.

## R7 — Historique et retour arrière
- Chaque appel `fichier_*` = une opération d'Historique (constitution II : écriture MCP directe, marquée, annulable),
  kind `mcp_write`, entité externe `project_file` (handler comme les documents, spec 012) : `{ path, content|null }`
  avant/après ; annuler réécrit l'ancien contenu ou met le fichier créé à la **corbeille du profil**
  (`<profil>/documents/.corbeille/`) — jamais d'effacement définitif. Contrôle de conflit : refus si le disque ne
  correspond plus au contenu « après » du lot (retouché à la main).
- « Revenir en arrière » (US3 sc. 5) = un lot `final` qui restaure tous les fichiers du livrable non retouchés, signale
  les autres ; annulable.
- Accepter / refuser une proposition, rétrograder, accepter un livrable : lots `final` (entités `final_action`,
  `neuron` pour `step_status`).

## R8 — Proposition par Claude et rendu
- Outil MCP `action_proposer { id?, livrable, raison }` (étape de la conversation par défaut) ; refus `LOT_INVALIDE` si
  l'étape a des sous-étapes ou une proposition en attente, ou n'est pas une étape (FR-002). `plan_proposer` refuse une
  action finale comme parent. Bouton de chat « Proposer l'action finale » (`FINAL_MESSAGE`, outil nommé).
- Carte : la carte d'étape garde sa place dans la disposition ; variante **action** (bord épais ambre, icône éclair,
  pastille d'état prête / en cours / à revoir / fait) ; proposition = bandeau pointillé sur la carte avec ✓ / ✗ et
  lecture complète au clic (réutilise `GhostPanel`). Nœud **livrable** = annexe sous l'action (même logique que les
  documents, spec 012 D4) : liste des fichiers, différence dépliable, Accepter / Corriger / Revenir en arrière, « Voir
  le fil ».

## R9 — Scripts approuvés (D2 bis, 2026-10-06)
- **Décision** : outil MCP `commande_lancer { script }` ; le main lit `package.json` du projet lié (texte, 1 Mo, Zod),
  vérifie que le script est approuvé pour ce genesis ET que son texte actuel est celui approuvé, puis lance
  `node <npm-cli.js> run <script>` (exécutable `node.exe` et `npm-cli.js` résolus dans le PATH par le main) — **sans
  shell**, `cwd` = dossier du projet, `CI=1`, `FORCE_COLOR=0`. Nom de script : `^[A-Za-z0-9:_.-]{1,40}$`.
- **Délai** : 5 min ; au-delà, `taskkill /PID <pid> /T /F` (arguments fixes) arrête l'arbre (workers de tests).
  Une seule commande à la fois par exécution. Sortie : stdout + stderr, codes ANSI retirés, 20 Ko de fin gardés.
- **Pont MCP** : le gestionnaire d'outils devient asynchrone ; le relais attend 6 min pour `commande_lancer`
  (30 s pour les autres) ; la conversation est lancée avec `MCP_TOOL_TIMEOUT=420000`.
- **Pourquoi** : D2 bis — tester et compiler sans donner `Bash` ; l'app décide de ce qui est lançable. Un script
  réécrit par Claude (ex. `"test": "curl …"`) n'est plus lançable avant que mentalyas ne le relise.
- **Risque assumé** (écart constitution I à valider) : un script approuvé exécute du code du projet, y compris du code
  écrit par Claude (ses tests, sa config). C'est le but ; le garde-fou est l'approbation, la trace et git.
- **Écartées** : `cmd /c npm run …` (interpréteur) ; `Bash(npm run test)` du CLI (contrôle délégué) ; validation à
  chaque commande (choix de mentalyas).

## R10 — Visionneuse et « Ouvrir dans l'éditeur » (D4, 2026-10-06)
- **Différences** : `src/shared/diff/lineDiff.ts` (T002, Myers) — aucune dépendance de diff à ajouter.
- **Coloration** : `highlight.js` (cœur + langages courants enregistrés à la main : ts, js, json, css, html/xml, md,
  php, cs, cpp, sql, yaml, bash). Synchrone, sans WASM, rendu en `<span>` de classes (jamais `innerHTML` d'une source
  non échappée : la sortie de `hljs.highlight` est échappée, insérée dans un `<code>` dédié). **Écarté** : Shiki
  (WASM, asynchrone, plus lourd) ; Monaco (≈ 5 Mo, édition hors périmètre, conflit avec le retour arrière).
- **Contenu actuel** : lu par le main (`ProjectFiles`, contrôles T001/T003, 1 Mo, octet nul → binaire), jamais par le
  renderer.
- **Éditeur** : réglage `editor.command` (ex. `code -g {fichier}:{ligne}`, `"C:\…\notepad++.exe" -n{ligne} {fichier}`)
  découpé en arguments par un analyseur pur (guillemets doubles seulement), exécutable = premier argument, lancé par
  `spawn(…, { shell: false, detached: true })` ; `{fichier}` remplacé par le chemin **absolu vérifié** (un seul
  argument, jamais concaténé dans une chaîne de commande). `code` est un `.cmd` sous Windows : refusé sans shell → le
  réglage propose de résoudre `Code.exe` (chemin complet) ; l'interface le dit.
- **Repli sans éditeur** : `shell.openPath` seulement pour une liste blanche (`.md .txt .json .css .html .ts .tsx .jsx
  .mjs .cjs .php .cs .cpp .h .sql .yml .yaml .xml .csv .log`) ; `.js`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.wsf`, `.hta`,
  `.lnk`, `.exe`… jamais (Windows Script Host / exécution).

## R11 — Tests du livrable (D5, 2026-10-06)
- **Fichiers de test** : fichiers du livrable non revenus en arrière, présents sur le disque, dont le chemin correspond
  à `\.(test|spec)\.[cm]?[jt]sx?$` ou se trouve sous `test/`, `tests/`, `__tests__/` ; 20 au plus.
- **Lancement** : `CommandRunner` réutilisé : `node <npm-cli.js> run test -- <fichiers…>`, sans shell, `CI=1` (Vitest
  et Jest tournent une fois, pas en veille), 5 min, arbre arrêté. npm transmet les arguments au script **à travers
  l'interpréteur de commandes du système** : chaque chemin MUST correspondre à `^[A-Za-z0-9_./@-]{1,200}$` (pas
  d'espace, ni `& | < > ^ % " ' ( ) !`), sinon il est ignoré et signalé. Relatif au projet, `/`.
- **Script** : le script nommé `test`, approuvé et inchangé (FR-015). **Écarté** (YAGNI) : choisir un autre script de
  test par projet — à rouvrir si un projet n'a que `test:unit`.
- **Pas Claude** : lancé par mentalyas (IPC), aucune session `claude -p`, aucun jeton consommé. `CommandService` garde
  « une commande à la fois » par projet, commune aux lancements de Claude et de mentalyas.
- **Correction** : `TEST_FIX_MESSAGE(fichiers, sortie)` (fin de sortie 8 Ko) et `TEST_WRITE_MESSAGE(fichiers)` passent
  par `deliverable:correct` ; le message est construit par le main à partir de la trace, pas par le renderer.
- **Risque assumé** : comme R9, un test exécute du code du projet écrit par Claude ; garde-fous : approbation du script,
  geste explicite de mentalyas, trace.
