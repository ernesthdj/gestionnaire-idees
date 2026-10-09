import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Dépôts git FICTIFS pour les tests de la spec 021 (T002) : auteurs `*@example.invalid`, secrets factices, hooks
 * témoins. Rien de réel. Aussi lançable : `npx tsx tests/support/gitRepos.ts <dossier> <scénario>`.
 */

export type GitScenario = 'trois-auteurs' | 'conflit' | 'secret-ancien' | 'hook-temoin' | 'config-piegee' | 'licences'

export const SCENARIOS: readonly GitScenario[] = [
  'trois-auteurs',
  'conflit',
  'secret-ancien',
  'hook-temoin',
  'config-piegee',
  'licences'
]

interface Author {
  readonly name: string
  readonly email: string
}

export const AUTHORS = {
  alice: { name: 'Alice Fictive', email: 'alice@example.invalid' },
  aliceBis: { name: 'A. Fictive', email: 'Alice@Example.invalid' },
  bob: { name: 'Bob Fictif', email: 'bob@example.invalid' },
  chloe: { name: 'Chloé Fictive', email: 'chloe@example.invalid' }
} as const satisfies Record<string, Author>

let tick = 0
/** Git de test : environnement isolé (pas de configuration globale, dates fixes, aucune invite). */
export function git(cwd: string, args: readonly string[], author: Author = AUTHORS.alice, input?: string): string {
  tick += 1
  const date = new Date(Date.UTC(2026, 0, 1, 9, 0, tick)).toISOString()
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date
    }
  })
}

/** Dépôt vide sur `main`, identité locale fictive (les commits de l'app en ont besoin). */
export function initRepo(dir: string): string {
  mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.name', AUTHORS.alice.name])
  git(dir, ['config', 'user.email', AUTHORS.alice.email])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  return dir
}

export function writeFiles(dir: string, files: Readonly<Record<string, string | Buffer>>): void {
  for (const [path, content] of Object.entries(files)) {
    const target = join(dir, path)
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, content)
  }
}

export function commit(
  dir: string,
  files: Readonly<Record<string, string | Buffer>>,
  message: string,
  author?: Author
): void {
  writeFiles(dir, files)
  git(dir, ['add', '--', ...Object.keys(files)], author)
  git(dir, ['commit', '-q', '-m', message], author)
}

/** Dépôt nu (le « GitHub » des tests) et un clone de travail qui le suit sur `main`. */
export function bareWithClone(root: string, name = 'clone'): { bare: string; work: string } {
  const bare = join(root, 'distant.git')
  mkdirSync(bare, { recursive: true })
  git(bare, ['init', '-q', '--bare', '-b', 'main'])
  const work = initRepo(join(root, name))
  commit(work, { 'README.md': '# Projet fictif\n' }, 'chore: départ')
  git(work, ['remote', 'add', 'origin', bare])
  git(work, ['push', '-q', '-u', 'origin', 'main'])
  return { bare, work }
}

/**
 * Faux secrets assemblés à l'exécution : le texte source ne contient ni préfixe de jeton GitHub ni en-tête de clé privée
 * littéraux (le dépôt est public : la détection de secrets de GitHub ne doit pas s'y déclencher).
 */
const keyLine = (word: string): string => `-----${word} OPENSSH ${'PRIV'}ATE KEY-----`
export const FAKE_PRIVATE_KEY = `${keyLine('BEGIN')}\nFAUSSE-CLE-DE-TEST\n${keyLine('END')}\n`
export const FAKE_TOKEN = `${'gh'}${'p_'}FAUXJETONDETESTFAUXJETONDETEST1234`

const BINARY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03])

