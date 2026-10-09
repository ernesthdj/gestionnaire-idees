# L1k — Accueil ProjectMaster : créer ou charger un projet dans l'app (idée, 2026-10-09)

> Brainstorm de niveau 1, mené dans la conversation du genesis « gestionnaire-idees » du Brainstormer. Les points
> listés en « Décisions » ont été validés par mentalyas. Ce qui reste ouvert est listé à la fin. Aucune spec n'est écrite :
> prochaine étape, `/speckit-specify` (spec 024 prévue).

## Demande de mentalyas (2026-10-09)

> « Il nous faut une nouvelle user story qui concerne un menu de chargement de brainstorms déjà exécutés, aussi une
> possibilité de sauvegarde de brainstorm sur un certain projet et ainsi retrouver la doc, les schémas, cartographies,
> etc. sur base de ce projet. Ensuite ce menu de départ nous demandera si on part sur un nouveau projet ou si on
> continue un projet existant et reprend en fait le workflow complet qu'on a configuré dans notre ProjectMaster
> (`pm.bat`). En résumé, on doit importer ProjectMaster dans un menu de cette app qui nous permet de créer ou charger
> un projet. »

## Point de départ : ce qui existe

### Le workflow ProjectMaster (hors de l'app)
- `ProjectsMaster/scripts/pm.bat` lance `scripts/launcher.sh` (Git Bash). Le lanceur lit `.hub/registry.json` (les
  projets) et `.hub/sessions.json` (la session active).
- Session restée ouverte : il propose de la reprendre, de la fermer (`/hub end` puis `/hub work`), ou de l'ignorer.
- Menu : la liste des projets (pastille actif / inactif, nom, description, branche), plus « N. Nouveau projet » et « Q. Quitter ».
- **Nouveau projet** : nom, description, type (7 choix), visibilité GitHub, confirmation, puis
  `claude "/hub new <nom> --desc … --type … --visibility …"`. Le skill `/hub new` valide le slug et crée la structure
  (`CLAUDE.md`, `docs/JOURNAL.md`, `src/`, `tests/`). Il fait ensuite `git init`, le premier commit et `gh repo create`
  (après confirmation), le premier graphe graphify, l'entrée du registre et le journal global. Puis vient `/brainstorm`.
- **Projet existant** : `cd`, `git fetch`, `git status`, `git pull` si en retard, un résumé, puis
  `claude "/hub work <slug>"` (anomalies, synchro git, résumé actionnable, prochaine tâche, ouverture de session).
- **Fin de session** `/hub end` : état des lieux, commit, push, journal du projet, journal global, graphify
  incrémental, cours académique (si actif), fermeture de la session.

### Dans l'app
- `HubRegistry` lit et réécrit `.hub/registry.json` de façon atomique (spec 016).
- « Faire de ce genesis un projet » crée le dossier d'un projet (spec 016).
- Import d'un projet existant, analyse statique (spec 017).
- Vue Workflow lue dans `specs/`, `tasks.md` et `docs/brainstorm/` d'un projet lié (spec 023).
- Git et GitHub dans l'app (spec 021) : spécifiés, pas codés.
- Aujourd'hui, tous les genesis vivent sur **une seule carte**. Le seul projet réel de l'app est le Brainstormer
  lui-même, rattaché à son dossier.

## Décisions (validées par mentalyas, 2026-10-09)

### 1. Un projet par canevas
- Charger un projet ouvre **sa** carte : son genesis, ses brainstorms, sa doc, ses schémas, sa structure (Progression,
  Architecture) et sa vue Workflow. On retrouve tout « sur base de ce projet ».
- La gestion multi-projets sur une même carte est **reportée** : elle risque le chaos. Ce sera pour plus tard.

### 2. Le genesis change de rôle
- Le genesis redevient **le nœud de départ d'une idée**, plus un conteneur de projet. C'est **le canevas qui porte le
  projet**.

### 3. Pas de brainstorm hors projet
- Brainstormer demande un dossier de projet : **une idée est travaillée d'office dans un environnement de projet**.
  Il n'y a plus de genesis « libre » sans dossier.
- Le choix porte plutôt sur le dépôt : **GitHub, ou local seulement**.

