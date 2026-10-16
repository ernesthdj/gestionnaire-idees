import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import { runRepriseGuide } from '../../../src/main/application/ai/RepriseGuideTask'
import { runRepriseResolution } from '../../../src/main/application/ai/RepriseResolutionTask'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { ConversationService } from '../../../src/main/application/conversation/ConversationService'
import { DocumentService } from '../../../src/main/application/documents/DocumentService'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { DocumentTools } from '../../../src/main/application/mcp/DocumentTools'
import { FinalTools } from '../../../src/main/application/mcp/FinalTools'
import { MapService } from '../../../src/main/application/mcp/MapService'
import { NeuronTools } from '../../../src/main/application/mcp/NeuronTools'
import { PlanTools } from '../../../src/main/application/mcp/PlanTools'
import { SelectionStore } from '../../../src/main/application/mcp/SelectionStore'
import { createToolHandler } from '../../../src/main/application/mcp/toolHandler'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import { CodeGraphTools } from '../../../src/main/application/reprise/CodeGraphTools'
import { ConfidentialityGuard } from '../../../src/main/application/reprise/ConfidentialityGuard'
import { ExplorerService } from '../../../src/main/application/reprise/ExplorerService'
import { GuideService } from '../../../src/main/application/reprise/GuideService'
import { RepriseService } from '../../../src/main/application/reprise/RepriseService'
import { ResolutionService } from '../../../src/main/application/reprise/ResolutionService'
import { StructureService } from '../../../src/main/application/structure/StructureService'
import { WidgetIoService } from '../../../src/main/application/widgets/WidgetIoService'
import { WidgetService } from '../../../src/main/application/widgets/WidgetService'
import { McpToolError } from '../../../src/main/domain/mcp/errors'
import { maskLocalProjects } from '../../../src/main/domain/reprise/maskLocal'
import type { SpawnOptions } from '../../../src/main/infrastructure/claude/CliConversation'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { ElementRepository } from '../../../src/main/infrastructure/db/repositories/ElementRepository'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { HatchedRepository } from '../../../src/main/infrastructure/db/repositories/HatchedRepository'
import { MapLinkRepository } from '../../../src/main/infrastructure/db/repositories/MapLinkRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { WidgetIoRepository } from '../../../src/main/infrastructure/db/repositories/WidgetIoRepository'
import { WidgetRepository } from '../../../src/main/infrastructure/db/repositories/WidgetRepository'
import { DocumentFiles } from '../../../src/main/infrastructure/documents/DocumentFiles'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { readProjectText } from '../../../src/main/infrastructure/reprise/projectText'
import type { ToolResult } from '../../../src/shared/mcp/protocol'
import {
  MCP_PUBLIC_TOOL_NAMES,
  MCP_TOOLS,
  StructureDessinerInput,
  type McpToolName
} from '../../../src/shared/mcp/tools'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { git, initRepo } from '../../support/gitRepos'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

/**
 * Spec 017 T035 — SC-002 et SC-003 sur tout le parcours, services composés comme au démarrage de l'app
 * (`bootstrap.ts`) : un projet piégé est repris « Local uniquement », analysé, ses ambiguïtés et son guide demandés,
 * cartographié, branché sur un widget, ouvert en conversation, puis interrogé par le pont MCP depuis une session
 * Claude Code externe et depuis la conversation d'un autre projet.
 *
 * Toutes les sorties possibles vers Claude sont enregistrées : moteur Claude de la passerelle IA (tâches et widgets),
 * lancement d'une conversation `claude -p`, réponses du pont MCP. Un marqueur unique est semé partout dans le projet
 * (nom du dossier, fichiers, titres, fiche, document) : il ne doit jamais en sortir.
 */
const MARK = 'ZQX-LOCAL-7731'

/**
 * Deux réglages de l'IA : modèle local en marche (le travail doit y aller), puis modèle local arrêté avec le repli vers
 * Claude autorisé dans les réglages (le cas où une fuite serait la plus facile).
 */
const SETUPS = [
  { name: 'modèle local en marche', ollama: true, fallback: false },
  { name: 'modèle local arrêté, repli vers Claude autorisé', ollama: false, fallback: true }
] as const

