import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src/main', 'src/shared', 'src/mcp-relay'].map((dir) => resolve(import.meta.dirname, '../..', dir))

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []
  )

describe('build du processus principal (electron-vite)', () => {
  it('should_never_end_a_code_line_with_a_string_finishing_with_the_word_import', () => {
    // Le shim CommonJS d'electron-vite prend « …import") » pour la dernière instruction d'import et insère son code au
    // milieu de la chaîne : le build échoue (« Unterminated string literal »), constaté sur un appel `…("…import")`.
    const offenders = ROOTS.flatMap(sources).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => /\bimport['"`]\);?\s*$/.test(text))
    )
    expect(offenders).toEqual([])
  })
})
