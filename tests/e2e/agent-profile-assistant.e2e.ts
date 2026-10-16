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
    await conversation.getByLabel('Message à Claude').fill('Un agent QA qui relit les tests avant chaque fusion.')
    await conversation.getByRole('button', { name: 'Envoyer' }).click()
    await conversation.getByText(/il me reste à relire le diff/).waitFor({ timeout: 15_000 })
    await page.getByRole('textbox', { name: /Nom/ }).fill('Chef qualité')
    // L'agent minté (L1o D21) : sa chambre, ses calques et leur rareté, son rang, avant même sa création.
    await page.getByRole('region', { name: /^Agent minté : Chef qualité, / }).waitFor()
    const save = page.getByRole('button', { name: '✦ Créer l’agent' })
    await expect.poll(() => save.isEnabled()).toBe(true)
    await page.waitForTimeout(1500)
    await run.shot('t019-01-creer-avec-claude')
    // « Créer l'agent » : l'éclat de la naissance, puis le profil ; la conversation se ferme avec la fiche.
    await save.click()
    await page.waitForTimeout(300)
    await run.shot('t021-02-naissance')
    await page.getByText('Chef qualité', { exact: true }).waitFor()
    await conversation.waitFor({ state: 'detached' })
  })
})
