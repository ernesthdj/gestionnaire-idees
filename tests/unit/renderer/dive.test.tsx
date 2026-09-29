import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { useUiStore } from '../../../src/renderer/src/app/uiStore'
import type { TreeView } from '../../../src/shared/ipc/neurons'
import { expectNoAxeViolations } from '../../support/axe'
import { CHILD_ID, developingTree, rawTree, ROOT_ID } from '../../fixtures/ui/dive'
import { FakeIpcError } from './support/fakeApi'
import { renderOpenIdea, type Handlers } from './support/openIdea'
import { installReactFlowMocks } from './support/reactFlowMocks'

function renderDive(tree: TreeView = developingTree(), handlers: Handlers = {}) {
  const growth = (): unknown => ({ tree })
  const api = renderOpenIdea(() => tree, {
    'growth:develop': growth,
    'growth:answer': growth,
    'growth:more': growth,
    'growth:dismiss': growth,
    'growth:addBranch': growth,
    'growth:editBranch': growth,
    'growth:acceptSuggestion': growth,
    'growth:dismissSuggestion': growth,
    'neuron:delete': growth,
    'fusion:getProposed': () => null,
    ...handlers
  })
  return { api }
}

const panel = (): HTMLElement => screen.getByRole('complementary', { name: 'Questions de l’IA' })
const loaded = (): Promise<HTMLElement> => screen.findByRole('complementary', { name: 'Questions de l’IA' })

