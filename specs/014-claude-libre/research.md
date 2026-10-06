# Research — 014 Claude libre

## R1 — Relayer les demandes de permission : `--permission-prompt-tool` sur le pont MCP
- **Décision** : lancer `claude -p … --permission-prompt-tool mcp__brainstormer__permission_demander` (sans
  `--permission-prompts none`). Claude Code appelle cet outil à chaque action soumise à permission avec
  `{ tool_name, input, tool_use_id? }` et attend un texte JSON `{ "behavior": "allow", "updatedInput": … }` ou
  `{ "behavior": "deny", "message": … }`. Le relais transmet au main (pipe authentifié existant, gestionnaire
  asynchrone déjà utilisé par `commande_lancer`) ; `PermissionService` crée la demande, l'annonce au chat
  (`chat:permission`) et attend la décision de mentalyas (`chat:permissionDecide`).
- **Délai** : le relais attend jusqu'à 30 min pour cet outil (`MCP_TOOL_TIMEOUT` porté à 31 min) ; au-delà, refus. Une
  demande est refusée d'office à la fermeture du chat, à l'arrêt de la conversation, à la fermeture de l'app.
- **Constat (essai 2.1.291)** : sans hôte qui répond, une demande est refusée (`system/permission_denied`). Le protocole
  `--permission-prompt-tool stdio` (contrôle du SDK) est une alternative non retenue : non documenté pour un hôte
  maison, et l'essai n'a pas pu être mené ; la voie MCP est documentée et réutilise le pont existant.
- **Sécurité** : l'outil `permission_demander` n'est accepté que de la conversation qui l'appelle (appelant connu du
  relais, `GI_NEURON_ID`) ; il n'est jamais listé dans les instructions données à Claude ; ses entrées sont validées.

## R2 — Modes et arguments
- **Décision** : `--permission-mode` = `default` (Demander), `acceptEdits` (Accepter les modifications) ou
  `bypassPermissions` (Libre, avec `--allow-dangerously-skip-permissions`). `--tools default` (tous les outils natifs) ;
  `--allowedTools` garde `mcp__brainstormer Read Glob Grep WebSearch` (lecture libre, US1 #5).
- **Changement de mode, de dossiers ou de réglages** : comme le changement de modèle (spec 010) — le processus est
  arrêté, le message suivant reprend la session (`--resume`) avec les nouveaux arguments.
- **Réglages** : `--setting-sources ""` par défaut ; `user` si « Utiliser mes réglages Claude Code » ;
  `user,project,local` si de plus le dossier lié est de confiance.

## R3 — Règles « Toujours pour ce projet »
- **Décision** : gardées par l'app (jamais écrites dans le dépôt), par projet (clé = chemin réel en minuscules ;
  sans dossier lié : l'espace de travail du profil). Correspondance pure : écriture (`Write`, `Edit`, `MultiEdit`,
  `NotebookEdit`) → règle par outil sur tout le projet ; `Bash`/`PowerShell` → **commande exacte** (texte identique) ;
  autre outil → par nom. Une demande qui correspond est autorisée par `PermissionService` sans carte (tracée).
- **Écartée** : écrire dans `.claude/settings.local.json` du projet (modifie le dépôt, contournable par le dépôt).

## R4 — Fil fidèle
- **Décision** : `parseStreamLine` lit l'identifiant des `tool_use` et les `tool_result` (`is_error`) des messages
  `user`, ainsi que `system/permission_denied`. La pastille passe de « en attente / en cours » à « réussi », « refusé »
  (refus de permission) ou « échoué » (erreur), avec la raison courte (premiers 160 caractères, sans contenu de fichier).

## R5 — Livrable reconstitué : hook `PreToolUse`
- **Décision** : l'app passe `--settings` avec un hook `PreToolUse` (matcher `Write|Edit|MultiEdit|NotebookEdit`) dont la
  commande lance le relais en mode hook (`<electron> <relay> --hook`, `ELECTRON_RUN_AS_NODE`). Le hook envoie au main
  `{ neuronId, tool, file_path }` par le pipe authentifié ; le main lit le contenu d'avant (contrôles de chemin
  existants, 1 Mo) si la conversation est celle d'une action finale, et répond « continuer ». Au `tool_result` réussi,
  le contenu d'après est relu et le livrable mis à jour (créé / modifié / supprimé).
- **Pourquoi** : fonctionne dans tous les modes ; le hook est injecté par l'app et n'exécute que le relais de l'app.
  Les hooks de mentalyas et d'un dépôt de confiance s'ajoutent si les réglages sont chargés.
- **Changements faits par des commandes** (FR-010, projet sous git) : différé en fin de lot 3 — `git status` en fin
  de tour, lancé par l'app sans shell ; à défaut, le livrable le signale.

## R6 — Commiter l'étape
- **Décision** : bouton → message fixe `COMMIT_MESSAGE` dans la conversation de l'action : rang et titre de l'étape,
  fichiers du livrable, règles (ajout nommé, Conventional Commits, pas de co-auteur, pas de push). Le commit passe par
  `Bash` → carte de permission en mode Demander. Détection : `tool_result` d'une commande `git commit` réussie →
  identifiant court (`[branche abc1234]`) gardé sur l'action finale.
- **Disponibilité** : dossier lié sous git (`.git` présent) et livrable non vide.

## R7 — Retrait de l'outillage confiné (spec 013 D2, D2 bis)
- **Décision** : retirer `fichier_ecrire`, `fichier_modifier`, `commande_lancer`, `CommandService`, `CommandRunner`,
  `CommandRepository`, `CommandsSection` ; la table `approved_commands` reste (archive, down 0026 intact). L'exécution
  garde son suivi (état, fil, durée) mais n'ouvre plus de « droits » : c'est le mode qui décide.
