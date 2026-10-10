import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Dossier de méthode FICTIF du profil démo (spec 023 T039) : une fondation, deux specs (l'une en cours, l'autre
 * planifiée), un L1 cité par une spec et un L1 à brainstormer, un fichier de tâches à trois états (D20, D21), plus un
 * petit fichier de code cité par une tâche — de quoi montrer la vue Workflow, ses cartes, le lecteur et « Que fait ce
 * fichier ? ». Aucune donnée réelle.
 */
const FILES: Readonly<Record<string, string>> = {
  'docs/FOUNDATION.md': `# Fondation — Application de notes (démo)

Une petite application fictive pour noter une idée en deux secondes, la retrouver par la recherche et l'exporter.

## Vision
Noter vite, retrouver sans chercher longtemps.
`,
  'docs/brainstorm/L1-notes-recherche.md': `# L1 — Retrouver une note (démo)

Chercher dans le titre et le texte des notes, résultats classés par date.
`,
  'docs/brainstorm/L1-notes-partage.md': `# L1 — Partager une note par lien (démo)

Idée pas encore travaillée : envoyer une note à quelqu'un sans compte.
`,
  'specs/001-recherche/spec.md': `# Feature Specification: Recherche dans les notes (démo)

**Created**: 2026-10-01 · **Status**: Draft
**Input**: brainstorm \`docs/brainstorm/L1-notes-recherche.md\`

## Décisions

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Portée | Titre et texte des notes |
| D2 | Ordre | Les plus récentes d'abord |

### User Story 1 — Chercher un mot (Priority: P1)

Taper un mot affiche les notes qui le contiennent.

### User Story 2 — Filtrer par date (Priority: P2)

Limiter les résultats à une période.
`,
  'specs/001-recherche/tasks.md': `# Tasks: Recherche dans les notes (démo)

## Phase 1 — Mise en place
- [x] T001 Créer le module de recherche dans \`src/notes/search.ts\`

## Phase 2 — US1 Chercher un mot
- [x] T002 [US1] Fonction \`searchNotes\` (titre et texte, sans tenir compte des accents) dans \`src/notes/search.ts\`
- [ ] T003 [US1] Classer les résultats par date dans \`src/notes/search.ts\`

## Phase 3 — US2 Filtrer par date
- [ ] T004 [US2] Filtre « depuis » et « jusqu'à » dans \`src/notes/search.ts\`
`,
  'specs/002-export/spec.md': `# Feature Specification: Export des notes (démo)

**Created**: 2026-10-05 · **Status**: Draft

### User Story 1 — Exporter en Markdown (Priority: P1)

Enregistrer une note en fichier Markdown.
`,
  'specs/002-export/tasks.md': `# Tasks: Export des notes (démo)

- [ ] T001 [US1] Écrire une note en Markdown dans \`src/notes/export.ts\`
`,
  'docs/TACHES-DESIGN.md': `# Tâches — Design de l'application (démo)

## Écrans
### Liste des notes
- [x] Maquette de la liste
- [~] Tri par date dans \`src/notes/search.ts\`
- [ ] État vide (« aucune note »)
### Recherche
- [ ] Champ de recherche toujours visible

## Accessibilité
- [x] Contraste AA des couleurs
`,
  'src/notes/search.ts': `/** Une note de l'application (démo). */
export interface Note {
  readonly title: string
  readonly text: string
  readonly createdAt: string
}

/** Texte sans accents ni majuscules, pour comparer sans tenir compte de la forme. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
}

/** Notes dont le titre ou le texte contient le mot cherché. */
export function searchNotes(notes: readonly Note[], word: string): Note[] {
  const wanted = normalize(word)
  return notes.filter((note) => normalize(\`\${note.title} \${note.text}\`).includes(wanted))
}
`
}

/** Écrit le dossier de méthode fictif s'il n'existe pas encore (jamais d'écrasement) ; renvoie son chemin. */
export function writeDemoMethodFolder(dir: string): string {
  if (existsSync(dir)) return dir
  for (const [path, content] of Object.entries(FILES)) {
    const target = join(dir, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf8')
  }
  return dir
}