### 4. Le workflow ProjectMaster est gardé tel quel
- On n'invente pas un autre workflow : l'app devient **l'interface visuelle** de celui de ProjectMaster. Elle pilote
  les commandes `/hub new`, `/hub work`, `/hub end`, puis `/brainstorm`, au lieu de les réimplémenter. Les skills
  restent la source unique, et `pm.bat` comme l'app restent d'accord.
- Les opérations git restent sur un clic de mentalyas (constitution 4.4).

### 5. Nouveau projet : un formulaire, comme pm.bat
- Champs : **nom**, **description**, **type** (gardé), **GitHub oui / non**, et si oui la **visibilité** (public /
  privé).
- Claude part du nom et de la description pour **cibler les questions du brainstorm** qui suit.
- Un projet peut rester **local** (sans `gh repo create`). Aujourd'hui, le skill `/hub new` crée toujours le dépôt
  GitHub : il devra accepter ce choix, ce qui profite aussi à `pm.bat`.

### 6. Continuer un projet
- L'accueil liste les projets comme `pm.bat` : pastille d'état, nom, description, branche, dernière session.
- Une session restée ouverte est signalée, et l'accueil propose de la reprendre.
- Ouvrir un projet charge son canevas et suit `/hub work` (synchro git, résumé, prochaine tâche).

### 7. Fin de session éclatée
- `/hub end` n'est plus un bloc : ses étapes deviennent des **boutons et des exécutions séparées**, déclenchés à la main.
- Avant d'exécuter, des **cases à cocher** choisissent les étapes : commit, push, journal du projet, journal global,
  graphify, cours académique, fermeture de la session. Mentalyas décide notamment de faire ou non graphify.
- L'app **garde plus de choses en mémoire** qu'un CLI (état de la session, historique, ce qui a changé) : elle s'en
  sert au lieu de tout redemander.

### 8. Le coffre : un seul environnement structuré
- Le dossier **ProjectsMaster** devient le **coffre** (vault) du Brainstormer. Tous les projets, brainstorms et docs y
  sont rangés, ce qui donne au Brainstormer un seul environnement structuré.
- Chez mentalyas, c'est le dossier ProjectsMaster actuel. Le projet du Brainstormer
  (`projects/gestionnaire-idees`) sert de **projet de test**.
- Un utilisateur qui part de zéro **définit (ou crée) son ProjectMaster** au premier lancement. Ensuite, tous ses
  projets s'y rangent.

## Contraintes repérées

- **Mode de conversation.** Les conversations du chat sont volontairement verrouillées
  (`ConversationService.ts` : `--setting-sources ""`, outils restreints, permissions par le pont). Or `/hub` et
  `/brainstorm` ont besoin de Bash (git, `gh`, graphify en Python) et des skills utilisateur, dont le chargement dans
  ce mode reste à vérifier. Piloter `/hub` demandera un **mode de conversation dédié**, limité au coffre, avec les
  permissions qui passent par mentalyas. C'est probablement un amendement de la constitution.
- **Données actuelles.** La carte unique d'aujourd'hui doit devenir une carte par projet. Le seul projet réel est le
  Brainstormer (déjà rattaché à son dossier), ce qui simplifie la migration.
- **Recoupements.** Le clone d'un projet (spec 017 US5, `CloneService`) et « Cloner par lien » (spec 021 US3) touchent
  aussi « continuer un projet » : à réconcilier dans la spec.

## Questions ouvertes (à trancher dans la spec)

1. Quel mode de conversation pilote `/hub` et `/brainstorm` (outils, confinement au coffre, amendement de la
   constitution) ?
2. Que crée l'app dans un coffre vide au premier lancement : `.hub/registry.json`, `sessions.json`, `projects/`,
   `docs/JOURNAL.md`, les skills `/hub` et `/brainstorm` ?
3. Quelle mémoire de session tient l'app, et quel est son rapport avec `.hub/sessions.json` (que `pm.bat` lit aussi) ?
4. Comment `/hub new` accepte-t-il le choix « local seulement » (option du skill) ?
5. Où se range ce qui vivait sur la carte unique (fiches, liens libres, widgets) quand chaque projet a son canevas ?

## Suite

1. `/speckit-specify` : spec 024 « Accueil ProjectMaster », à partir de ce document.
2. La coder **après** avoir fermé une partie des chantiers ouverts (019, 022, 023, 017, 013), car la 024 touche au
   cœur de l'app (un projet par canevas, le rôle du genesis).
