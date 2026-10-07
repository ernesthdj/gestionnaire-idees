import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProbeService } from '../../../src/main/application/analyste/ProbeService'
import { RepoGuard } from '../../../src/main/application/analyste/RepoGuard'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { seedDemo } from '../../../src/main/infrastructure/db/demo/seedDemo'
import { AnalysteRepository } from '../../../src/main/infrastructure/db/repositories/AnalysteRepository'
import { ObservationRepository } from '../../../src/main/infrastructure/db/repositories/ObservationRepository'
import { createLogger, teeSink } from '../../../src/main/infrastructure/logging/logger'
import { neurons } from '../../../src/main/infrastructure/db/schemaNeurons'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

/**
 * SC-001 / SC-002 (spec 019) : après un parcours du profil démo, aucun texte saisi ni identifiant réel n'est dans les
 * observations ; dans l'app installée, rien n'est collecté.
 */
describe('sonde sans contenu sur le profil démo', () => {
  let root: string
  let repo: string
  let handle: DatabaseHandle

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-probe-sc001-'))
    repo = join(root, 'brainstormer')
    mkdirSync(join(repo, 'src', 'main'), { recursive: true })
    writeFileSync(join(repo, 'src', 'main', 'bootstrap.ts'), '')
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'gestionnaire-idees' }))
    handle = openDatabase({ file: join(root, 'demo.db'), key: '9'.repeat(64), migrationsFolder: MIGRATIONS })
    seedDemo(handle.db)
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  const stack = async (isPackaged: boolean) => {
    const settings = new AnalysteRepository(handle.db)
    const observations = new ObservationRepository(handle.db)
    const secrets = new Map<string, string>()
    const guard = new RepoGuard({
      isPackaged,
      appPath: repo,
      git: async (cwd) => ({ code: 0, output: cwd }),
      storedRepo: () => settings.repoPath(),
      storeRepo: (path) => settings.saveRepoPath(path),
      secrets: {
        get: (name) => secrets.get(name) ?? null,
        getOrCreateRandomKey: (name) => {
          if (!secrets.has(name)) secrets.set(name, 'e'.repeat(64))
          return secrets.get(name) ?? ''
        }
      }
    })
    if (!isPackaged) await guard.designate(repo)
    const probe = new ProbeService({
      key: () => guard.hmacKey(),
      repository: observations,
      settings: () => settings.settings()
    })
    const logger = createLogger(teeSink((record) => probe.recordLog(record.level, record.event)))
    return { probe, logger, observations }
  }

  const demoRoots = () =>
    handle.db
      .select({ id: neurons.id, title: neurons.title })
      .from(neurons)
      .all()
      .filter((row) => row.title.trim().length >= 4)

  /** Parcours : tout ce que l'interface et le main envoient pendant une session, textes piégés compris. */
  const walk = ({ probe, logger }: Awaited<ReturnType<typeof stack>>): void => {
    const roots = demoRoots()
    probe.recordRenderer([{ event: 'screen.open', screen: 'carte' }])
    for (const { id, title } of roots) {
      probe.recordRenderer([
        { event: 'chat.send', subjectKind: 'conversation', subjectId: id, via: 'clavier' },
        { event: 'neuron.remove', subjectKind: 'neuron', subjectId: id, via: 'souris' },
        // Tentatives de faire passer du contenu : rejetées par le catalogue.
        { event: 'neuron.create', subjectKind: 'neuron', subjectId: id, via: 'souris', title },
        { event: 'error.renderer', code: 'TypeError', frames: [], message: title },
        { event: 'screen.open', screen: title }
      ])
      probe.recordCall('chat:send', 120, true)
      logger.error('chat.failed', { channel: 'chat:send', status: title })
    }
    probe.recordRenderer([{ event: 'panel.close', screen: 'carte', durationMs: 60_000 }])
    probe.flush()
  }

  const dump = (): string =>
    JSON.stringify(handle.db.all(sql`SELECT * FROM observations`)) +
    JSON.stringify(handle.db.all(sql`SELECT * FROM ai_calls`))

  it('should_keep_no_typed_text_nor_real_id_when_the_demo_profile_is_walked', async () => {
    const parts = await stack(false)
    walk(parts)
    expect(parts.observations.count()).toBeGreaterThan(10)
    const stored = dump()
    const roots = demoRoots()
    expect(roots.length).toBeGreaterThan(5)
    for (const { id, title } of roots) {
      expect(stored, `titre « ${title} »`).not.toContain(title)
      expect(stored, `identifiant ${id}`).not.toContain(id)
    }
  })

  it('should_collect_nothing_when_the_app_is_packaged', async () => {
    const parts = await stack(true)
    walk(parts)
    expect(parts.observations.count()).toBe(0)
  })
})
