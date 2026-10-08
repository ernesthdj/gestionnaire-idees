import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SkillUsageScanner, USAGE_WINDOW_MS } from '../../../src/main/application/skills/SkillUsageScanner'
import type { SkillView } from '../../../src/shared/ipc/skills'

const NOW = Date.parse('2026-10-08T12:00:00.000Z')
const TRAP = 'TEXTE-PIEGE-NE-DOIT-JAMAIS-SORTIR'
const iso = (daysAgo: number): string => new Date(NOW - daysAgo * 86_400_000).toISOString()

const skill = (id: string): SkillView => ({
  id,
  family: id.startsWith('plugin') ? 'plugin' : 'perso',
  name: id.split(':').at(-1) ?? id,
  description: '',
  origin: '',
  hasScripts: false,
  damaged: false,
  sameNameAs: [],
  modifiedAt: 0,
  contentHash: 'x'
})

const toolUse = (name: string, daysAgo: number): string =>
  JSON.stringify({
    type: 'assistant',
    timestamp: iso(daysAgo),
    message: {
      content: [
        { type: 'text', text: TRAP },
        { type: 'tool_use', name: 'Skill', input: { skill: name, args: TRAP } }
      ]
    }
  })
const command = (type: string, name: string, daysAgo: number): string =>
  JSON.stringify({
    type,
    timestamp: iso(daysAgo),
    message: { content: `<command-name>/${name}</command-name> ${TRAP}` }
  })

describe('usage réel des skills (spec 020 T017, SC-004)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skill-usage-'))
    const project = join(root, 'C--projet-fictif')
    mkdirSync(project)
    writeFileSync(
      join(project, 'a.jsonl'),
      [
        JSON.stringify({ type: 'user', timestamp: iso(1), message: { content: TRAP } }),
        toolUse('hub', 1),
        toolUse('hub', 3),
        command('user', 'hub', 2),
        // Une réponse qui cite une commande ne compte pas.
        command('assistant', 'graphify', 1),
        toolUse('vercel:deploy', 4),
        // Hors fenêtre de 30 jours.
        toolUse('graphify', 40),
        toolUse('inconnu', 1),
        '{ ligne abîmée "name":"Skill"'
      ].join('\n')
    )
    const old = join(project, 'ancien.jsonl')
    writeFileSync(old, toolUse('graphify', 1))
    const past = (NOW - USAGE_WINDOW_MS - 86_400_000) / 1000
    utimesSync(old, past, past)
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_count_skill_calls_over_30_days_and_keep_nothing_else', async () => {
    const scanner = new SkillUsageScanner({ projectsDir: root, now: () => NOW })
    const usage = await scanner.usage([skill('perso:hub'), skill('perso:graphify'), skill('plugin:m/vercel:deploy')])
    expect(usage).toEqual({
      'perso:hub': { calls30d: 3, lastAt: Date.parse(iso(1)) },
      'plugin:m/vercel:deploy': { calls30d: 1, lastAt: Date.parse(iso(4)) }
    })
    // SC-004 : le texte des conversations n'apparaît nulle part, ni dans le résultat ni dans l'état du scanner.
    expect(JSON.stringify(usage)).not.toContain(TRAP)
    expect(
      JSON.stringify([...(scanner as unknown as { cache: { counts: Map<string, unknown> } }).cache.counts])
    ).not.toContain(TRAP)
  })

  it('should_return_nothing_when_the_history_folder_is_missing', async () => {
    const scanner = new SkillUsageScanner({ projectsDir: join(root, 'absent'), now: () => NOW })
    expect(await scanner.usage([skill('perso:hub')])).toEqual({})
  })
})
