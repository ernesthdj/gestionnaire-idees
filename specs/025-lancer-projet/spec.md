# Feature Specification: Lancer un projet (spec 025)

**Feature Branch**: `main` · **Created**: 2026-10-10 · **Status**: Livrée
**Input**: « Je veux un bouton ou la possibilité de lancer un npm run dev ou une exécution de projet avec un raccourci
direct depuis l'app. » — mentalyas, 2026-10-10. Constitution 4.6.0 (amendée pour cette spec).

## Décisions (2026-10-10, validées par mentalyas)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Affichage | **Panneau de sortie dans l'app** (bas de l'écran) : sortie en direct, « Arrêter », « Relancer » ; plusieurs projets peuvent tourner, un onglet chacun. Pas de saisie interactive. |
| D2 | Commandes | **Scripts du `package.json`** du projet (dev, build, test…) ; un **script favori** par projet, lancé d'un clic ou au raccourci. Projets non Node : plus tard. |
| D3 | Sécurité | **Projets de confiance seulement** (spec 014). Un projet cloné n'est jamais lancé tant que mentalyas ne lui a pas fait confiance. La confiance devient réglable dans l'app (elle n'avait pas d'écran) : « Faire confiance à ce projet », confirmé, qui dit ce que ça permet (scripts lancés d'un clic, hooks git exécutés) ; retirable. |
| D4 | Exécution | `node` + `npm-cli.js` résolus par chemin absolu, `run <script>`, sans shell, dans le dossier du projet ; nom de script revalidé contre le `package.json` relu au moment du lancement ; un seul processus par projet et par script ; processus et enfants arrêtés sur « Arrêter » et à la fermeture de l'app. Sortie bornée (dernières 2 000 lignes), couleurs ANSI retirées à l'affichage. |
| D5 | Raccourci | **F5** : lance le script favori du projet du brainstorm ouvert (s'il tourne déjà, l'app le dit et montre son onglet ; « Relancer » est dans le panneau) ; **Maj+F5** : l'arrête. |
| D6 | Ouvrir dans le navigateur (2026-10-10, demande de mentalyas) | Quand la sortie d'un lancement en cours annonce une **adresse locale** (`localhost`, `127.0.0.1`, `0.0.0.0` → `localhost`, `[::1]`, avec port et chemin), le panneau propose **« 🌐 Ouvrir <adresse> »** (la première annoncée). Le main n'ouvre le navigateur par défaut (`shell.openExternal`) que pour une adresse locale **présente dans la sortie de ce lancement** ; jamais une adresse distante ni une adresse donnée par l'interface seule. |

## User Stories

### US1 — Lancer mon projet d'un clic (P1)
Sur la carte, la barre du projet porte « ▶ dev » (son script favori) et la liste de ses scripts ; un clic lance le
script, le panneau de sortie s'ouvre et montre la sortie en direct ; « Arrêter » l'arrête.

**Scénarios**
1. Projet de confiance avec un `package.json` → « ▶ <favori> » lance `npm run <favori>` ; la sortie s'affiche.
2. Projet non de confiance → bouton désactivé, explication et « Faire confiance à ce projet… ».
3. Script absent du `package.json` relu au lancement → refus clair, rien n'est lancé.
4. « Arrêter » → le processus et ses enfants s'arrêtent ; l'onglet dit « arrêté ».
5. Fermer l'app → tout ce qui tourne est arrêté.

### US2 — Raccourci (P2)
F5 lance le favori du projet ouvert (s'il tourne déjà, l'app le dit) ; Maj+F5 l'arrête.

## Exigences
- FR-001 Scripts lus dans `package.json` (Zod, noms `^[A-Za-z0-9:._-]{1,100}$`, 50 au plus), jamais exécutés hors clic.
- FR-002 Lancement refusé hors projet de confiance (`NOT_TRUSTED`), sans `package.json` (`NO_PACKAGE`), script inconnu
  (`UNKNOWN_SCRIPT`), npm introuvable (`NPM_MISSING`), déjà en cours (`ALREADY_RUNNING`).
- FR-003 Sortie diffusée au renderer par lots, bornée ; aucune sortie journalisée.
- FR-004 Confiance : `project:trust { genesisId, trusted, confirm: true }` ; état lu par `run:scripts`.
- FR-005 Tests : purs (lecture des scripts), intégration (vrai `npm run` sur un projet fictif : sortie, arrêt, refus),
  renderer + axe, e2e.
