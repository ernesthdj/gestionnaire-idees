import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AssemblyService,
  boxesOf,
  type AssemblyNode,
  type SketchStore
} from '../../../src/main/application/agents/AssemblyService'
import { PipelineDocuments } from '../../../src/main/application/agents/PipelineDocuments'
import {
  PipelineEngine,
  type AgentSessionRequest,
  type AgentSessionRunner
} from '../../../src/main/application/agents/PipelineEngine'
import { runGit } from '../../../src/main/infrastructure/projects/GitCli'
import type { AssemblyRequest } from '../../../src/main/application/agents/AssemblyService'
import type { AgentProfileView, AgentRole } from '../../../src/shared/agents/profile'
import type { AssemblySketchView } from '../../../src/shared/ipc/assemblies'

const profile = (id: string, role: AgentRole): AgentProfileView => ({
  id,
  name: `Agent ${id}`,
  role,
  instructions: '',
  permissionMode: 'acceptEdits',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: [],
  updatedAt: 0,
  delivered: 0
})

const PROFILES = [profile('po', 'po'), profile('back', 'backend'), profile('qa', 'qa')]

describe('agents connectés à un nœud (T005, L1o D1 et D12)', { timeout: 60_000 }, () => {
  let root: string
  let project: string
  let sessions: AgentSessionRequest[]
  let events: string[]
  let credited: string[]
  let engines: number
  let stored: Map<string, AssemblySketchView>
  const sketchStore: SketchStore = {
    list: (genesisId) => [...stored.values()].filter((s) => genesisId === undefined || s.genesisId === genesisId),
    save: (sketch) => void stored.set(sketch.nodeId, sketch),
    remove: (nodeId) => void stored.delete(nodeId)
  }
  const git = (args: readonly string[]) => runGit(project, args)

  const node = (patch: Partial<AssemblyNode> = {}): AssemblyNode => ({
    genesisId: 'g1',
    kind: 'tache',
    title: 'Ajouter le tri',
    content: 'Trier la liste par date.',
    sheet: 'Résumé : tri par date',
    projectDir: project,
    projectName: 'demo',
    ...patch
  })

  /** Chaque agent écrit un fichier à son nom ; le QA valide. */
  const runner: AgentSessionRunner = async (request) => {
    sessions.push(request)
    writeFileSync(join(request.cwd, `${request.profile.id}.txt`), 'x\n')
    return {
      ok: true,
      text: `Rapport ${request.profile.id}${request.profile.role === 'qa' ? '\nVERDICT: VALIDE' : ''}`
    }
  }

  const serviceWith = (
    found: AssemblyNode | undefined,
    refusal: string | null = null,
    runSession: AgentSessionRunner = runner
  ): AssemblyService =>
    new AssemblyService({
      sketches: sketchStore,
      node: (id) => (id === NODE_ID || id === OTHER_ID ? found : undefined),
      refusal: () => refusal,
      engineFor: ({ projectDir, projectName }) => {
        engines += 1
        return new PipelineEngine({
          profiles: () => PROFILES,
          runSession,
          git: (args) => runGit(projectDir, args),
          projectDir,
          worktreeRoot: join(root, 'worktrees'),
          documentsFor: (dir) =>
            new PipelineDocuments({
              projectDir: dir,
              profileDir: join(root, 'profil'),
              projectName,
              projectJournalFile: join(root, 'profil', 'journal.md')
            })
        })
      },
      emit: (genesisId, taskId) => events.push(`${genesisId}/${taskId}`),
      credit: (profileIds) => credited.push(...profileIds)
    })

  const NODE_ID = '11111111-1111-4111-8111-111111111111'
  /** Une autre tâche du même projet (L1o D24). */
  const OTHER_ID = '22222222-2222-4222-8222-222222222222'
  const alone: AssemblyRequest = {
    nodeId: NODE_ID,
    taskId: 'T020',
    task: 'Trier par date décroissante',
    agents: [{ id: 'back', profileId: 'back' }],
    links: []
  }
  const finished = async (service: AssemblyService, taskId: string): Promise<void> => {
    for (let i = 0; i < 400 && service.list().find((run) => run.taskId === taskId)?.state === 'running'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  beforeEach(async () => {
    sessions = []
    events = []
    credited = []
    engines = 0
    stored = new Map()
    root = mkdtempSync(join(tmpdir(), 'gi-assembly-'))
    project = join(root, 'projet')
    mkdirSync(project)
    for (const args of [
      ['init', '-b', 'main'],
      ['config', 'user.email', 'test@example.invalid'],
      ['config', 'user.name', 'Test'],
      ['config', 'commit.gpgsign', 'false']
    ]) {
      expect((await git(args)).code).toBe(0)
    }
    writeFileSync(join(project, 'README.md'), 'demo\n')
    await git(['add', 'README.md'])
    expect((await git(['commit', '-m', 'init'])).code).toBe(0)
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_run_a_lone_agent_on_the_node_context_without_po_then_merge_after_approval', async () => {
    const service = serviceWith(node())
    const started = await service.start(alone)
    expect(started).toMatchObject({ genesisId: 'g1', nodeId: NODE_ID, taskId: 'T020', state: 'running' })
    await finished(service, 'T020')

    const [run] = service.list('g1')
    expect(run?.state).toBe('finished')
    expect(run?.result).toMatchObject({ completed: true, agents: [{ status: 'done', branch: 'agents/T020/back' }] })
    // Le contexte du nœud et la tâche demandée arrivent à l'agent seul, sans spec de PO.
    expect(sessions[0]?.prompt).toContain('Nœud « Ajouter le tri » (tache).')
    expect(sessions[0]?.prompt).toContain('Trier la liste par date.')
    expect(sessions[0]?.prompt).toContain('Résumé : tri par date')
    expect(sessions[0]?.prompt).toContain('Trier par date décroissante')
    expect(events).toContain('g1/T020')
    // Travail livré (L1o D13) : un point à la validation du QA…
    expect(credited).toEqual(['back'])

    // Rien sur la base avant l'accord ; après, la branche de l'agent est fusionnée.
    expect((await git(['ls-tree', '-r', '--name-only', 'main'])).output).not.toContain('back.txt')
    const approval = await service.approve('g1', 'T020')
    expect(approval).toMatchObject({ merged: true, baseBranch: 'main' })
    expect((await git(['ls-tree', '-r', '--name-only', 'main'])).output).toContain('back.txt')
    expect(service.list('g1')[0]?.approval?.merged).toBe(true)
    // … et un autre à la fusion acceptée.
    expect(credited).toEqual(['back', 'back'])
    await expect(service.approve('g1', 'T020')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('should_connect_a_po_to_the_node_and_hand_its_spec_to_the_other_agents', async () => {
    const service = serviceWith(node({ kind: 'module', title: 'Module liste' }))
    await service.start({
      nodeId: NODE_ID,
      taskId: 'T021',
      agents: [
        { id: 'po', profileId: 'po' },
        { id: 'back', profileId: 'back' },
        { id: 'qa', profileId: 'qa' }
      ],
      links: [
        { from: 'po', to: 'back' },
        { from: 'back', to: 'qa' }
      ]
    })
    await finished(service, 'T021')
    expect(service.list()[0]?.result?.completed).toBe(true)
    const forPo = sessions.find((s) => s.profile.id === 'po')
    expect(forPo?.prompt).toContain('Nœud « Module liste » (module).')
    expect(sessions.find((s) => s.profile.id === 'back')?.prompt).toContain('Spec signée de la tâche T021')
  })

  it('should_refuse_an_unknown_node_a_node_without_project_and_a_refused_project', async () => {
    await expect(serviceWith(undefined).start(alone)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(serviceWith(node({ projectDir: null })).start(alone)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(serviceWith(node(), 'Projet repris.').start(alone)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Projet repris.'
    })
    await expect(serviceWith(node()).start({ ...alone, taskId: '../x' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(sessions).toHaveLength(0)
  })

  it('should_keep_the_po_lot_plan_with_the_team_and_let_mentalyas_reroute_a_task', async () => {
    // L1o D25 (T021, T023) : le PO connecté à un lot cadre ses tâches ; son plan reste avec l'équipe.
    const lotNode = node({
      kind: 'lot',
      lotTasks: [
        { id: 'T001', key: 'a', text: 'Trier', done: false },
        { id: 'T002', key: 'b', text: 'Filtrer', done: false }
      ]
    })
    const service = serviceWith(lotNode, null, async () => ({
      ok: true,
      text: [
        '## T001',
        'AIGUILLAGE: T001 | Agent back, Agent qa | Agent qa attend Agent back',
        'AIGUILLAGE: T002 | Agent back, Agent designer |',
        'RYTHME: une à une — T002 est risquée'
      ].join('\n')
    }))
    const team = {
      ...alone,
      taskId: 'T060',
      agents: [
        { id: 'po', profileId: 'po' },
        { id: 'back', profileId: 'back' },
        { id: 'qa', profileId: 'qa' }
      ],
      links: [{ from: 'po', to: 'back' }]
    }
    service.saveSketch(team)
    // Seul le PO tourne : il cadre le lot.
    await service.start({ ...team, agents: [{ id: 'po', profileId: 'po' }], links: [] })
    await finished(service, 'T060')
    const kept = service.sketches()[0]
    expect(kept?.agents).toHaveLength(3)
    expect(kept?.lot?.plan.rhythm).toEqual({ mode: 'une-a-une', reason: 'T002 est risquée' })
    expect(kept?.lot?.plan.steps.map((step) => step.task)).toEqual(['T001', 'T002'])

    // Retouche : T002 sans le QA ; le croquis enregistré ensuite garde plan et retouche.
    service.routeTask(NODE_ID, 'T002', { agents: ['back'], links: [] })
    service.saveSketch({ ...team, task: 'Lot tri' })
    expect(service.sketches()[0]?.lot?.overrides).toEqual([{ task: 'T002', agents: ['back'], links: [] }])
    expect(() => service.routeTask(NODE_ID, 'T009', null)).toThrow(/pas dans le plan/)
    expect(() => service.routeTask(NODE_ID, 'T001', { agents: ['inconnu'], links: [] })).toThrow(/au moins un agent/)
    service.routeTask(NODE_ID, 'T002', null)
    expect(service.sketches()[0]?.lot?.overrides).toEqual([])
  })

  it('should_relink_a_stray_team_with_everything_and_its_chats_when_its_node_is_gone', () => {
    // L1o D27 : le nœud d'origine n'existe plus ; l'équipe revient entière, conversations comprises.
    const GONE = '33333333-3333-4333-8333-333333333333'
    const moved: string[] = []
    const service = new AssemblyService({
      sketches: sketchStore,
      node: (id) => (id === OTHER_ID ? node() : undefined),
      refusal: () => null,
      engineFor: () => {
        throw new Error('aucun lancement ici')
      },
      emit: () => undefined,
      moveChats: (_genesisId, from, to) => moved.push(`${from}→${to}`)
    })
    const team = {
      nodeId: GONE,
      genesisId: 'g1',
      taskId: 'T070',
      task: 'Trier',
      agents: [{ id: 'po', profileId: 'po', zone: ['docs'] }],
      links: []
    }
    stored.set(GONE, team)
    expect(service.relinkSketch(GONE, OTHER_ID)).toEqual({ ...team, nodeId: OTHER_ID })
    expect(stored.has(GONE)).toBe(false)
    expect(moved).toEqual([`${GONE}→${OTHER_ID}`])
    // Un nœud qui existe encore se déplace (D24), il ne se rattache pas.
    stored.set(GONE, team)
    expect(() => service.relinkSketch(OTHER_ID, GONE)).toThrow()
  })

  it('should_move_the_team_to_another_task_without_what_belonged_to_the_old_one', () => {
    // L1o D24 : agents (profils, places) et liens suivent ; demande, part et zone restent à l'ancienne tâche.
    const service = serviceWith(node())
    service.saveSketch({
      ...alone,
      agents: [
        { id: 'po', profileId: 'po', task: 'Cadrer le tri', zone: ['docs'], place: { x: 10, y: 20 } },
        { id: 'back', profileId: 'back', zone: ['src'] }
      ],
      links: [{ from: 'po', to: 'back' }]
    })
    const moved = service.moveSketch(NODE_ID, OTHER_ID, 'T021')
    expect(moved).toEqual({
      nodeId: OTHER_ID,
      genesisId: moved.genesisId,
      taskId: 'T021',
      agents: [
        { id: 'po', profileId: 'po', place: { x: 10, y: 20 } },
        { id: 'back', profileId: 'back' }
      ],
      links: [{ from: 'po', to: 'back' }]
    })
    expect(service.sketches().map((sketch) => sketch.nodeId)).toEqual([OTHER_ID])
    // Plus d'équipe à déplacer ; une tâche qui a déjà des agents refuse l'équipe.
    expect(() => service.moveSketch(NODE_ID, OTHER_ID, 'T022')).toThrow(/Aucune équipe/)
    service.saveSketch(alone)
    expect(() => service.moveSketch(NODE_ID, OTHER_ID, 'T022')).toThrow(/déjà des agents/)
  })

  it('should_refuse_an_invalid_assembly_before_launching_anything', async () => {
    const service = serviceWith(node())
    // Deux agents sans PO : le planificateur refuse, rien ne démarre et rien n'est enregistré.
    await expect(
      service.start({
        ...alone,
        agents: [
          { id: 'back', profileId: 'back' },
          { id: 'qa', profileId: 'qa' }
        ]
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.start({ ...alone, baseBranch: 'absente' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(service.list()).toEqual([])
    expect(sessions).toHaveLength(0)
  })

  it('should_warn_about_permissions_without_starting_the_assembly', async () => {
    const service = serviceWith(node())
    expect(await service.warnings(alone)).toEqual([expect.stringContaining('Écrire sans demander')])
    expect(service.list()).toEqual([])
  })

  it('should_refuse_a_second_run_of_the_same_task_while_one_is_running_and_allow_cancel', async () => {
    let sessionStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => (sessionStarted = resolve))
    // Session qui attend le signal d'annulation.
    const waiting: AgentSessionRunner = async (request) => {
      sessions.push(request)
      sessionStarted()
      await new Promise<void>((resolve) => request.signal?.addEventListener('abort', () => resolve()))
      return { ok: false, text: '', error: 'Session annulée.' }
    }
    const service = serviceWith(node(), null, waiting)
    await service.start(alone)
    await expect(service.start({ ...alone })).rejects.toMatchObject({ code: 'CONFLICT' })
    await started
    service.cancel('g1', 'T020')
    await finished(service, 'T020')
    expect(service.list()[0]).toMatchObject({ state: 'finished', result: { completed: false } })
    await expect(service.approve('g1', 'T020')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(() => service.cancel('g1', 'T020')).toThrowError(/Aucun assemblage en cours/)
  })

  it('should_share_one_engine_per_project_when_two_tasks_run_at_the_same_time', async () => {
    const service = serviceWith(node())
    await Promise.all([service.start(alone), service.start({ ...alone, taskId: 'T021' })])
    await finished(service, 'T020')
    await finished(service, 'T021')
    // Un seul moteur : ses commandes git passent une à une, les deux tâches aboutissent.
    expect(engines).toBe(1)
    expect(service.list().map((run) => run.result?.completed)).toEqual([true, true])
  })

  it('should_follow_each_agent_live_from_waiting_to_done_with_pass_verdict_and_report', async () => {
    const seen: string[] = []
    const watching = (request: AgentSessionRequest) => {
      // Pendant la session du back, le PO a fini et le QA attend.
      if (request.profile.id === 'back') {
        seen.push(
          service
            .list()[0]
            ?.agents.map((a) => `${a.agentId}:${a.state}`)
            .join(',') ?? ''
        )
      }
      return runner(request)
    }
    const service: AssemblyService = serviceWith(node(), null, watching)
    await service.start({
      nodeId: NODE_ID,
      taskId: 'T022',
      agents: [
        { id: 'po', profileId: 'po' },
        { id: 'back', profileId: 'back' },
        { id: 'qa', profileId: 'qa' }
      ],
      links: [
        { from: 'po', to: 'back' },
        { from: 'back', to: 'qa' }
      ]
    })
    expect(service.list()[0]?.agents.map((a) => a.state)).toEqual(['waiting', 'waiting', 'waiting'])
    await finished(service, 'T022')
    expect(seen).toEqual(['po:done,back:running,qa:waiting'])
    const [po, back, qa] = service.list()[0]?.agents ?? []
    expect(po).toMatchObject({ state: 'done', pass: 1, nature: 'initiale', specVersion: 1 })
    expect(back).toMatchObject({ state: 'done', report: 'Rapport back' })
    expect(qa).toMatchObject({ state: 'done', verdict: 'valide' })
    expect(events.length).toBeGreaterThan(6)
  })

  it('should_show_a_failed_agent_with_its_reason_and_block_the_ones_that_wait_for_it', async () => {
    const failing: AgentSessionRunner = async (request) =>
      request.profile.id === 'po' ? { ok: false, text: '', error: 'Session coupée.' } : runner(request)
    const service = serviceWith(node(), null, failing)
    await service.start({
      nodeId: NODE_ID,
      taskId: 'T023',
      agents: [
        { id: 'po', profileId: 'po' },
        { id: 'back', profileId: 'back' }
      ],
      links: [{ from: 'po', to: 'back' }]
    })
    await finished(service, 'T023')
    const [po, back] = service.list()[0]?.agents ?? []
    expect(po).toMatchObject({ state: 'failed', message: 'Session coupée.' })
    expect(back).toMatchObject({ state: 'blocked' })
  })

  it('should_keep_a_sketch_per_node_replace_it_and_refuse_a_badly_formed_one', () => {
    const service = serviceWith(node())
    const sketch = {
      nodeId: NODE_ID,
      taskId: 'T030',
      task: 'Trier',
      agents: [
        { id: 'po', profileId: 'po' },
        { id: 'back', profileId: 'back', zone: ['src/liste'] }
      ],
      links: [{ from: 'po', to: 'back' }]
    }
    expect(service.saveSketch(sketch)).toMatchObject({ genesisId: 'g1', taskId: 'T030', task: 'Trier' })
    // Un croquis peut être incomplet (pas encore de PO) : il se vérifie au lancement.
    service.saveSketch({ ...sketch, taskId: 'T031', agents: [{ id: 'back', profileId: 'back' }], links: [] })
    expect(service.sketches('g1')).toEqual([expect.objectContaining({ taskId: 'T031' })])
    expect(service.sketches('autre')).toEqual([])
    expect(() => service.saveSketch({ ...sketch, links: [{ from: 'po', to: 'absent' }] })).toThrowError(/absent/)
    expect(() =>
      service.saveSketch({
        ...sketch,
        links: [
          { from: 'po', to: 'back' },
          { from: 'back', to: 'po' }
        ]
      })
    ).toThrowError(/boucle/)
    expect(() => service.saveSketch({ ...sketch, taskId: '../x' })).toThrowError(/tâche/)
    expect(() => serviceWith(undefined).saveSketch(sketch)).toThrowError(/introuvable/)
    service.clearSketch(NODE_ID)
    expect(service.sketches()).toEqual([])
  })
})

describe('cases cochées à la fusion (L1o D23, D25)', () => {
  const base: AssemblyNode = {
    genesisId: 'g1',
    kind: 'lot',
    title: 'Lot',
    content: null,
    sheet: '',
    projectDir: 'C:/p',
    projectName: 'demo',
    lotFile: 'docs/TACHES-TRI.md',
    lotTasks: [
      { id: 'T001', key: 'a', text: 'Trier', done: false },
      { id: 'T002', key: 'b', text: 'Filtrer', done: false },
      { id: 'T003', key: 'c', text: 'Chercher', done: true }
    ]
  }

  it('should_check_the_planned_open_tasks_of_a_lot_or_all_of_them_without_a_plan', () => {
    const plan = { steps: [{ task: 'T002', agents: ['Thor'], waits: [] }], rhythm: null }
    expect(boxesOf(base, plan)).toEqual([{ path: 'docs/TACHES-TRI.md', key: 'b' }])
    expect(boxesOf(base, undefined).map((box) => box.key)).toEqual(['a', 'b'])
    expect(boxesOf({ ...base, box: { path: 'x.md', key: 'k' } }, plan)).toEqual([{ path: 'x.md', key: 'k' }])
    const withoutFile: AssemblyNode = {
      genesisId: 'g1',
      kind: 'lot',
      title: 'Lot',
      content: null,
      sheet: '',
      projectDir: 'C:/p',
      projectName: 'demo',
      ...(base.lotTasks === undefined ? {} : { lotTasks: base.lotTasks })
    }
    expect(boxesOf(withoutFile, plan)).toEqual([])
  })
})
