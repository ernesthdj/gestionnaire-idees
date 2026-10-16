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
import type { Assembly } from '../../../src/shared/agents/pipeline'
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
  updatedAt: 0
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
          projectJournalFile: join(root, 'profil', 'journal-demo.md')
        }),
      newSessionId: () => `session-${++n}`
    })
  }
  const filesOf = async (branch: string): Promise<string> =>
    (await git(['ls-tree', '-r', '--name-only', branch])).output

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
      expect(seen.filter((r) => r.profile.id === 'front')).toHaveLength(1)
      const log = (await git(['log', '--format=%s', 'agents/T010/back'])).output
      expect(log).toContain('chore(agents): T010 · back · passe 2 (correction, spec v2)')
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
  })
})
