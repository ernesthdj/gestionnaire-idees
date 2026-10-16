import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshProfile, launchApp, settled, type LaunchedApp } from './support/app'

/**
 * Spec 032 D18 dans l'app réelle : un brainstorm seulement « suffisant » ; ses tâches portent l'anneau de contexte à
 * 66 % et restent des ébauches ; aucune n'est « Bosser ici ». Après « Mettre à jour » (réponse simulée), la carte va
 * sur le brainstorm à compléter, « ▶ Compléter ici ».
 */
const DIR = join(tmpdir(), 'gi-e2e-contexte')

describe('jauge de contexte des tâches et « Compléter ici » (spec 032 D18, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    rmSync(DIR, { recursive: true, force: true })
    freshProfile(() => {
      mkdirSync(join(DIR, 'docs', 'brainstorm'), { recursive: true })
      writeFileSync(
        join(DIR, 'docs', 'brainstorm', 'L1-tri.md'),
        '# L1 — Tri des réparations\n\n**Maturité** : suffisant — manque : règles d’urgence · **Tâches** : docs/TACHES-TRI.md\n'
      )
      writeFileSync(
        join(DIR, 'docs', 'TACHES-TRI.md'),
        '# Tâches — Tri\n\n## Lot 1\n\n- [x] T001 Liste des réparations\n- [ ] T002 Tri par urgence\n'
      )
    })
    const reply = join(tmpdir(), 'gi-e2e-reponse-contexte.json')
    writeFileSync(reply, '{}')
    run = await launchApp({ GI_E2E_PROJECT: DIR, GI_E2E_CLAUDE_REPLY: reply })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(DIR, { recursive: true, force: true })
  })

  it('should_show_the_context_ring_on_each_task_and_point_to_the_brainstorm_to_complete', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    const sketch = page.getByLabel(/^Ébauche T002 · Tri par urgence, à faire, en attente du brainstorm, contexte 66 %/)
    await settled(sketch)
    await expect.poll(() => page.getByText('▶ Bosser ici').count()).toBe(0)
    await page.getByText('▶ Compléter ici').waitFor()
    await run.shot('032-D18-01-jauge-et-completer-ici')
    await page.getByRole('button', { name: 'Mettre à jour le Workflow' }).click()
    await page.getByText(/Aucune tâche n’a tout son contexte : complète d’abord « L1 — Tri des réparations »/).waitFor({
      timeout: 20_000
    })
    await expect.poll(() => page.locator('.react-flow__node.wf-arrived').count()).toBeGreaterThan(0)
    await run.shot('032-D18-02-apres-mise-a-jour')
  })
})
