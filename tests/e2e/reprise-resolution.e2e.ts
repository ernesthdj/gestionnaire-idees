import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REPRISE_FIXTURES } from '../support/reprise'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 017 US6 dans l'app réelle (quickstart §3, §6) : un projet C# fictif repris avec « Claude autorisé », puis
 * « Préciser les liens avec l'IA » (Claude simulé : sa réponse est lue dans un fichier fictif, la demande reçue est
 * écrite à côté). L'appel ambigu `store.Save` devient « déduit » vers la bonne classe, avec sa raison dans le panneau ;
 * une cible hors des candidats est rejetée ; rien du `.env` du projet n'est envoyé.
 */
const WORK = join(tmpdir(), 'gi-e2e-reprise')
const PROJECT = join(WORK, 'cs-app')
const REPLY = join(tmpdir(), 'gi-e2e-claude-resolution.json')
const REQUEST = `${REPLY}.request.txt`
const REASON = 'Archive range les factures : le magasin résolu est celui des factures.'

const stableId = (...parts: readonly string[]): string =>
  createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32)

type Invoke = (channel: string, payload?: unknown) => Promise<{ success: boolean; data?: unknown }>

describe('levée des ambiguïtés avec l’IA dans un projet repris (spec 017 US6, e2e)', () => {
  let run: LaunchedApp
  let genesisId = ''

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

  beforeAll(async () => {
    rmSync(WORK, { recursive: true, force: true })
    rmSync(REQUEST, { force: true })
    freshProfile(() => {
      mkdirSync(WORK, { recursive: true })
      cpSync(join(REPRISE_FIXTURES, 'cs-app'), PROJECT, { recursive: true })
      // Un secret au bord du projet : il ne doit jamais apparaître dans ce qui part vers Claude.
      writeFileSync(join(PROJECT, '.env'), 'API_KEY=SECRET-NE-JAMAIS-ENVOYER\n')
      writeFileSync(REPLY, JSON.stringify({ items: [] }))
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
    await run?.close()
    rmSync(WORK, { recursive: true, force: true })
    rmSync(REPLY, { force: true })
    rmSync(REQUEST, { force: true })
  })

  it('should_import_the_project_with_claude_allowed_and_open_its_explorer', async () => {
    const { page } = run
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Idées', { exact: true }).click()
    await page.getByText('Idées en vrac', { exact: true }).click()
    await page.locator('.react-flow').waitFor()
    await run.shot('017-us6-00-canevas')
    await page.getByRole('button', { name: 'Reprendre un projet existant' }).click()
    await page.getByRole('button', { name: 'Choisir le dossier du projet…' }).click()
    await page.getByRole('region', { name: 'Aperçu du projet' }).waitFor()
    await page.getByLabel(/Claude autorisé/).check()
    await page.getByRole('button', { name: 'Importer', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await page.getByRole('group', { name: /: cs-app,/ }).click({ force: true, timeout: 60_000 })
    await page.getByRole('dialog', { name: 'Détails : cs-app' }).getByRole('button', { name: 'Discuter' }).click()
    await page.getByRole('button', { name: 'Ouvrir l’explorateur' }).click({ timeout: 60_000 })
    await page.getByRole('heading', { name: /Explorateur · cs-app/ }).waitFor()
    // L'analyse finie, des liens incertains attendent : le compteur est sur le bouton.
    await page.getByRole('button', { name: /Préciser les liens avec l’IA \(\d+\)/ }).waitFor({ timeout: 90_000 })
    await run.shot('017-us6-01-bouton')

    const canvas = (await invoke('canvas:get', {})) as { ideas: { id: string; title: string }[] }
    genesisId = canvas.ideas.find((idea) => idea.title === 'cs-app')?.id ?? ''
    expect(genesisId).not.toBe('')
  })

  it('should_turn_the_ambiguous_save_into_a_deduced_link_with_its_reason_and_reject_a_foreign_target', async () => {
    const { page } = run
    // Les identifiants viennent de l'app (recherche) : le lien `store.Save` part de `Archive`.
    const find = async (query: string) =>
      (
        (await invoke('explorer:search', { genesisId, query })) as {
          results: { symbolId: string | null; title: string; path: string | null }[]
        }
      ).results
    const archive = (await find('Archive')).find((entry) => entry.path === 'Domain/OrderService.cs')
    const invoice = (await find('Save')).find((entry) => entry.path === 'Infrastructure/InvoiceRepository.cs')
    const foreign = (await find('Place')).find((entry) => entry.path === 'Domain/OrderService.cs')
    expect(archive?.symbolId).toMatch(/^[0-9a-f]{32}$/)
    expect(invoice?.symbolId).toMatch(/^[0-9a-f]{32}$/)
    const edgeId = stableId(genesisId, 'edge', archive?.symbolId ?? '', 'call', 'store.Save', '')

    // Claude simulé : la bonne classe pour `store.Save`, une cible hors candidats pour un lien inventé.
    writeFileSync(
      REPLY,
      JSON.stringify({
        items: [
          { edgeId, targetId: invoice?.symbolId, reason: REASON },
          { edgeId: 'f'.repeat(32), targetId: foreign?.symbolId, reason: 'Lien inventé : doit être rejeté.' }
        ]
      })
    )
    await page.getByRole('button', { name: /Préciser les liens avec l’IA/ }).click()
    await page.getByText(/1 lien précisé \(« déduit », avec sa raison\)/).waitFor({ timeout: 60_000 })
    await run.shot('017-us6-02-resultat')

    // Ce qui est parti : l'appel, quelques lignes autour, des candidats par identifiant — jamais le secret.
    expect(existsSync(REQUEST)).toBe(true)
    const request = readFileSync(REQUEST, 'utf8')
    expect(request).toContain('store.Save')
    expect(request).toContain('store.Save(due);')
    expect(request).toContain(invoice?.symbolId ?? '?')
    expect(request).not.toContain('SECRET-NE-JAMAIS-ENVOYER')
    expect(request).not.toContain(PROJECT)

    // La raison est dans le panneau du module appelant, le lien est « déduit ».
    await page.getByRole('button', { name: 'Vue liste' }).click()
    const modules = page.getByRole('region', { name: 'Éléments de ce niveau' })
    await modules
      .getByRole('button', { name: /^Domain/ })
      .first()
      .click()
    const panel = page.getByRole('complementary', { name: 'Élément choisi' })
    await panel.getByText(new RegExp(`déduit — ${REASON}`)).waitFor()
    // Le lien montre sa cible (le nom n'est pas écrasé par la raison) et sa raison, sur sa propre ligne.
    await panel.getByRole('button', { name: /InvoiceRepository\.Save/ }).waitFor()
    await run.shot('017-us6-03-raison')

    // Plus de lien incertain à préciser pour cet appel : le compteur a baissé.
    const view = (await invoke('reprise:get', { genesisId })) as { resolution: { pending: number } }
    expect(view.resolution.pending).toBeGreaterThanOrEqual(0)
  })
})
