import { WidgetOut } from '@shared/ai/widgets'
import type { WidgetRequestView, WidgetView } from '@shared/ipc/widgets'
import type { Engine } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import type { WidgetRepository, WidgetVersionRow } from '../../infrastructure/db/repositories/WidgetRepository'
import type { AIGateway } from '../ai/AIGateway'
import { transpileWidget } from './transpile'

export type WidgetEvent =
  | {
      readonly type: 'widget:thinking'
      readonly blockId: string
      /** Moteur qui génère, connu une fois l'appel parti. */
      readonly engine?: Engine
      readonly model?: string
    }
  | { readonly type: 'widget:thought'; readonly blockId: string }

export interface WidgetDependencies {
  readonly repository: WidgetRepository
  readonly gateway: Pick<AIGateway, 'run'>
  readonly emit: (event: WidgetEvent) => void
  /** Structure (sans valeur) des entrées branchées sur un widget ; `null` s'il n'en a pas (spec 005). */
  readonly inputShape?: (blockId: string) => string | null
  /** Demande d'un outil coché à l'éclosion, pas encore généré (spec 006). */
  readonly request?: (blockId: string) => WidgetRequestView | null
}

/** Demandes précédentes rappelées à Claude (le code actuel porte le reste) : borne le contexte envoyé. */
const RECENT_REQUESTS = 3

/** Code actuel renvoyé tel quel (sortie de Claude, non modifiable par l'utilisateur en v1 : voir `verbatim`). */
function currentCode(version: WidgetVersionRow): string {
  return [
    `Code actuel du widget « ${version.title} » (version ${version.number}), à faire évoluer selon la demande :`,
    '=== html ===',
    version.html,
    '=== css ===',
    version.css,
    '=== ts ===',
    version.ts
  ].join('\n')
}

/**
 * Widgets de la carte (spec 004 US3) : chaque demande à Claude crée une version complète (HTML, CSS, TypeScript
 * transpilé localement) ; un échec laisse la version affichée intacte et s'explique dans la conversation.
 */
export class WidgetService {
  constructor(private readonly deps: WidgetDependencies) {}

  get(blockId: string): WidgetView {
    const { repository } = this.deps
    const widget = repository.widget(blockId)
    if (widget === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    const versions = repository.versions(blockId)
    const numbers = new Map(versions.map((version) => [version.id, version.number]))
    const current = versions.find((version) => version.id === widget.versionId)
    const summary = (version: WidgetVersionRow): WidgetView['versions'][number] => ({
      id: version.id,
      number: version.number,
      title: version.title,
      summary: version.summary,
      model: version.model,
      createdAt: version.createdAt
    })
    return {
      blockId,
      request: this.deps.request?.(blockId) ?? null,
      current:
        current === undefined ? null : { ...summary(current), html: current.html, css: current.css, ts: current.ts },
      versions: versions.map(summary),
      messages: repository.messages(blockId).map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        versionNumber: message.versionId === null ? null : (numbers.get(message.versionId) ?? null),
        failed: message.failed
      }))
    }
  }

  async prompt(input: { readonly blockId: string; readonly text: string }): Promise<WidgetView> {
    const { repository, gateway, emit } = this.deps
    const widget = repository.widget(input.blockId)
    if (widget === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    const current = widget.versionId === null ? undefined : repository.version(input.blockId, widget.versionId)
    const previous = repository
      .messages(input.blockId)
      .filter((message) => message.role === 'user')
      .slice(-RECENT_REQUESTS)
      .map((message) => `- ${message.text}`)
    repository.insertMessage({ blockId: input.blockId, role: 'user', text: input.text })

    const shape = this.deps.inputShape?.(input.blockId) ?? null
    const request = [
      previous.length === 0 ? null : `Demandes précédentes :\n${previous.join('\n')}`,
      shape === null ? null : `Entrées branchées sur ce widget, lues par gi.inputs (structure seulement) :\n${shape}`,
      `${current === undefined ? 'Widget à fabriquer' : 'Évolution demandée'} : ${input.text}`
    ]
      .filter((part) => part !== null)
      .join('\n\n')

    emit({ type: 'widget:thinking', blockId: input.blockId })
    try {
      const result = await gateway.run({
        kind: 'widget',
        input: request,
        schema: WidgetOut,
        ...(current === undefined ? {} : { verbatim: currentCode(current) }),
        onEngine: (engine, model) => emit({ type: 'widget:thinking', blockId: input.blockId, engine, model })
      })
      if (!result.ok) return this.fail(input.blockId, result.error.message)
      const out = result.value.data
      const js = transpileWidget(out.ts)
      if (!js.ok) return this.fail(input.blockId, `${js.error}. La version précédente reste affichée : redemande.`)
      // Widget retiré pendant la génération (suppression, éclosion annulée) : la réponse est ignorée.
      if (repository.widget(input.blockId) === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
      repository.transaction(() => {
        const version = repository.insertVersion({
          blockId: input.blockId,
          title: out.title,
          html: out.html,
          css: out.css,
          ts: out.ts,
          js: js.value,
          summary: out.summary,
          model: result.value.model
        })
        repository.setCurrent(input.blockId, version.id)
        repository.insertMessage({
          blockId: input.blockId,
          role: 'assistant',
          text: out.summary,
          versionId: version.id
        })
      })
      return this.get(input.blockId)
    } finally {
      emit({ type: 'widget:thought', blockId: input.blockId })
    }
  }

  /**
   * Widget écrit par Claude Code et posé par le pont MCP (spec 007 FR-015) : mêmes validations et transpilation que
   * la génération (spec 004), sans appel IA. Aucune autorisation n'est créée : le widget arrive « À revoir ».
   * Lève `VALIDATION` si le code est refusé (l'appelant annule alors toute l'opération).
   */
  createFromCode(
    blockId: string,
    code: {
      readonly titre: string
      readonly html: string
      readonly css: string
      readonly ts: string
      readonly resume: string
    }
  ): void {
    const { repository } = this.deps
    if (repository.widget(blockId) === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    const out = WidgetOut.safeParse({
      title: code.titre.slice(0, 80),
      html: code.html,
      css: code.css,
      ts: code.ts,
      summary: code.resume
    })
    if (!out.success) throw new AppError('VALIDATION', 'Code de widget refusé : une partie dépasse la taille permise.')
    const js = transpileWidget(out.data.ts)
    if (!js.ok) throw new AppError('VALIDATION', `Code de widget refusé : ${js.error}`)
    repository.transaction(() => {
      const version = repository.insertVersion({
        blockId,
        ...out.data,
        js: js.value,
        model: 'claude-code'
      })
      repository.setCurrent(blockId, version.id)
      repository.insertMessage({ blockId, role: 'assistant', text: out.data.summary, versionId: version.id })
    })
  }

  /** Revenir à une version précédente : elle redevient affichée, rien n'est supprimé. */
  restore(input: { readonly blockId: string; readonly versionId: string }): WidgetView {
    const { repository } = this.deps
    if (repository.widget(input.blockId) === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    if (repository.version(input.blockId, input.versionId) === undefined) {
      throw new AppError('NOT_FOUND', 'Version introuvable')
    }
    repository.setCurrent(input.blockId, input.versionId)
    return this.get(input.blockId)
  }

  private fail(blockId: string, message: string): WidgetView {
    this.deps.repository.insertMessage({ blockId, role: 'assistant', text: message, failed: true })
    return this.get(blockId)
  }
}
