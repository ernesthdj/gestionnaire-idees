import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Un `.md` du projet lu dans l'app réelle : encadré `> [!IMPORTANT]` et schéma ```mermaid dessiné en image, malgré la
 * politique de sécurité du contenu (CSP) de l'interface ; un schéma invalide garde son code source.
 */
const GENESIS = 'Projet démo : application de notes'

const FOUNDATION = [
  '# Actif = Passif',
  '',
  '> [!IMPORTANT]',
  '> **Pour tout emploi d’argent, il existe une ressource équivalente.**',
  '',
  '```mermaid',
  'flowchart LR',
  '    R["🟧 RESSOURCES<br/>d’où vient l’argent<br/><b>PASSIF</b>"]',
  '    E["🟦 EMPLOIS<br/>à quoi il sert<br/><b>ACTIF</b>"]',
  '    R -->|"financent"| E',
  '    classDef passif fill:#fde8cf,stroke:#e08a1e,color:#5a3300',
  '    classDef actif fill:#d6e8fb,stroke:#2f7fd3,color:#0b2e55',
  '    class R passif',
  '    class E actif',
  '```',
  '',
  '```mermaid',
  'flowchart ??? pas un schéma',
  '```',
  ''
].join('\n')

describe('fichier .md mis en forme : encadrés et schémas Mermaid (e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => {
      // Même préparation que l'e2e du panneau (spec 027) : un dépôt git, la fondation par-dessus.
      buildScenario(DEMO_PROJECT, 'trois-auteurs')
      mkdirSync(join(DEMO_PROJECT, 'docs'), { recursive: true })
      writeFileSync(join(DEMO_PROJECT, 'docs', 'FOUNDATION.md'), FOUNDATION)
    })
    run = await launchApp()
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_draw_the_mermaid_diagram_and_the_callout_when_a_markdown_file_is_read', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    // La vue Workflow est dessinée (le nœud du genesis y est remplacé) avant de cliquer dessus.
    await page.getByText(/Brainstorme une idée, puis spécifie-la/).waitFor()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    // « Tout afficher » anime la vue : un clic pendant l'animation peut tomber à côté du nœud, on le refait.
    const card = page.getByRole('dialog', { name: `Détails : ${GENESIS}` })
    await expect
      .poll(
        async () => {
          if (!(await card.isVisible()))
            await page.getByRole('group', { name: new RegExp(`: ${GENESIS},`) }).click({ force: true })
          return card.isVisible()
        },
        { interval: 1_000, timeout: 15_000 }
      )
      .toBe(true)
    await card.getByRole('button', { name: 'Lire la fondation' }).click()
    const reader = page.getByRole('region', { name: 'docs/FOUNDATION.md' })
    await reader.getByRole('heading', { name: 'Actif = Passif' }).waitFor()
    await reader
      .locator('blockquote')
      .getByText(/^❗ Important$/)
      .waitFor()
    const diagram = reader.getByRole('img', { name: 'Schéma Mermaid' })
    await diagram.waitFor({ timeout: 20_000 })
    // L'image est réellement décodée (pas une icône cassée) et a une taille.
    await expect
      .poll(() =>
        diagram.evaluate((image) => {
          const loaded = image as unknown as { readonly complete: boolean; readonly naturalWidth: number }
          return loaded.complete ? loaded.naturalWidth : 0
        })
      )
      .toBeGreaterThan(100)
    await reader.getByText('Schéma Mermaid illisible : code source affiché.').waitFor()
    expect(await reader.locator('script').count()).toBe(0)
    const light = await diagram.getAttribute('src')
    await reader.getByRole('button', { name: /Agrandir/ }).click()
    await run.shot('md-mermaid-01-fondation')
    // Thème sombre (carbone) : le schéma est redessiné aux couleurs sombres de Mermaid.
    await page.getByRole('button', { name: /Réduire/ }).click()
    await page.getByRole('button', { name: 'Thème carbone' }).click()
    await expect.poll(() => diagram.getAttribute('src')).not.toBe(light)
    await reader.getByRole('button', { name: /Agrandir/ }).click()
    await run.shot('md-mermaid-02-fondation-sombre')
  })
})
