# Règles de développement — Brainstormer

> Règles de travail de Claude Code sur ce dépôt, pour tout contributeur. Elles viennent des règles personnelles du
> propriétaire du projet (mentalyas), réduites à ce qui sert ce dépôt. Les règles du projet (`CLAUDE.md`) et la
> constitution (`.specify/memory/constitution.md`) les complètent et priment en cas d'écart.

## Principes
1. **Sécurité d'abord** : aucun code n'est acceptable s'il introduit une vulnérabilité.
2. **Structure claire** : chaque tâche suit un plan, chaque décision est traçable (spec, JOURNAL).
3. **Qualité durable** : code lisible, maintenable, testé. Pas de raccourcis.

## Communication
- Réponses **structurées en étapes numérotées** pour toute tâche non triviale ; **checklists** pour le multi-étapes.
- **Direct et précis**, sans phrase d'introduction inutile ; **expliquer les choix techniques** importants.
- Proposer des **alternatives** quand plusieurs options sont valables.
- **Abréviations** : à la première utilisation, nom complet + explication entre parenthèses.
  Ex. : *IPC (Inter-Process Communication — échanges entre le processus principal d'Electron et l'interface)*.

## Avant de coder
- Lire le code existant avant de proposer une modification ; suivre ses conventions (nommage, densité de
  commentaires, idiomes).
- Poser des questions si les exigences sont ambiguës.
- Présenter un plan pour toute tâche complexe (3 fichiers ou plus, ou décision d'architecture).

## Sécurité — priorité absolue
- Appliquer **OWASP Top 10** (référentiel des 10 risques majeurs des applications web).
- Interdits : injection SQL, XSS (Cross-Site Scripting), CSRF (Cross-Site Request Forgery), secrets dans le code,
  commandes non assainies (jamais de shell : `spawn` avec `shell: false`, arguments fixes, programme par chemin absolu).
- Valider les entrées **aux frontières** : IPC (Zod), fichiers, sorties de Claude.
- Ne jamais journaliser de données sensibles (jetons, mots de passe, données personnelles).
- Signaler immédiatement toute vulnérabilité détectée.
- **Dépôt public** : aucune donnée réelle, aucun secret, aucune adresse e-mail, aucun chemin personnel.

## Git
- **Jamais de commit, de push ni de PR sans confirmation explicite.**
- Format **Conventional Commits** : `<type>(<scope>): <description courte>` ; types `feat` · `fix` · `refactor` ·
  `chore` · `docs` · `test` · `security` · `perf` ; scope de ce dépôt : `gestionnaire-idees`.
- Commits atomiques ; fichiers ajoutés **nommément** (jamais `git add -A` sans revue).
- Jamais `--force` sur `main`, jamais `--no-verify`, jamais de ligne `Co-Authored-By`.

## Standards de code
- **YAGNI · DRY · KISS** : pas de sur-abstraction, pas de code mort, pas de `console.log` de débogage, pas de
  `// TODO` sans issue.
- **TypeScript** : `strict: true` ; pas de `any` (`unknown` + gardes de type) ; types explicites sur les retours publics ;
  `interface` pour les contrats d'objets, `type` pour les unions et intersections.
- **SQL** : requêtes paramétrées ou ORM (Drizzle), jamais de concaténation ; tables en snake_case au pluriel ;
  chaque migration a son `down` écrit à la main (`migrations/down/<nom>.down.sql`).
- **CSS / Tailwind** : utilitaires d'abord, `@apply` ou composant dès 3 répétitions ; jetons du thème, pas de valeur
  magique.
- Dépendance externe nouvelle : la **signaler** (nom, licence, raison) avant de l'ajouter.
- Ne pas modifier CI/CD, `Dockerfile` ni `docker-compose.yml` sans revue.

## Tests
- Tests pour toute nouvelle logique métier, cas limites et chemins d'erreur compris.
- Unitaires rapides et déterministes, dépendances externes simulées.
- Nommage : `should_<comportement>_when_<condition>`.
- Interface : tests renderer + vérification d'accessibilité (`expectNoAxeViolations`).

## Workflow d'une tâche
ANALYSE → PLAN (si complexe) → IMPLÉMENTATION → REVUE (sécurité, qualité, tests) → COMMIT (après confirmation).
Détail de la méthode : [`methode-travail.md`](./methode-travail.md).
