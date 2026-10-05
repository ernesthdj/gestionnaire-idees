<!--
Sync Impact Report
- Version change: 2.0.0 → 3.0.0 (2026-10-05, spec 010 FR-008 — bascule validée par mentalyas)
- Modified principles: I (plus de clé API Claude), III (plus de suggestion sourcée du web : la recherche web est
  retirée), IV (l'IA locale ne fait plus que les tâches de fond ; aucun SDK ni API Anthropic ; plus de recherche web),
  V (logique à tester : conversion, verrous, dépendances — plus de budget ni d'anonymisation)
- Removed: toute mention du plafond de dépense, de l'anonymisation, de `@anthropic-ai/sdk` et de la recherche web
- Motif : un seul moteur (conversations `claude -p` et pont MCP) ; l'ancien moteur de neurones est retiré (spec 010)
- Impact : specs 001–003 et 006 historiques (leurs exigences retirées ne s'appliquent plus) ; spec 011 conforme
- Historique : 1.2.0 → 2.0.0 (2026-10-04, arbitrages validés par mentalyas — FOUNDATION §00, L1c)
- Modified principles: I (secret : jeton MCP au lieu de la clé API ; canal MCP authentifié), II (écritures de Claude
  par MCP : directes, marquées, annulables), III (cadre de l'IA et refus hors périmètre supprimés ; validation par
  schéma conservée ; code de widget aussi écrit par Claude Code via MCP), IV (anonymisation et plafond en euros
  supprimés ; Claude uniquement via le CLI officiel), VI (lots du Pont Claude Code)
- Motif : le Brainstormer devient l'interface visuelle de Claude Code ; suppression de l'API Anthropic (coût)
- Impact : spec 001 (anonymisation, budget), 002 (cadre, `out_of_scope`), 004/006 (génération de widget), specs 007+
- Historique : 1.1.0 → 1.2.0 (2026-09-29, validé par mentalyas)
- Modified principles: III (exception unique au refus de produire du code : tâche `widget`, bac à sable)
- Motif : mini-widgets générés par Claude sur la carte (FOUNDATION §0.3, spec 004)
- Impact : spec 004 (cadre système `WidgetFrame`, protocole isolé `gi-widget://`), spec 005 (capacités)
- Historique : 1.0.0 → 1.1.0 (2026-09-28, validé par mentalyas)
- Modified principles: III (suggestions de valeurs par l'IA, sourcées et soumises à acceptation),
  IV (montants exacts par défaut, masquage en fourchettes devenu un réglage)
- Motif : calculs sur montants exacts ; suggestions d'approfondissement (neurones fantômes, recherche web)
- Impact : spec 001 FR-006/SC-002, spec 002 (user story Suggestions), spec 003 (neurones fantômes)
- Historique : (template) → 1.0.0
- Modified principles: n/a (première ratification)
- Added sections: Core Principles I–VI, Contraintes techniques, Workflow de développement, Governance
- Removed sections: aucune
- Templates requiring updates: aucun (plan/spec/tasks lisent la constitution à l'exécution) ✅
- Deferred TODOs: aucun
- Sources : ~/.claude/CLAUDE.md (standards globaux mentalyas), CLAUDE.md du projet, docs/FOUNDATION.md
-->

# Gestionnaire_idées Constitution

## Core Principles

### I. Sécurité d'abord (NON NÉGOCIABLE)
- Le code MUST respecter l'OWASP Top 10 ; aucune injection SQL, XSS ou commande non assainie.
- Electron MUST être durci : `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP
  stricte, API `contextBridge` minimale ; **chaque** payload IPC MUST être validé par un schéma Zod
  dans le processus principal.
- Secrets (jeton du canal MCP, jetons Microsoft, clé de base) MUST être chiffrés via `safeStorage`/DPAPI,
  jamais dans le code, la base, les logs, le renderer ni le dépôt.
- Le dépôt est **public** : il MUST NOT contenir de données réelles, de secret ni d'adresse e-mail ;
  uniquement des exemples fictifs (`*.example.*`).
- Les logs MUST NOT contenir de contenu d'idée, de montant, de jeton ni de PII.
- Le seul point d'entrée externe de l'app est le **canal MCP** : canal nommé local (aucun port réseau),
  authentifié par jeton (comparaison à temps constant), entrées validées par Zod, bornées, tout-ou-rien.
- L'app ne lance aucun programme choisi par le renderer : seul le CLI `claude`, résolu par le main, avec des
  arguments fixes, sans interpréteur intermédiaire ; les données passent par stdin, jamais en argument.
Rationale : l'app manipule des idées personnelles, des données financières et des accès à un compte
Microsoft, dans un dépôt visible de tous.

### II. Humain dans la boucle
- Aucune proposition de l'IA (décomposition, restructuration, suggestion, événement Outlook,
  réservation de budget) MUST être appliquée sans acceptation explicite de l'utilisateur.
- L'application d'une proposition MUST être atomique (transaction tout-ou-rien), historisée et annulable.
- Toute action destructive externe (suppression d'un événement Outlook) MUST être confirmée.
- Exception : les écritures de Claude Code **par le canal MCP** sont appliquées directement, sans validation
  préalable, MUST être marquées « par Claude » (origine `claude`), historisées en une opération par appel
  d'outil et annulables ; elles MUST NOT supprimer définitivement (archivage seulement).
Rationale : une IA peut se tromper ; l'utilisateur reste maître de ses données — par validation préalable
pour les propositions de l'app, par annulation pour le travail conversationnel avec Claude Code (L1c n°1).

### III. IA cadrée et vérifiable
- Tout appel IA **lancé par l'app** MUST passer par l'unique `AIGateway` (routage, contexte, validation,
  journal) ; aucun appel direct à Ollama ou au CLI `claude` ailleurs.
- Toute réponse IA MUST être validée par un schéma avant usage ; une réponse invalide est rejetée.
- Une tâche automatique de l'app MUST NOT écrire d'elle-même un prix, une date ou un montant dans les
  données. En conversation par MCP, Claude écrit ce que mentalyas lui demande (II, exception) ; ce qui
  structure le travail de mentalyas (couche de sous-nœuds, verrou) reste une proposition à accepter (II).
- Aucun rôle imposé ni refus « hors périmètre » : la consigne de chaque tâche décrit seulement ce qu'elle
  produit (cadre supprimé, L1c n°6).
- Le texte utilisateur MUST être transmis comme donnée délimitée, jamais comme instruction ; les consignes
  de tâche sont figées dans le code et ne peuvent pas être remplacées par un import de contexte.
- Le contexte importé (profil, règles, exemples) MUST passer par un aperçu validé par l'utilisateur,
  versionné et réversible.
- Code de widget (tâche `widget`, ou écrit par Claude Code et posé par l'outil MCP `widget_poser`) : format
  figé (fichier unique HTML/CSS/TypeScript effaçable, aucune ressource externe, aucune API de l'app hors
  pont de capacités). Le code généré MUST s'exécuter uniquement dans le bac à sable `gi-widget://`
  (iframe sans `allow-same-origin`, CSP sans réseau, requêtes sortantes filtrées) ; il n'est jamais évalué
  ni injecté dans l'app. Un widget sans capacité peut s'exécuter sans revue préalable ; toute demande de
  capacité MUST imposer la revue du code et des capacités avant exécution.
Rationale : limiter hallucinations et injections de prompt ; les garde-fous sont techniques (schémas, bac à
sable, annulation), pas un rôle imposé à l'IA.

### IV. Local d'abord & minimisation des données
- Les données MUST rester sur la machine (SQLite chiffré dans `%APPDATA%/gestionnaire-idees/`).
- L'IA locale (Ollama) fait les tâches de fond (catégorisation d'une idée capturée) ; le raisonnement passe
  par Claude.
- Claude est joint **uniquement par le CLI officiel `claude`** de mentalyas (abonnement), jamais par l'API
  Anthropic ni un SDK ; les tâches automatiques (`claude -p`) tournent sans outil, sans serveur MCP et sans
  réglage utilisateur. Pas d'anonymisation sur ce chemin (L1c n°2) ; les données sont minimisées (seul le
  nécessaire à la tâche).
- La capture d'une idée MUST fonctionner sans aucune IA disponible (aucune idée perdue).
- L'usage de Claude MUST être journalisé (tâche, durée, statut, modèle — jamais le contenu).
Rationale : confidentialité, fonctionnement hors ligne, coût nul hors abonnement.

### V. Qualité & tests
- TypeScript `strict: true` ; `any` interdit (utiliser `unknown` + type guards) ; types explicites sur les
  API publiques ; `interface` pour les contrats d'objets, `type` pour les unions.
- Toute logique métier (statuts, dépendances, cycles, verrous, routage IA, conversion de données, disposition
  de la carte, tirage du compagnon) MUST être couverte par des tests unitaires rapides et déterministes, cas limites et chemins
  d'erreur inclus ; nommage `should_<comportement>_when_<condition>`.
- Les tests MUST NOT appeler de service externe réel (Claude, Ollama, Graph) : moteurs et clients mockés
  derrière leurs interfaces ; RNG injectable pour les tests.
- Pas de `console.log` de debug ni de `// TODO` sans issue.
Rationale : l'app est pilotée par des règles fines ; les régressions doivent être détectées sans coût.

### VI. Simplicité (YAGNI · DRY · KISS)
- Livraison incrémentale : après le MVP-1 et les widgets (specs 001–006), le **Pont Claude Code** prime
  (FOUNDATION §00) : lot 1 F10 Pont MCP, lot 2 F11 Moteur CLI, lot 3 F12 Terminal & espaces + F13 skill,
  lot 4 F14 Recettes ; MVP-2 (F5–F8) devient des recettes ou vues, à replanifier.
- Pas d'abstraction sans deuxième usage réel ; pas de fonctionnalité hors cahier des charges
  (`docs/FOUNDATION.md`) sans décision explicite.
- Les données déclaratives (arbre d'évolution, catégories, routage IA) vivent dans des fichiers de
  configuration validés, pas dans du code dupliqué.
Rationale : un projet solo en apprentissage ; la complexité doit être justifiée.

## Contraintes techniques

- **Stack** : Electron · React + TypeScript + Tailwind · React Flow · Zod · SQLite chiffré via
  **Drizzle ORM** + `better-sqlite3-multiple-ciphers` (exception validée au standard Prisma : moteur
  binaire non empaquetable proprement, SQLite chiffré non supporté) · Ollama · CLI Claude Code (`claude -p`,
  modèles configurables par usage ; aucun SDK Anthropic) · `@modelcontextprotocol/sdk` · `@xterm/xterm` +
  `node-pty` (lot 3) · Microsoft Graph + MSAL Node (autorité `consumers`,
  PKCE, scope `Calendars.ReadWrite` uniquement).
- **Architecture** : pas d'API HTTP ni de port réseau (le canal MCP est un canal nommé local) ; le contrat est l'IPC renderer ↔ main, format uniforme
  `{ success, data } | { success: false, error: { code, message } }`. Le renderer n'accède jamais
  directement à la base, au disque ni au réseau.
- **Données** : requêtes typées et paramétrées uniquement ; migrations versionnées avec `down` ;
  montants en centimes (entiers) ; dates ISO avec fuseau `Europe/Brussels` explicite.
- **UX** : WCAG AA, 100 % utilisable au clavier, dark/light, grille 8 px, 1 CTA par écran, feedback
  < 200 ms, widget de capture affiché en < 200 ms.
- **Cible** : Windows, mono-utilisateur, démarrage avec Windows + icône de zone de notification.

## Workflow de développement

- Lire le code existant avant de le modifier ; plan présenté pour toute tâche touchant 3+ fichiers ou
  une décision d'architecture.
- **Aucun commit, push ou PR sans confirmation explicite de mentalyas** ; Conventional Commits
  (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `security`, `perf`) ; commits atomiques, fichiers
  nommés explicitement ; jamais de `--no-verify`, jamais de `--force` sur `main` ; pas de co-auteur.
- Toute nouvelle dépendance MUST être annoncée et justifiée avant installation.
- `docs/JOURNAL.md` est alimenté après chaque modification significative ; le suivi académique
  (`docs/academique/`) est mis à jour à chaque `/hub end`.
- Toute modification de CI/CD ou de packaging est proposée en brouillon et revue avant adoption.

## Governance

- Cette constitution prime sur les autres pratiques du projet ; en cas de conflit avec le CLAUDE.md
  global, la règle la plus stricte en matière de sécurité s'applique.
- Amendement : proposition écrite (motif + impact), validation par mentalyas, mise à jour de la version
  et du Sync Impact Report ; les specs/plans en cours sont revus pour conformité.
- Versionnage sémantique : MAJOR = retrait/redéfinition d'un principe ; MINOR = principe ou section
  ajouté(e) ou élargi(e) ; PATCH = clarification.
- Chaque plan (`/speckit-plan`) MUST inclure une vérification de conformité aux principes I à VI ;
  toute complexité supplémentaire MUST être justifiée dans le plan.
- Référence de travail au quotidien : `CLAUDE.md` du projet et `docs/FOUNDATION.md`.

**Version**: 3.0.0 | **Ratified**: 2026-09-28 | **Last Amended**: 2026-10-05
