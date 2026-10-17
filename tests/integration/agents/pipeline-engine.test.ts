import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PipelineDocuments } from '../../../src/main/application/agents/PipelineDocuments'
import {
  PipelineEngine,
  type AgentSessionRequest,
  type AgentSessionRunner
} from '../../../src/main/application/agents/PipelineEngine'
import { runGit } from '../../../src/main/infrastructure/projects/GitCli'
import { parseTaskFile } from '../../../src/main/domain/workflow/parseTaskFile'
import { parseLotPlan } from '../../../src/shared/agents/lotPlan'
import { agentBranch, type Assembly } from '../../../src/shared/agents/pipeline'
import type { AgentProfileView, AgentRole } from '../../../src/shared/agents/profile'

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

const PROFILES = [profile('po', 'po'), profile('back', 'backend'), profile('front', 'frontend'), profile('qa', 'qa')]

/** PO → back et PO → front (en parallèle), puis back → qa et front → qa. */
const diamond = (taskId = 'T010'): Assembly => ({
  taskId,
  brief: 'Faire X',
  agents: [
    { id: 'po', profileId: 'po' },
    { id: 'back', profileId: 'back' },
    { id: 'front', profileId: 'front', task: 'Seulement l’écran' },
    { id: 'qa', profileId: 'qa' }
  ],
  links: [
    { from: 'po', to: 'back' },
    { from: 'po', to: 'front' },
    { from: 'back', to: 'qa' },
    { from: 'front', to: 'qa' }
  ]
})

/** Chaque agent écrit un fichier à son nom dans son dossier et rend un rapport ; le QA valide. */
const writer: AgentSessionRunner = async (request) => {
  writeFileSync(join(request.cwd, `${request.profile.id}.txt`), 'x\n')
  const verdict = request.profile.role === 'qa' ? '\nVERDICT: VALIDE' : ''
  return { ok: true, text: `Rapport ${request.profile.id}${verdict}` }
}

