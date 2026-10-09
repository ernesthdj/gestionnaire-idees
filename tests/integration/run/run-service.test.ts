import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { RunService } from '../../../src/main/application/run/RunService'
import { defaultFavorite, scriptsOf } from '../../../src/main/domain/run/scripts'
import { resolveNpm } from '../../../src/main/infrastructure/analyste/NpmCli'
import type { RunOutputEvent, RunView } from '../../../src/shared/run/run'

const root = mkdtempSync(join(tmpdir(), 'gi-run-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })
const G = 'g'

/** Projet fictif : un script qui écrit puis s'arrête, un qui écrit puis attend, un qui échoue. */
function project(name: string): string {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name,
      private: true,
      scripts: {
        bonjour: 'node -e "console.log(\'bonjour du projet\')"',
        attendre: 'node -e "console.log(\'serveur pret\'); setInterval(() => {}, 1000)"',
        echouer: 'node -e "process.exit(3)"',
        annoncer:
          "node -e \"console.log('  Local:   http://localhost:5173/'); console.log('  Network: http://0.0.0.0:5173/')\"",
        'nom; piege': 'echo non'
      }
    })
  )
  return dir
}

function harness(dir: string | null, trusted = true) {
  const trust = new Set<string>()
  const outputs: RunOutputEvent[] = []
  const changes: RunView[] = []
  const opened: string[] = []
  let favorite: string | null = null
  const runs = new RunService({
    projectDir: () => dir,
    isTrusted: (key) => trusted || trust.has(key),
    setTrusted: (key, value) => {
      if (value) trust.add(key)
      else trust.delete(key)
    },
    npm: () => resolveNpm(),
    favorites: {
      runFavorite: () => favorite,
      saveRunFavorite: (_genesisId, script) => {
        favorite = script
      }
    },
    dataDir,
    emitOutput: (event) => outputs.push(event),
    emitChanged: (view) => changes.push(view),
    openUrl: async (url) => {
      opened.push(url)
    }
  })
  return { runs, outputs, changes, opened }
}

const until = async (check: () => boolean, ms = 30_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (!check()) {
    if (Date.now() > deadline) throw new Error('délai dépassé')
    await new Promise((done) => setTimeout(done, 50))
  }
}

describe('lancer un projet (spec 025)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_read_only_safe_script_names_and_pick_dev_first', () => {
    const scripts = scriptsOf(JSON.stringify({ scripts: { build: 'x', dev: 'y', 'a b': 'z', test: 3 } }))
    expect(scripts?.map((script) => script.name)).toEqual(['build', 'dev'])
    expect(defaultFavorite(scripts ?? [])).toBe('dev')
    expect(scriptsOf('{ pas du json')).toBeNull()
  })

  it('should_run_a_script_stream_its_output_and_report_the_exit', async () => {
    const { runs, outputs, changes } = harness(project('ecrit'))
    const view = runs.scripts(G)
    expect(view).toMatchObject({ trusted: true, hasPackage: true, favorite: 'bonjour' })
    expect(view.scripts.map((script) => script.name)).not.toContain('nom; piege')
    const run = runs.start(G, 'bonjour')
    await until(() => changes.some((change) => change.runId === run.runId && change.state !== 'running'))
    expect(changes.at(-1)).toMatchObject({ state: 'exited', exitCode: 0 })
    expect(outputs.map((event) => event.chunk).join('')).toContain('bonjour du projet')
    expect(runs.list()[0]?.output).toContain('bonjour du projet')

    const failed = runs.start(G, 'echouer')
    await until(() => changes.some((change) => change.runId === failed.runId && change.state !== 'running'))
    expect(changes.at(-1)).toMatchObject({ state: 'failed', exitCode: 3 })
  })

  it('should_stop_a_long_running_script_and_its_children', async () => {
    const { runs, outputs, changes } = harness(project('serveur'))
    const run = runs.start(G, 'attendre')
    await until(() => outputs.some((event) => event.chunk.includes('serveur pret')))
    expect(() => runs.start(G, 'attendre')).toThrow(/tourne déjà/)
    expect(runs.stop(run.runId)).toEqual({ ok: true })
    await until(() => changes.some((change) => change.runId === run.runId && change.state === 'stopped'))
    runs.dismiss(run.runId)
    expect(runs.list()).toEqual([])
  })

  it('should_refuse_an_untrusted_project_an_unknown_script_and_the_app_folder', () => {
    const dir = project('mefiance')
    const { runs } = harness(dir, false)
    expect(runs.scripts(G).trusted).toBe(false)
    expect(() => runs.start(G, 'bonjour')).toThrow(/pas de confiance/)
    expect(runs.trust(G, true).trusted).toBe(true)
    expect(() => runs.start(G, 'inconnu')).toThrow(/n’existe pas/)
    expect(() => runs.setFavorite(G, 'inconnu')).toThrow(/n’existe pas/)
    expect(runs.setFavorite(G, 'attendre').favorite).toBe('attendre')
    expect(() => harness(dataDir).runs.scripts(G)).toThrow(/données de l’app/)
    expect(() => harness(null).runs.scripts(G)).toThrow(/introuvable/)
  })

  it('should_open_only_a_local_address_announced_by_this_run', async () => {
    const { runs, changes, opened } = harness(project('adresse'))
    const run = runs.start(G, 'annoncer')
    await until(() => changes.some((change) => change.runId === run.runId && change.state !== 'running'))
    await runs.openUrl(run.runId, 'http://localhost:5173/')
    expect(opened).toEqual(['http://localhost:5173/'])
    await expect(runs.openUrl(run.runId, 'https://exemple.invalid/')).rejects.toThrow(/pas été annoncée/)
    await expect(runs.openUrl(run.runId, 'http://localhost:9999/')).rejects.toThrow(/pas été annoncée/)
    expect(opened).toHaveLength(1)
  })
})
