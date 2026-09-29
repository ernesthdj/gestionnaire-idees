# CLAUDE.md — Gestionnaire_idées

> **Projet :** Gestionnaire_idées
> **Slug :** gestionnaire-idees
> **Type :** Desktop App
> **Cree le :** 2026-09-28
> **Description :** Mini app desktop pour noter vite fait à la main les idées du quotidien (idées générales, achats, projets, sorties — tout ce qui vient sur le moment et qu'on oublie ensuite), les structurer en tâches et recevoir un rappel chaque jour.
> **Vision (2026-09-28) :** « Brainstormer » — réfléchir à n'importe quoi avec Claude via une carte de neurones (Action / Réflexion) qui poussent, fusionnent et se relient. Voir `docs/FOUNDATION.md` §0.

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

## Regles specifiques

> Les regles globales de `~/.claude/CLAUDE.md` s'appliquent par defaut.

- **Exception ORM (validee 2026-09-28)** : **Drizzle ORM** + `better-sqlite3-multiple-ciphers` au lieu de Prisma
  (standard global Node). Raison : Prisma embarque un moteur binaire separe, fragile a empaqueter dans Electron,
  et ne supporte pas SQLite chiffre. Garanties conservees : requetes typees et parametrees, migrations versionnees avec `down`.
- **Repo public** : aucune donnee reelle, aucun secret, aucune adresse e-mail. Donnees utilisateur dans `%APPDATA%/gestionnaire-idees/`.
- **Modele Claude par defaut** : `claude-opus-5` (configurable dans l'app).

## Suivi academique

> Renseigne automatiquement par `/brainstorm` (Etape 0) au premier lancement.

Active : oui
Dossier : docs/academique/
Derniere mise a jour : 2026-09-29

## Stack

Electron · React + TypeScript (strict) + Tailwind · React Flow · SQLite chiffre (Drizzle + better-sqlite3-multiple-ciphers)
· Ollama (IA locale) + Claude API (`@anthropic-ai/sdk`) · Microsoft Graph + MSAL Node · Zod. Detail : `docs/FOUNDATION.md` §5.

## Commandes

| Commande | Effet |
|----------|-------|
| `npm run dev` | Lance l'app en developpement (rechargement a chaud) |
| `npm run seed:demo` | Lance l'app sur le profil demo (`%APPDATA%/gestionnaire-idees-demo`, 100 idees / 50 liens fictifs) |
| `npm run seed:demo:reset` | Idem en recreant le profil demo de zero (efface uniquement ce dossier fictif) |
| `npm test` | Tests Vitest |
| `npm run typecheck` | Verification TypeScript (main/preload + renderer) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run build` | Typecheck + build de production dans `out/` |

> Si `npm run dev` affiche « Electron uninstall » : `node node_modules/electron/install.js` (telechargement
> du binaire Electron non effectue a l'installation).
> `better-sqlite3` est un **alias npm** de `better-sqlite3-multiple-ciphers` (Drizzle importe `better-sqlite3`) ;
> ses types sont pointes dans `tsconfig.base.json` (`paths`).
> Migrations : `npm run db:generate`, puis ecrire a la main `migrations/down/<nom>.down.sql` (constitution).
> `npm audit` : 4 alertes moderees connues (esbuild ancien dans drizzle-kit, outil de dev uniquement, pas de
> serveur lance) — correctif auto refuse car il retrograderait drizzle-kit 0.31 → 0.18.

## Workflows actifs

- [x] Brainstorm initial (`/brainstorm`) — niveaux 1 a 4, export `docs/FOUNDATION.md`
- [ ] Spec Kit — initialise (`.specify/`, skills `.claude/skills/speckit-*`), specs a produire par feature
- [ ] Pipeline agents (`/pipeline`)
- [x] Graphify projet — seede a la creation, mis a jour a chaque `/hub end`
