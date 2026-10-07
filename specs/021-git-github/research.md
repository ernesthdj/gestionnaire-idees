# Research — Git et GitHub (spec 021)

> Phase 0 du plan. Chaque point : décision, raison, alternatives. Le niveau 3 du brainstorm
> (`docs/brainstorm/L3-git-*.md`) est repris ; les écarts constatés contre le code (2026-10-08) sont signalés
> « écart L3 ». Constats sur le code : `GitCli.runGit` (sortie 4 000 caractères, stdin ignoré, pas d'annulation,
> aucun préfixe de sûreté) sert à `ProjectService.initGit` (spec 016) et `RepoGuard` (spec 019) ; `runProcess` de
> `ClaudeCliProvider` a stdin et annulation mais une sortie standard non bornée ; aucun clone codé (spec 017
> T028–T031 en pause, spec 020 T026–T027 à faire) ; dernière migration `0032_element_progress` (0033 réservée par la
> spec 020) ; `trusted_projects.project_key` = chemin réel en minuscules (`projectKey`, spec 014) ;
> `RepriseService.preview(path, 'git', remoteUrl)` existe déjà pour une source git ; `Markdown.tsx` (spec 008) ouvre
> tout lien `https://`.

## R1 — Exécuteur de processus commun (`GitRunner`, `GhRunner`)
- **Décision** : un `ProcessRunner` d'infrastructure (`src/main/infrastructure/process/ProcessRunner.ts`) : `spawn` sans
  shell, `windowsHide`, environnement explicite, `stdin` facultatif, `AbortSignal`, délai, **sortie bornée**
  (`maxOutput`, 8 Mo au plus ; au-delà `truncated: true`), rappel ligne à ligne sur la sortie d'erreur (progression).
  `resolveProgram(nom)` généralise `resolveGit` (dossiers **absolus** du PATH seulement) pour `git.exe` et `gh.exe`.
  `GitRunner` et `GhRunner` construisent leurs préfixes et leur environnement par-dessus ; `runGit` reste une fine
  enveloppe compatible (spec 016, spec 019 inchangées). `RunProcess` reste injectable pour les tests.
- **Raison** : deux usages réels (git, gh) → une abstraction justifiée (constitution VI) ; les limites actuelles de
  `runGit` empêchent diff, log, commit par stdin et clone annulable.
- **Alternatives** : réutiliser `runProcess` de `ClaudeCliProvider` — sortie non bornée, couche IA ; étendre `runGit`
  seul — `gh` dupliquerait le code.

