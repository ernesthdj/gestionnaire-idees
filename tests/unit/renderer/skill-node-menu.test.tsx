import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { installMenuItems, SkillNodeMenu, type InstallTarget } from '../../../src/renderer/src/skills/SkillNodeMenu'
import type { LibrarySkillView } from '../../../src/shared/ipc/skills'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const DRAFT_ID = '7b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'
const AT = { x: 40, y: 40 }

const LIBRARY: LibrarySkillView = {
  candidateId: '3b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f',
  repoId: 'r1',
  name: 'nettoyage',
  description: 'Skill fictif',
  files: [{ path: 'SKILL.md', size: 10, executable: false }],
  verdict: 'sur',
  reasons: [],
  auditedByClaude: false,
  installed: false
}

const DRAFT: InstallTarget = { kind: 'draft', draftId: DRAFT_ID, name: 'hub' }

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>
  )

describe('installer un skill au clic droit', () => {
  it('should_offer_only_the_sheet_when_a_library_skill_is_dangerous', () => {
    const items = installMenuItems({ kind: 'library', skill: { ...LIBRARY, verdict: 'dangereux' } })
    expect(items.map((item) => item.tool)).toEqual(['open'])
  })

  it('should_warn_about_scripts_and_replacement_when_a_library_skill_has_them', () => {
    const skill: LibrarySkillView = {
      ...LIBRARY,
      installed: true,
      files: [...LIBRARY.files, { path: 'run.sh', size: 5, executable: true }]
    }
    const [install] = installMenuItems({ kind: 'library', skill })
    expect(install?.hint).toContain('sans ses scripts')
    expect(install?.hint).toContain('remplace ta version')
  })

  it('should_install_a_draft_with_confirm_true_when_install_is_picked', async () => {
    const install = vi.fn(() => ({ batchId: 'b1', skillId: 'perso:hub' }))
    installFakeApi({ 'skills:install': install })
    const onInstalled = vi.fn()
    const onClose = vi.fn()
    const { container } = wrap(
      <SkillNodeMenu at={AT} target={DRAFT} onOpen={vi.fn()} onInstalled={onInstalled} onClose={onClose} />
    )
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('menuitem', { name: /^Installer/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(install).toHaveBeenCalledWith({ draftId: DRAFT_ID, confirm: true })
    expect(onInstalled).toHaveBeenCalledWith('perso:hub')
  })

  it('should_draft_without_scripts_then_install_when_a_library_skill_is_picked', async () => {
    const prepare = vi.fn(() => ({ draftId: DRAFT_ID }))
    const install = vi.fn(() => ({ batchId: 'b1', skillId: 'perso:nettoyage' }))
    installFakeApi({ 'skills:libraryInstall': prepare, 'skills:install': install })
    const onClose = vi.fn()
    wrap(
      <SkillNodeMenu
        at={AT}
        target={{ kind: 'library', skill: LIBRARY }}
        onOpen={vi.fn()}
        onInstalled={vi.fn()}
        onClose={onClose}
      />
    )
    await userEvent.click(screen.getByRole('menuitem', { name: /^Installer/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(prepare).toHaveBeenCalledWith({ candidateId: LIBRARY.candidateId, scripts: [], seen: 'sur' })
    expect(install).toHaveBeenCalledWith({ draftId: DRAFT_ID, confirm: true })
  })

  it('should_open_the_draft_instead_of_overwriting_when_the_skill_changed_on_disk', async () => {
    installFakeApi({
      'skills:install': () => {
        throw new FakeIpcError('DISK_CHANGED')
      }
    })
    const onOpen = vi.fn()
    const onInstalled = vi.fn()
    const onClose = vi.fn()
    wrap(<SkillNodeMenu at={AT} target={DRAFT} onOpen={onOpen} onInstalled={onInstalled} onClose={onClose} />)
    await userEvent.click(screen.getByRole('menuitem', { name: /^Installer/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onOpen).toHaveBeenCalledWith(DRAFT_ID)
    expect(onInstalled).not.toHaveBeenCalled()
  })
})