describe('idée ouverte sur la carte (volet + arbre)', () => {
  // ResizeObserver n'existe pas dans jsdom.
  beforeAll(() => installReactFlowMocks())

  it('should_start_developing_a_raw_idea_as_soon_as_it_is_opened', async () => {
    const { api } = renderDive(rawTree(), { 'growth:develop': () => ({ tree: developingTree() }) })
    await waitFor(() => expect(api.invoke).toHaveBeenCalledWith('growth:develop', { rootId: ROOT_ID }))
    expect(await within(panel()).findByRole('heading', { name: 'Pour quand ?' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Question : Quelle taille ?' })).toBeDefined()
  })

  it('should_answer_with_a_quick_reply_and_show_the_sub_neuron_before_the_ai_finishes', async () => {
    const user = userEvent.setup()
    let finish = (): void => undefined
    const { api } = renderDive(developingTree(), {
      'growth:answer': () => new Promise((resolve) => (finish = () => resolve({ tree: developingTree() })))
    })
    await loaded()
    await user.click(await within(panel()).findByRole('button', { name: 'Ce mois-ci' }))
    expect(api.invoke).toHaveBeenCalledWith('growth:answer', { extensionId: 'ext-1', answer: { choice: 'Ce mois-ci' } })
    expect(screen.getByRole('status', { name: 'Nouveau sous-neurone : quand : Ce mois-ci' })).toBeDefined()
    expect(within(panel()).getByText('L’IA réfléchit aux questions suivantes…')).toBeDefined()
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByRole('status', { name: /Nouveau sous-neurone/ })).toBeNull())
  })

  it('should_answer_in_free_text_or_with_i_do_not_know', async () => {
    const user = userEvent.setup()
    const { api } = renderDive()
    await loaded()
    await user.type(await within(panel()).findByLabelText('Ta réponse'), 'Avant l’été{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('growth:answer', { extensionId: 'ext-1', answer: { text: 'Avant l’été' } })
    await user.click(within(panel()).getByRole('button', { name: 'Je ne sais pas' }))
    expect(api.invoke).toHaveBeenCalledWith('growth:answer', { extensionId: 'ext-1', answer: { unknown: true } })
  })

  it('should_empty_the_answer_when_another_question_is_chosen', async () => {
    const user = userEvent.setup()
    renderDive()
    await loaded()
    const field = await within(panel()).findByLabelText('Ta réponse')
    await user.type(field, 'Brouillon pour la date')
    await user.click(await screen.findByRole('button', { name: 'Question : Quelle taille ?' }))
    expect(within(panel()).getByRole('heading', { name: 'Quelle taille ?' })).toBeDefined()
    expect((within(panel()).getByLabelText('Ta réponse') as HTMLTextAreaElement).value).toBe('')
  })

  it('should_keep_the_question_and_the_text_being_typed_when_new_questions_arrive_in_the_background', async () => {
    const user = userEvent.setup()
    let tree = developingTree()
    const api = renderOpenIdea(() => tree, { 'fusion:getProposed': () => null })
    await loaded()
    await user.type(await within(panel()).findByLabelText('Ta réponse'), 'Avant la ren')
    // L'IA a fini de réfléchir : une nouvelle question arrive en tête de liste.
    const [first] = tree.extensions
    if (first === undefined) throw new Error('fixture')
    tree = {
      ...tree,
      extensions: [
        { ...first, id: 'ext-new', question: 'Quel budget maximum ?', dimension: 'budget' },
        ...tree.extensions
      ]
    }
    await act(async () => api.emit('neuron:created', { rootId: ROOT_ID }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Question : Quel budget maximum ?' })).toBeDefined())
    expect(within(panel()).getByRole('heading', { name: 'Pour quand ?' })).toBeDefined()
    expect((within(panel()).getByLabelText('Ta réponse') as HTMLTextAreaElement).value).toBe('Avant la ren')
  })

  it('should_explain_what_to_do_instead_of_greying_out_the_answer_button_when_the_field_is_empty', async () => {
    const user = userEvent.setup()
    const { api } = renderDive()
    await loaded()
    const button = within(panel()).getByRole('button', { name: 'Répondre' })
    expect(button.hasAttribute('disabled')).toBe(false)
    await user.click(button)
    expect(within(panel()).getByText('Écris ta réponse ou choisis une réponse rapide ci-dessus.')).toBeDefined()
    expect(document.activeElement).toBe(within(panel()).getByLabelText('Ta réponse'))
    expect(api.invoke).not.toHaveBeenCalledWith('growth:answer', expect.anything())
    await user.type(within(panel()).getByLabelText('Ta réponse'), 'D')
    expect(within(panel()).queryByText('Écris ta réponse ou choisis une réponse rapide ci-dessus.')).toBeNull()
  })

  it('should_write_a_long_answer_on_several_lines_and_send_it_with_enter', async () => {
    const user = userEvent.setup()
    const { api } = renderDive()
    await loaded()
    const field = await within(panel()).findByLabelText('Ta réponse')
    expect(field.tagName).toBe('TEXTAREA')
    await user.type(field, 'Première ligne{Shift>}{Enter}{/Shift}seconde ligne')
    expect(api.invoke).not.toHaveBeenCalledWith('growth:answer', expect.anything())
    await user.keyboard('{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('growth:answer', {
      extensionId: 'ext-1',
      answer: { text: 'Première ligne\nseconde ligne' }
    })
  })

  it('should_switch_question_dismiss_it_ask_for_more_and_add_a_branch', async () => {
    const user = userEvent.setup()
    const { api } = renderDive()
    await user.click(await screen.findByRole('button', { name: 'Question : Quelle taille ?' }))
    expect(within(panel()).getByRole('heading', { name: 'Quelle taille ?' })).toBeDefined()
    await user.click(within(panel()).getByRole('button', { name: 'Écarter la question' }))
    expect(api.invoke).toHaveBeenCalledWith('growth:dismiss', { extensionId: 'ext-2' })
    await user.click(within(panel()).getByRole('button', { name: 'Plus de questions' }))
    expect(api.invoke).toHaveBeenCalledWith('growth:more', { neuronId: ROOT_ID })
    await user.click(within(panel()).getByRole('button', { name: 'Ajouter ma branche' }))
    await user.type(within(panel()).getByLabelText('Titre de ta branche'), 'Vérifier le bureau{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('growth:addBranch', { parentId: ROOT_ID, title: 'Vérifier le bureau' })
  })

  it('should_focus_a_sub_neuron_on_the_map_and_come_back_with_the_breadcrumb_then_close_with_escape', async () => {
    const user = userEvent.setup()
    renderDive()
    await user.click(await screen.findByRole('button', { name: /^réponse : budget : 200 €, 1 sous-neurones$/ }))
    const crumbs = screen.getByRole('navigation', { name: 'Fil d’Ariane' })
    expect(within(crumbs).getByText('budget : 200 €').getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Profondeur 1/6')).toBeDefined()
    expect(within(panel()).getByRole('heading', { name: 'Neuf ou occasion ?' })).toBeDefined()
    await user.click(within(crumbs).getByRole('button', { name: 'Deuxième écran' }))
    expect(within(crumbs).queryByText('budget : 200 €')).toBeNull()
    await user.keyboard('{Escape}')
    expect(useUiStore.getState().openRootId).toBeNull()
  })

  it('should_show_the_gauge_level_and_what_is_missing', async () => {
    renderDive()
    const bar = await screen.findByRole('progressbar', { name: 'Niveau de contexte' })
    expect(bar.getAttribute('aria-valuetext')).toBe('insuffisant')
    expect(screen.getByText('Il manque : quand, taille')).toBeDefined()
  })

  it('should_accept_a_ghost_with_enter_ignore_it_with_escape_and_list_its_web_sources', async () => {
    const user = userEvent.setup()
    const { api } = renderDive()
    const ghost = await screen.findByRole('button', {
      name: /^Suggestion de l’IA : Comparer les dalles IPS, vérifiée sur le web/
    })
    expect(screen.getByRole('link', { name: /Guide des dalles/ }).getAttribute('href')).toBe('https://example.org/ips')
    ghost.focus()
    await user.keyboard('{Enter}')
    expect(api.invoke).toHaveBeenCalledWith('growth:acceptSuggestion', { suggestionId: 'sug-1' })
    ghost.focus()
    await user.keyboard('{Escape}')
    expect(api.invoke).toHaveBeenCalledWith('growth:dismissSuggestion', { suggestionId: 'sug-1' })
    expect(useUiStore.getState().openRootId).toBe(ROOT_ID)
  })

  it('should_ask_for_confirmation_before_deleting_a_sub_neuron_with_descendants', async () => {
    const user = userEvent.setup()
    const { api } = renderDive()
    await user.click(await screen.findByRole('button', { name: /^réponse : budget : 200 €/ }))
    await user.click(within(panel()).getByRole('button', { name: 'Supprimer' }))
    expect(api.invoke).not.toHaveBeenCalledWith('neuron:delete', expect.anything())
    expect(within(panel()).getByText('Ses 1 sous-neurone seront supprimés aussi.')).toBeDefined()
    await user.click(within(panel()).getByRole('button', { name: 'Confirmer la suppression' }))
    expect(api.invoke).toHaveBeenCalledWith('neuron:delete', { neuronId: CHILD_ID, confirm: true })
  })

  it('should_explain_that_manual_branches_still_work_when_the_ai_is_unavailable', async () => {
    const user = userEvent.setup()
    renderDive(developingTree(), {
      'growth:more': () => {
        throw new FakeIpcError('AI_UNAVAILABLE')
      }
    })
    await loaded()
    await user.click(within(panel()).getByRole('button', { name: 'Plus de questions' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/tu peux ajouter tes propres branches/)
  })

  it('should_have_no_accessibility_violation', async () => {
    renderDive()
    await loaded()
    await within(panel()).findByRole('heading', { name: 'Pour quand ?' })
    await expectNoAxeViolations(document.body)
  })
})
