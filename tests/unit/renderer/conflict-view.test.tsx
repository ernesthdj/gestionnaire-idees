import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ConflictFileView, MergeStateView } from '../../../src/shared/git/conflicts'
import { ConflictView } from '../../../src/renderer/src/git/ConflictView'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000c24'

const state = (resolved: boolean): MergeStateView => ({
  into: 'main',
  from: 'origin/main',
  files: [{ path: 'src/liste.ts', kind: 'content', state: resolved ? 'resolved' : 'unresolved' }],
  startedAt: '2026-10-10T10:00:00Z'
})

const file = (decision?: 'claude'): ConflictFileView => ({
  path: 'src/liste.ts',
  kind: 'content',
  hunks: [
    {
      index: 0,
      base: 'export const liste = [1, 2, 3]',
      ours: 'export const liste = [0, 1, 2, 3]',
      theirs: 'export const liste = [1, 2, 3, 4]',
      contextBefore: '',
      contextAfter: '',
      proposal: {
        text: 'export const liste = [0, 1, 2, 3, 4]\nfetch("x")',
        explanation: 'Garde le 0 et le 4.',
        confidence: 'sure',
        newLines: [1]
      },
      ...(decision === undefined ? {} : { decision })
    }
  ],
  preview: decision === undefined ? '<<<<<<< ta version\n…' : 'export const liste = [0, 1, 2, 3, 4]\n',
  previewHash: decision === undefined ? 'a'.repeat(32) : 'b'.repeat(32),
  localOnly: false
})

function renderView(handlers: Parameters<typeof installFakeApi>[0]) {
  const api = installFakeApi(handlers)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    api,
    ...render(
      <QueryClientProvider client={client}>
        <ConflictView genesisId={G} onClose={() => undefined} />
      </QueryClientProvider>
    )
  }
}

describe('vue de résolution (spec 021 T038, US4)', () => {
  it('should_decide_a_block_validate_the_file_then_finish_only_when_everything_is_resolved', async () => {
    const user = userEvent.setup()
    let resolved = false
    const { api, container } = renderView({
      'git:mergeState': () => state(resolved),
      'git:conflictFile': () => file(),
      'git:conflictDecide': () => file('claude'),
      'git:conflictResolveFile': () => {
        resolved = true
        return state(true)
      },
      'git:mergeFinish': () => ({ hash: 'c'.repeat(40) })
    })
    const block = await screen.findByRole('region', { name: 'Bloc 1' })
    // La ligne absente des deux versions est signalée par une icône ET un texte.
    expect(within(block).getByText(/fetch\("x"\) \(ligne nouvelle\)/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Terminer la fusion' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Valider ce fichier' })).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
    await user.click(within(block).getByLabelText('Proposition de Claude'))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:conflictDecide', {
        genesisId: G,
        path: 'src/liste.ts',
        hunkIndex: 0,
        choice: 'claude'
      })
    )
    await user.click(await screen.findByRole('button', { name: 'Valider ce fichier' }))
    await waitFor(() =>
      expect(api.invoke).toHaveBeenCalledWith('git:conflictResolveFile', {
        genesisId: G,
        path: 'src/liste.ts',
        expectedPreviewHash: 'b'.repeat(32),
        confirm: true
      })
    )
    await user.click(await screen.findByRole('button', { name: 'Terminer la fusion' }))
    expect(await screen.findByText(/Fusion terminée \(commit ccccccc\)/)).toBeDefined()
  })

  it('should_ask_confirmation_before_aborting', async () => {
    const user = userEvent.setup()
    const { api } = renderView({
      'git:mergeState': () => state(false),
      'git:conflictFile': () => file(),
      'git:mergeAbort': () => ({})
    })
    await user.click(await screen.findByRole('button', { name: 'Abandonner la fusion' }))
    expect(api.invoke).not.toHaveBeenCalledWith('git:mergeAbort', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Confirmer l’abandon' }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('git:mergeAbort', { genesisId: G, confirm: true }))
    expect(await screen.findByText(/revenu à son état d’avant/)).toBeDefined()
  })

  it('should_offer_whole_file_choices_for_a_binary_and_no_claude_for_a_local_project', async () => {
    renderView({
      'git:mergeState': () => ({ ...state(false), files: [{ path: 'logo.png', kind: 'binary', state: 'unresolved' }] }),
      'git:conflictFile': () => ({ ...file(), path: 'logo.png', kind: 'binary', hunks: [], preview: '' })
    })
    expect(await screen.findByRole('button', { name: 'Garder ta version' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Prendre leur version' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /Demander à Claude/ })).toBeNull()
  })
})
