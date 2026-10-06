# Brainstormer (gestionnaire-idees)

Application de bureau (Windows) pour réfléchir à n'importe quoi avec Claude sur une **carte de neurones** : chaque
idée (genesis) est une conversation Claude Code ; elle se brainstorme, se découpe en plan d'attaque, devient un projet
avec son dossier (et son dépôt git si on le veut), et ses étapes finales se réalisent depuis la carte.

Stack : Electron · React + TypeScript (strict) + Tailwind · React Flow · SQLite chiffré (Drizzle +
better-sqlite3-multiple-ciphers) · Claude Code (`claude -p`, abonnement) · pont MCP · Ollama (facultatif).

## Prérequis
- **Windows 10/11**
- **Node.js 24** ou plus récent (`node -v`)
- **Git pour Windows** (`git --version`) — pour cloner, et pour « Initialiser git » dans l'app
- **Claude Code** installé et connecté à un abonnement Claude (`claude --version`, puis `claude` une fois pour se
  connecter). L'app n'utilise ni clé API ni facturation à l'usage : elle lance le CLI de l'utilisateur.
- *Facultatif* : **Ollama** (`http://127.0.0.1:11434`) pour les petites tâches locales (catégorie d'une idée…).

## Installation
```bash
git clone https://github.com/ernesthdj/gestionnaire-idees.git
cd gestionnaire-idees
npm install
npm run dev
```
Si `npm run dev` affiche « Electron uninstall » : `node node_modules/electron/install.js`, puis relancer.

Pour découvrir l'app sans toucher à ses propres données : `npm run seed:demo` (profil de démonstration fictif,
séparé ; `npm run seed:demo:reset` le recrée).

## Première mise en route
1. **Réglages › Claude Code** : copier la commande `claude mcp add brainstormer …` affichée et la lancer **une fois**
   dans un terminal — Claude peut alors lire et dessiner sur la carte.
2. **Réglages › Projets** : choisir la racine où les genesis deviennent des projets (un dossier dédié, ou le dossier
   `projects/` d'un workspace ProjectMaster).
3. Capturer une idée, double-cliquer dessus : la conversation avec Claude s'ouvre.

Les données de l'app (base chiffrée, profil) restent sur la machine, dans `%APPDATA%/gestionnaire-idees/` ; rien
n'est dans le dépôt.

## Développer avec Claude Code
Ouvrir Claude Code à la racine du dépôt : `CLAUDE.md` lui donne le contexte du projet et importe les règles de travail
de [`docs/claude/`](docs/claude/) (sécurité, git, standards, tests, méthode). À lire aussi :
- [`docs/FOUNDATION.md`](docs/FOUNDATION.md) — vision et architecture ;
- [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — principes non négociables ;
- [`specs/`](specs/) — une spec par fonctionnalité (Spec Kit : `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`,
  `/speckit-implement`) ;
- [`docs/JOURNAL.md`](docs/JOURNAL.md) — historique des décisions et règles apprises (skill `/journal`).

| Commande | Effet |
|----------|-------|
| `npm run dev` | Lance l'app (rechargement à chaud) |
| `npm test` | Tests Vitest |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run build` | Build de production dans `out/` |