describe.each(SETUPS)(
  'projet repris « Local uniquement » ($name) : rien ne part vers Claude, rien ne s’exécute (spec 017 T035)',
  ({ ollama, fallback }) => {
    let engine: Engine
    let t: NeuronHarness
    let root: string
    let dir: string
    let spawned: SpawnOptions[]
    let mcp: (tool: McpToolName, args: unknown, neuronId: string | null) => Promise<ToolResult | McpToolError>
    let local: {
      genesis: string
      element: string
      step: string
      document: string
    }
    let open: { genesis: string }
    let conversations: ConversationService
    let guide: GuideService
    let resolution: ResolutionService
    let widgets: WidgetService
    let widgetIo: WidgetIoService
    let blocks: BlockRepository
    let selection: SelectionStore
    let gitRunner: GitRunner

    beforeAll(async () => {
      engine = await loadEngine(GRAMMARS_DIR)
    })

    beforeEach(async () => {
      t = createNeuronHarness({ config: () => ({ allowClaudeFallback: fallback }) })
      // En marche, le modèle local n'a rien à dire : une passerelle qui se rabattrait sur Claude après son échec serait
      // prise en défaut.
      t.h.ollama.setAvailable(ollama)
      const db = t.handle.db
      root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-t035-')))
      const profile = join(root, 'profil')
      mkdirSync(profile)
      dir = join(root, `boutique-${MARK}`)
      cpSync(join(REPRISE_FIXTURES, 'hostile-app'), dir, { recursive: true })
      // Ce que le dépôt public ne peut pas porter : secrets, dépendances installées, hooks git.
      writeFileSync(join(dir, '.env'), `API_KEY=${MARK}-secret\n`)
      mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true })
      writeFileSync(join(dir, 'node_modules', '.bin', 'piege.cmd'), `echo ${MARK} > ..\\..\\BIN_RAN\n`)
      mkdirSync(join(dir, '.git', 'hooks'), { recursive: true })
      writeFileSync(join(dir, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\necho ran > HOOK_RAN\n')
      writeFileSync(join(dir, 'src', 'marque.js'), `// Facturation ${MARK}\nexport const marque = '${MARK}'\n`)

      const neuronRepository = new NeuronRepository(db)
      const conversationRepository = new ConversationRepository(db)
      const repriseRepository = new RepriseRepository(db)
      const documentRepository = new DocumentRepository(db)
      const planRepository = new PlanRepository(db)
      const elementRepository = new ElementRepository(db)
      const mapLinkRepository = new MapLinkRepository(db)
      const finalRepository = new FinalRepository(db)
      const codeGraph = new CodeGraphRepository(db)
      blocks = new BlockRepository(db)
      gitRunner = new GitRunner({ emptyHooksDir: join(profile, 'git-empty-hooks') })

      // ── Garde unique, branchée comme dans bootstrap.ts ───────────────────────────────────────────────────────────
      const confidentiality = new ConfidentialityGuard({
        neuron: (id) => conversationRepository.neuron(id),
        project: (genesisId) => repriseRepository.project(genesisId),
        documentNeuron: (documentId) => documentRepository.get(documentId)?.neuronId
      })
      const genesisOf = (neuronId: string): string | undefined => {
        const neuron = conversationRepository.neuron(neuronId)
        if (neuron === undefined) return undefined
        return neuron.kind === 'root' ? neuron.id : (neuron.genesisId ?? undefined)
      }

      // ── Import (US1) puis analyse (US3) ─────────────────────────────────────────────────────────────────────────
      const analysis = new AnalysisService({
        reprise: repriseRepository,
        graph: codeGraph,
        scan: (folder) => scanProject(folder),
        runWorker: (request, onMessage) => {
          void processBatch(engine, request, (message) => onMessage(JSON.parse(JSON.stringify(message))))
          return { cancel: () => undefined }
        },
        emit: () => undefined
      })
      const reprise = new RepriseService({
        repository: repriseRepository,
        pickFolder: async () => dir,
        scan: (folder) => scanProject(folder),
        linkedFolders: () => conversationRepository.linkedFolders(),
        createGenesis: async (title) => t.neurons.insert({ text: title }),
        attach: (neuronId, folder) => conversationRepository.setProjectDir(neuronId, folder, 'session'),
        dataDir: profile,
        onCreated: (genesisId) => analysis.analyze(genesisId)
      })
      const preview = await reprise.previewFolder()
      const { genesisId } = await reprise.create(preview?.previewId ?? '', 'local')
      await analysis.idle()

      // ── Carte du projet : structure, plan d'attaque, fiche, document ────────────────────────────────────────────
      const structure = new StructureService({
        elements: elementRepository,
        links: mapLinkRepository,
        genesisOf,
        genesisTitle: (id) => neuronRepository.root(id)?.title,
        emit: () => undefined
      })
      // Dessinée par l'app elle-même (le pont la refuserait : projet local).
      structure.draw(
        StructureDessinerInput.parse({
          elements: [
            { cle: 'module:facturation', type: 'module', titre: `Facturation ${MARK}`, chemins: ['src/marque.js'] }
          ]
        }),
        { neuronId: genesisId }
      )
      const element = elementRepository.list(genesisId)[0]?.id ?? ''
      const finals = new FinalService({ repository: finalRepository, plan: planRepository })
      const plan = new PlanService({ repository: planRepository, finals })
      const proposal = plan.propose({
        parentId: genesisId,
        steps: [{ key: 'a', title: `Migrer ${MARK}`, why: `Parce que ${MARK}` }]
      })
      const step =
        plan.decide({
          proposalId: proposal.proposalId,
          accept: planRepository.proposal(proposal.proposalId)?.items.map((item) => item.id) ?? [],
          reject: []
        }).born[0] ?? ''
      conversationRepository.setSheet(
        genesisId,
        JSON.stringify({
          resume: `Résumé ${MARK}`,
          points_cles: [],
          decisions: [],
          questions_ouvertes: [],
          manques: []
        })
      )
      const documents = new DocumentService({
        repository: documentRepository,
        files: new DocumentFiles({ profileDir: profile }),
        nodes: planRepository,
        projectDir: (id) =>
          repriseRepository.project(id) === undefined ? (conversationRepository.neuron(id)?.projectDir ?? null) : null
      })
      const document = documents.create({
        neuronId: genesisId,
        title: `Notes ${MARK}`,
        content: `Contenu ${MARK}`,
        author: 'user'
      }).document.id
      local = { genesis: genesisId, element, step, document }
      open = { genesis: t.neurons.insert({ text: 'Mon idée ouverte' }) }

      // ── Ambiguïtés (US6) et guide (US4) : passerelle IA réelle, moteurs simulés ─────────────────────────────────
      const explorer = new ExplorerService({ reprise: repriseRepository, graph: codeGraph })
      resolution = new ResolutionService({
        reprise: repriseRepository,
        graph: codeGraph,
        claudeAllowed: (id) => confidentiality.claudeAllowed(id),
        runResolution: (items, options) => runRepriseResolution(t.h.gateway, items, options),
        readText: readProjectText,
        emit: () => undefined
      })
      guide = new GuideService({
        reprise: repriseRepository,
        graph: codeGraph,
        documents,
        documentAlive: (id) => documentRepository.get(id)?.deletedAt === null,
        claudeAllowed: (id) => confidentiality.claudeAllowed(id),
        runGuide: (input, options) => runRepriseGuide(t.h.gateway, input, options),
        readText: readProjectText,
        emit: () => undefined,
        onWritten: () => undefined
      })

      // ── Widget branché sur le projet (spec 005, 026) ───────────────────────────────────────────────────────────
      const widgetRepository = new WidgetRepository(db)
      const hatched = new HatchedRepository(db)
      widgetIo = new WidgetIoService({
        repository: new WidgetIoRepository(db),
        widgets: widgetRepository,
        blocks,
        tree: (id) => (neuronRepository.root(id) === undefined ? undefined : t.neurons.getTree(id)),
        document: (id) => hatched.result(id)
      })
      widgets = new WidgetService({
        repository: widgetRepository,
        gateway: t.h.gateway,
        emit: () => undefined,
        inputContext: (blockId) => widgetIo.inputContext(blockId),
        savedState: (blockId) => widgetIo.savedState(blockId),
        localOnly: (blockId) => widgetIo.sourceNeurons(blockId).some((id) => !confidentiality.claudeAllowed(id))
      })

      // ── Conversation (spec 008) : le lancement de `claude -p` est enregistré, jamais exécuté ────────────────────
      spawned = []
      conversations = new ConversationService({
        repository: conversationRepository,
        spawn: (options) => {
          spawned.push(options)
          return { write: () => undefined, kill: () => undefined }
        },
        claudePath: async () => 'claude.exe',
        settings: () => ({ cwd: profile, model: 'm', electronPath: 'e', relayPath: 'r', profileDir: profile }),
        frame: 'CADRE',
        emit: () => undefined,
        folderExists: () => true,
        claudeAllowed: (neuronId) => confidentiality.claudeAllowed(neuronId),
        repriseOf: (neuronId) => confidentiality.projectOf(neuronId)
      })

      // ── Pont MCP (spec 007) : même composition que bootstrap.ts ─────────────────────────────────────────────────
      selection = new SelectionStore()
      const canvas = new CanvasService({
        neurons: neuronRepository,
        blocks,
        io: widgetIo,
        mapLinks: mapLinkRepository,
        elements: elementRepository,
        plan: planRepository,
        documents: documentRepository,
        sheetSummaries: () => conversationRepository.sheetSummaries()
      })
      const mapService = new MapService({
        canvas: () => maskLocalProjects(canvas.get(), (id) => confidentiality.isLocalGenesis(id)),
        tree: (rootId) =>
          neuronRepository.root(rootId) === undefined || confidentiality.isLocalGenesis(rootId)
            ? undefined
            : t.neurons.getTree(rootId),
        blocks,
        mapLinks: mapLinkRepository,
        neurons: neuronRepository,
        selection,
        widgetFromCode: (blockId, code) => widgets.createFromCode(blockId, code),
        connectSource: (blockId, sourceKind, sourceId, parts) =>
          new WidgetIoRepository(db).insertInput({ blockId, sourceKind, sourceId, parts }).id,
        emit: () => undefined
      })
      const handle = confidentiality.guardTools(
        createToolHandler(
          mapService,
          new NeuronTools({
            conversations: conversationRepository,
            insertAssessment: (input) => conversationRepository.insertAssessment(input),
            onChanged: () => undefined,
            plan: planRepository,
            documents: documentRepository,
            finals
          }),
          structure,
          new PlanTools({ plan, conversations: conversationRepository, onProposed: () => undefined }),
          new DocumentTools({
            documents,
            repository: documentRepository,
            conversations: conversationRepository,
            onWritten: () => undefined
          }),
          new FinalTools({ finals, conversations: conversationRepository, onProposed: () => undefined }),
          undefined,
          undefined,
          new CodeGraphTools({
            genesisOf,
            project: (id) => repriseRepository.project(id),
            graph: codeGraph,
            fileCalls: (id) => explorer.fileCalls(id)
          })
        )
      )
      // Appel tel que le canal nommé le fait : entrée validée par le schéma, puis exécution ; une erreur du pont est
      // une réponse (texte d'erreur rendu à Claude), elle compte aussi.
      mcp = async (tool, args, neuronId) => {
        try {
          return await handle(tool, MCP_TOOLS[tool].input.parse(args), { neuronId })
        } catch (error) {
          if (error instanceof McpToolError) return error
          throw error
        }
      }
    })

    afterEach(() => {
      conversations.stopAll()
      t.dispose()
      rmSync(root, { recursive: true, force: true })
    })

    /** Aucun envoi au moteur Claude de la passerelle, aucune conversation lancée. */
    const nothingSentToClaude = (): void => {
      expect(t.h.claude.requests).toEqual([])
      expect(spawned).toEqual([])
    }
    const text = (result: ToolResult | McpToolError): string =>
      result instanceof McpToolError ? result.message : JSON.stringify(result)

    it('should_send_nothing_to_claude_through_the_analysis_ambiguities_and_guide', async () => {
      expect(readdirSync(dir)).toContain('.env')
      await resolution.resolve(local.genesis).catch(() => undefined)
      await guide.generate(local.genesis).catch(() => undefined)
      nothingSentToClaude()
      // Le travail est bien parti… vers le modèle local seulement, s'il est en marche.
      expect(t.h.ollama.requests.length > 0).toBe(ollama)
    })

    it('should_never_open_a_claude_conversation_on_the_genesis_its_element_or_its_step', async () => {
      for (const id of [local.genesis, local.element, local.step]) {
        await expect(conversations.send(id, 'Explique-moi ce projet')).rejects.toMatchObject({ code: 'LOCAL_ONLY' })
      }
      nothingSentToClaude()
    })

    it('should_never_send_a_local_project_to_claude_through_a_widget_plugged_on_it', async () => {
      const blockId = blocks.insert({ kind: 'widget', x: 0, y: 0, width: 520, height: 440, text: null }).id
      widgetIo.connect({ blockId, sourceKind: 'idea', sourceId: local.genesis })
      for (const action of ['wireframe', 'parcours', 'adapter'] as const) {
        await widgets.build({ blockId, action }).catch(() => undefined)
      }
      await widgets.prompt({ blockId, text: 'Un tableau de bord' }).catch(() => undefined)
      nothingSentToClaude()
    })

    it('should_leak_nothing_through_any_bridge_tool_whoever_calls_and_whatever_local_id_is_given', async () => {
      selection.set([local.genesis, local.element, local.step])
      const ids = [local.genesis, local.element, local.step]
      const calls = argumentsFor(ids, local.document)
      // Tout outil public du pont est couvert : un outil ajouté sans cas ici fait échouer le test.
      expect(Object.keys(calls).sort()).toEqual([...MCP_PUBLIC_TOOL_NAMES].sort())
      const leaks: string[] = []
      const accepted: string[] = []
      const aimsAtLocal = (args: unknown): boolean =>
        [...ids, local.document].some((id) => JSON.stringify(args).includes(id))
      for (const caller of [null, open.genesis, ...ids]) {
        for (const [tool, variants] of Object.entries(calls) as [McpToolName, unknown[]][]) {
          for (const args of variants) {
            const result = await mcp(tool, args, caller)
            const call = `${tool} ${JSON.stringify(args)} appelé par ${caller ?? 'session externe'}`
            const answer = text(result)
            if (answer.includes(MARK) || answer.includes(dir)) leaks.push(call)
            // Claude ne touche pas non plus au projet : tout appel qui le vise, ou qui vient de lui, est refusé.
            if (
              !(result instanceof McpToolError) &&
              (caller !== null && caller !== open.genesis ? true : aimsAtLocal(args))
            )
              accepted.push(call)
          }
        }
      }
      expect(leaks).toEqual([])
      expect(accepted).toEqual([])
      nothingSentToClaude()
    })

    it('should_run_no_git_trap_of_the_project_when_its_repository_state_is_read', async () => {
      initRepo(dir)
      git(dir, ['add', 'package.json'])
      git(dir, ['commit', '-q', '-m', 'init'])
      // Piège neutralisable : un moniteur de fichiers qui laisserait un témoin à chaque `git status`.
      git(dir, ['config', 'core.fsmonitor', 'echo ran > FSMONITOR_RAN'])
      const access = new GitAccess({
        locator: new RepoLocator({
          projectDir: () => dir,
          isTrusted: () => false,
          runner: gitRunner,
          dataDir: join(root, 'profil')
        }),
        runner: gitRunner,
        repository: { openMergeHead: () => null }
      })
      await access.readStatus(await access.ready(local.genesis))
      expect(existsSync(join(dir, 'FSMONITOR_RAN'))).toBe(false)
      // Le piège est réel : git lancé sans le préfixe sûr de l'app l'aurait déclenché.
      const copy = join(root, 'temoin')
      cpSync(dir, copy, { recursive: true })
      git(copy, ['status', '--porcelain'])
      expect(existsSync(join(copy, 'FSMONITOR_RAN'))).toBe(true)

      // Piège non neutralisable : un filtre `clean` ; plus aucune commande git n'est lancée.
      git(dir, ['config', 'filter.piege.clean', 'echo ran > FILTER_RAN'])
      writeFileSync(join(dir, '.gitattributes'), '* filter=piege\n')
      await expect(access.ready(local.genesis)).rejects.toMatchObject({ code: 'RISKY_CONFIG' })
      expect(existsSync(join(dir, 'FILTER_RAN'))).toBe(false)
      expect(existsSync(join(dir, 'FSMONITOR_RAN'))).toBe(false)
    })

    it('should_run_nothing_from_the_trapped_project_along_the_way', async () => {
      await resolution.resolve(local.genesis).catch(() => undefined)
      await guide.generate(local.genesis).catch(() => undefined)
      await conversations.send(local.genesis, 'npm install').catch(() => undefined)
      for (const witness of ['INSTALL_RAN', 'BIN_RAN', 'HOOK_RAN']) expect(existsSync(join(dir, witness))).toBe(false)
      expect(spawned).toEqual([])
    })
  }
)