## R2 — Préfixe sûr de toute commande git
- **Décision** : toujours `-c core.quotepath=off -c color.ui=never -c core.pager=cat -c core.fsmonitor=false -c
  core.editor=false -c protocol.allow=never -c protocol.https.allow=always -c protocol.ssh.allow=always` ; environnement
  `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, `GIT_OPTIONAL_LOCKS=0` (lectures), `GIT_LFS_SKIP_SMUDGE=1` (clone) ; diff / log /
  show : `--no-ext-diff --no-textconv` ; sorties machine `-z`. Dépôt **non de confiance** : en plus `-c
  core.hooksPath=<profil>/git-empty-hooks` (dossier vide créé par l'app). Dépôt **de confiance** (`trusted_projects`,
  clé `projectKey(realpath)`) : hooks du dépôt exécutés, jamais contournés — **sauf** tant que HEAD est sur une
  branche `pr/*` récupérée par `git:prFetchBranch` : profil sans hooks (FR-005, analyse H2), car un chemin de hooks
  suivi dans le dépôt (`core.hooksPath=.husky`) ferait exécuter des hooks écrits par l'auteur de la PR.
- **Raison** : constitution I (4.4.0) ; les restrictions de protocole s'appliquent aussi aux téléchargements différés
  d'un clone partiel (R6). `-c` en ligne de commande prime sur toute configuration.
- **Alternatives** : `core.hooksPath=NUL` (spec 017 R4) — dépend de Windows, moins testable.

## R3 — Configuration locale à risque (écart L3, sécurité)
- **Décision** : lecture `git config --local --list --name-only -z` (`--local` ne suit pas les `include`). Deux
  classes : **neutralisées** par le préfixe R2 (`core.fsmonitor`, `core.hooksPath`, `core.pager`, `core.editor`,
  `diff.external`, `diff.*.textconv`, `sequence.editor`) → simple mention ; **non neutralisables** (`filter.*`,
  `include.path`, `includeIf.*`, `core.sshCommand`, `credential.helper`, `merge.*.driver`, `diff.*.command`,
  `gpg.program`, `uploadpack.*`, `core.gitProxy`, `remote.*.uploadpack`, `remote.*.receivepack`) → dans un dépôt **non
  de confiance**, **aucune** autre commande git n'est lancée (lecture comprise) : volet en mode « configuration à risque
  » (liste des clés, explication, marquer de confiance ou nettoyer en terminal) ; dans un dépôt de confiance, simple
  avertissement.
- **Raison** : un filtre `clean` peut s'exécuter dès un `git status` ; `core.sshCommand` dès un `fetch`. Le L3 ne
  bloquait que les écritures : insuffisant pour un dossier importé (spec 017) dont `.git/config` est hostile. Un dépôt
  **cloné par l'app** a une configuration créée par git, sans clé à risque. Règle reprise dans la spec (FR-005 et edge
  case, analyse H1, 2026-10-08).
- **Alternatives** : neutraliser clé par clé (`-c filter.x.clean=`) — noms imprévisibles ; ignorer — exécution de code.

## R4 — Verrou et concurrence
- **Décision** : `GitWriteQueue` (une file d'écriture par `genesisId`, en mémoire du main) ; lectures hors file avec
  `GIT_OPTIONAL_LOCKS=0` ; `index.lock` présent → `BUSY`, jamais supprimé ; un seul clone à la fois, tous profils.
- **Raison** : FR-008, edge cases ; Claude en conversation ou le terminal peuvent écrire en même temps.

## R5 — Ce que l'utilisateur a vu = ce qui est fait
- **Décision** : chaque écriture porte l'état montré : `expectedStaged` (commit), `expectedHead` (push, publier, revert,
  PR), `expectedRemote`, `expectedBranch`, `expectedUpstreamHead` (fusion), `expectedPreviewHash` (conflit) ; différence
  → erreur (`STAGED_CHANGED`, `HEAD_CHANGED`…) et récapitulatif à rouvrir. L'état est relu au retour du focus (`window`
  `focus` côté renderer → `git:status`), sans surveillance du disque (GA-9).
- **Raison** : FR-002, FR-013, edge case « récapitulatif devenu faux ».

## R6 — Clone : un service, deux profils (FR-022)
- **Décision** : `CloneService` unique (`src/main/application/reprise/CloneService.ts`), profils `historique` (spec 021
  : `--filter=blob:none`, « Tout télécharger » → sans filtre, dossier parent au sélecteur natif + nom, délai 30 min,
  question à 500 Mo reçus) et `superficiel` (spec 020 : `--depth 1 --single-branch`, quarantaine du profil, délai 5 min,
  bornes 50 Mo / 2 000 fichiers après clone). Commun : préfixe R2 + `clone --no-recurse-submodules --progress <profil>
  -- <url> <cible>`, cible inscrite dans `git_clones_running` **avant** le lancement (absente avant, vérifié),
  suppression du seul dossier créé en cas d'échec / annulation / fermeture (nettoyage au démarrage), échecs classés
  (`AUTH_FAILED`, `NOT_FOUND`, `NETWORK`, `CANCELLED`, `TIMEOUT`, `FAILED`), espace libre < 2 Go → avertissement. Livré
  par la première spec codée (021 US3 ou 020 US4) ; l'autre ajoute son profil. **À reporter au moment de coder** dans
  `specs/020-arbre-de-skills/research.md` R7 et tâche T027, et dans `specs/017-reprise-voir/tasks.md` T028–T031 (ce plan
  ne modifie pas ces specs) : le report se fait **au début de T028** (analyse M6), pas en fin de spec.
- **Raison** : constitution VI ; le clone superficiel n'a pas l'historique dont US3 et US5 ont besoin.

## R7 — Seuil de 500 Mo : question, pas de vraie pause
- **Décision** : à 500 Mo reçus (lu dans la progression), événement `reprise:cloneLarge` → « Ce dépôt dépasse 500 Mo.
  Continuer / Annuler » ; git **continue** de recevoir pendant la question (texte honnête : « le téléchargement continue
  pendant que tu choisis ») ; pas d'annulation automatique sans réponse. Seuil de 100 000 commits de `L2-git-cloner`
  GC-6 **non retenu** (absent de la spec).
- **Raison** : un processus git ne se suspend pas proprement sous Windows ; la spec US3-4 a été reformulée en ce sens
  (analyse M1, 2026-10-08).
- **Alternatives** : tuer puis reprendre — git ne reprend pas un clone ; suspendre le processus — non portable.

## R8 — Adresses (`gitUrl.ts`, = spec 017 T028, = spec 020 T026)
- **Décision** : pur, partagé (`src/shared/reprise/gitUrl.ts`) : `https://hôte[:port]/chemin` et `git@hôte:chemin`
  **seulement** (FR-017 ; `ssh://` retiré, analyse M2) ; refus : `ssh://`, `ext::`, `fd::`, `file://`, chemin local,
  `http://`, `-` initial, espace ou
  caractère de contrôle, hôte vide, `..` ; identifiant retiré (`display`), l'URL complète passée une seule fois à git,
  jamais stockée ni journalisée. Sortie `{ ok, url, display, host, owner?, repo? } | { ok: false, reason }`.
- **Tests d'intégration** : le transport `file` étant refusé en production, les tests injectent dans `CloneService` une
  liste de transports de test (`file` vers un dépôt nu temporaire) ; un test vérifie la valeur de production.

## R9 — `gh` : liste blanche et publication (écart L3)
- **Décision** : `ghArgs.ts` (pur) seul constructeur d'arguments `gh` ; sous-commandes permises : `api user --jq
  .login`, `repo create`, `repo view --json`, `repo fork --clone=false --remote=false`, `pr
  list|view|diff|create|comment`, `issue list|view|create`. Valeurs en forme collée (`--title=…`), corps par **stdin**
  (`--body-file -`), `<o/n>` lu dans `git_repos.github_repo`, jamais du renderer. Environnement `GH_PROMPT_DISABLED=1`,
  `GH_NO_UPDATE_NOTIFIER=1`, `GH_NO_EXTENSION_UPDATE_NOTIFIER=1`, `NO_COLOR=1`, `GH_PAGER=cat`, `GH_SPINNER_DISABLED=1`.
  **Publier** : `gh repo create <nom> --private|--public [--description=…]` **sans** `--source` ni `--push`, puis `git
  remote add origin <url>` et le push par `GitRunner`. **Ajout** `pr diff <n> --repo <o/n> --color=never` (lecture de
  PR, couverte par la constitution I) pour US6-1.
- **Raison** : `--source` ferait lancer git par `gh`, hors du profil sûr (même raison que le refus de `pr checkout` dans
  le L3) ; le L3 n'avait pas de moyen d'afficher le diff d'une PR sans créer de branche locale.

## R10 — Règles de blocage du push (FR-014, FR-015)
- **Décision** : fonction pure `pushRules.ts` : constat bloquant (nom sensible, en-tête de clé privée) →
  `SENSITIVE_IN_HISTORY` ; `viewerPermission` `read` / `triage` / `none` → `NO_WRITE_ACCESS` (proposer Forker) ;
  **propriétaire** (D11, analyse H3, 2026-10-08) = dépôt à son compte (`owner.login` = compte connecté) **ou**
  `viewerPermission` `admin` / `maintain` (lu par `gh repo view <o/n> --json viewerPermission,owner,defaultBranchRef`,
  déjà dans la liste blanche R9) ; branche cible = branche par défaut **et** non propriétaire (droit `write` seulement)
  → `THIRD_PARTY_DEFAULT_BRANCH` (proposer branche + PR) ; propriétaire → push permis, toujours après récapitulatif ;
  remote hors GitHub → permis après récapitulatif, avertissement « droits non vérifiés ». Motifs de contenu (préfixes de
  jetons) non bloquants, acceptés un par un (`acceptFindings`). Motifs dans `src/main/domain/git/sensitivePatterns.ts`
  (données déclaratives validées par Zod au chargement).
- **Contrôle** : `rev-list` de la plage à pousser (premier push : `HEAD --not --remotes=<remote>`), noms par `log
  --format=%H -z --name-only --no-renames --diff-filter=AMR`, contenu par `grep -I -n -E` sur les fichiers ajoutés ou
  modifiés de chaque commit (bornes : 5 000 commits, 50 000 chemins, 2 000 fichiers ≤ 1 Mo ; au-delà, noms seulement +
  avertissement) ; `sensitive_checked_head` évite de recontrôler une plage déjà vue.

## R11 — Interdits par construction (SC-002)
- **Décision** : `args.ts` (pur) assemble **toutes** les commandes git ; `assertSafeArgs` refuse `--force`, `-f` au
  push, `--force-with-lease`, `--mirror`, `--all`, `--delete`, `--prune`, `--tags`, refspec commençant par `+` ou `:`,
  `--no-verify`, `-n` au commit, `rebase`, `reset`, `--amend`, `clean`, `gc --prune`, `add -A|--all|.`, `commit -a`. Un
  test parcourt tous les constructeurs avec des entrées hostiles. `ProjectService.initGit` (spec 016) passe à
  `commit -F -` (message par stdin, constitution I ; analyse C1) quand `runGit` devient l'enveloppe de `GitRunner`
  (T008) ; il garde `add --all`, seule exception documentée : dossier neuf créé par l'app, fichiers d'échafaudage
  écrits par elle, rien d'autre à exclure.

## R12 — Tâches d'IA (sans outil, par l'`AIGateway`)
- **Décision** : nouveaux `TaskKind` `git_message`, `git_conflict`, `git_story`, `git_pr_text`, `git_pr_review`,
  `git_issue_text` (`GIT_TASK_KINDS`), moteur Claude, cadres figés `src/main/infrastructure/ai/Git*Frame.ts`, schémas
  Zod dans `src/shared/ai/schemas.ts`, entrées balisées comme données, auteurs pseudonymisés (« Auteur A »), fichiers
  sensibles exclus, bornes (40 000 caractères de diff ; conflit 200 Ko / 30 blocs). Modèle par défaut : Sonnet 5.5
  (éléments de projet, CLAUDE.md), réglable. **Projet « Local uniquement »** : aucune tâche lancée, propositions vides
  (FR-038, la spec prime sur le L3 qui proposait le modèle local) ; écart signalé à l'analyse.
- **Contrôles de sortie** : `git_message` — ligne `Co-Authored-By:` retirée, `paths` ⊆ fichiers préparés, format
  Conventional Commits signalé sinon ; `git_conflict` — bloc refusé s'il contient un marqueur ou un index inconnu ;
  `git_pr_text` — idem message ; `git_pr_review` — commentaires `{ path?, line?, text ≤ 2 000 }[] ≤ 30`, affichés dans
  l'app, publiés seulement par `git:prComment` sur clic.

## R13 — Historique, auteurs et rediffusion (US5)
- **Décision** : `log --format=%H%x00%ae%x00%an%x00%aI%x00%s -z --name-only --no-renames` (5 000 par lecture, curseur
  `before`) ; **auteur principal = lignes modifiées** (`--numstat`) quand le dépôt est complet ; dans un **clone
  partiel** (`remote.<r>.partialclonefilter` présent), `--numstat` téléchargerait tout le contenu de l'historique : on
  compte alors les **commits** par nœud, légende « par commits » (D12, validé le 2026-10-08). « Tout télécharger » sur
  un clone partiel existant (`git:fetchAll`, sur clic, après confirmation) : retrait de
  `remote.<r>.partialclonefilter` de la configuration locale puis `fetch --refetch --no-recurse-submodules -- <r>`
  (git ≥ 2.36, sinon message « mets git à jour ») ; le dépôt redevient complet et les lignes sont comptées.
  Clé d'auteur = HMAC de l'e-mail normalisé (secret `git-author-hmac`, comme `analyste-hmac`) : la
  base ne garde que des clés (alias) ; noms et e-mails seulement en mémoire et vers le renderer. Correspondance fichier
  → nœud de la cartographie (spec 017) : préfixe de chemin le plus long (`fileToNode.ts`, pur, partagé avec « Depuis ta
  dernière visite ») ; sans cartographie, dossiers de premier niveau. Palette : 12 teintes espacées, contraste ≥ 3:1
  vérifié sur les deux thèmes, initiales toujours, bordure pointillée au-delà de 12.
- **Raison** : spec US5-2 / FR-027 amendées (D12, analyse H4) : jamais de téléchargement massif caché derrière une
  lecture.

## R14 — Conflits (US4)
- **Décision** : versions lues dans l'index (`show :1:`, `:2:`, `:3:`), jamais dans le fichier à marqueurs ; fusion à
  trois voies par une fonction pure `splitHunks` sur un diff de lignes : réutiliser `src/main/domain/skills/diff.ts`
  (spec 020 T020) s'il est livré, sinon livrer `src/main/domain/text/lineDiff.ts` et le partager ; test de
  non-régression : « tout la mienne » = version `:2:`. Écriture atomique (temporaire + renommage) après vérification de
  l'empreinte du fichier ; `add --`. Binaire, > 1 Mo, suppression / modification → choix entier. Sessions et blocs en
  base (reprise après fermeture ; blocs effacés en fin ou abandon ; `lost` si `MERGE_HEAD` a disparu).
- **Avant US4** : `git:merge` qui rencontre des conflits lance `merge --abort` et répond `CONFLICTS_ABORTED` avec
  l'explication (D10) ; un `revert` en conflit fait de même (`revert --abort`).

## R15 — Retour arrière (FR-007) et ce qui est écarté
- **Décision** : `git:revert { hash, confirm, expectedHead }` (`revert --no-edit <hash>`, commit simple seulement ;
  commit de fusion → `MERGE_COMMIT`), proposé dans la liste « Derniers commits » de l'onglet Historique dès US1. «
  Rétablir un fichier » (`git:restoreFile` du L3) **écarté** : absent de la spec (YAGNI).
- **Raison** : le L3 n'avait aucun canal pour le revert exigé par FR-007.

## R16 — Extraire (US7)
- **Décision** : racine du workspace = racine des projets (spec 016) si `HubRegistry.locate` la reconnaît (H18) ; sinon
  extraction indisponible (`NO_WORKSPACE`, explication) — pas de sélecteur de secours (le L2 le proposait ; la spec
  FR-036 limite à `snippets/` et `techno/` du workspace). Licence par règles fixes (`license.ts` : MIT, Apache-2.0,
  BSD-2/3-Clause, ISC, MPL-2.0, Unlicense → copie permise ; GPL-2.0/3.0, LGPL, AGPL → permise avec avertissement de
  réciprocité ; sinon « inconnue » → note d'étude seulement). En-tête d'attribution selon la syntaxe de commentaire de
  l'extension. Fichier texte ≤ 200 Ko, jamais d'écrasement (`NAME_TAKEN`). Pas de commentaire de Claude (optionnel au
  L2, absent de la spec).

## R17 — Interface
- **Décision** : volet Dépôt 38 % à droite de la carte du projet (`src/renderer/src/git/`), 5 onglets (PR / Issues
  masqués hors GitHub et avant US6), en-tête d'état + Tirer / Pousser, un CTA de 40 px par onglet, `Ctrl+Maj+G` (libre,
  H16), `Ctrl+Entrée` = CTA ; badge sur le nœud genesis (`NeuronNode.tsx`) ; liste de fichiers fenêtrée maison (aucune
  dépendance) au-delà de 200 lignes ; vue de conflit qui remplace la carte (62 %) ; rediffusion sur l'explorateur de la
  reprise (spec 017). Textes venus de GitHub : `GitHubMarkdown.tsx` (dérivé de `Markdown.tsx` : `skipHtml`, images
  jamais chargées, seuls les liens `https://github.com/…` cliquables via `git:openExternal`, les autres copiables), car
  `Markdown.tsx` ouvre tout lien `https://`.

## R18 — Mesures
- SC-001 (commit < 30 s), SC-007 (conflit < 3 min), SC-008 (auteur d'un nœud < 5 s) : chronométrés aux tests guidés.
- SC-006 (≈ 10 000 commits clonés et visibles < 3 min) : mesure manuelle sur un dépôt public, consignée ici en
  finitions.
