# CLAUDE.md — Gestionnaire_idées

> **Projet :** Gestionnaire_idées
> **Slug :** gestionnaire-idees
> **Type :** Desktop App
> **Cree le :** 2026-09-28
> **Description :** Mini app desktop pour noter vite fait à la main les idées du quotidien (idées générales, achats, projets, sorties — tout ce qui vient sur le moment et qu'on oublie ensuite), les structurer en tâches et recevoir un rappel chaque jour.
> **Vision (2026-09-28) :** « Brainstormer » — réfléchir à n'importe quoi avec Claude via une carte de neurones (Action / Réflexion) qui poussent, fusionnent et se relient. Voir `docs/FOUNDATION.md` §0.
> **Vision (2026-10-04, prioritaire) :** le Brainstormer devient l'**interface visuelle de Claude Code** (pont MCP, moteur `claude -p`, terminal intégré). Voir `docs/FOUNDATION.md` §00 et `docs/brainstorm/L1c-pont-claude-code.md`.
> **Évolution (2026-10-06) :** **reprendre un projet existant** (import dossier / git, analyse statique TS · C# · PHP,
> explorateur à 4 niveaux, guide de reprise, diagnostic en couleurs). Voir `docs/FOUNDATION.md` §000 et
> `docs/brainstorm/L1f-reprise-projet.md`. Specs prévues : 017 (Voir), 018 (Juger).
> **Évolution (2026-10-07) :** **Analyste interne** (sonde sans contenu, Claude en lecture seule qui propose, mise à jour
> sur une branche `analyste/*` gardée ou jetée, annulable). Voir `docs/FOUNDATION.md` §0000 et
> `docs/brainstorm/L1g-analyste-interne.md`. Spec prévue : 019 (à confirmer), après amendement de la constitution.
> **Évolution (2026-10-07) :** **Arbre de skills** (page Skills : skills de Claude en arbre de compétences, fiche
> technique, brouillon → installation, import GitHub en quarantaine). Voir `docs/FOUNDATION.md` §00000 et
> `docs/brainstorm/L1h-arbre-de-skills.md`. Spec prévue : 020.
> **Évolution (2026-10-07) :** **Git et GitHub** (volet Dépôt : commit, branches, publier, tirer, pousser sur clic ;
> clone par lien ; frise des contributions ; conflits guidés ; PR et issues). Voir `docs/FOUNDATION.md` §000000 et
> `docs/brainstorm/L1i-git-github.md`. Spec prévue : 021, après amendement 4.4.0 de la constitution.

---

## Contexte

Ce projet a ete cree via `/hub new` dans le workspace ProjectMaster.
La stack et les dependances seront definies apres le brainstorm initial (`/brainstorm`).

## Structure

```
gestionnaire-idees/
├── CLAUDE.md          # Ce fichier
├── docs/
│   └── JOURNAL.md     # Journal du projet
├── graphify-out/      # Graphe de connaissances local (seede a la creation)
├── src/               # Code source
└── tests/             # Tests
```

## Regles de travail (tout contributeur)

Ces regles s'appliquent a toute personne qui travaille sur ce depot avec Claude Code (elles reprennent, sans donnee
personnelle, les regles globales de mentalyas) :

@docs/claude/regles-dev.md
@docs/claude/methode-travail.md

Avant tout travail d'interface, lire `docs/claude/ergonomie-ui.md` et `docs/claude/frontend-workflow.md`.
Skills du depot : `/journal`, `/selfdoubt`, `/speckit-*` (`.claude/skills/`). Installation : `README.md`.

## Regles specifiques

> Les regles globales de `~/.claude/CLAUDE.md` s'appliquent par defaut (et `docs/claude/` pour tout contributeur).

- **Exception ORM (validee 2026-09-28)** : **Drizzle ORM** + `better-sqlite3-multiple-ciphers` au lieu de Prisma
  (standard global Node). Raison : Prisma embarque un moteur binaire separe, fragile a empaqueter dans Electron,
  et ne supporte pas SQLite chiffre. Garanties conservees : requetes typees et parametrees, migrations versionnees avec `down`.
- **Repo public** : aucune donnee reelle, aucun secret, aucune adresse e-mail. Donnees utilisateur dans `%APPDATA%/gestionnaire-idees/`.
- **Modeles Claude par defaut** (spec 010) : Opus 5.5 pour les genesis, Sonnet 5.5 pour les elements de projet et les
  widgets ; configurables dans Reglages › IA et par conversation.