/** Construit le scénario dans `dir` (créé) ; renvoie le dossier de travail principal. */
export function buildScenario(dir: string, scenario: GitScenario): string {
  switch (scenario) {
    case 'trois-auteurs': {
      const repo = initRepo(dir)
      commit(repo, { 'README.md': '# Notes\n' }, 'chore: départ', AUTHORS.alice)
      commit(repo, { 'src/a.ts': 'export const a = 1\n' }, 'feat: a', AUTHORS.bob)
      commit(repo, { 'src/b.ts': 'export const b = 2\n' }, 'feat: b', AUTHORS.chloe)
      commit(repo, { 'src/a.ts': 'export const a = 3\n' }, 'fix: a', AUTHORS.aliceBis)
      return repo
    }
    case 'conflit': {
      const { bare, work } = bareWithClone(dir, 'moi')
      commit(work, { 'src/liste.ts': 'export const liste = [1, 2, 3]\n', 'logo.png': BINARY }, 'feat: liste')
      git(work, ['push', '-q'])
      const other = join(dir, 'collegue')
      git(dir, ['clone', '-q', bare, other])
      git(other, ['config', 'user.name', AUTHORS.bob.name])
      git(other, ['config', 'user.email', AUTHORS.bob.email])
      commit(
        other,
        {
          'src/liste.ts': 'export const liste = [1, 2, 3, 4]\n',
          'logo.png': Buffer.concat([BINARY, Buffer.from([9])])
        },
        'feat: 4',
        AUTHORS.bob
      )
      git(other, ['push', '-q'], AUTHORS.bob)
      commit(
        work,
        {
          'src/liste.ts': 'export const liste = [0, 1, 2, 3]\n',
          'logo.png': Buffer.concat([BINARY, Buffer.from([7])])
        },
        'feat: 0'
      )
      return work
    }
    case 'secret-ancien': {
      const repo = initRepo(dir)
      commit(repo, { '.env': 'API_KEY=faux-secret-de-test\n' }, 'chore: config (erreur)')
      commit(repo, { 'cle.pem': FAKE_PRIVATE_KEY }, 'chore: clé (erreur)')
      git(repo, ['rm', '-q', '--', '.env', 'cle.pem'])
      git(repo, ['commit', '-q', '-m', 'chore: retire les secrets'])
      commit(repo, { 'tests/jeton.test.ts': `const jeton = '${FAKE_TOKEN}'\n` }, 'test: jeton factice')
      return repo
    }
    case 'hook-temoin': {
      const repo = initRepo(dir)
      commit(repo, { 'README.md': '# Hook\n' }, 'chore: départ')
      // Hook témoin : s'il s'exécute, il écrit `hook-a-tourne.txt` à la racine du dépôt.
      writeFiles(repo, { '.git/hooks/pre-commit': '#!/bin/sh\necho oui > hook-a-tourne.txt\nexit 0\n' })
      return repo
    }
    case 'config-piegee': {
      const repo = initRepo(dir)
      commit(repo, { 'README.md': '# Piège\n' }, 'chore: départ')
      git(repo, ['config', 'filter.x.clean', 'echo piege > filtre-a-tourne.txt'])
      git(repo, ['config', 'core.sshCommand', 'echo piege'])
      return repo
    }
    case 'licences': {
      const root = dir
      commit(
        initRepo(join(root, 'mit')),
        { LICENSE: 'MIT License\n\nCopyright (c) 2026 Auteur Fictif\n' },
        'chore: licence'
      )
      commit(
        initRepo(join(root, 'gpl')),
        { LICENSE: 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n' },
        'chore: licence'
      )
      commit(initRepo(join(root, 'sans-licence')), { 'index.ts': 'export {}\n' }, 'chore: départ')
      return root
    }
  }
}

// Lancement en ligne de commande : `npx tsx tests/support/gitRepos.ts <dossier> <scénario>`.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [dir, scenario] = process.argv.slice(2)
  if (dir === undefined || scenario === undefined || !(SCENARIOS as readonly string[]).includes(scenario)) {
    process.stderr.write(`Usage : gitRepos.ts <dossier> <${SCENARIOS.join('|')}>\n`)
    process.exit(1)
  }
  process.stdout.write(`${buildScenario(resolve(dir), scenario as GitScenario)}\n`)
}
