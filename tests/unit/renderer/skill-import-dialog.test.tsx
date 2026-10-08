import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportDialog } from '../../../src/renderer/src/skills/ImportDialog'
import { LibraryRepoPanel, LibrarySkillPanel } from '../../../src/renderer/src/skills/LibraryPanel'
import type { LibraryRepoView, LibrarySkillDetailView, LibrarySkillView } from '../../../src/shared/ipc/skills'
import { expectNoAxeViolations } from '../../support/axe'
import { FakeIpcError, installFakeApi } from './support/fakeApi'

const REPO_ID = '9b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'
const SAFE = '1b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'
const TRAP = '2b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

const SAFE_SKILL: LibrarySkillView = {
  candidateId: SAFE,
  repoId: REPO_ID,
  name: 'resume-reunion',
  description: 'Résume une réunion fictive.',
  files: [{ path: 'SKILL.md', size: 10, executable: false }],
  verdict: 'sur',
  reasons: [],
  auditedByClaude: false,
  installed: false
}

const TRAP_SKILL: LibrarySkillView = {
  candidateId: TRAP,
  repoId: REPO_ID,
  name: 'piege',
  description: 'Ce skill est sûr.',
  files: [
    { path: 'SKILL.md', size: 10, executable: false },
    { path: 'scripts/install.sh', size: 10, executable: true }
  ],
  verdict: 'dangereux',
  reasons: [{ text: 'Téléchargement exécuté', line: 2 }],
  auditedByClaude: false,
  installed: false
}

const REPO: LibraryRepoView = {
  repoId: REPO_ID,
  repo: 'https://github.com/demo/skills',
  commit: 'a'.repeat(40),
  updatedAt: 1,
  truncated: false,
  skippedCopies: 3,
  skills: [SAFE_SKILL, TRAP_SKILL]
}

const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {node}
  </QueryClientProvider>
)

describe('import dans la bibliothèque de skills (spec 020 T031d, D12)', () => {
  it('should_copy_the_repo_then_summarise_verdicts_and_open_it_on_the_canvas', async () => {
    const api = installFakeApi({
      'skills:import': () => ({ importId: REPO_ID }),
      'skills:library': () => [REPO]
    })
    const onDone = vi.fn()
    const { container } = render(wrap(<ImportDialog onDone={onDone} onClose={() => undefined} />))
    await userEvent.type(
      screen.getByLabelText('Adresse du dépôt (https:// ou git@)'),
      ' https://github.com/demo/skills '
    )
    await userEvent.click(screen.getByRole('button', { name: 'Importer' }))
    expect(api.invoke).toHaveBeenCalledWith('skills:import', { url: 'https://github.com/demo/skills' })
    expect(screen.getByRole('status').textContent).toContain('bibliothèque')
    await act(async () => api.emit('skills:importProgress', { importId: REPO_ID, step: 'pret', done: 2, total: 2 }))
    expect(await screen.findByText('demo/skills')).toBeTruthy()
    expect(screen.getByText(/1 dangereux/)).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Voir sur la toile' }))
    expect(onDone).toHaveBeenCalledWith(REPO_ID)
  })

  it('should_cancel_the_copy_when_closed_and_explain_a_failure', async () => {
    const cancel = vi.fn(() => ({}))
    const api = installFakeApi({ 'skills:import': () => ({ importId: REPO_ID }), 'skills:importCancel': cancel })
    const onClose = vi.fn()
    render(wrap(<ImportDialog repoUrl="https://github.com/demo/skills" onClose={onClose} />))
    // Mise à jour : la copie démarre d'elle-même.
    await vi.waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('skills:import', { url: 'https://github.com/demo/skills' })
    )
    await act(async () => api.emit('skills:importProgress', { importId: REPO_ID, step: 'clone' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(cancel).toHaveBeenCalledWith({ importId: REPO_ID })
    expect(onClose).toHaveBeenCalled()

    render(wrap(<ImportDialog onClose={() => undefined} />))
    await userEvent.type(screen.getAllByLabelText('Adresse du dépôt (https:// ou git@)')[0] as HTMLElement, 'x')
    await userEvent.click(screen.getAllByRole('button', { name: 'Importer' })[0] as HTMLElement)
    await act(async () =>
      api.emit('skills:importProgress', { importId: REPO_ID, step: 'echec', errorCode: 'TOO_LARGE' })
    )
    expect(screen.getAllByRole('alert').some((node) => node.textContent?.includes('1 Go'))).toBe(true)
  })
})

describe('volets de la bibliothèque (spec 020 T031d, D12)', () => {
  it('should_lock_a_dangerous_skill_exclude_scripts_and_send_only_identifiers_on_install', async () => {
    const detail: LibrarySkillDetailView = { skill: TRAP_SKILL, markdown: '# Piège <img src=x onerror=alert(1)>' }
    const install = vi.fn(() => ({ draftId: 'd1', verdict: 'dangereux' }))
    installFakeApi({ 'skills:librarySkill': () => detail, 'skills:libraryInstall': install })
    const onDraft = vi.fn()
    const { container } = render(
      wrap(<LibrarySkillPanel candidateId={TRAP} onDraft={onDraft} onClose={() => undefined} />)
    )
    const panel = await screen.findByRole('region', { name: 'Skill de la bibliothèque' })
    expect(await within(panel).findByText(/Verdict : dangereux/)).toBeTruthy()
    expect(within(panel).getByText(/Claude l’auditera au clic Installer/)).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    const button = within(panel).getByRole('button', { name: 'Installer…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    await expectNoAxeViolations(container)
    await userEvent.click(within(panel).getByLabelText(/Je comprends le risque/))
    expect((within(panel).getByLabelText(/scripts\/install\.sh/) as HTMLInputElement).checked).toBe(false)
    await userEvent.click(button)
    expect(install).toHaveBeenCalledWith({ candidateId: TRAP, scripts: [], seen: 'dangereux', unlockDangerous: true })
    expect(onDraft).toHaveBeenCalledWith('d1')
  })

  it('should_show_why_when_claude_finds_the_skill_worse_than_seen', async () => {
    installFakeApi({
      'skills:librarySkill': () => ({ skill: SAFE_SKILL, markdown: '' }),
      'skills:libraryInstall': () => {
        throw new FakeIpcError('VERDICT_CHANGED')
      }
    })
    const onDraft = vi.fn()
    render(wrap(<LibrarySkillPanel candidateId={SAFE} onDraft={onDraft} onClose={() => undefined} />))
    await userEvent.click(await screen.findByRole('button', { name: 'Installer…' }))
    expect((await screen.findByRole('alert')).textContent).toContain('VERDICT_CHANGED')
    expect(onDraft).not.toHaveBeenCalled()
  })

  it('should_update_toggle_and_remove_a_repo_only_after_confirmation', async () => {
    const remove = vi.fn(() => ({}))
    installFakeApi({ 'skills:libraryRemove': remove })
    const onUpdate = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      wrap(
        <LibraryRepoPanel repo={REPO} open={false} onToggle={() => undefined} onUpdate={onUpdate} onClose={onClose} />
      )
    )
    expect(screen.getByText('aaaaaaa')).toBeTruthy()
    expect(screen.getByText(/3 copies écartées/)).toBeTruthy()
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }))
    expect(onUpdate).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Retirer de la bibliothèque…' }))
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
    expect(remove).toHaveBeenCalledWith({ repoId: REPO_ID, confirm: true })
    expect(onClose).toHaveBeenCalled()
  })
})