- **Constitution 3.0.0 (2026-10-05)** : ecritures de Claude par MCP directes, marquees « par Claude », annulables ;
  plus d'API ni de SDK Anthropic, de budget, d'anonymisation ni de cadre IA (spec 010).
- **Ancien moteur de neurones retire (spec 010)** : ses tables (`extensions`, `suggestions`, `syntheses`, `plan_nodes`,
  `reflection_summaries`, `neuron_links`, `link_seeds`…) restent en **archive**, lues seulement par l'Historique et les
  entrees des widgets ; converties en fiches et liens libres au premier demarrage (marqueur `migration.legacySheets`).
  Un element de structure se reconnait a `kind = 'element'`.

## Suivi academique

> Renseigne automatiquement par `/brainstorm` (Etape 0) au premier lancement.

Active : oui
Dossier : docs/academique/
Derniere mise a jour : 2026-10-07

## Stack

Electron · React + TypeScript (strict) + Tailwind · React Flow · SQLite chiffre (Drizzle + better-sqlite3-multiple-ciphers)
· Ollama (IA locale) + Claude Code (`claude -p`, abonnement — plus d'API Anthropic depuis la spec 010) · pont MCP
(`@modelcontextprotocol/sdk`, relais `src/mcp-relay/`) · Microsoft Graph + MSAL Node · Zod. Detail : `docs/FOUNDATION.md` §5 et §00.

## Commandes

| Commande | Effet |
|----------|-------|
| `npm run dev` | Lance l'app en developpement (rechargement a chaud) |
| `npm run seed:demo` | Lance l'app sur le profil demo (`%APPDATA%/gestionnaire-idees-demo` : 12 genesis fictifs avec fiches, 8 liens libres, 1 carte de structure) |
| `npm run seed:demo:reset` | Idem en recreant le profil demo de zero (efface uniquement ce dossier fictif) |
| `npm test` | Tests Vitest |
| `npm run typecheck` | Verification TypeScript (main/preload + renderer) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run build` | Typecheck + build de production dans `out/` |

> Si `npm run dev` affiche « Electron uninstall » : `node node_modules/electron/install.js` (telechargement
> du binaire Electron non effectue a l'installation).
> `better-sqlite3` est un **alias npm** de `better-sqlite3-multiple-ciphers` (Drizzle importe `better-sqlite3`) ;
> ses types sont pointes dans `tsconfig.base.json` (`paths`).
> Pont MCP (spec 007) : Reglages › Claude Code affiche la commande `claude mcp add brainstormer …` a lancer une fois.
> Le relais (`out/main/mcp-relay.js`) existe apres `npm run dev` ou `npm run build` ; canal nomme par profil, secret
> dans `<profil>/mcp.token` (jamais dans `~/.claude.json`).
> Chat des neurones (spec 008) : double-clic sur une idee = conversation `claude -p` (stream-json) dans
> `<profil>/workspace` (ou le dossier de projet lie), session reprise ; AUCUNE source de reglages (`--setting-sources ""` :
> ni hooks utilisateur, ni hooks d'un projet lie ; le CLAUDE.md d'un projet est lu par Claude, pas charge d'office), outils restreints.
> Migrations : `npm run db:generate`, puis ecrire a la main `migrations/down/<nom>.down.sql` (constitution).
> `npm audit` : 0 alerte (2026-10-06) grace a deux `overrides` dans `package.json` : `@esbuild-kit/core-utils > esbuild`
> (dependance morte de drizzle-kit) et `global-agent ^4` (packaging seulement ; a retirer si un packaging derriere un
> proxy echoue). Jamais `npm audit fix --force` (il retrograderait drizzle-kit 0.31 → 0.18).
> `npm ci` echoue si l'app ou le relais MCP tourne (`electron.exe` verrouille) : fermer l'app, ou `npm install` puis
> `node node_modules/electron/install.js`.

## Workflows actifs

- [x] Brainstorm initial (`/brainstorm`) — niveaux 1 a 4, export `docs/FOUNDATION.md`
- [x] Spec Kit — `.specify/`, skills `.claude/skills/speckit-*` ; une spec par feature (`specs/0NN-*`), en cours : 017 « Reprise — Voir » (US1–US4, US7, D16 et D17 livrées ; reste US6, finitions T035–T037 ; US5 clone (T028+) en pause) ; en pause : 014 (T014+), 015 (US4–US5), 013 (US3) — 016 livrée
- [ ] Pipeline agents (`/pipeline`)
- [x] Graphify projet — seede a la creation, mis a jour a chaque `/hub end`
