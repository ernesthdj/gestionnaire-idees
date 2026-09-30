import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ActionPlanOut, ReflectionSummaryOut } from '../../../src/shared/ai/neurons'
import { keepNewTools } from '../../../src/main/domain/widgets/toolProposals'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { readyRoot, reflectionSummary, screenPlan } from '../../support/fusion'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const budget = {
  title: 'Tableau des dépenses',
  description: 'Additionne les achats prévus et compare au budget.',
  parts: ['tree', 'document'],
  producesResult: true
}
const countdown = {
  title: 'Compte à rebours',
  description: 'Affiche les jours restants avant la livraison.',
  parts: ['document'],
  producesResult: false
}

describe('outils proposés dans la sortie de synthèse (spec 006 FR-001 à FR-003)', () => {
  const plan = screenPlan().raw

  it('should_accept_a_synthesis_without_tools', () => {
    expect(ActionPlanOut.parse(plan).tools).toBeUndefined()
    expect(ReflectionSummaryOut.parse(reflectionSummary.raw).tools).toBeUndefined()
  })

  it('should_keep_valid_proposals_and_drop_only_the_faulty_one', () => {
    const parsed = ActionPlanOut.parse({ ...plan, tools: [budget, { title: '', description: 'x' }, countdown] })
    expect(parsed.tools?.map((tool) => tool.title)).toEqual(['Tableau des dépenses', 'Compte à rebours'])
    expect(parsed.nodes).toHaveLength(4)
  })

  it('should_keep_at_most_three_proposals', () => {
    const many = Array.from({ length: 5 }, (_, index) => ({ ...countdown, title: `Outil ${index}` }))
    expect(ReflectionSummaryOut.parse({ ...reflectionSummary.raw, tools: many }).tools).toHaveLength(3)
  })

  it('should_filter_unknown_or_repeated_parts_and_default_to_no_result', () => {
    const parsed = ActionPlanOut.parse({
      ...plan,
      tools: [{ title: 'Liste', description: 'Liste les tâches.', parts: ['tree', 'secret', 'tree', 'identity'] }]
    })
    expect(parsed.tools).toEqual([
      { title: 'Liste', description: 'Liste les tâches.', parts: ['identity', 'tree'], producesResult: false }
    ])
  })

  it('should_never_invalidate_the_synthesis_when_the_tools_field_is_malformed', () => {
    expect(ActionPlanOut.parse({ ...plan, tools: 'un tableau, merci' }).tools).toBeUndefined()
    expect(ReflectionSummaryOut.parse({ ...reflectionSummary.raw, tools: null }).tools).toBeUndefined()
  })
})

describe('outils déjà branchés et doublons (spec 006 FR-011)', () => {
  const tool = (title: string) => ({ title, description: 'd', parts: [], producesResult: false })

  it('should_drop_a_tool_already_connected_and_a_repeated_title_whatever_the_case_and_spaces', () => {
    const kept = keepNewTools(
      [tool(' tableau  des DÉPENSES '), tool('Compte à rebours'), tool('compte à rebours'), tool('Check-list')],
      [{ title: 'Tableau des dépenses', summary: 'Suit les dépenses.' }]
    )
    expect(kept?.map((entry) => entry.title)).toEqual(['Compte à rebours', 'Check-list'])
  })

  it('should_leave_no_tools_field_when_nothing_is_left', () => {
    expect(keepNewTools([tool('A')], [{ title: 'a', summary: '' }])).toBeUndefined()
    expect(keepNewTools(undefined, [])).toBeUndefined()
  })
})

describe('outils proposés au verrouillage (spec 006 US1)', () => {
  let t: NeuronHarness
  beforeEach(() => {
    t = createNeuronHarness()
  })
  afterEach(() => t.dispose())

  /** Widget « Tableau des dépenses » déjà branché sur l'idée. */
  function connectBudgetWidget(rootId: string): void {
    const db = t.handle.db
    const widgets = new WidgetRepository(db)
    const blockId = new BlockRepository(db).insert({
      kind: 'widget',
      x: 0,
      y: 0,
      width: 520,
      height: 440,
      text: null
    }).id
    const version = widgets.insertVersion({
      blockId,
      title: 'Tableau des dépenses',
      html: '',
      css: '',
      ts: '',
      js: '',
      summary: 'Additionne les achats.',
      model: 'claude-sonnet-5-5'
    })
    widgets.setCurrent(blockId, version.id)
    new WidgetIoRepository(db).insertInput({ blockId, sourceKind: 'idea', sourceId: rootId, parts: ['tree'] })
  }

  it('should_show_the_proposals_with_the_synthesis_without_creating_anything', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue({ raw: { ...screenPlan().raw, tools: [budget, countdown] } })
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    if (proposal.type !== 'action_plan') throw new Error('plan attendu')
    expect(proposal.plan.tools).toEqual([
      { ...budget, parts: ['tree', 'document'] },
      { ...countdown, parts: ['document'] }
    ])
    expect(new BlockRepository(t.handle.db).list()).toEqual([])
  })

  it('should_tell_claude_which_tools_are_already_connected_and_never_propose_them_again', async () => {
    const tree = await readyRoot(t, 'reflection', ['Pour le reportage', 'Poids du sac', 'Location possible'])
    connectBudgetWidget(tree.root.id)
    t.h.claude.enqueue({ raw: { ...reflectionSummary.raw, tools: [budget, countdown] } })
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    expect(t.h.anonymized.at(-1)).toContain(
      'Outils déjà branchés sur cette idée : \n- Tableau des dépenses : Additionne les achats.'
    )
    if (proposal.type !== 'reflection_summary') throw new Error('synthèse attendue')
    expect(proposal.summary.tools?.map((tool) => tool.title)).toEqual(['Compte à rebours'])
  })

  it('should_say_that_no_tool_is_connected_yet', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue(screenPlan())
    await t.fusion.lock({ rootId: tree.root.id })
    expect(t.h.anonymized.at(-1)).toContain('Outils déjà branchés sur cette idée : aucun')
  })

  it('should_propose_no_tool_when_the_synthesis_comes_from_the_local_ai', async () => {
    const tree = await readyRoot(t)
    t.h.claude.setAvailable(false)
    t.h.ollama.setAvailable(true)
    t.h.ollama.enqueue({ raw: { ...screenPlan().raw, tools: [budget] } })
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    expect(proposal.degraded).toBe(true)
    if (proposal.type !== 'action_plan') throw new Error('plan attendu')
    expect(proposal.plan.tools).toBeUndefined()
  })

  it('should_keep_the_proposals_when_a_point_of_the_preview_is_corrected', async () => {
    const tree = await readyRoot(t)
    t.h.claude.enqueue({ raw: { ...screenPlan().raw, tools: [countdown] } })
    const proposal = await t.fusion.lock({ rootId: tree.root.id })
    const edited = t.fusion.editProposed({
      synthesisId: proposal.id,
      patch: { ref: 't3', title: 'Installer et régler l’écran' }
    })
    if (edited.type !== 'action_plan') throw new Error('plan attendu')
    expect(edited.plan.tools?.map((tool) => tool.title)).toEqual(['Compte à rebours'])
  })
})
