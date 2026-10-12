import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import { useCards } from '../../../src/renderer/src/canvas/cards/cardsStore'
import { GlassFolder } from '../../../src/renderer/src/canvas/folder/GlassFolder'
import { IdeasCanvas } from '../../../src/renderer/src/canvas/IdeasCanvas'
import { SidePanel } from '../../../src/renderer/src/canvas/side/SidePanel'
import { useSidePanel } from '../../../src/renderer/src/canvas/side/sidePanelStore'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/ipc/app'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import type { DocumentView } from '../../../src/shared/ipc/documents'
import type { FolderFileView } from '../../../src/shared/ipc/folders'
import { expectNoAxeViolations } from '../../support/axe'
import { canvasView, HATCHED_A_ID } from '../../fixtures/ui/canvas'
import { installFakeApi } from './support/fakeApi'
import { installReactFlowMocks } from './support/reactFlowMocks'

const files = ['cours.md', 'bilan.md', 'plan.md', 'notes.md'].map((name, index) => ({
  key: name,
  name,
  meta: 'MD · par Claude',
  unseen: index === 0
}))

const folder = (handlers: { onOpenFile?: (index: number) => void; onOpenChange?: (open: boolean) => void } = {}) =>
  render(
    <GlassFolder
      title="Actif = Passif"
      count={6}
      files={files}
      color="#2563eb"
      seed={42}
      unseen
      onOpenFile={handlers.onOpenFile ?? (() => undefined)}
      {...(handlers.onOpenChange === undefined ? {} : { onOpenChange: handlers.onOpenChange })}
    />
  )

describe('dossier de verre (spec 028 US1)', () => {
  beforeAll(() => installReactFlowMocks())

  it('should_stay_closed_with_its_files_out_of_reach_until_opened', async () => {
    const { container } = folder()
    const toggle = screen.getByRole('button', {
      name: /^Ouvrir le dossier de « Actif = Passif », 6 fichiers, nouveau$/
    })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('list', { name: 'Fichiers du dossier de « Actif = Passif »' }).hasAttribute('inert')).toBe(
      true
    )
    expect(screen.getByText('6 fichiers')).toBeDefined()
    await expectNoAxeViolations(container)
  })

  it('should_open_into_a_fan_of_at_most_four_files_and_open_the_chosen_one', () => {
    const onOpenFile = vi.fn()
    const onOpenChange = vi.fn()
    const { container } = folder({ onOpenFile, onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: /^Ouvrir le dossier/ }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(container.querySelector('.folder')?.hasAttribute('data-open')).toBe(true)
    const list = screen.getByRole('list', { name: 'Fichiers du dossier de « Actif = Passif »' })
    expect(list.hasAttribute('inert')).toBe(false)
    expect(within(list).getAllByRole('button')).toHaveLength(4)
    expect(within(list).getByText('nouveau')).toBeDefined()
    fireEvent.click(within(list).getByRole('button', { name: /bilan\.md/ }))
    expect(onOpenFile).toHaveBeenCalledWith(1)
  })

  it('should_close_on_escape_and_give_the_focus_back_to_the_folder', () => {
    const onOpenChange = vi.fn()
    folder({ onOpenChange })
    const toggle = screen.getByRole('button', { name: /^Ouvrir le dossier/ })
    fireEvent.click(toggle)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ouvrir le dossier/ }))
  })

  it('should_close_when_clicking_elsewhere', () => {
    const onOpenChange = vi.fn()
    folder({ onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: /^Ouvrir le dossier/ }))
    fireEvent.pointerDown(document.body)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('should_load_nothing_from_outside_and_inject_no_style_element', () => {
    const { container } = folder()
    expect(container.querySelector('img, a[href], style, script')).toBeNull()
  })
})

const DOC: DocumentView = {
  id: '00000000-0000-4000-8000-000000000601',
  neuronId: HATCHED_A_ID,
  genesisId: HATCHED_A_ID,
  title: 'Cours',
  fileLabel: 'documents/cours.md',
  width: 360,
  height: 280,
  origin: 'claude',
  offset: { x: 0, y: 0 }
}

function folderView(): IdeasCanvasView {
  const file: FolderFileView = {
    path: 'documents/cours.md',
    name: 'cours.md',
    kind: 'doc',
    source: 'document',
    updatedAt: '2026-10-12T20:00:00.000Z',
    unseen: true,
    document: DOC
  }
  return {
    ...canvasView(),
    folders: [
      {
        neuronId: HATCHED_A_ID,
        anchor: { kind: 'neuron', id: HATCHED_A_ID },
        count: 1,
        unseen: true,
        preview: [file],
        offset: { x: 0, y: 0 },
        moved: false
      }
    ]
  }
}

describe('dossier d’un nœud dans la carte (spec 028 US1)', () => {
  beforeAll(() => installReactFlowMocks())
  beforeEach(() => {
    useUiStore.setState({ view: 'ideas', chatNeuronId: null, toast: null })
    useCards.setState({ cards: [], activeId: null })
    useSidePanel.getState().reset()
  })

  it('should_open_a_document_of_the_folder_in_the_tab_of_its_node_and_mark_the_folder_seen', async () => {
    const api = installFakeApi({
      'canvas:get': () => folderView(),
      'canvas:savePositions': () => ({ ok: true }),
      'app:getSettings': () => DEFAULT_APP_SETTINGS,
      'folder:markSeen': () => ({ ok: true }),
      'document:get': () => ({ id: DOC.id, content: '# Cours\n\nActif = Passif', hash: 'h', missing: false })
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IdeasCanvas />
        <SidePanel />
      </QueryClientProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: /^Ouvrir le dossier de « Mission mariage », 1 fichier/ }))
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('folder:markSeen', { neuronId: HATCHED_A_ID }))
    fireEvent.click(screen.getByRole('button', { name: /cours\.md/ }))
    const side = await screen.findByRole('complementary', { name: 'Panneau de droite' })
    const reader = await within(side).findByRole('region', { name: 'Document : Cours' })
    expect(await within(reader).findByRole('heading', { name: 'Cours' })).toBeDefined()
  })

  it('should_open_a_file_covered_by_an_element_in_the_element_file_reader', async () => {
    const view = folderView()
    const covered: FolderFileView = {
      path: 'cours/actif-passif.md',
      name: 'actif-passif.md',
      kind: 'doc',
      source: 'covered',
      updatedAt: '',
      unseen: false
    }
    const folders = (view.folders ?? []).map((entry) => ({ ...entry, unseen: false, preview: [covered] }))
    installFakeApi({
      'canvas:get': () => ({ ...view, folders }),
      'canvas:savePositions': () => ({ ok: true }),
      'app:getSettings': () => DEFAULT_APP_SETTINGS,
      'structure:file': () => ({ path: covered.path, lang: 'other', lines: ['# Actif = Passif'], symbols: [] })
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IdeasCanvas />
        <SidePanel />
      </QueryClientProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: /^Ouvrir le dossier de « Mission mariage »/ }))
    fireEvent.click(screen.getByRole('button', { name: /actif-passif\.md/ }))
    const side = await screen.findByRole('complementary', { name: 'Panneau de droite' })
    expect(await within(side).findByRole('heading', { name: 'cours/actif-passif.md' })).toBeDefined()
  })
})
