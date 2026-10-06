import { randomUUID } from 'node:crypto'
import type { GaugeLevel } from '@shared/ipc/neurons'
import type { ToolResult } from '@shared/mcp/protocol'
import type { FicheEcrireInput, MaturiteEvaluerInput } from '@shared/mcp/tools'
import { McpToolError } from '../../domain/mcp/errors'
import { mergeSheet, readSheet, sheetMarkdown, SHEET_MAX_CHARS } from '../../domain/conversation/sheet'
import type {
  ConversationNeuron,
  ConversationRepository
} from '../../infrastructure/db/repositories/ConversationRepository'
import type { McpCaller } from '../../domain/mcp/caller'
import { conversationTarget } from './target'
import { fileLabel } from './DocumentTools'
import type { DocumentRepository } from '../../infrastructure/db/repositories/DocumentRepository'
import type { PlanRepository, StepStatus } from '../../infrastructure/db/repositories/PlanRepository'
import type { FinalService } from '../finals/FinalService'
import type { FinalState } from '../../domain/finals/state'

export interface NeuronToolsDeps {
  readonly conversations: Pick<ConversationRepository, 'neuron' | 'setSheet' | 'maturity' | 'log' | 'transaction'>
  readonly insertAssessment: (input: {
    rootId: string
    level: GaugeLevel
    aiLevel: GaugeLevel
    covered: readonly string[]
    missing: readonly string[]
    answered: number
  }) => void
  /** Fiche ou maturité changée : la carte et le panneau de chat se rafraîchissent (sans notification). */
  readonly onChanged: (neuronId: string) => void
  /** Étapes d'un nœud (spec 011) : son plan d'attaque, montré par `neurone_contexte`. */
  readonly plan?: Pick<PlanRepository, 'children'>
  /** Documents du nœud (spec 012), listés par `neurone_contexte`. */
  readonly documents?: Pick<DocumentRepository, 'ofNeuron'>
  /** Action finale de l'étape (spec 013), montrée par `neurone_contexte`. */
  readonly finals?: Pick<FinalService, 'actionOf'>
}

const FINAL_STATE_NAMES: Readonly<Record<FinalState, string>> = {
  proposee: 'proposée, en attente de mentalyas',
  prete: 'prête à exécuter',
  en_cours: 'en cours d’exécution',
  a_revoir: 'exécutée, livrable à revoir par mentalyas'
}

const STATUS_NAMES: Readonly<Record<StepStatus, string>> = {
  a_faire: 'à faire',
  en_cours: 'en cours',
  fait: 'fait',
  bloque: 'bloqué'
}

const LEVELS: Readonly<Record<MaturiteEvaluerInput['niveau'], GaugeLevel>> = {
  insuffisant: 'insufficient',
  suffisant: 'sufficient',
  complet: 'complete'
}
const LEVEL_NAMES: Readonly<Record<string, string>> = {
  insufficient: 'insuffisant',
  sufficient: 'suffisant',
  complete: 'complet'
}

/**
 * Outils du neurone d'une conversation (spec 008 FR-004, FR-007, FR-008, FR-014) : relire son contexte, écrire sa
 * fiche (une opération d'Historique « par Claude »), évaluer sa maturité. Une conversation n'écrit que dans son arbre.
 */
export class NeuronTools {
  constructor(private readonly deps: NeuronToolsDeps) {}

  context(id: string | undefined, caller: McpCaller): ToolResult {
    const neuron = this.target(id, caller)
    const maturity = this.deps.conversations.maturity(neuron.id)
    const kind =
      neuron.kind === 'root'
        ? 'genesis, couche 1'
        : neuron.kind === 'step'
          ? `étape de rang ${neuron.rank ?? '?'}`
          : 'sous-neurone'
    const children = this.deps.plan?.children(neuron.id) ?? []
    const docs = this.deps.documents?.ofNeuron(neuron.id) ?? []
    const action = this.deps.finals?.actionOf(neuron.id)
    const rankOf = new Map(children.map((child) => [child.id, child.rank] as const))
    const plan =
      children.length === 0
        ? null
        : `Plan d’attaque (étapes filles, dans l’ordre) :\n${children
            .map((child) => {
              const waits = child.waitsFor.map((id) => rankOf.get(id) ?? id).join(', ')
              return `- ${child.rank}. ${child.title} [${child.id}] — ${STATUS_NAMES[child.status]}${waits === '' ? '' : ` — attend ${waits}`}`
            })
            .join('\n')}`
    const text = [
      `Neurone ${neuron.id} — « ${neuron.title} » (${kind})`,
      neuron.content === null ? null : `Description : ${neuron.content}`,
      `Maturité : ${maturity === null ? 'non évaluée' : (LEVEL_NAMES[maturity] ?? maturity)}`,
      neuron.lockedAt === null ? null : 'Verrouillé : sa fiche, son titre et sa description ne s’écrivent plus.',
      action === undefined
        ? null
        : `Action finale (${FINAL_STATE_NAMES[action.state]}) — livrable annoncé : ${action.deliverable}`,
      `Fiche :\n${sheetMarkdown(readSheet(neuron.sheetJson))}`,
      plan,
      docs.length === 0
        ? null
        : `Documents :\n${docs.map((doc) => `- « ${doc.title} » [${doc.id}] (${fileLabel(doc)})`).join('\n')}`
    ]
      .filter((line) => line !== null)
      .join('\n\n')
    return { text }
  }

  writeSheet(input: FicheEcrireInput, caller: McpCaller): ToolResult {
    const neuron = this.target(input.id, caller, true)
    const before = neuron.sheetJson
    const next = mergeSheet(readSheet(before), {
      resume: input.resume,
      points_cles: input.points_cles,
      decisions: input.decisions,
      questions_ouvertes: input.questions_ouvertes,
      manques: input.manques
    })
    if (next === null) {
      throw new McpToolError('LOT_INVALIDE', `Fiche trop longue : ${SHEET_MAX_CHARS} caractères au plus, condense-la.`)
    }
    const after = JSON.stringify(next)
    const batchId = randomUUID()
    const { conversations } = this.deps
    conversations.transaction(() => {
      conversations.setSheet(neuron.id, after)
      conversations.log(
        batchId,
        [
          {
            kind: 'mcp_write',
            entity: 'neuron_sheet',
            entityId: neuron.id,
            before: { sheet: before },
            after: { sheet: after }
          }
        ],
        'claude'
      )
    })
    this.deps.onChanged(neuron.id)
    return { text: `Fiche de « ${neuron.title} » mise à jour (annulable par mentalyas).`, data: { lot: batchId } }
  }

  evaluate(input: MaturiteEvaluerInput, caller: McpCaller): ToolResult {
    const neuron = this.target(input.id, caller, true)
    const level = LEVELS[input.niveau]
    this.deps.insertAssessment({
      rootId: neuron.id,
      level,
      aiLevel: level,
      covered: [],
      missing: input.manques,
      answered: 0
    })
    this.deps.onChanged(neuron.id)
    return { text: `Maturité de « ${neuron.title} » : ${input.niveau}.` }
  }

  /** Neurone visé : `id` fourni, sinon celui de la conversation ; toujours dans l'arbre de la conversation. */
  private target(id: string | undefined, caller: McpCaller, writing = false): ConversationNeuron {
    return conversationTarget(this.deps.conversations, id, caller, writing)
  }
}
