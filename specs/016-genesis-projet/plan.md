# Plan — spec 016 « Genesis → projet »

## Découpage
- **Domaine (pur)** `domain/projects/project.ts` : `PROJECT_TYPES` (ceux de `pm.bat`), `isCodeType`, `slugify`,
  `slugProblem`, `scaffoldFiles` (contenus), `GITIGNORE`, `registryWithProject`, `registryWithBranch`, `cleanText`.
- **Infrastructure** `infrastructure/projects/` : `ProjectFolder` (création sans écrasement), `HubRegistry`
  (détection `../.hub/registry.json`, écriture atomique), `GitCli` (`spawn('git', args, { shell: false })`, délai).
- **Application** `application/projects/ProjectService.ts` : `settings`, `chooseRoot`, `create`, `initGit`, `isGit`.
- **Réglage** `projects.root` (`AppSettingsRepository`).
- **IPC** `project:settings`, `project:chooseRoot`, `project:create`, `project:initGit` ; `ChatView.git`.
- **Interface** : `chat/ProjectForm.tsx` ; en-tête du chat du genesis ; `pages/settings/ProjectSettings.tsx`.
- **Cadre** : à la fin du premier brainstorm d'un genesis sans dossier, Claude peut suggérer « Faire de ce genesis un projet ».

## Sécurité
Racine choisie au sélecteur natif ; chemin du projet = `join(racine, slug validé)` puis contrôle qu'il reste sous la
racine ; git sans shell ; registre jamais écrit sur un JSON illisible.
