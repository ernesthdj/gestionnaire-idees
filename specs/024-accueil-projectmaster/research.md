# Research — Accueil ProjectMaster (spec 024)

> Phase 0. Chaque point : décision, raison, alternatives. Points d'appui vérifiés dans le code le 2026-10-09 :
> `ProjectService.create` + `scaffoldFiles` + réglage `projectsRoot` (spec 016), `HubRegistry` (écriture atomique),
> `CloneService` profil « historique » (spec 017 / 021 R6), table `settings`, `change_log` (Historique), une seule carte
> (`canvasRoots()` = tous les genesis), `uiStore.structureViews` en mémoire, `scripts/launcher.sh` (`pm.bat`) qui lit
> `folder` dans le registre et construit `projects/<folder>`.

## R1 — Un canevas par brainstorm : à qui appartient chaque objet
- **Decision** : nouvelle table `brainstorms` (un par projet travaillé dans l'app). Colonne `brainstorm_id` ajoutée à
  `neurons` (renseignée sur les genesis ; leurs descendants suivent par `root_id`) et à `canvas_blocks` (notes, cadres,
  widgets, résultats). Un lien libre (`map_links`) appartient au brainstorm de ses extrémités. `CanvasService` ne lit plus
  « tous les genesis » mais ceux du **brainstorm actif** ; tout ce qui crée un genesis ou un bloc reçoit ce brainstorm.
- **Rationale** : la plus petite coupure qui isole un canevas sans toucher aux ~40 tables qui pendent des neurones.
- **Alternatives** : une base SQLite par projet (isolation parfaite, mais migrations × N, chiffrement × N, recherche
  globale impossible : rejeté) ; une colonne sur chaque table (lourd, redondant avec `root_id` : rejeté).

## R2 — Reprise exacte et sauvegarde continue
- **Decision** : le contenu est **déjà** enregistré à chaque geste (SQLite, transactions) ; ce qui manque est l'**état
  de vue**, aujourd'hui en mémoire : vue de chaque genesis (Workflow / Progression / Architecture), position et zoom de
  la carte, cartes ouvertes (position, volet), genesis dont on travaille la conversation. Il est enregistré dans
  `brainstorms.view_state_json` (schéma Zod, borné), **écrit en différé** (500 ms après le dernier changement, et à la
  fermeture du brainstorm ou de l'app), relu à l'ouverture.
- **Rationale** : FR-003 et FR-005 ; une écriture différée évite d'écrire à chaque image d'un glissement.
- **Alternatives** : bouton « Sauvegarder » (rejeté par mentalyas, D7) ; état de vue dans `localStorage` du renderer
  (perdu au reset du profil, non lié au brainstorm, hors base chiffrée : rejeté).

## R3 — Points de sauvegarde
- **Decision** : table `save_points` (brainstorm, nom, date, `snapshot_json` compressé en gzip, taille). L'instantané
  contient le **canevas seulement** : genesis et descendants du brainstorm (`neurons`, sans les messages), `canvas_blocks`,
  `map_links`, et l'état de vue. **Revenir à un point** : l'app pose d'abord un point caché « avant retour à … », puis
  remplace le canevas en une transaction ; **annuler** = revenir à ce point caché. Les conversations (`neuron_messages`,
  sessions Claude) et les fichiers du projet ne sont jamais touchés ; un nœud qui revient retrouve sa conversation (même
  identifiant). Borne : 50 points par brainstorm, 20 Mo par instantané (au-delà, refus avec message).
- **Rationale** : un retour « tout ou rien » est fiable et testable (SC-003) ; rejouer l'Historique entité par entité
  sur des centaines de lignes serait fragile.
- **Alternatives** : points = marques dans `change_log` et annulation jusqu'à la marque (dépend de l'annulabilité de
  chaque action passée, inégale selon les specs : rejeté) ; copie de la base entière (trop lourd, mélange les projets).

## R4 — Le Project Manager au démarrage
- **Decision** : nouvelle section renderer `home` ; au démarrage, `AppShell` l'affiche tant qu'aucun brainstorm n'est
  actif (et la propose dans la navigation : « Projets »). Le brainstorm actif est un état du main (`brainstorms:active`),
  mémorisé dans `settings` (`brainstorm.last`) pour proposer « Reprendre <nom> » en tête de liste. La capture rapide
  (raccourci global) range une idée dans le brainstorm actif, ou dans « Idées en vrac » s'il n'y en a pas.
- **Alternatives** : fenêtre séparée pour l'accueil (deux fenêtres à synchroniser : rejeté).

## R5 — Le coffre et les fichiers `.hub`
- **Decision** : le coffre = le dossier parent du réglage `projectsRoot` existant (spec 016) quand il contient
  `.hub/registry.json` ; sinon US7 le fait choisir ou créer. `HubRegistry` (existant) pour le registre ; nouvelle classe
  `HubSessions` pour `.hub/sessions.json` (même écriture atomique, relecture avant écriture, jamais sur un JSON
  illisible). Les entrées existantes ne sont jamais réécrites hors des champs touchés.
- **Rationale** : `pm.bat` et le skill `/hub` restent la référence (D4).
- **Alternatives** : copie des projets dans la base de l'app (deux vérités : rejeté).

## R6 — Projets externes dans le registre (compatibilité `pm.bat`)
- **Decision** : une entrée externe porte `"external": true` et `"path"` (chemin absolu), sans `folder`. Le lanceur
  `scripts/launcher.sh` (hors de ce dépôt) doit utiliser `path` quand il existe ; la modification est **proposée à
  mentalyas** (avec celle du skill `/hub`, FR-017) et appliquée avec son accord. Tant qu'elle ne l'est pas, l'app écrit
  les références externes dans `.hub/external.json` (fichier que `pm.bat` ignore) et les liste quand même.
- **Rationale** : la clarification « référence au registre » sans casser `pm.bat`, qui construit `projects/<folder>`.
- **Alternatives** : toujours `.hub/external.json` (simple, mais `pm.bat` ne verrait jamais ces projets).

## R7 — Le vault `.brainstormer/` d'un projet en chantier
- **Decision** : `.brainstormer/brainstorm.json` (version, identifiant du brainstorm, nom, rôle git, branche de
  travail, date de création) et `.brainstormer/sessions.json` (sessions de ce projet, même forme que `.hub`). Les points
  de sauvegarde et le contenu de la carte restent dans la base chiffrée (constitution IV). Ligne `.brainstormer/` ajoutée
  au `.gitignore` (créé s'il manque), après confirmation. Lecture revalidée par Zod ; un vault inconnu ou abîmé est
  signalé, jamais réécrit sans accord. Le vault permet de **reconnaître** un projet déplacé (« Relier »).
- **Alternatives** : tout le canevas dans le vault (en clair : rejeté par mentalyas, constitution IV).

## R8 — Rôle git d'un projet en chantier
- **Decision** : à la première ouverture, choix « Collaborateur (ma branche) » / « Mon propre dépôt » / (sans dépôt)
  « Créer un dépôt ». Collaborateur : nom de branche proposé `<prenom-ou-pseudo>/brainstorm` (modifiable), créée ou
  reprise par `git switch` ; garde **dans l'app** : tout push de ce projet vise cette branche, jamais la branche par
  défaut du distant (refus avant lancement). Les opérations (switch, commit, push, PR) sont celles de la **spec 021**
  (`GitRunner`, lots A et B) : la 024 ne crée pas un second exécuteur git. `git init` réutilise `ProjectService.initGit`.
- **Rationale** : constitution II (« Dépôt ») et spec 021 H : une seule porte vers git.
- **Alternatives** : exécuteur git propre à la 024 (doublon, deux jeux de garde-fous : rejeté).

## R9 — Les étapes de `/hub` faites par l'app
- **Decision** : `HubWork` (ouverture) : session mal fermée (lue dans `.hub/sessions.json` ou le vault), `git status
  --porcelain`, commits non poussés, distant en avance (`git fetch` **sur clic** « Vérifier le distant », pas en fond,
  spec 021 H), dernières entrées du JOURNAL, issues (`gh issue list` si GitHub, facultatif), prochaine tâche (vue
  Workflow, spec 023 : première tâche restante d'une spec en cours). `HubEnd` (fin de session) : étapes séparées —
  commit et push (spec 021), entrées de JOURNAL projet et global (écrites par l'app, texte proposé par Claude et
  modifiable), **graphe** et **cours académique** confiés à la **conversation du projet** avec une consigne pré-remplie
  (`/graphify . --update`, `/professor parcours --auto`), lancée sur clic dans le mode de permission choisi (spec 014) :
  ce sont des skills de Claude, pas des actions de l'app ; fermeture de session (fichiers de session et registre).
- **Rationale** : FR-015 (pas de nouveau mode de conversation) ; l'app ne lance ni Python ni graphify elle-même.
- **Alternatives** : lancer graphify (Python) depuis le main (nouveau programme, nouvelle surface : rejeté).

## R10 — Passage de la carte unique aux brainstorms
- **Decision** : au premier démarrage après la migration (marqueur `migration.brainstorms` dans `settings`) : un
  brainstorm `gestionnaire-idees` reçoit le(s) genesis dont `project_dir` est ce dépôt ; un brainstorm local « Idées en
  vrac » (dossier `projects/idees-en-vrac` créé dans le coffre avec la structure minimale, registre mis à jour) reçoit
  tout le reste (genesis sans dossier, blocs, liens). Chaque autre genesis lié à un dossier devient son propre
  brainstorm (externe ou dans le coffre selon son chemin). Inventaire avant / après journalisé (SC-008). Annulable par la
  migration `down` (colonnes et tables retirées : tout redevient une seule carte).
- **Alternatives** : tout dans « Idées en vrac » (perd le rattachement existant : rejeté).

## R11 — Ordre de réalisation et spec 021
- **Decision** : lots 0 à 4 et 6 (sans les parties git distantes) d'abord ; **le rôle collaborateur (US4), la fin de
  session (US6, commit/push) et l'extraction (US5) attendent les lots A–B (et G pour l'extraction) de la spec 021**.
  B3 « depuis un lien » est faisable dès maintenant avec `CloneService` (profil historique).
- **Alternatives** : coder la 021 en entier avant la 024 (retarde l'accueil, qui ne dépend de git que pour une partie).
