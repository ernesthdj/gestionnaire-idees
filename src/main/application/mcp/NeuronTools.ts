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
    const maturity = this.deps.conversations.maturity(neuron.rootId)
    const text = [
      `Neurone ${neuron.id} — « ${neuron.title} » (${neuron.kind === 'root' ? 'genesis, couche 1' : 'sous-neurone'})`,
      neuron.content === null ? null : `Description : ${neuron.content}`,
      `Maturité : ${maturity === null ? 'non évaluée' : (LEVEL_NAMES[maturity] ?? maturity)}`,
      `Fiche :\n${sheetMarkdown(readSheet(neuron.sheetJson))}`
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
      rootId: neuron.rootId,
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
    const targetId = id ?? caller.neuronId
    if (targetId === null) {
      throw new McpToolError('ENTREE_INVALIDE', 'id requis : cette session n’est pas la conversation d’un neurone.')
    }
    const neuron = this.deps.conversations.neuron(targetId)
    if (neuron === undefined || neuron.state === 'archived') {
      throw new McpToolError('INTROUVABLE', `Neurone ${targetId} introuvable (retiré ou annulé ?)`)
    }
    if (caller.neuronId !== null && id !== undefined) {
      const own = this.deps.conversations.neuron(caller.neuronId)
      // Un projet = un genesis et ses éléments de structure (spec 009) ; une idée = sa racine et son arbre.
      const treeOf = (row: ConversationNeuron): string => row.genesisId ?? row.rootId
      if (own === undefined || treeOf(own) !== treeOf(neuron)) {
        throw new McpToolError(
          'NON_MODIFIABLE',
          'Ce neurone appartient à un autre arbre que celui de cette conversation.'
        )
      }
    }
    if (writing && neuron.absorbed)
      throw new McpToolError('NON_MODIFIABLE', 'Ce neurone a été absorbé par une éclosion.')
    return neuron
  }
}
