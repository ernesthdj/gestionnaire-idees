import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { git } from '../support/gitRepos'
import { buildVault } from '../support/vault'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 024 dans l'app réelle, de zéro (quickstart scénarios 1, 2, 5) : profil vide, coffre fictif vide ; le Project
 * Manager s'affiche d'abord, « Nouveau brainstorm › De zéro » crée le projet dans le coffre et ouvre son canevas sur la
 * conversation ; après un redémarrage, « Reprendre » rouvre le canevas tel qu'il était (cadrage, carte ouverte).
 */
const VAULT = join(tmpdir(), 'gi-e2e-coffre')
const ROOT = join(VAULT, 'projects')
/** La première consigne est dans un champ de la conversation (évalué dans la page). */
const PROMPT_SHOWN = (): boolean => {
  const page = globalThis as unknown as {
    document: { querySelectorAll(selector: string): ArrayLike<{ readonly value: string }> }
  }
  return Array.from(page.document.querySelectorAll('textarea')).some((area) => area.value.includes('« Essai local »'))
}
const ENV = { GI_E2E_VAULT: ROOT, GI_E2E_EMPTY: '1' }

const viewportOf = async (run: LaunchedApp): Promise<string> =>
  run.page
    .locator('.react-flow__viewport')
    .first()
    .evaluate((element) => {
      return (element as unknown as { style: { transform: string } }).style.transform
    })

describe('Project Manager de zéro (spec 024, e2e)', () => {
  let run: LaunchedApp
  let zoomed = ''

  beforeAll(async () => {
    rmSync(VAULT, { recursive: true, force: true })
    freshProfile(() => buildVault(VAULT))
    run = await launchApp(ENV)
  })
  afterAll(async () => {
    await run?.close()
    rmSync(VAULT, { recursive: true, force: true })
  })

  it('should_show_the_project_manager_first_with_nothing_to_load', async () => {
    const { page } = run
    await page.getByRole('heading', { name: 'Project Manager' }).waitFor()
    await page.getByText(ROOT).first().waitFor()
    // Aucun canevas avant le choix (D5), et « Nouveau brainstorm » proposé d'office.
    expect(await page.locator('.react-flow').count()).toBe(0)
    await page.getByRole('heading', { name: 'Nouveau projet de zéro' }).waitFor()
    await run.shot('024-01-project-manager-vide')
    await page.getByRole('button', { name: /Charger un brainstorm existant/ }).click()
    await page.getByText('Aucun brainstorm pour l’instant').waitFor()
    await page.getByRole('button', { name: /Nouveau brainstorm/ }).click()
  })

  it('should_create_a_project_from_scratch_and_open_its_canvas_on_the_conversation', async () => {
    const { page } = run
    await page.getByLabel('Nom', { exact: true }).fill('Essai local')
    expect(await page.getByLabel('Nom du dossier').inputValue()).toBe('essai-local')
    await page.getByLabel('Type').selectOption('Web App')
    await page.getByLabel('Description').fill('Un carnet de recettes fictif')
    await run.shot('024-02-formulaire')
    await page.getByRole('button', { name: 'Créer et ouvrir le canevas' }).click()
    await page.getByRole('button', { name: '← Projets' }).waitFor({ timeout: 60_000 })
    await page.locator('.react-flow').waitFor()

    // Le projet est dans le coffre, avec la structure ProjectMaster, son dépôt et son entrée au registre.
    const dir = join(ROOT, 'essai-local')
    for (const file of ['CLAUDE.md', join('docs', 'JOURNAL.md'), '.git']) expect(existsSync(join(dir, file))).toBe(true)
    expect(git(dir, ['log', '--format=%s']).trim()).toMatch(/essai-local/)
    const registry = JSON.parse(readFileSync(join(VAULT, '.hub', 'registry.json'), 'utf8')) as {
      projects: Record<string, { name: string; folder: string }>
    }
    expect(registry.projects['essai-local']).toMatchObject({ name: 'Essai local', folder: 'essai-local' })

    // La conversation du genesis s'ouvre, la première consigne pré-remplie (jamais envoyée sans geste).
    await page.waitForFunction(PROMPT_SHOWN)
    await run.shot('024-03-canevas-conversation')

    // Un cadrage changé à la main est gardé (écrit en différé).
    await page.getByRole('button', { name: 'Zoomer' }).first().click()
    await page.waitForTimeout(1200)
    zoomed = await viewportOf(run)
    expect(zoomed).toMatch(/scale/)
  })

  it('should_list_the_new_brainstorm_and_resume_it_identically_after_a_restart', async () => {
    await run.page.getByRole('button', { name: '← Projets' }).click()
    await run.page.getByRole('button', { name: /Reprendre « Essai local »/ }).waitFor()
    await run.close()

    run = await launchApp({ ...ENV, GI_E2E_KEEP: '1' })
    const { page } = run
    await page.getByRole('heading', { name: 'Project Manager' }).waitFor()
    await run.shot('024-04-reprendre')
    await page.getByRole('button', { name: /Reprendre « Essai local »/ }).click()
    await page.locator('.react-flow').waitFor()
    await page.waitForTimeout(1500)
    await run.shot('024-05-repris')
    expect(await viewportOf(run)).toBe(zoomed)
    await run.shot('024-05-repris')
  })
})
