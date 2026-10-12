import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { writeBenchProject } from '../support/benchProject'
import { freshProfile, launchApp, SHOTS, type LaunchedApp } from './support/app'

/**
 * Spec 017 T036 — mesures SC-004 et SC-005 dans l'app réelle, sur le poste qui lance le test : un projet fictif de
 * 5 000 fichiers (TS, C#, PHP) importé par l'interface, analysé dans le processus séparé de l'app.
 * - SC-004 : analyse complète < 2 min, l'app restant utilisable (échanges avec le main et images de l'interface
 *   mesurés pendant l'analyse) ; réanalyse après la modification d'un fichier < 10 s.
 * - SC-005 : passage d'un niveau à l'autre de l'explorateur < 1 s ; déplacement de la carte fluide.
 * Claude simulé (réponse vide) : le guide qui suit l'analyse ne lance aucun vrai modèle. Résultats écrits dans
 * `test-results/e2e/reprise-bench.json` et reportés dans `specs/017-reprise-voir/research.md`.
 */
const WORK = join(tmpdir(), 'gi-e2e-bench')
const PROJECT = join(WORK, 'bench-5000')
const REPLY = join(tmpdir(), 'gi-e2e-claude-bench.json')

type Invoke = (channel: string, payload?: unknown) => Promise<{ success: boolean; data?: unknown }>
interface ProjectState {
  readonly analysis: {
    readonly state: string
    readonly analyzedAt: string | null
    readonly stats: { readonly files: number; readonly edges: number; readonly symbols: number } | null
  }
}

const percentile = (values: readonly number[], rank: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * rank))] ?? 0
}