describe('planificateur d’assemblage (L1o, T011–T012, T016–T018)', { timeout: 60_000 }, () => {
  let root: string
  let project: string
  const git = (args: readonly string[]) => runGit(project, args)

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'gi-engine-'))
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

  const engineWith = (runSession: AgentSessionRunner): PipelineEngine => {
    let n = 0
    return new PipelineEngine({
      profiles: () => PROFILES,
      runSession,
      git,
      projectDir: project,
      worktreeRoot: join(root, 'worktrees'),
      documentsFor: (dir) =>
        new PipelineDocuments({
          projectDir: dir,
          profileDir: join(root, 'profil'),
          projectName: 'demo',
          projectJournalFile: join(root, 'profil', 'journal-demo.md'),
          usageFile: join(root, 'profil', 'usage.jsonl')
        }),
      newSessionId: () => `session-${++n}`
    })
  }
  const filesOf = async (branch: string): Promise<string> =>
    (await git(['ls-tree', '-r', '--name-only', branch])).output

  it('should_stop_an_agent_whose_writes_were_refused_and_who_changed_nothing_instead_of_validating', async () => {
    // L1o D20 : le profil « Demander avant d'écrire », sans personne pour répondre ; l'agent ne fait que rendre compte.
    const result = await engineWith(async (request) => {
      request.onEvent?.({ kind: 'tool', name: 'Write', id: 'w1', input: { file_path: 'src/a.ts' } })
      request.onEvent?.({
        kind: 'toolResult',
        id: 'w1',
        isError: true,
        text: 'Claude requested permissions to write to src/a.ts, but you haven’t granted it yet.'
      })
      return { ok: true, text: 'Je n’ai rien pu écrire.' }
    }).run({ taskId: 'T021', brief: 'Écrire a', agents: [{ id: 'back', profileId: 'back' }], links: [] })
    expect(result.completed).toBe(false)
    expect(result.agents[0]).toMatchObject({ status: 'failed', stopped: { reason: 'permission-denied' } })
    expect(result.agents[0]?.stopped?.message).toContain('1 écriture(s) ou commande(s) refusée(s)')
  })

  it('should_record_what_a_pass_consumed_with_the_result_and_in_the_project_usage_log', async () => {
    // L2-pipeline-optimal D10 (T015) : relevé lu dans le flux de la session, joint au résultat et gardé hors du dépôt.
    const quota = (utilization: number) =>
      ({
        kind: 'quota',
        status: 'allowed',
        utilization: null,
        resetsAt: null,
        fiveHour: { utilization, resetsAt: null },
        sevenDay: null
      }) as const
    const result = await engineWith(async (request) => {
      request.onEvent?.(quota(0.1))
      request.onEvent?.({ kind: 'tool', name: 'Read', id: 'r1', input: { file_path: 'README.md' } })
      request.onEvent?.({ kind: 'tool', name: 'Write', id: 'w1', input: { file_path: 'a.txt' } })
      request.onEvent?.(quota(0.14))
      request.onEvent?.({
        kind: 'result',
        ok: true,
        text: 'Fait',
        sessionId: request.sessionId,
        usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 5000, cacheWriteTokens: 800 },
        costUsd: 0.42,
        turns: 6,
        durationMs: 15000
      })
      return writer(request)
    }).run({ taskId: 'T030', brief: 'Écrire a', agents: [{ id: 'back', profileId: 'back' }], links: [] })
    const expected = {
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 5000,
      cacheWriteTokens: 800,
      costUsd: 0.42,
      turns: 6,
      tools: 2,
      durationMs: 15000,
      fiveHourStart: 0.1,
      fiveHourEnd: 0.14
    }
    expect(result.agents[0]?.usage).toEqual(expected)
    const log = new PipelineDocuments({
      projectDir: project,
      profileDir: join(root, 'profil'),
      projectName: 'demo',
      usageFile: join(root, 'profil', 'usage.jsonl')
    }).readUsage('T030')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      agentId: 'back',
      role: 'backend',
      pass: 1,
      nature: 'initiale',
      ok: true,
      usage: expected
    })
    // Rien dans le dépôt : le relevé vit dans le profil.
    expect(await filesOf('agents/T030/back')).not.toContain('usage')
  })

  it('should_give_each_agent_its_visio_identity_on_the_bridge_when_the_team_has_a_node', async () => {
    // L2-pipeline-optimal D11 : l'identité de l'agent sur le pont est la visio de l'agent sur le nœud de l'équipe.
    const seen: AgentSessionRequest[] = []
    const engine = new PipelineEngine({
      profiles: () => PROFILES,
      runSession: async (request) => {
        seen.push(request)
        return writer(request)
      },
      git,
      projectDir: project,
      worktreeRoot: join(root, 'worktrees'),
      documentsFor: (dir) =>
        new PipelineDocuments({ projectDir: dir, profileDir: join(root, 'profil'), projectName: 'demo' }),
      agentNeuron: (hostId, agentId) => `visio-${hostId}-${agentId}`
    })
    await engine.run({
      taskId: 'T031',
      brief: 'X',
      agents: [{ id: 'back', profileId: 'back' }],
      links: [],
      hostId: 'wf:g:ttask:t1'
    })
    expect(seen[0]?.bridgeNeuronId).toBe('visio-wf:g:ttask:t1-back')
    await engine.run({ taskId: 'T032', brief: 'X', agents: [{ id: 'back', profileId: 'back' }], links: [] })
    expect(seen[1]?.bridgeNeuronId).toBeUndefined()
  })

  it('should_warn_about_uncommitted_files_that_the_agents_will_not_see', async () => {
    const engine = engineWith(writer)
    expect(await engine.uncommittedWarning()).toBeNull()
    writeFileSync(join(project, 'TACHES-NOUVEAU.md'), '- [ ] T001 X\n')
    writeFileSync(join(project, 'README.md'), 'modifié\n')
    const warning = await engine.uncommittedWarning()
    expect(warning).toContain('Copie de travail modifiée : 2 fichier(s) non commité(s)')
    expect(warning).toContain('TACHES-NOUVEAU.md')
  })

  it('should_run_a_single_agent_without_po_in_its_own_worktree', async () => {
    const seen: AgentSessionRequest[] = []
    const result = await engineWith(async (request) => {
      seen.push(request)
      return writer(request)
    }).run({ taskId: 'T020', brief: 'Corriger le bug', agents: [{ id: 'back', profileId: 'back' }], links: [] })
    expect(result.completed).toBe(true)
    expect(result.agents[0]).toMatchObject({ status: 'done', branch: 'agents/T020/back', sessionId: 'session-1' })
    expect(result.agents[0]?.worktree).toBeUndefined()
    expect(seen[0]?.cwd).toBe(join(root, 'worktrees', 'T020', 'back'))
    expect(seen[0]?.prompt).toContain('Corriger le bug')
    expect(seen[0]?.systemPrompt).toContain('Tu travailles seul')
    const files = await filesOf('agents/T020/back')
    expect(files).toContain('back.txt')
    expect(files).toContain('docs/pipeline/T020/rapport-back.md')
    // Ni la base ni la copie de travail de mentalyas ne bougent ; le worktree est retiré.
    expect(await filesOf('main')).not.toContain('back.txt')
    expect((await git(['status', '--porcelain'])).output).toBe('')
    expect(existsSync(join(root, 'worktrees', 'T020', 'back'))).toBe(false)
  })

  it('should_run_unlinked_agents_at_the_same_time', async () => {
    const started: string[] = []
    let release: () => void = () => undefined
    const bothStarted = new Promise<void>((resolve) => (release = resolve))
    const result = await engineWith(async (request) => {
      if (request.profile.role === 'backend' || request.profile.role === 'frontend') {
        started.push(request.profile.id)
        if (started.length === 2) release()
        // Chacun attend que l'autre ait démarré : en séquence, ce test ne finirait jamais.
        await bothStarted
      }
      return writer(request)
    }).run(diamond())
    expect(result.completed).toBe(true)
    expect(started.sort()).toEqual(['back', 'front'])
  })

  it('should_show_the_po_the_existing_profiles_and_how_to_recommend_agents', async () => {
    const prompts = new Map<string, string>()
    await engineWith(async (request) => {
      prompts.set(request.profile.id, request.prompt)
      return writer(request)
    }).run(diamond())
    const forPo = prompts.get('po') ?? ''
    expect(forPo).toContain('Profils d’agents existants :')
    expect(forPo).toContain('- Agent back (Backend, claude-sonnet-5-5')
    expect(forPo).toContain('RECOMMANDÉ:')
    expect(forPo).toContain('SUGGÉRÉ:')
    expect(prompts.get('back')).not.toContain('Profils d’agents existants')
  })

  it('should_ask_the_po_for_a_lot_spec_with_routing_and_read_it_back_when_connected_to_a_lot', async () => {
    // L1o D25 (T021) : le PO cadre toutes les tâches du lot ; sa spec signée porte l'aiguillage et le rythme.
    const prompts = new Map<string, string>()
    const lot: Assembly = {
      taskId: 'T050',
      brief: 'Lot Tri',
      agents: [{ id: 'po', profileId: 'po' }],
      links: [],
      lot: [
        { id: 'T001', key: 'a', text: 'Trier par date', done: false },
        { id: 'T002', key: 'b', text: 'Trier par titre', done: false }
      ]
    }
    await engineWith(async (request) => {
      prompts.set(request.profile.id, request.prompt)
      return {
        ok: true,
        text: '## T001\n\nAIGUILLAGE: T001 | Agent back | \nRYTHME: tout le lot — deux tris simples'
      }
    }).run(lot)
    const forPo = prompts.get('po') ?? ''
    expect(forPo).toContain('LOT de 2 tâche(s)')
    expect(forPo).toContain('- T002 · Trier par titre')
    expect(forPo).toContain('Profils d’agents existants :')
    // La spec signée est commitée sur la branche du PO.
    const signed = (await git(['show', `${agentBranch('T050', 'po')}:docs/pipeline/T050/spec.md`])).output
    expect(parseLotPlan(signed)).toEqual({
      steps: [{ task: 'T001', agents: ['Agent back'], waits: [], after: [] }],
      rhythm: { mode: 'tout', reason: 'deux tris simples' }
    })
  })

  it('should_start_from_the_merge_of_every_awaited_agent', async () => {
    const prompts = new Map<string, string>()
    const result = await engineWith(async (request) => {
      prompts.set(request.profile.id, request.prompt)
      return writer(request)
    }).run(diamond())
    expect(result.agents.map((a) => a.status)).toEqual(['done', 'done', 'done', 'done'])
    // Le PO a signé la spec, que back et front lisent ; le QA part de la fusion des deux.
    expect(prompts.get('back')).toContain('Spec signée de la tâche T010')
    expect(prompts.get('front')).toContain('Seulement l’écran')
    expect(prompts.get('qa')).toContain('### back (Backend, passe 1 initiale)')
    expect(prompts.get('qa')).toContain('### front (Frontend, passe 1 initiale)')
    const files = await filesOf('agents/T010/qa')
    for (const file of ['po.txt', 'back.txt', 'front.txt', 'qa.txt', 'docs/pipeline/T010/spec.md']) {
      expect(files).toContain(file)
    }
    expect(await filesOf('agents/T010/back')).not.toContain('front.txt')
  })

  it('should_block_the_agents_waiting_for_a_failed_one', async () => {
    const result = await engineWith(async (request) =>
      request.profile.id === 'back' ? { ok: false, text: '', error: 'session perdue' } : writer(request)
    ).run(diamond())
    expect(result.completed).toBe(false)
    const [po, back, front, qa] = result.agents
    expect(po?.status).toBe('done')
    expect(front?.status).toBe('done')
    expect(back).toMatchObject({ status: 'failed', stopped: { reason: 'agent-failed', message: 'session perdue' } })
    // Le worktree de l'agent arrêté reste, pour voir où il en était.
    expect(back?.worktree !== undefined && existsSync(back.worktree)).toBe(true)
    expect(qa).toMatchObject({ status: 'blocked', stopped: { reason: 'upstream-failed' } })
  })

  it('should_stop_when_the_awaited_results_conflict', async () => {
    const result = await engineWith(async (request) => {
      writeFileSync(join(request.cwd, 'commun.txt'), `${request.profile.id}\n`)
      return { ok: true, text: `Rapport ${request.profile.id}` }
    }).run(diamond())
    expect(result.agents[3]).toMatchObject({ status: 'failed', stopped: { reason: 'merge-conflict' } })
  })

  it('should_keep_the_hooks_and_stop_when_one_refuses_the_commit', async () => {
    writeFileSync(join(project, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho "refus du hook" >&2\nexit 1\n', {
      mode: 0o755
    })
    const result = await engineWith(writer).run({
      taskId: 'T030',
      brief: 'Faire Y',
      agents: [{ id: 'back', profileId: 'back' }],
      links: []
    })
    expect(result.agents[0]).toMatchObject({ status: 'failed', stopped: { reason: 'git-failed' } })
    expect(result.agents[0]?.stopped?.message).toContain('refus du hook')
  })

  it('should_cancel_the_agents_not_yet_started', async () => {
    const controller = new AbortController()
    const result = await engineWith(async (request) => {
      controller.abort()
      return writer(request)
    }).run(diamond(), controller.signal)
    expect(result.agents.map((a) => a.status)).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled'])
  })

  it('should_refuse_an_invalid_assembly_or_an_unknown_base', async () => {
    const engine = engineWith(writer)
    await expect(engine.run({ ...diamond(), taskId: '../x' })).rejects.toThrow(/invalide/)
    await expect(engine.run({ ...diamond(), links: [] })).rejects.toThrow(/pas relié au Product Owner/)
    await expect(engine.run({ ...diamond(), baseBranch: 'absente' })).rejects.toThrow(/introuvable/)
  })

  describe('boucle QA → PO → agents concernés (D8) et passes indexées (D9)', () => {
    /** Le QA renvoie au premier tour ; le PO réécrit la spec en désignant `designation` ; le QA valide ensuite. */
    const sendBackOnce = (designation: string, seen: AgentSessionRequest[]): AgentSessionRunner => {
      let qaRuns = 0
      return async (request) => {
        seen.push(request)
        const { id, role } = request.profile
        writeFileSync(join(request.cwd, `${id}.txt`), `${seen.length}\n`)
        if (role === 'qa') {
          qaRuns += 1
          return {
            ok: true,
            text: qaRuns === 1 ? 'Le bouton plante.\nVERDICT: RENVOI' : 'Tout passe.\nVERDICT: VALIDE'
          }
        }
        if (role === 'po' && request.prompt.includes('Le QA a renvoyé le travail')) {
          return { ok: true, text: `Spec v2 : le bouton ne plante plus.\n${designation}` }
        }
        return { ok: true, text: `Rapport ${id}` }
      }
    }

    it('should_rerun_only_the_designated_agents_and_the_qa_when_the_qa_sends_back', async () => {
      const seen: AgentSessionRequest[] = []
      const result = await engineWith(sendBackOnce('AGENTS: back=correction', seen)).run(diamond())
      expect(result.completed).toBe(true)
      expect(result.rounds).toBe(2)
      const [po, back, front, qa] = result.agents
      expect(po?.index).toEqual({ pass: 2, nature: 'correction', specVersion: 2 })
      expect(back?.index).toEqual({ pass: 2, nature: 'correction', specVersion: 2 })
      expect(front?.index).toEqual({ pass: 1, nature: 'initiale', specVersion: 1 })
      expect(qa).toMatchObject({ index: { pass: 2, nature: 'repasse', specVersion: 2 }, verdict: 'valide' })
      // Le PO a lu le rapport du QA ; l'agent relancé sait qu'il corrige, et lit la spec v2.
      const poAgain = seen.filter((r) => r.profile.id === 'po')[1]
      expect(poAgain?.prompt).toContain('Le bouton plante.')
      const backAgain = seen.filter((r) => r.profile.id === 'back')[1]
      expect(backAgain?.systemPrompt).toContain('Passe 2 : correction d’une erreur relevée par le QA, spec v2.')
      expect(backAgain?.prompt).toContain('(v2)')
      // L2-pipeline-optimal D3 : une passe suivante reprend la session de la précédente, la première n'en reprend pas.
      const backFirst = seen.filter((r) => r.profile.id === 'back')[0]
      expect(backFirst?.resume).toBeUndefined()
      expect(backAgain).toMatchObject({ resume: true, sessionId: backFirst?.sessionId })
      expect(poAgain?.resume).toBe(true)
      expect(seen.filter((r) => r.profile.id === 'front')).toHaveLength(1)
      const log = (await git(['log', '--format=%s', 'agents/T010/back'])).output
      expect(log).toContain('chore(agents): T010 · back · passe 2 (correction, spec v2)')
    })

    it('should_open_a_fresh_session_when_claude_code_no_longer_knows_the_one_to_resume', async () => {
      const seen: AgentSessionRequest[] = []
      const inner = sendBackOnce('AGENTS: back=correction', seen)
      const result = await engineWith(async (request) =>
        request.resume === true && request.profile.id === 'back'
          ? { ok: false, text: '', error: 'No conversation found', missingSession: true }
          : inner(request)
      ).run(diamond())
      expect(result.completed).toBe(true)
      // Reprise refusée, puis la même passe dans une session neuve.
      const backRuns = seen.filter((r) => r.profile.id === 'back')
      expect(backRuns).toHaveLength(2)
      expect(backRuns[1]?.resume).toBeUndefined()
      expect(backRuns[1]?.sessionId).not.toBe(backRuns[0]?.sessionId)
      expect(result.agents[1]).toMatchObject({ status: 'done', sessionId: backRuns[1]?.sessionId })
    })

    it('should_rerun_the_agents_depending_on_a_designated_one_as_a_repasse', async () => {
      const seen: AgentSessionRequest[] = []
      const chain: Assembly = {
        ...diamond(),
        links: [...diamond().links, { from: 'back', to: 'front' }]
      }
      const result = await engineWith(sendBackOnce('AGENTS: back=correction', seen)).run(chain)
      expect(result.completed).toBe(true)
      expect(result.agents[2]?.index).toMatchObject({ pass: 2, nature: 'repasse' })
    })

    it('should_stop_when_the_po_designates_no_agent', async () => {
      const result = await engineWith(sendBackOnce('Sans désignation.', [])).run(diamond())
      expect(result.completed).toBe(false)
      expect(result.agents[0]).toMatchObject({ status: 'failed', stopped: { reason: 'po-no-designation' } })
    })

    it('should_stop_when_the_po_designates_an_unknown_agent', async () => {
      const result = await engineWith(sendBackOnce('AGENTS: inconnu=correction', [])).run(diamond())
      expect(result.agents[0]?.stopped?.message).toContain('« inconnu »')
    })

    it('should_stop_when_the_qa_gives_no_verdict', async () => {
      const result = await engineWith(async (request) =>
        request.profile.role === 'qa' ? { ok: true, text: 'Je ne sais pas.' } : writer(request)
      ).run(diamond())
      expect(result.completed).toBe(false)
      expect(result.agents[3]).toMatchObject({ status: 'failed', stopped: { reason: 'qa-no-verdict' } })
    })
  })

  describe('accord unique de fusion (D11)', () => {
    it('should_merge_the_final_branch_on_the_base_once_approved', async () => {
      const engine = engineWith(writer)
      expect((await engine.run(diamond())).completed).toBe(true)
      expect(await filesOf('main')).not.toContain('qa.txt')
      const approval = await engine.approve(diamond())
      expect(approval).toMatchObject({ merged: true, baseBranch: 'main' })
      const files = await filesOf('main')
      for (const file of ['po.txt', 'back.txt', 'front.txt', 'qa.txt']) expect(files).toContain(file)
      // La copie de travail était sur main : elle a avancé, propre.
      expect(existsSync(join(project, 'qa.txt'))).toBe(true)
      expect((await git(['status', '--porcelain'])).output).toBe('')
      expect(existsSync(join(root, 'worktrees', 'T010', '_fusion'))).toBe(false)
    })

    it('should_merge_every_final_branch_when_several_agents_end_the_assembly', async () => {
      const fork: Assembly = {
        ...diamond('T040'),
        agents: diamond('T040').agents.slice(0, 3),
        links: diamond('T040').links.slice(0, 2)
      }
      const engine = engineWith(writer)
      expect((await engine.run(fork)).completed).toBe(true)
      expect(await engine.approve(fork)).toMatchObject({ merged: true })
      const files = await filesOf('main')
      expect(files).toContain('back.txt')
      expect(files).toContain('front.txt')
    })

    it('should_check_the_task_in_the_same_fusion_then_clean_the_merged_agent_branches', async () => {
      // L1o D23 : la case de la tâche est cochée dans un commit de plus, la base avance d'un coup.
      writeFileSync(join(project, 'TACHES-TRI.md'), '# Tri\n\n## Lot\n\n- [ ] T001 Trier\n')
      await git(['add', 'TACHES-TRI.md'])
      await git(['commit', '-m', 'docs: tâches'])
      const key = parseTaskFile('TACHES-TRI.md', '# Tri\n\n## Lot\n\n- [ ] T001 Trier\n').lots[0]?.tasks[0]?.key ?? ''
      const engine = engineWith(writer)
      expect((await engine.run(diamond())).completed).toBe(true)
      const approval = await engine.approve(diamond(), [{ path: 'TACHES-TRI.md', key }])
      expect(approval).toMatchObject({ merged: true, checked: 1 })
      expect((await git(['show', 'main:TACHES-TRI.md'])).output).toContain('- [x] T001 Trier')
      expect((await git(['log', '-1', '--format=%s', 'main'])).output).toContain('T010 faite')
      expect((await git(['status', '--porcelain'])).output).toBe('')

      const cleaned = await engine.cleanup(diamond())
      expect([...cleaned.removed].sort()).toEqual(
        ['po', 'back', 'front', 'qa'].map((id) => agentBranch('T010', id)).sort()
      )
      expect(cleaned.kept).toEqual([])
      expect((await git(['branch', '--list', 'agents/*'])).output.trim()).toBe('')
    })

    it('should_check_every_task_of_a_lot_in_its_own_file_in_one_commit', async () => {
      // L1o D25 : la fusion d'un lot coche ses tâches dans le fichier du lot (jamais dans un doublon).
      const text = '# Tri\n\n## Lot\n\n- [ ] T001 Trier\n- [~] T002 Filtrer\n- [x] T003 Chercher\n'
      writeFileSync(join(project, 'TACHES-TRI.md'), text)
      await git(['add', 'TACHES-TRI.md'])
      await git(['commit', '-m', 'docs: tâches'])
      const keys = parseTaskFile('TACHES-TRI.md', text).lots[0]?.tasks.map((task) => task.key ?? '') ?? []
      const engine = engineWith(writer)
      expect((await engine.run(diamond())).completed).toBe(true)
      const approval = await engine.approve(
        diamond(),
        keys.map((key) => ({ path: 'TACHES-TRI.md', key }))
      )
      // T003 était déjà cochée : deux cases de plus.
      expect(approval).toMatchObject({ merged: true, checked: 2 })
      const after = (await git(['show', 'main:TACHES-TRI.md'])).output
      expect(after).toContain('- [x] T001 Trier')
      expect(after).toContain('- [x] T002 Filtrer')
      expect((await git(['log', '-1', '--format=%s', 'main'])).output).toContain('T010 · 2 tâches faites')
    })

    it('should_keep_an_agent_branch_that_the_base_does_not_contain_when_cleaning', async () => {
      const engine = engineWith(writer)
      expect((await engine.run(diamond())).completed).toBe(true)
      // Pas de fusion : aucune branche n'est contenue dans main, toutes sont gardées.
      const cleaned = await engine.cleanup(diamond())
      expect(cleaned.removed).toEqual([])
      expect(cleaned.kept).toHaveLength(4)
    })

    it('should_refuse_the_approval_when_the_working_copy_has_changes', async () => {
      const engine = engineWith(writer)
      await engine.run(diamond())
      writeFileSync(join(project, 'brouillon.txt'), 'en cours\n')
      const before = (await git(['rev-parse', 'main'])).output
      const approval = await engine.approve(diamond())
      expect(approval).toMatchObject({ merged: false })
      expect(approval.message).toContain('modifications')
      expect((await git(['rev-parse', 'main'])).output).toBe(before)
    })

    it('should_refuse_the_approval_when_the_assembly_has_not_run', async () => {
      expect(await engineWith(writer).approve(diamond())).toMatchObject({ merged: false })
    })

    it('should_warn_about_permission_modes_that_block_writes_or_commands', () => {
      const warnings = engineWith(writer).warnings(diamond())
      expect(warnings).toHaveLength(4)
      expect(warnings[0]).toContain('ne pourra lancer aucune commande')
    })

    it('should_warn_when_two_parallel_agents_share_a_zone', () => {
      const base = diamond()
      const shared: Assembly = {
        ...base,
        agents: base.agents.map((a) => (a.id === 'back' || a.id === 'front' ? { ...a, zone: ['src/app'] } : a))
      }
      const warnings = engineWith(writer).warnings(shared)
      expect(warnings.some((w) => w.includes('« back » et « front »') && w.includes('src/app'))).toBe(true)
    })
  })
})
