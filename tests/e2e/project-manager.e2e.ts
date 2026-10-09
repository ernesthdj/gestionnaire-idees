import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
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

/** Le sélecteur de dossier natif répond `folder` (remplacé dans le main de l'app, jamais sur le bureau). */
const pickFolderWith = async (run: LaunchedApp, folder: string): Promise<void> => {
  await run.app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [path]
    })) as unknown as typeof dialog.showOpenDialog
  }, folder)
}

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
    // Le cadrage de référence : celui de la carte au moment où on la quitte (stable).
    await run.page.waitForTimeout(1000)
    zoomed = await viewportOf(run)
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

  it('should_return_to_a_save_point_and_undo_the_return', async () => {
    const { page } = run
    const idea = page.locator('.react-flow__node').filter({ hasText: 'Recette du jour' })
    await page.getByRole('button', { name: /Fermer les cartes/ }).click()
    await page.getByRole('button', { name: /Points de sauvegarde/ }).click()
    await page.getByLabel('Nom du point').fill('avant refonte')
    await page.getByRole('button', { name: 'Poser', exact: true }).click()
    await page.getByRole('button', { name: 'Points de sauvegarde (1)' }).waitFor()
    await page.getByRole('button', { name: 'Points de sauvegarde (1)' }).click()

    // Une idée née après le point.
    await page.locator('.react-flow__pane').dblclick({ position: { x: 80, y: 80 } })
    await page.getByLabel('Nouvelle idée').fill('Recette du jour')
    await page.getByLabel('Nouvelle idée').press('Enter')
    await idea.first().waitFor()
    await run.shot('024-06-apres-le-point')

    await page.getByRole('button', { name: 'Points de sauvegarde (1)' }).click()
    await page.getByRole('button', { name: 'Revenir à avant refonte' }).click()
    await page.getByRole('button', { name: 'Confirmer le retour' }).click()
    await page.getByRole('button', { name: /Annuler le retour à « avant refonte »/ }).waitFor()
    await page.waitForTimeout(800)
    expect(await idea.count()).toBe(0)
    await run.shot('024-07-retour-au-point')

    await page.getByRole('button', { name: /Annuler le retour à « avant refonte »/ }).click()
    await idea.first().waitFor()
    await run.shot('024-08-retour-annule')
  })

  it('should_adopt_a_project_in_progress_elsewhere_then_relink_it_after_a_move', async () => {
    const outside = join(tmpdir(), 'gi-e2e-ailleurs')
    const project = join(outside, 'projet-groupe')
    const moved = join(outside, 'deplace')
    rmSync(outside, { recursive: true, force: true })
    mkdirSync(join(project, 'src'), { recursive: true })
    writeFileSync(join(project, 'src', 'app.ts'), 'export {}\n')
    writeFileSync(join(project, '.gitignore'), 'node_modules/\n')
    await pickFolderWith(run, project)

    const { page } = run
    await page.getByRole('button', { name: '← Projets' }).click()
    await page.getByRole('button', { name: /Nouveau brainstorm/ }).click()
    await page.getByRole('button', { name: /Projet en chantier/ }).click()
    await page.getByRole('button', { name: 'Choisir le dossier du projet…' }).click()
    await page.getByRole('list', { name: 'Écritures prévues' }).waitFor()
    await run.shot('024-09-chantier-apercu')
    // Rien n'est écrit avant le clic.
    expect(existsSync(join(project, '.brainstormer'))).toBe(false)
    await page.getByLabel('Nom', { exact: true }).fill('Projet de groupe')
    await page.getByRole('button', { name: 'Poser le vault et ouvrir' }).click()
    await page.getByText('Projet de groupe', { exact: true }).first().waitFor()
    await page.locator('.react-flow').waitFor()
    await run.shot('024-10-chantier-ouvert')
    expect(existsSync(join(project, '.brainstormer', 'brainstorm.json'))).toBe(true)
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toBe('node_modules/\n.brainstormer/\n')
    expect(readFileSync(join(project, 'src', 'app.ts'), 'utf8')).toBe('export {}\n')
    const refs = JSON.parse(readFileSync(join(VAULT, '.hub', 'external.json'), 'utf8')) as {
      projects: { name: string; path: string }[]
    }
    expect(refs.projects.map((ref) => ref.name)).toEqual(['Projet de groupe'])

    // Le projet est déplacé app fermée : il est grisé, puis « Relier… » le retrouve par son vault.
    await run.close()
    mkdirSync(moved, { recursive: true })
    renameSync(project, join(moved, 'projet-groupe'))
    run = await launchApp({ ...ENV, GI_E2E_KEEP: '1' })
    await run.page.getByRole('heading', { name: 'Project Manager' }).waitFor()
    await run.page.getByRole('button', { name: /Charger un brainstorm existant/ }).click()
    await run.page.getByText('dossier introuvable').waitFor()
    await run.shot('024-11-chantier-introuvable')
    await pickFolderWith(run, join(moved, 'projet-groupe'))
    await run.page.getByRole('button', { name: 'Relier Projet de groupe à son nouveau dossier' }).click()
    await run.page.getByRole('button', { name: 'Ouvrir Projet de groupe' }).and(run.page.locator(':enabled')).waitFor()
    await run.page.getByRole('button', { name: 'Ouvrir Projet de groupe' }).click()
    await run.page.locator('.react-flow').waitFor()
    await run.shot('024-12-chantier-relie')
    rmSync(outside, { recursive: true, force: true })
  })
})
