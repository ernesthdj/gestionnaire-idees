import { WidgetOut } from '@shared/ai/widgets'
import type { WidgetBuild, WidgetView } from '@shared/ipc/widgets'
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
  /** Contexte complet des nœuds branchés (spec 026 D1) ; `null` si rien de vivant n'est branché. */
  readonly inputContext?: (blockId: string) => { readonly titles: readonly string[]; readonly json: string } | null
  /** État enregistré par le widget (spec 026 D5), `null` s'il n'en a pas. */
  readonly savedState?: (blockId: string) => unknown
}

/** Trace laissée dans la conversation du widget par une construction prédéfinie (spec 026). */
const BUILD_LABELS: Readonly<Record<WidgetBuild, string>> = {
  wireframe: '🖼 Wireframe',
  parcours: '🔀 Parcours',
  adapter: '🛠 Adapter au nœud'
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

  /** Retouche libre demandée dans la chatbox du widget. */
  async prompt(input: { readonly blockId: string; readonly text: string }): Promise<WidgetView> {
    return this.generate({ blockId: input.blockId, message: input.text, request: input.text, keepCode: true })
  }

  /**
   * Construction prédéfinie (spec 026 D2, D6) : sa consigne est dans le cadre figé, la demande n'en porte que le nom.
   * Wireframe et Parcours repartent d'une page blanche ; Adapter part du code affiché.
   */
  async build(input: { readonly blockId: string; readonly action: WidgetBuild }): Promise<WidgetView> {
    const { repository } = this.deps
    if (repository.widget(input.blockId) === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    const context = this.deps.inputContext?.(input.blockId) ?? null
    if (context === null) {
      throw new AppError('INVALID_STATE', 'Branche d’abord une idée ou une étape sur ce widget')
    }
    const source = context.titles.map((title) => `« ${title} »`).join(', ')
    return this.generate({
      blockId: input.blockId,
      message: `${BUILD_LABELS[input.action]}${source === '' ? '' : ` à partir de ${source}`}`,
      request: '',
      build: input.action,
      keepCode: input.action === 'adapter'
    })
  }

  private async generate(input: {
    readonly blockId: string
    /** Trace gardée dans la conversation. */
    readonly message: string
    /** Texte de l'utilisateur, transmis comme donnée. */
    readonly request: string
    /** Construction prédéfinie : seul son nom est transmis, sa consigne est dans le cadre figé. */
    readonly build?: WidgetBuild
    /** Faire évoluer le code affiché plutôt que repartir d'une page blanche. */
    readonly keepCode: boolean
  }): Promise<WidgetView> {
    const { repository, gateway, emit } = this.deps
    const widget = repository.widget(input.blockId)
    if (widget === undefined) throw new AppError('NOT_FOUND', 'Widget introuvable')
    const displayed = widget.versionId === null ? undefined : repository.version(input.blockId, widget.versionId)
    const current = input.keepCode ? displayed : undefined
    const previous = repository
      .messages(input.blockId)
      .filter((message) => message.role === 'user')
      .slice(-RECENT_REQUESTS)
      .map((message) => `- ${message.text}`)
    repository.insertMessage({ blockId: input.blockId, role: 'user', text: input.message })

    const context = this.deps.inputContext?.(input.blockId) ?? null
    const state = this.deps.savedState?.(input.blockId) ?? null
    const request = [
      previous.length === 0 ? null : `Demandes précédentes :\n${previous.join('\n')}`,
      context === null
        ? null
        : `Contexte complet des nœuds branchés (c’est aussi ce que gi.onInputs remettra une fois la lecture autorisée) :\n${context.json}`,
      state === null
        ? null
        : `État actuel enregistré par le widget (réglages de l’utilisateur) :\n${JSON.stringify(state)}`,
      input.build !== undefined
        ? `Construction : ${input.build}`
        : `${current === undefined ? 'Widget à fabriquer' : 'Évolution demandée'} : ${input.request}`
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
