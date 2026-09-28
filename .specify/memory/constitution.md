<!--
Sync Impact Report
- Version change: (template) → 1.0.0
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
- Secrets (clé API Claude, jetons Microsoft, clé de base) MUST être chiffrés via `safeStorage`/DPAPI,
  jamais dans le code, la base, les logs, le renderer ni le dépôt.
- Le dépôt est **public** : il MUST NOT contenir de données réelles, de secret ni d'adresse e-mail ;
  uniquement des exemples fictifs (`*.example.*`).
- Les logs MUST NOT contenir de contenu d'idée, de montant, de jeton ni de PII.
Rationale : l'app manipule des idées personnelles, des données financières et des accès à un compte
Microsoft, dans un dépôt visible de tous.

### II. Humain dans la boucle
- Aucune proposition de l'IA (décomposition, restructuration, suggestion, événement Outlook,
  réservation de budget) MUST être appliquée sans acceptation explicite de l'utilisateur.
- L'application d'une proposition MUST être atomique (transaction tout-ou-rien), historisée et annulable.
- Toute action destructive externe (suppression d'un événement Outlook) MUST être confirmée.
Rationale : une IA peut se tromper ; l'utilisateur reste maître de son agenda (décision L1, option A).

### III. IA cadrée et vérifiable
- Tout appel IA MUST passer par l'unique `AIGateway` (routage, contexte, budget, validation, journal) ;
  aucun appel direct à Ollama ou à l'API Anthropic ailleurs.
- Toute réponse IA MUST être validée par un schéma avant usage ; une réponse invalide est rejetée.
- L'agent MUST NOT inventer un prix, une date ou un montant : il demande, ou crée une tâche
  d'investigation. Les demandes hors périmètre sont refusées et recentrées.
- Le texte utilisateur MUST être transmis comme donnée délimitée, jamais comme instruction ; le cadre
  système est figé dans le code et ne peut pas être remplacé par un import de contexte.
- Le contexte importé (profil, règles, exemples) MUST passer par un aperçu validé par l'utilisateur,
  versionné et réversible.
Rationale : limiter hallucinations et injections de prompt, garder l'agent dans son rôle de secrétaire.

### IV. Local d'abord & minimisation des données
- Les données MUST rester sur la machine (SQLite chiffré dans `%APPDATA%/gestionnaire-idees/`).
- L'IA locale MUST traiter par défaut les tâches simples ; Claude n'est appelé que pour le raisonnement
  profond.
- Avant tout envoi à Claude, les données MUST être minimisées et anonymisées (alias, bandes de montants,
  noms de personnes retirés) ; en cas d'échec de l'anonymisation, rien n'est envoyé en brut.
- La capture d'une idée MUST fonctionner sans aucune IA disponible (aucune idée perdue).
- Le coût API MUST être journalisé et plafonné (plafond mensuel configurable, 10 € par défaut).
Rationale : confidentialité, fonctionnement hors ligne, maîtrise du coût.

### V. Qualité & tests
- TypeScript `strict: true` ; `any` interdit (utiliser `unknown` + type guards) ; types explicites sur les
  API publiques ; `interface` pour les contrats d'objets, `type` pour les unions.
- Toute logique métier (statuts, dépendances, cycles, routage IA, budget, anonymisation, tirage du
  compagnon) MUST être couverte par des tests unitaires rapides et déterministes, cas limites et chemins
  d'erreur inclus ; nommage `should_<comportement>_when_<condition>`.
- Les tests MUST NOT appeler de service externe réel (Claude, Ollama, Graph) : moteurs et clients mockés
  derrière leurs interfaces ; RNG injectable pour les tests.
- Pas de `console.log` de debug ni de `// TODO` sans issue.
Rationale : l'app est pilotée par des règles fines ; les régressions doivent être détectées sans coût.

### VI. Simplicité (YAGNI · DRY · KISS)
- Livraison incrémentale : **MVP-1** (F1 Capture, F2 Structuration, F3 Validation, F4 Organigramme,
  F9 Moteur IA) avant **MVP-2** (F5 Planning, F6 Outlook, F7 Conseiller, F8 Compagnon).
- Pas d'abstraction sans deuxième usage réel ; pas de fonctionnalité hors cahier des charges
  (`docs/FOUNDATION.md`) sans décision explicite.
- Les données déclaratives (arbre d'évolution, catégories, routage IA) vivent dans des fichiers de
  configuration validés, pas dans du code dupliqué.
Rationale : un projet solo en apprentissage ; la complexité doit être justifiée.

## Contraintes techniques

- **Stack** : Electron · React + TypeScript + Tailwind · React Flow · Zod · SQLite chiffré via
  **Drizzle ORM** + `better-sqlite3-multiple-ciphers` (exception validée au standard Prisma : moteur
  binaire non empaquetable proprement, SQLite chiffré non supporté) · Ollama · `@anthropic-ai/sdk`
  (modèle par défaut `claude-opus-5`, configurable) · Microsoft Graph + MSAL Node (autorité `consumers`,
  PKCE, scope `Calendars.ReadWrite` uniquement).
- **Architecture** : pas d'API HTTP ; le contrat est l'IPC renderer ↔ main, format uniforme
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

**Version**: 1.0.0 | **Ratified**: 2026-09-28 | **Last Amended**: 2026-09-28