/**
 * Arguments de chaque outil public du pont, avec les identifiants du projet local à toutes les places où un outil
 * accepte un identifiant (cible, parent, ancre, source, extrémité de lien, élément, document, projet).
 */
function argumentsFor(ids: readonly string[], document: string): Record<McpToolName, unknown[]> {
  const each = <T>(build: (id: string) => T): T[] => ids.map(build)
  const calls: Partial<Record<McpToolName, unknown[]>> = {
    etat: [{}],
    carte_lire: [{}],
    selection_lire: [{}],
    noeud_lire: each((id) => ({ id, profondeur: 3 })),
    dessiner: [
      ...each((id) => ({ ancre: id, noeuds: [{ cle: 'n1', titre: 'Note' }] })),
      ...each((id) => ({ noeuds: [{ cle: 'n1', titre: 'Note', parent: id }] })),
      ...each((id) => ({ noeuds: [{ cle: 'n1', titre: 'Note' }], liens: [{ de: 'n1', vers: id }] }))
    ],
    noeud_modifier: each((id) => ({ id, titre: 'Renommé' })),
    relier: [...each((id) => ({ de: id, vers: ids[0] ?? id })), ...each((id) => ({ de: ids[0] ?? id, vers: id }))],
    retirer: [{ ids: [...ids] }],
    widget_poser: each((source) => ({
      titre: 'Vue',
      html: '<main></main>',
      css: '',
      ts: 'gi.onInputs(() => {})',
      resume: 'Vue du projet',
      source
    })),
    neurone_contexte: [{}, ...each((id) => ({ id }))],
    fiche_ecrire: each((id) => ({ id, resume: 'Fiche' })),
    maturite_evaluer: each((id) => ({ id, niveau: 'suffisant', manques: [] })),
    document_ecrire: [
      ...each((id) => ({ id, titre: 'Doc', contenu: 'Texte' })),
      { document, titre: 'Doc', contenu: 'Texte' }
    ],
    document_lire: [{ document }],
    plan_proposer: each((id) => ({ id, etapes: [{ cle: 'x', titre: 'Étape', pourquoi: 'Parce que' }] })),
    action_proposer: each((id) => ({ id, livrable: 'README.md', raison: 'Fini' })),
    permission_demander: [{ tool_name: 'Read', input: { file_path: 'src/marque.js' } }],
    structure_dessiner: each((projet) => ({
      projet,
      elements: [{ cle: 'module:x', type: 'module', titre: 'X' }]
    })),
    element_avancer: [{ statut: 'en_cours' }, ...each((element) => ({ element, statut: 'en_cours' }))],
    structure_lire: [{}, ...each((projet) => ({ projet }))],
    code_graphe_lire: [{}, ...each((projet) => ({ projet }))],
    skills_lire: [{}],
    skill_brouillon: each((projet) => ({
      skill: 'mon-skill',
      famille: 'projet',
      projet,
      description: 'Un skill',
      contenu: '# Skill'
    })),
    // Fiche d'un profil d'agent (L1o D15) : aucun identifiant de projet, et seulement dans « Créer avec Claude ».
    agent_profil_proposer: [{ nom: 'Agent' }],
    agent_skills_proposer: [{ ajouter: ['perso:x'], pourquoi: 'test' }]
  }
  return calls as Record<McpToolName, unknown[]>
}