describe('reprise d’un projet de 5 000 fichiers : mesures (spec 017 T036, SC-004, SC-005)', () => {
  let run: LaunchedApp
  let genesisId = ''
  const results: Record<string, unknown> = {}

  const invoke = async (channel: string, payload: unknown): Promise<unknown> => {
    const result = await run.page.evaluate(
      ([name, body]) =>
        (globalThis as unknown as { api: { invoke: Invoke } }).api.invoke(name as string, body) as Promise<{
          success: boolean
          data?: unknown
        }>,
      [channel, payload] as const
    )
    expect(result.success).toBe(true)
    return result.data
  }
  const state = async (): Promise<ProjectState> => (await invoke('reprise:get', { genesisId })) as ProjectState

  /** Attend la fin d'une analyse ; pendant ce temps, mesure les allers-retours avec le main. */
  const waitAnalysis = async (previous: string | null): Promise<{ ms: number; ipc: number[] }> => {
    const started = Date.now()
    const ipc: number[] = []
    for (;;) {
      const asked = Date.now()
      const current = await state()
      ipc.push(Date.now() - asked)
      if (current.analysis.state !== 'running' && current.analysis.analyzedAt !== previous) {
        return { ms: Date.now() - started, ipc }
      }
      if (Date.now() - started > 240_000) throw new Error('analyse trop longue (> 4 min)')
      await new Promise((done) => setTimeout(done, 100))
    }
  }

  /** Images de l'interface : écarts entre deux `requestAnimationFrame`, enregistrés dans la page. */
  const startFrames = async (): Promise<void> => {
    await run.page.evaluate(() => {
      const holder = globalThis as unknown as {
        __frames: number[]
        __framesOn: boolean
        requestAnimationFrame: (callback: (now: number) => void) => number
      }
      holder.__frames = []
      holder.__framesOn = true
      let last = performance.now()
      const tick = (now: number): void => {
        holder.__frames.push(now - last)
        last = now
        if (holder.__framesOn) holder.requestAnimationFrame(tick)
      }
      holder.requestAnimationFrame(tick)
    })
  }
  const stopFrames = async (): Promise<number[]> =>
    run.page.evaluate(() => {
      const holder = globalThis as unknown as { __frames: number[]; __framesOn: boolean }
      holder.__framesOn = false
      return holder.__frames.slice(1)
    })

  beforeAll(async () => {
    rmSync(WORK, { recursive: true, force: true })
    freshProfile(() => {
      mkdirSync(PROJECT, { recursive: true })
      results['project'] = writeBenchProject(PROJECT)
      writeFileSync(REPLY, '{}')
    })
    run = await launchApp({ GI_E2E_CLAUDE_REPLY: REPLY })
    await run.app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [path]
      })) as unknown as typeof dialog.showOpenDialog
    }, PROJECT)
  })
  afterAll(async () => {
    writeFileSync(join(SHOTS, 'reprise-bench.json'), `${JSON.stringify(results, null, 2)}\n`)
    await run?.close()
    rmSync(WORK, { recursive: true, force: true })
    rmSync(REPLY, { force: true })
  })

  it('should_analyse_5000_files_in_under_two_minutes_while_the_app_stays_responsive', async () => {
    const { page } = run
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Idées', { exact: true }).click()
    await page.getByText('Idées en vrac', { exact: true }).click()
    await page.locator('.react-flow').waitFor()
    await page.getByRole('button', { name: 'Reprendre un projet existant' }).click()
    await page.getByRole('button', { name: 'Choisir le dossier du projet…' }).click()
    await page.getByRole('region', { name: 'Aperçu du projet' }).waitFor({ timeout: 60_000 })
    await page.getByLabel(/Claude autorisé/).check()
    // Bilan de l'analyse : donné par l'évènement de fin (la vue du projet ne le garde pas).
    await page.evaluate(() => {
      const holder = globalThis as unknown as {
        api: { on: (event: string, listener: (payload: unknown) => void) => () => void }
        __analysisDone: unknown[]
      }
      holder.__analysisDone = []
      holder.api.on('reprise:analysisDone', (payload) => holder.__analysisDone.push(payload))
    })
    await startFrames()
    await page.getByRole('button', { name: 'Importer', exact: true }).click()
    const canvas = (await invoke('canvas:get', {})) as { ideas: { id: string; title: string }[] }
    genesisId = canvas.ideas.find((idea) => idea.title === 'bench-5000')?.id ?? ''
    expect(genesisId).not.toBe('')

    const full = await waitAnalysis(null)
    const frames = await stopFrames()
    const stats = (await page.evaluate(
      () => (globalThis as unknown as { __analysisDone: { stats: unknown }[] }).__analysisDone[0]?.stats
    )) as { files: number; analyzed: number; symbols: number; edges: number } | undefined
    results['sc004_full'] = {
      ms: full.ms,
      stats,
      ipc: { p95: percentile(full.ipc, 0.95), max: Math.max(...full.ipc), samples: full.ipc.length },
      frames: { p95: percentile(frames, 0.95), max: Math.max(...frames), samples: frames.length }
    }
    await run.shot('017-t036-01-analyse')
    expect(stats?.analyzed).toBeGreaterThanOrEqual(5000)
    expect(full.ms).toBeLessThan(120_000)
    // Utilisable : le main répond vite et l'interface continue de dessiner pendant l'analyse.
    expect(percentile(full.ipc, 0.95)).toBeLessThan(250)
    expect(percentile(frames, 0.95)).toBeLessThan(100)
  })

  it('should_reanalyse_after_one_file_changes_in_under_ten_seconds', async () => {
    const before = (await state()).analysis.analyzedAt
    appendFileSync(
      join(PROJECT, 'packages', 'pkg0', 'src', 'feature0', 'F0x0Controller.ts'),
      '\nexport function ajoutee(): number {\n  return 1\n}\n'
    )
    await invoke('reprise:analyze', { genesisId })
    const again = await waitAnalysis(before)
    results['sc004_reanalysis'] = { ms: again.ms }
    expect(again.ms).toBeLessThan(10_000)
  })

  it('should_switch_explorer_levels_in_under_a_second_and_pan_smoothly', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await page.getByRole('group', { name: /: bench-5000,/ }).click({ force: true, timeout: 60_000 })
    await page.getByRole('dialog', { name: 'Détails : bench-5000' }).getByRole('button', { name: 'Discuter' }).click()
    const opened = Date.now()
    await page.getByRole('button', { name: 'Ouvrir l’explorateur' }).click({ timeout: 60_000 })
    await page.getByRole('heading', { name: /Explorateur · bench-5000/ }).waitFor()
    await page.locator('.react-flow__node').first().waitFor()
    const first = Date.now() - opened
    await run.shot('017-t036-02-explorateur')
    results['explorerNodes'] = await page.locator('.react-flow__node').allInnerTexts()

    // Modules → dossiers d'un module → retour aux modules : chaque passage jusqu'aux nœuds dessinés.
    const switches: number[] = []
    const crumbs = page.getByRole('navigation', { name: 'Fil d’Ariane' })
    const moduleNode = page.locator('.react-flow__node').filter({ hasText: 'Bench0' }).first()
    // Choisir le module (son détail s'affiche), puis l'ouvrir : chaque geste chronométré jusqu'à l'écran à jour.
    let started = Date.now()
    await moduleNode.click()
    const panel = page.getByRole('complementary', { name: 'Élément choisi' })
    await panel.getByText('dotnet/Bench0').waitFor()
    const selectMs = Date.now() - started
    started = Date.now()
    await moduleNode.dblclick()
    await crumbs.getByText('Bench0').waitFor()
    await page.locator('.react-flow__node').first().waitFor()
    switches.push(Date.now() - started)
    await run.shot('017-t036-03-niveau-2')
    started = Date.now()
    await crumbs.getByRole('button').first().click()
    await crumbs.getByText('Bench0').waitFor({ state: 'detached' })
    await page.locator('.react-flow__node').first().waitFor()
    switches.push(Date.now() - started)

    // Déplacement de la carte : glisser le fond pendant une seconde, images mesurées.
    const pane = page.locator('.react-flow__pane')
    const box = await pane.boundingBox()
    if (box === null) throw new Error('carte introuvable')
    await startFrames()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let step = 0; step < 60; step += 1) {
      await page.mouse.move(box.x + box.width / 2 + step * 4, box.y + box.height / 2 + step * 2)
    }
    await page.mouse.up()
    const pan = await stopFrames()
    results['sc005'] = {
      openExplorerMs: first,
      selectMs,
      switchesMs: switches,
      pan: { p95: percentile(pan, 0.95), max: Math.max(...pan), samples: pan.length }
    }
    expect(selectMs).toBeLessThan(1_000)
    for (const ms of switches) expect(ms).toBeLessThan(1_000)
    expect(percentile(pan, 0.95)).toBeLessThan(50)
  })
})
