import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Créer un profil d'agent avec Claude (docs/TACHES-AGENTS.md T019, L1o D15) dans l'app réelle : page Skills › Profils
 * d'agents, « ✦ Créer avec Claude » ouvre la conversation à côté de la fiche, on décrit l'agent, Claude répond. La
 * conversation est simulée (`GI_E2E_CLAUDE_REPLY` : aucun processus `claude`) ; la fiche reste modifiable à la main.
 */
describe('créer un profil d’agent avec Claude (T019, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile()
    const reply = join(tmpdir(), 'gi-e2e-reponse-profil.json')
    writeFileSync(reply, '{}')
    run = await launchApp({ GI_E2E_CLAUDE_REPLY: reply })
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_open_the_conversation_beside_the_form_and_keep_the_form_editable', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Skills', exact: true }).click()
    await page.getByRole('button', { name: 'Profils d’agents' }).click()
    await page.getByRole('button', { name: '✦ Créer avec Claude' }).click()
    const conversation = page.getByRole('region', { name: /^Conversation/ })
    await conversation.waitFor()
    // Ses propres suggestions (pas celles des Skills), sur plusieurs lignes sans se chevaucher.
    await conversation.getByRole('button', { name: /^Aide-moi à créer un agent/ }).waitFor()
    await run.shot('t019-00-suggestions')
    await conversation.getByLabel('Message à Claude').fill('Un agent QA qui relit les tests avant chaque fusion.')
    await conversation.getByRole('button', { name: 'Envoyer' }).click()
    await conversation.getByText(/il me reste à relire le diff/).waitFor({ timeout: 15_000 })
    await page.getByRole('textbox', { name: /Nom/ }).fill('Chef qualité')
    // L'effet de surprise (L1o D22) : rien du personnage avant la création.
    expect(await page.getByRole('region', { name: /^Agent minté/ }).count()).toBe(0)
    const save = page.getByRole('button', { name: '✦ Créer l’agent' })
    await expect.poll(() => save.isEnabled()).toBe(true)
    await run.shot('t019-01-creer-avec-claude')
    // « Créer l'agent » : la fenêtre de l'agent, en grand, avec Félicitations et confettis ; la conversation de
    // création se ferme avec la fiche.
    await save.click()
    const reveal = page.getByRole('dialog', { name: '« Chef qualité » rejoint l’équipe' })
    await reveal.waitFor()
    await reveal.getByRole('region', { name: /^Agent minté : Chef qualité, / }).waitFor()
    await conversation.waitFor({ state: 'detached' })
    await page.waitForTimeout(700)
    await run.shot('t022-01-naissance')
    await page.waitForTimeout(1500)
    await run.shot('t022-02-revele')
    // « Discuter avec lui » : un tête-à-tête hors de toute tâche, avec la persona de son profil.
    await reveal.getByRole('button', { name: 'Discuter avec lui' }).click()
    const chat = reveal.getByRole('region', { name: /^Conversation/ })
    await chat.waitFor()
    await chat.getByLabel('Message à Claude').fill('Présente-toi.')
    await chat.getByRole('button', { name: 'Envoyer' }).click()
    await chat.getByText(/il me reste à relire le diff/).waitFor({ timeout: 15_000 })
    await run.shot('t022-03-tete-a-tete')
    await reveal.getByRole('button', { name: 'Fermer la fenêtre de Chef qualité' }).click()
    await reveal.waitFor({ state: 'detached' })
    // Depuis la liste : la même fenêtre, sans fête.
    await page.getByRole('button', { name: 'Voir l’agent Chef qualité' }).click()
    const again = page.getByRole('dialog', { name: 'Chef qualité' })
    await again.waitFor()
    expect(await again.getByText('Félicitations !').count()).toBe(0)
  })
})
