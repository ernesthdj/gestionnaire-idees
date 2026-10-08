# Research — Arbre de skills (spec 020)

> Phase 0 du plan. Chaque point : décision, raison, alternatives. Constats faits sur le poste : 17 skills personnels
> (`~/.claude/skills`), 12 skills dans `.claude/skills` du dépôt, 90 `SKILL.md` dans le cache des plugins
> (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/…/skills/<nom>/SKILL.md`, parfois sous `.claude/skills`).

## R1 — Noms identiques entre familles
- **Décision** : les skills de plugins sont **espacés par leur plugin** pour Claude Code (`vercel:deploy`,
  `claude-md-management:revise-claude-md`, constaté dans la liste des skills disponibles) : pas de collision avec un skill
  personnel. Entre un skill personnel et un skill de projet de même nom, les deux existent (un skill de projet peut être
  préfixé par son dossier) : deux nœuds, la fiche indique « même nom qu'un skill personnel ». Pas de notion d'« ombre »
  calculée.
- **Raison** : refléter ce que Claude Code affiche, sans supposer une règle de priorité non documentée.
- **Alternatives** : calculer une priorité — risque de se tromper.

## R2 — En-tête des `SKILL.md`
- **Décision** : analyseur maison du bloc `---` initial : lignes `clé: valeur`, valeurs simples ou entre guillemets
  (échappements `\"` et `\\`), clés `name`, `description`, `trigger` ; tout le reste ignoré ; pas de listes, d'ancres ni de
  types ; validé par Zod. Échec → skill « abîmé ».
- **Raison** : 3 champs utiles ; zéro dépendance ; aucune exécution possible.
- **Alternatives** : bibliothèque YAML — dépendance et fonctions dangereuses (types personnalisés).

## R3 — Version de plugin à retenir
- **Décision** : pour chaque `<marketplace>/<plugin>`, le dossier `<version>` le plus élevé (comparaison semver, sinon
  lexicale) ; recherche des `SKILL.md` en profondeur ≤ 6 sous cette version, liens symboliques ignorés.
- **Raison** : le cache garde plusieurs versions ; seule la dernière compte.

## R4 — Comptage d'usage
- **Décision** : `worker_threads` ; fichiers `~/.claude/projects/*/*.jsonl` dont la date de modification est dans les
  30 jours ; lecture ligne à ligne (`readline` sur un flux) ; test textuel préalable (`"name":"Skill"` ou
  `<command-name>/`) ; puis `JSON.parse` de la seule ligne retenue, extraction de `input.skill` (outil `Skill`) ou du nom
  entre balises `command-name` ; horodatage de la ligne (`timestamp`) ; agrégat renvoyé au main ; rien d'écrit. Nom de
  plugin espacé (`vercel:deploy`) relié au skill de plugin correspondant.
- **Raison** : minimisation (constitution IV), fil principal libre.
- **Alternatives** : index persistant — inutile au volume constaté.
- **Amendement (2026-10-08, US2)** : lecture en flux **asynchrone dans le main** (`createReadStream` + `readline`)
  plutôt qu'un `worker_threads` : mesuré à 241 Mo / 89 fichiers sur 30 jours, la lecture asynchrone ne bloque pas la
  boucle d'événements, et un fil de travail exigerait un quatrième point d'entrée au build. Agrégat recalculé au plus
  une fois par heure ; commande comptée seulement sur une ligne `user`.

## R5 — Conversations Skills
- **Décision** : neurones cachés (`neurons.hidden`, migration 0030) : un neurone « Skills » unique et un par skill ouvert
  (clé = `skillId`), dossier de travail `<profil>/skills-workspace` (vide) ; `ConversationService` existant ; consigne
  dédiée (lire par `skills_lire`, écrire par `skill_brouillon` seulement). **Outils limités** (/speckit-analyze H1) :
  `Read`, `Glob`, `Grep` et les outils MCP `skills_lire` / `skill_brouillon` seulement — aucun outil d'écriture ni de
  commande, quel que soit le mode de permission choisi ailleurs (le mode « Libre » ne s'applique pas à ces
  conversations) ; test qui inspecte les arguments du CLI.
- **Raison** : réutilise conversations, permissions, historique ; Claude ne voit pas les dossiers de skills en écriture.

## R6 — Écriture atomique et versions
- **Décision** : pour chaque fichier, écriture dans `<fichier>.tmp-<id>` puis `rename` ; sauvegarde préalable de
  l'ensemble des fichiers texte connus du skill dans `<profil>/skill-versions/<skillId-sûr>/<horodatage>/` ; en cas
  d'échec en cours, restauration depuis cette sauvegarde ; 10 versions par skill.
- **Raison** : jamais de skill à moitié écrit (FR-019), retour arrière exact (SC-003).

## R7 — Contrôle d'URL et clone (spec 017 T028–T029)
- **Décision** : livrés ici, conformes à la spec 017 (US5) : `https://` et `git@` seulement, identifiants retirés,
  `ext::` / `file://` / `-…` / caractères de contrôle refusés ; `git clone --depth 1 --no-recurse-submodules
  -c core.hooksPath=<dossier vide> -- <url> <cible>`, `GIT_TERMINAL_PROMPT=0`, délai, annulation, nettoyage du seul
  dossier créé, échecs classés. La spec 017 US5 (import d'un projet par clone) en profitera ensuite (T030–T031 de 017).
- **Raison** : un seul clone contrôlé pour deux usages (constitution VI).

## R8 — Règles fixes d'audit
- **Décision** : motifs (insensibles à la casse) qui imposent au moins « à revoir » : téléchargement + exécution
  (`curl|wget|Invoke-WebRequest|iwr` suivis de `| sh|bash|iex|Invoke-Expression`), suppressions récursives
  (`rm -rf`, `Remove-Item -Recurse`, `del /s`), contenu encodé exécuté (`base64 -d |`, `FromBase64String`), consignes
  d'outrepassement (« ignore (all|previous|tes) (instructions|consignes) », « désactive les confirmations »,
  « sans demander »), accès à des secrets (`.ssh`, `id_rsa`, `.env`, `credentials`) ; « dangereux » si combinaison
  téléchargement + exécution ou exfiltration (envoi de fichiers vers une URL).
- **Raison** : filet indépendant de Claude ; une consigne cachée ne peut pas adoucir ces règles.

## R9 — Disposition de l'arbre
- **Décision** : fonction pure : tronc au centre ; branches = domaines triés par position (familles au lot A),
  angles répartis sur 360° ; le long d'une branche, rangées de 3 nœuds (208 × 104) perpendiculaires, espacement 200 px ;
  grappe de plugins = un nœud « N skills de plugins » tant qu'elle est repliée.
- **Raison** : image stable, sans chevauchement (test).

## Mesure SC-007 (T033, 2026-10-08)
- **Liens « appelle »** (150 skills fictifs) : ~1 s → **17 ms** après un pré-filtre (`includes` du nom avant les
  expressions régulières ligne à ligne : ~1,9 million d'essais évités) ; test permanent `skills-scale` (< 300 ms).
- **Inventaire** de la toile réelle (63 skills : 19 personnels, 44 de plugins) : **130 à 300 ms**. Sur 150 skills
  fictifs écrits juste avant : 0,4 à 3 s, variable, dominé par la première ouverture de fichiers neufs (analyse par
  l'antivirus) — non représentatif.
- **Rendu** : 3,1 s dans jsdom (borne haute, React Flow simulé) ; **dans Electron**, page Skills puis dépliage des
  296 skills disponibles du dépôt `affaan-m/ecc` : « rapide et fluide » (mentalyas). SC-007 tenu.

