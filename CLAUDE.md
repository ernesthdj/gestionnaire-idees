# CLAUDE.md — Gestionnaire_idées

> **Projet :** Gestionnaire_idées
> **Slug :** gestionnaire-idees
> **Type :** Desktop App
> **Cree le :** 2026-09-28
> **Description :** Mini app desktop pour noter vite fait à la main les idées du quotidien (idées générales, achats, projets, sorties — tout ce qui vient sur le moment et qu'on oublie ensuite), les structurer en tâches et recevoir un rappel chaque jour.

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
Derniere mise a jour : jamais

## Stack

Electron · React + TypeScript (strict) + Tailwind · React Flow · SQLite chiffre (Drizzle + better-sqlite3-multiple-ciphers)
· Ollama (IA locale) + Claude API (`@anthropic-ai/sdk`) · Microsoft Graph + MSAL Node · Zod. Detail : `docs/FOUNDATION.md` §5.

## Workflows actifs

- [x] Brainstorm initial (`/brainstorm`) — niveaux 1 a 4, export `docs/FOUNDATION.md`
- [ ] Spec Kit — initialise (`.specify/`, skills `.claude/skills/speckit-*`), specs a produire par feature
- [ ] Pipeline agents (`/pipeline`)
- [x] Graphify projet — seede a la creation, mis a jour a chaque `/hub end`
