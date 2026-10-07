import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DraftPanel } from '../../../src/renderer/src/skills/DraftPanel'
import { SkillPanel } from '../../../src/renderer/src/skills/SkillPanel'
import type { SkillDetailView, SkillDraftDiffView, SkillsView, SkillView } from '../../../src/shared/ipc/skills'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const DRAFT_ID = '7b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

const HUB: SkillView = {
  id: 'perso:hub',
  family: 'perso',
  name: 'hub',
  description: 'Archiviste fictif',
  origin: 'personnel',
  hasScripts: false,
  damaged: false,
  sameNameAs: [],
  modifiedAt: 1,
  contentHash: 'abc'
}

const DIFF: SkillDraftDiffView = {
  draft: {
    id: DRAFT_ID,
    skillId: 'perso:hub',
    family: 'perso',
    name: 'hub',
    description: 'Déclencheurs plus clairs',
    origin: 'claude',
    isNew: false,
    fileCount: 1,
    updatedAt: 1
  },
  files: [{ path: 'SKILL.md', status: 'modifie', before: 'ligne A\nligne B\n', after: 'ligne A\nligne C\n' }],
  diskChanged: false
}

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>
  )

describe('brouillons et gestes sur un skill (spec 020 T024)', () => {
  it('should_show_the_differences_and_install_only_with_confirm_true', async () => {
    const install = vi.fn(() => ({ batchId: 'b1', skillId: 'perso:hub' }))
    installFakeApi({ 'skills:draftDiff': () => DIFF, 'skills:install': install })
    const onDone = vi.fn()
    const { container } = wrap(<DraftPanel draftId={DRAFT_ID} onDone={onDone} />)
    expect(await screen.findByText('ligne C')).toBeTruthy()
    expect(screen.getByText('ligne B')).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Installer' }))
    expect(install).toHaveBeenCalledWith({ draftId: DRAFT_ID, confirm: true })
    expect(onDone).toHaveBeenCalledWith('perso:hub')
  })

  it('should_ask_before_removing_a_skill_and_offer_no_removal_for_a_plugin', async () => {
    const remove = vi.fn(() => ({ batchId: 'b2' }))
    const detail: SkillDetailView = { skill: HUB, markdown: '# hub', files: [], filesTruncated: false, versions: 1 }
    const view: SkillsView = { skills: [HUB], links: [], scannedAt: 1 }
    installFakeApi({ 'skills:get': () => detail, 'skills:drafts': () => [], 'skills:remove': remove })
    const onClose = vi.fn()
    const { container } = wrap(
      <SkillPanel skillId="perso:hub" view={view} onSelect={() => undefined} onClose={onClose} />
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer…' }))
    expect(remove).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Garder' }))
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(remove).toHaveBeenCalledWith({ skillId: 'perso:hub', confirm: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('should_offer_duplication_but_no_removal_for_a_plugin_skill', async () => {
    const plugin: SkillView = { ...HUB, id: 'plugin:m/p:deploy', family: 'plugin', name: 'deploy' }
    installFakeApi({
      'skills:get': () => ({ skill: plugin, markdown: '', files: [], filesTruncated: false, versions: 0 }),
      'skills:drafts': () => []
    })
    wrap(
      <SkillPanel
        skillId={plugin.id}
        view={{ skills: [plugin], links: [], scannedAt: 1 }}
        onSelect={() => undefined}
        onClose={() => undefined}
      />
    )
    expect(await screen.findByRole('button', { name: 'Dupliquer en skill personnel' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Supprimer…' })).toBeNull()
  })
})
