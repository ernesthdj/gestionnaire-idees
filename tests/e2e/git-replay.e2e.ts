import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AUTHORS, commit, initRepo } from '../support/gitRepos'
import { REPRISE_FIXTURES } from '../support/reprise'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 021 US5 lot 2 dans l'app réelle (L4g P5, E6) : un projet C# fictif, dépôt git à trois auteurs (chacun sa
 * couche), repris puis rejoué dans son explorateur ; chaque module prend la couleur et les initiales de son auteur
 * principal, le curseur remonte le temps, `Échap` quitte la rediffusion. Puis US7 : un fichier du projet (licence MIT)
 * est extrait dans `snippets/` d'un workspace ProjectMaster fictif, avec son en-tête d'attribution.
 */
const WORK = join(tmpdir(), 'gi-e2e-rediffusion')
const PROJECT = join(WORK, 'cs-app')
/** Workspace ProjectMaster fictif (`.hub/registry.json`, `projects/`, `snippets/`), passé par `GI_E2E_VAULT`. */
const VAULT = join(WORK, 'ProjectsMaster')
const MIT = 'MIT License\n\nCopyright (c) 2026 Auteur Fictif\n'
const fixture = (path: string): string => readFileSync(join(REPRISE_FIXTURES, 'cs-app', path), 'utf8')

describe('rediffusion git sur l’explorateur (spec 021 US5 lot 2, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    rmSync(WORK, { recursive: true, force: true })
    freshProfile(() => {
      initRepo(PROJECT)
      const files = (...paths: string[]): Record<string, string> =>
        Object.fromEntries(paths.map((path) => [path, fixture(path)]))
      commit(PROJECT, { ...files('App.csproj', 'Program.cs'), LICENSE: MIT }, 'chore: départ', AUTHORS.alice)
      commit(PROJECT, files('Domain/OrderService.cs', 'Domain/Stores.cs'), 'feat: domaine', AUTHORS.bob)
      commit(
        PROJECT,
        files('Infrastructure/InvoiceRepository.cs', 'Infrastructure/SqlOrderRepository.cs'),
        'feat: stockage',
        AUTHORS.chloe
      )
      commit(PROJECT, files('Controllers/OrdersController.cs', 'Logging/AuditLog.cs'), 'feat: api', AUTHORS.alice)
      for (const dir of ['.hub', 'projects', 'snippets']) mkdirSync(join(VAULT, dir), { recursive: true })
      writeFileSync(join(VAULT, '.hub', 'registry.json'), '{"projects":{}}\n')
    })
    run = await launchApp({ GI_E2E_VAULT: join(VAULT, 'projects') })
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
  })

  it('should_colour_each_module_by_its_main_author_and_go_back_in_time', async () => {
    const { page } = run
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Idées', { exact: true }).click()
    await page.getByText('Idées en vrac', { exact: true }).click()
    await page.locator('.react-flow').waitFor()
    await page.getByRole('button', { name: 'Reprendre un projet existant' }).click()
    await page.getByRole('button', { name: 'Choisir le dossier du projet…' }).click()
    await page.getByRole('region', { name: 'Aperçu du projet' }).waitFor()
    await page.getByLabel(/Local uniquement/).check()
    await page.getByRole('button', { name: 'Importer', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await page.getByRole('group', { name: /: cs-app,/ }).click({ force: true, timeout: 60_000 })
    await page.getByRole('dialog', { name: 'Détails : cs-app' }).getByRole('button', { name: 'Discuter' }).click()
    await page.getByRole('button', { name: 'Ouvrir l’explorateur' }).click({ timeout: 60_000 })
    await page.getByRole('heading', { name: /Explorateur · cs-app/ }).waitFor()
    await page.getByRole('group', { name: /module Domain/ }).waitFor({ timeout: 90_000 })

    await page.getByRole('button', { name: 'Rediffusion' }).click()
    const bar = page.getByRole('region', { name: 'Rediffusion' })
    await bar.getByText('4/4').waitFor()
    await bar.getByText('par lignes').waitFor()
    // Chaque couche a son auteur principal (nom accessible du nœud).
    await page.getByRole('group', { name: /module Domain.*rediffusion : Bob Fictif/ }).waitFor()
    await page.getByRole('group', { name: /module Infrastructure.*rediffusion : Chloé Fictive/ }).waitFor()
    await page.waitForTimeout(500)
    await run.shot('021-us5-03-rediffusion')

    // Au deuxième commit, l'infrastructure n'existait pas encore.
    await bar.getByRole('button', { name: 'Premier commit' }).click()
    await bar.getByRole('button', { name: 'Lire' }).waitFor()
    await bar.getByLabel('Commit rejoué').focus()
    await page.keyboard.press('ArrowRight')
    await bar.getByText('2/4').waitFor()
    await page.getByRole('group', { name: /module Infrastructure.*jamais touché/ }).waitFor()
    await run.shot('021-us5-04-rediffusion-passe')

    await page.keyboard.press('Escape')
    await bar.waitFor({ state: 'detached' })
    expect(await page.getByRole('group', { name: /rediffusion/ }).count()).toBe(0)
  })

  it('should_extract_a_file_into_the_workspace_with_its_license_and_attribution', async () => {
    const { page } = run
    await page.keyboard.press('Control+K')
    await page.getByRole('combobox', { name: 'Fichier ou fonction' }).fill('OrderService.cs')
    await page
      .getByRole('option', { name: /^▤?\s*OrderService\.cs/ })
      .first()
      .waitFor()
    await page.keyboard.press('Enter')
    const code = page.getByRole('region', { name: /^Code de Domain\/OrderService\.cs/ })
    await code.waitFor()
    await code.getByRole('button', { name: 'Extraire…' }).click()
    const dialog = page.getByRole('region', { name: 'Extraire ce fichier' })
    await dialog.getByText(/MIT/).first().waitFor()
    await dialog.getByLabel('Dossier').fill('csharp')
    await run.shot('021-us7-01-extraire')
    await dialog.getByRole('button', { name: 'Copier dans le workspace' }).click()
    await dialog.getByText('Écrit dans le workspace : snippets/csharp/OrderService.cs (ni commité ni lancé).').waitFor()
    const written = join(VAULT, 'snippets', 'csharp', 'OrderService.cs')
    expect(existsSync(written)).toBe(true)
    expect(readFileSync(written, 'utf8')).toMatch(
      /^\/\/ Extrait de .*Domain\/OrderService\.cs\n\/\/ Commit [0-9a-f]{12}/
    )
    expect(readFileSync(written, 'utf8')).toContain('// Licence : MIT')
  })
})
