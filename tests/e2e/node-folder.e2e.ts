import { mkdirSync, readFileSync } from 'node:fs'
import { connect, type Socket } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pipeNameFor, tokenPathFor } from '../../src/main/infrastructure/mcp/endpoint'
import { FOLDERS_ENABLED } from '../../src/shared/ipc/folders'
import { DEMO_PROJECT, freshProfile, launchApp, PROFILE, type LaunchedApp } from './support/app'

/**
 * Spec 028 lot 1 (quickstart 1) dans l'app réelle : Claude, par le pont MCP comme une session Claude Code, rédige un
 * cours pour l'élément « Données » de la carte de structure de la démo ; un dossier de verre apparaît à côté de
 * l'élément, s'ouvre en éventail, et le cours se lit dans l'onglet du nœud. Le dossier glissé garde sa place après une
 * relance de l'app.
 */
type Invoke = (channel: string, payload?: unknown) => Promise<{ success: boolean; data?: unknown }>
interface CanvasData {
  readonly elements: readonly { readonly id: string; readonly title: string }[]
  readonly steps: readonly { readonly id: string; readonly title: string }[]
  readonly folders?: readonly { readonly neuronId: string; readonly offset: { x: number; y: number }; moved: boolean }[]
}

/** Appel d'un outil du pont par le canal nommé du profil, comme le relais de Claude Code. */
async function bridge(tool: string, args: unknown): Promise<{ ok: boolean; result?: { text: string } }> {
  const token = readFileSync(tokenPathFor(PROFILE), 'utf8').trim()
  const socket: Socket = await new Promise((resolve, reject) => {
    const client = connect(pipeNameFor(PROFILE), () => resolve(client))
    client.once('error', reject)
  })
  socket.setEncoding('utf8')
  const lines: unknown[] = []
  let buffer = ''
  const received = new Promise<void>((resolve) => {
    socket.on('data', (chunk: string) => {
      buffer += chunk
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) if (part !== '') lines.push(JSON.parse(part))
      if (lines.length >= 2) resolve()
    })
  })
  socket.write(`${JSON.stringify({ hello: 'gi-mcp/1', token })}\n`)
  socket.write(`${JSON.stringify({ id: 1, tool, args })}\n`)
  await received
  socket.end()
  return lines[1] as { ok: boolean; result?: { text: string } }
}

// Dossiers désactivés le 2026-10-12 (`FOLDERS_ENABLED`) : ce parcours revient quand on les rallume.
describe.skipIf(!FOLDERS_ENABLED)('dossier d’un nœud (spec 028 lot 1, e2e)', () => {
  let run: LaunchedApp
  let element = ''

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
  const openCanvas = async (): Promise<void> => {
    const { page } = run
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Idées', { exact: true }).click()
    // Lié à un dossier existant, le genesis de la démo a son propre canevas (spec 024).
    await page.getByText('Projet démo : application de notes', { exact: true }).first().click()
    await page.locator('.react-flow').waitFor()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
  }

  beforeAll(async () => {
    // Le genesis de la carte de structure est lié à ce dossier fictif : le cours y est écrit (docs/brainstormer).
    freshProfile(() => mkdirSync(DEMO_PROJECT, { recursive: true }))
    run = await launchApp()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_show_a_glass_folder_beside_the_element_when_claude_writes_a_course_for_it', async () => {
    await openCanvas()
    await run.shot('028-lot1-00-avant')
    const canvas = (await invoke('canvas:get', {})) as CanvasData
    element = canvas.elements.find((entry) => entry.title === 'Données')?.id ?? ''
    expect(element).not.toBe('')
    const answer = await bridge('document_ecrire', {
      id: element,
      titre: 'Cours : la base locale',
      contenu: '# La base locale\n\n> [!NOTE]\n> Cours de démonstration.\n\n- Fichier chiffré\n- Sauvegarde nocturne'
    })
    expect(answer).toMatchObject({ ok: true })
    const folder = run.page.getByRole('button', { name: /^Ouvrir le dossier de « Données », 1 fichier, nouveau$/ })
    await folder.waitFor({ timeout: 30_000 })
    await run.shot('028-lot1-01-dossier')

    await folder.click()
    const sheet = run.page.getByRole('button', { name: /cours-la-base-locale\.md/ })
    await sheet.waitFor()
    await run.shot('028-lot1-02-eventail')
    await sheet.click()
    const side = run.page.getByRole('complementary', { name: 'Panneau de droite' })
    const reader = side.getByRole('region', { name: 'Document : Cours : la base locale' })
    await reader.getByRole('heading', { name: 'La base locale' }).waitFor()
    await run.shot('028-lot1-03-lecteur')
    // Ouvert : plus « nouveau ».
    await run.page.getByRole('button', { name: /^Fermer le dossier de « Données », 1 fichier$/ }).waitFor()
  })

  it('should_keep_the_dragged_place_of_the_folder_after_a_restart', async () => {
    const { page } = run
    await page.keyboard.press('Escape')
    const folderNode = page.locator(`.react-flow__node[data-id="folder-${element}"]`)
    const box = await folderNode.boundingBox()
    if (box === null) throw new Error('dossier introuvable')
    // Glissé par son verre (le bas du dossier), pas par une feuille.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height + 20, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(async () => ((await invoke('canvas:get', {})) as CanvasData).folders?.[0]?.moved, { timeout: 10_000 })
      .toBe(true)
    const saved = ((await invoke('canvas:get', {})) as CanvasData).folders?.[0]?.offset
    await run.close()

    // Relance sur la même base (le profil e2e est sinon remis à neuf).
    run = await launchApp({ GI_E2E_KEEP: '1' })
    await openCanvas()
    await run.page.getByRole('button', { name: /^Ouvrir le dossier de « Données », 1 fichier$/ }).waitFor()
    const again = ((await invoke('canvas:get', {})) as CanvasData).folders?.[0]
    expect(again?.offset).toEqual(saved)
    await run.shot('028-lot1-04-apres-relance')
  })

  it('should_file_the_document_of_a_plan_step_below_the_step_without_covering_the_plan', async () => {
    const { page } = run
    await page.getByRole('button', { name: '← Projets' }).click()
    await page.getByText('Idées en vrac', { exact: true }).click()
    await page.locator('.react-flow').waitFor()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    const canvas = (await invoke('canvas:get', {})) as CanvasData
    const step = canvas.steps.find((entry) => entry.title === 'Choisir l’hébergeur')?.id ?? ''
    expect(step).not.toBe('')
    expect(await bridge('document_ecrire', { id: step, titre: 'Comparatif', contenu: '# Comparatif' })).toMatchObject({
      ok: true
    })
    await page.getByRole('button', { name: /^Ouvrir le dossier de « Choisir l’hébergeur », 1 fichier/ }).waitFor()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await run.shot('028-lot1-05-etape')
  })
})
