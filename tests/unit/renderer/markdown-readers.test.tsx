import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileViewer } from '../../../src/renderer/src/canvas/FileViewer'
import { ElementFileReader } from '../../../src/renderer/src/chat/ElementFiles'
import { Markdown } from '../../../src/renderer/src/chat/Markdown'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

// jsdom ne mesure pas le SVG : Mermaid est simulé (rendu, ou syntaxe refusée).
const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: mermaid }))

const ID = '00000000-0000-4000-8000-0000000000e1'
const COURSE = [
  '# Actif = Passif',
  '',
  '> [!IMPORTANT]',
  '> **Pour tout emploi, une ressource équivalente.**',
  '',
  '> Une citation ordinaire.',
  '',
  '<script>alert(1)</script>'
]

const withQuery = (node: React.ReactNode): React.ReactNode => (
  <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
)

describe('encadrés Markdown (> [!TYPE])', () => {
  it('should_render_a_titled_callout_when_a_quote_starts_with_a_github_mark', () => {
    const { container } = render(<Markdown text={COURSE.join('\n')} />)
    const quotes = container.querySelectorAll('blockquote')
    expect(quotes).toHaveLength(2)
    expect(quotes[0]?.querySelector('p')?.textContent).toBe('❗ Important')
    expect(quotes[0]?.textContent).not.toContain('[!IMPORTANT]')
    expect(quotes[0]?.className).toContain('border-seed')
    expect(quotes[0]?.querySelector('strong')?.textContent).toBe('Pour tout emploi, une ressource équivalente.')
    // Une citation sans marque reste une citation.
    expect(quotes[1]?.className).toContain('border-content-muted/40')
    expect(container.querySelector('script')).toBeNull()
  })

  it('should_keep_the_mark_as_text_when_the_type_is_unknown', () => {
    const { container } = render(<Markdown text={'> [!FOO]\n> texte'} />)
    expect(container.querySelector('blockquote')?.textContent).toContain('[!FOO]')
  })
})

describe('fichier .md d’un élément de carte', () => {
  it('should_open_formatted_and_switch_to_raw_text_when_the_file_is_markdown', async () => {
    const user = userEvent.setup()
    installFakeApi({
      'structure:file': () => ({ path: 'cours/bilan.md', lang: 'other', lines: COURSE, symbols: [] })
    })
    const { container } = render(
      withQuery(<ElementFileReader elementId={ID} path="cours/bilan.md" onBack={() => undefined} />)
    )
    expect((await screen.findByRole('heading', { name: 'Actif = Passif' })).tagName).toBe('H3')
    expect(screen.getByRole('button', { name: 'Mis en forme' }).getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('script')).toBeNull()
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('button', { name: 'Texte brut' }))
    expect(screen.queryByRole('heading', { name: 'Actif = Passif' })).toBeNull()
    expect(container.querySelector('[data-line="1"]')?.textContent).toContain('# Actif = Passif')
  })

  it('should_show_no_toggle_when_the_file_is_code', async () => {
    installFakeApi({
      'structure:file': () => ({ path: 'src/a.ts', lang: 'ts', lines: ['const a = 1'], symbols: [] })
    })
    const { container } = render(
      withQuery(<ElementFileReader elementId={ID} path="src/a.ts" onBack={() => undefined} />)
    )
    await screen.findByText('Fichier de l’élément · lecture seule')
    await screen.findByText(/const/)
    expect(screen.queryByRole('button', { name: 'Mis en forme' })).toBeNull()
    expect(container.querySelector('[data-line="1"]')).not.toBeNull()
  })
})

describe('fichier .md d’un livrable', () => {
  it('should_open_on_the_formatted_tab_when_the_file_is_markdown', async () => {
    const user = userEvent.setup()
    installFakeApi({
      'deliverable:file': () => ({
        path: 'docs/cours.md',
        status: 'cree',
        language: 'markdown',
        before: null,
        after: COURSE.join('\n'),
        current: COURSE.join('\n'),
        missing: false,
        tooBig: false,
        binary: false,
        changedSince: false
      })
    })
    const { container } = render(withQuery(<FileViewer neuronId={ID} path="docs/cours.md" onClose={() => undefined} />))
    expect(await screen.findByRole('heading', { name: 'Actif = Passif' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mis en forme' }).getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('script')).toBeNull()
    await expectNoAxeViolations(container)
    await user.click(screen.getByRole('tab', { name: 'Fichier' }))
    expect(screen.getByRole('tabpanel').querySelector('code.hljs')?.textContent).toContain('# Actif = Passif')
  })
})

describe('schémas Mermaid', () => {
  const SOURCE = 'flowchart LR\n  R["RESSOURCES"] --> E["EMPLOIS"]'
  const FENCE = ['Avant', '', '```mermaid', ...SOURCE.split('\n'), '```'].join('\n')

  beforeEach(() => {
    mermaid.initialize.mockReset()
    mermaid.render.mockReset()
  })

  it('should_draw_the_diagram_as_an_image_when_a_mermaid_block_is_valid', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320.5 80"><script>alert(1)</script></svg>'
    })
    const { container } = render(<Markdown text={FENCE} />)
    const image = await screen.findByRole('img', { name: 'Schéma Mermaid' })
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }))
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), SOURCE)
    // Image en data: : le SVG n'entre jamais dans la page (le script ne peut pas s'y exécuter).
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(image.getAttribute('width')).toBe('321')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('pre')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_keep_the_source_visible_when_the_mermaid_syntax_is_invalid', async () => {
    mermaid.render.mockRejectedValue(new Error('Parse error'))
    const { container } = render(<Markdown text={FENCE} />)
    expect(await screen.findByText('Schéma Mermaid illisible : code source affiché.')).toBeTruthy()
    expect(container.querySelector('pre code')?.textContent).toBe(SOURCE)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('should_leave_other_code_blocks_untouched_when_they_are_not_mermaid', () => {
    const { container } = render(<Markdown text={'```ts\nconst a = 1\n```'} />)
    expect(container.querySelector('pre code')?.textContent).toBe('const a = 1\n')
    expect(mermaid.render).not.toHaveBeenCalled()
  })
})
