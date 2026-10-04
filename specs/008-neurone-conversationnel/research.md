# Research — Spec 008 Neurone conversationnel (lot A)

## R1 — Conversation = `claude -p` en flux continu (vérifié 2026-10-04, Claude Code 2.1.289)
- **Décision** : un processus par conversation ouverte :
  `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages`
  `(--session-id <uuid> | --resume <uuid>) --model <m> --setting-sources project --strict-mcp-config --mcp-config <json>`
  `--tools "Read,Glob,Grep,WebSearch" --allowedTools "mcp__brainstormer Read Glob Grep WebSearch" --permission-prompts none`
  `--append-system-prompt <cadre>`, cwd `%APPDATA%/<profil>/workspace`, `shell: false`, messages par stdin.
- **Vérifié** : événements `system/init` (`apiKeySource: none` = abonnement), `assistant` (blocs `thinking`/`text`/
  `tool_use`), `rate_limit_event` (`status`, `resetsAt`, fenêtres 5 h / 7 j), `result` (`subtype`, `session_id`).
  Sans `--setting-sources project`, les 3 hooks `SessionStart` de mentalyas se déclenchent ; avec, aucun.
- **Alternatives** : terminal brut (xterm) — écarté au profit d'un chat (L1c n°8) ; Agent SDK — facturation API.
- **À vérifier en T0xx** : `mcp__brainstormer` (sans nom d'outil) autorise bien tous les outils du serveur ; sinon lister
  `mcp__brainstormer__<outil>`.

## R2 — Contexte frais à chaque ouverture
- **Décision** : cadre stable en `--append-system-prompt` (figé par session par le CLI : `--system-prompt-snapshot` on par
  défaut) ; le contexte variable (titre, couche, type, fiche) est joint **au premier message de chaque processus** dans
  un bloc `<contexte_brainstormer>` ; outil `neurone_contexte` pour le relire.
- **Raison** : une fiche change entre deux ouvertures ; un system prompt figé l'ignorerait.

## R3 — Neurone courant transmis au pont
- **Décision** : `GI_NEURON_ID` dans l'`env` du serveur `brainstormer` de `--mcp-config` ; le relais l'ajoute à sa
  poignée de main (`neuron`) ; le main le passe au gestionnaire d'outils. Les outils `neurone_*` / `fiche_*` /
  `maturite_*` visent ce neurone par défaut et refusent un neurone d'un autre arbre.
- **Raison** : FR-014, sans faire confiance au texte de Claude.

## R4 — Maturité = évaluation de contexte existante
- **Décision** : `maturite_evaluer` insère une ligne `context_assessments` (niveau, manques) : la taille du neurone sur la
  carte (`tierOf` ← `latestGaugeLevels`) suit sans nouveau code de rendu.
- **Raison** : DRY ; la jauge existante devient la maturité (L1d n°16).

## R5 — Fiche
- **Décision** : `neurons.sheet_json` = `{ resume, points_cles[], decisions[], questions_ouvertes[], manques[] }`,
  ≤ 12 000 caractères (Zod) ; `fiche_ecrire` remplace les sections fournies ; entité d'Historique `neuron_sheet`.

## R6 — Historique du chat
- **Décision** : table `neuron_messages` (base chiffrée) : messages de mentalyas, réponses complètes de Claude, pastilles
  d'outils. Le CLI garde sa propre transcription (`~/.claude/projects/…`) pour `--resume`.

## R7 — Chemin de `claude`
- **Décision** : résolu par le main au démarrage (`where.exe claude`, premier `.exe`), mis en cache ; réglage manuel plus
  tard. Vérifié : `C:\Users\ernes\.local\bin\claude.exe`.

## R8 — Processus
- **Décision** : ≤ 3 vivants, arrêt après 10 min sans activité, tous tués à la fermeture ; un tour à la fois par
  conversation ; `chat:stop` tue le processus (le tour suivant reprend avec `--resume`).
