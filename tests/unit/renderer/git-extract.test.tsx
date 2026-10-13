import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ExtractPreviewView } from '../../../src/shared/git/extract'
import { ExtractDialog } from '../../../src/renderer/src/git/ExtractDialog'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const G = '00000000-0000-4000-8000-000000000c28'

const preview = (verdict: ExtractPreviewView['license']['verdict']): ExtractPreviewView => ({
  origin: 'compte/projet',
  commit: 'a'.repeat(40),
  license: {
    spdx: verdict === 'inconnue' ? null : 'MIT',
    verdict,
    summary: verdict === 'inconnue' ? 'Licence inconnue.' : 'Licence permissive.'
  },
  header: verdict === 'inconnue' ? '' : '// Extrait de compte/projet — src/outil.ts\n\n',
  destinations: [
    { root: 'snippets', folders: ['auth'] },
    { root: 'techno', folders: [] }
  ],
  studyNoteOnly: verdict === 'inconnue'
})

function renderDialog(verdict: ExtractPreviewView['license']['verdict']) {
  const api = installFakeApi({
    'git:extractPreview': () => preview(verdict),
    'git:extract': (payload) => ({
      written: `snippets/${(payload as { folder: string; fileName: string }).folder}/${(payload as { fileName: string }).fileName}`
    })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    api,
    ...render(
      <QueryClientProvider client={client}>
        <ExtractDialog genesisId={G} path="src/outil.ts" lineCount={12} onClose={() => undefined} />
      </QueryClientProvider>
    )
  }
}

describe('extraire un morceau (spec 021 T054)', () => {
  it('should_show_the_license_and_the_header_before_copying_into_a_workspace_folder', async () => {
    const user = userEvent.setup()
    const { api, container } = renderDialog('permise')
    expect(await screen.findByText(/copie permise/)).toBeDefined()
    expect(screen.getByLabelText('En-tête d’attribution').textContent).toContain('Extrait de compte/projet')
    expect(screen.getByRole('button', { name: 'Copier dans le workspace' })).toHaveProperty('disabled', true)
    await expectNoAxeViolations(container)
    await user.type(screen.getByLabelText('Dossier'), 'outils')
    await user.click(screen.getByRole('button', { name: 'Copier dans le workspace' }))
    await screen.findByText('Écrit dans le workspace : snippets/outils/outil.ts (ni commité ni lancé).')
    expect(api.invoke).toHaveBeenCalledWith('git:extract', {
      genesisId: G,
      path: 'src/outil.ts',
      root: 'snippets',
      folder: 'outils',
      fileName: 'outil.ts',
      mode: 'copy',
      confirm: true
    })
  })

  it('should_offer_only_a_study_note_when_the_license_is_unknown', async () => {
    const user = userEvent.setup()
    const { api } = renderDialog('inconnue')
    expect(await screen.findByText(/note d’étude seulement/)).toBeDefined()
    expect(screen.getByRole('radio', { name: 'Copier avec l’en-tête d’attribution' })).toHaveProperty('disabled', true)
    expect((screen.getByLabelText('Nom du fichier') as HTMLInputElement).value).toBe('outil.etude.md')
    await user.type(screen.getByLabelText('Dossier'), 'etudes')
    await user.click(screen.getByRole('button', { name: 'Écrire la note d’étude' }))
    await screen.findByText(/Écrit dans le workspace/)
    expect(api.invoke).toHaveBeenCalledWith('git:extract', expect.objectContaining({ mode: 'study_note' }))
  })
})
