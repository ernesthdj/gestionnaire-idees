import { useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import type { ConfirmView, CategoryView, SeedView } from '@shared/ipc/neurons'
import { SynthesisPreview } from '../fusion/SynthesisPreview'
import type { FusionActions } from '../fusion/useFusion'
import { HatchedPanel } from '../hatched/HatchedPanel'
import { call } from '../lib/ipc'
import { Breadcrumb } from './Breadcrumb'
import type { DiveModel } from './diveModel'
import { QuestionPanel } from './QuestionPanel'
import type { DiveActions } from './useDive'

interface IdeaPanelProps {
  readonly model: DiveModel
  readonly actions: DiveActions
  readonly fusion: FusionActions
  readonly categories: readonly CategoryView[]
  /** Parents de l'idée si elle est née d'une graine (FR-028). */
  readonly bornFrom: SeedView['parents'] | undefined
  readonly fusing: boolean
  readonly selectedExtensionId: string | null
  readonly onSelectExtension: (extensionId: string) => void
  readonly onFocus: (neuronId: string | null) => void
  readonly onOpenIdea: (rootId: string) => void
  readonly onConfirming: () => void
  readonly onConfirmed: (confirmed: ConfirmView | null) => void
  readonly onClose: () => void
  /** Fait éclore l'idée suggérée ciblée en idée à part entière (FR-036). */
  readonly onPromote: (neuronId: string) => Promise<boolean>
}

/**
 * Volet de l'idée ouverte, à droite de la carte (FR-013/FR-014 révisées) : fil d'Ariane, nature et catégorie, puis
 * selon l'état — questions et jauge, aperçu de synthèse, ou lecture de l'idée éclose.
 */
export function IdeaPanel(props: IdeaPanelProps): React.JSX.Element {
  const { model } = props
  const client = useQueryClient()
  const ids = { title: useId(), nature: useId(), category: useId() }
  const rootId = model.root.id

  const updateRoot = async (patch: { nature?: string; categorySlug?: string }): Promise<void> => {
    await call('neuron:update', { id: rootId, ...patch }).catch(() => undefined)
    await Promise.all([
      client.invalidateQueries({ queryKey: ['dive', rootId] }),
      client.invalidateQueries({ queryKey: ['canvas'] })
    ])
  }

  const categories =
    props.categories.length > 0 ? props.categories : model.root.category === null ? [] : [model.root.category]
  return (
    <section aria-labelledby={ids.title} className="flex h-full flex-col">
      <h2 id={ids.title} className="sr-only">
        Idée ouverte : {model.root.title}
      </h2>
      <header className="space-y-2 border-b border-content-muted/20 px-4 py-2">
        <div className="flex items-start justify-between gap-2">
          <Breadcrumb
            steps={model.breadcrumb}
            onIdeas={props.onClose}
            onStep={(id) => props.onFocus(id === rootId ? null : id)}
          />
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Fermer le volet"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised"
          >
            ×
          </button>
        </div>
        {props.bornFrom === undefined ? null : (
          <p className="text-xs text-content-muted">
            <span aria-hidden="true">🌱 </span>Née de{' '}
            {props.bornFrom.map((parent, index) => (
              <span key={parent.id}>
                {index > 0 ? ' × ' : null}
                <button
                  type="button"
                  onClick={() => props.onOpenIdea(parent.id)}
                  className="underline decoration-dotted underline-offset-2 hover:text-content"
                >
                  {parent.title}
                </button>
              </span>
            ))}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={ids.nature} className="text-content-muted">
            Nature{model.root.natureSource === 'ai' ? ' ✦' : ''}
          </label>
          <select
            id={ids.nature}
            value={model.root.nature}
            onChange={(event) => void updateRoot({ nature: event.target.value })}
            className="h-8 rounded-md bg-surface-raised px-2"
          >
            <option value="action">Action</option>
            <option value="reflection">Réflexion</option>
          </select>
          <label htmlFor={ids.category} className="text-content-muted">
            Catégorie{model.root.categorySource === 'ai' ? ' ✦' : ''}
          </label>
          <select
            id={ids.category}
            value={model.root.category?.slug ?? ''}
            onChange={(event) => void updateRoot({ categorySlug: event.target.value })}
            className="h-8 rounded-md bg-surface-raised px-2"
          >
            {model.root.category === null ? <option value="">À classer</option> : null}
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {props.fusing ? (
          <p role="status" className="p-4 text-sm text-content-muted">
            L’idée éclôt…
          </p>
        ) : model.root.state === 'hatched' ? (
          <HatchedPanel rootId={rootId} onDeepened={() => void props.actions.develop()} />
        ) : props.fusion.synthesis !== null ? (
          <SynthesisPreview fusion={props.fusion} onConfirming={props.onConfirming} onConfirmed={props.onConfirmed} />
        ) : (
          <QuestionPanel
            model={model}
            actions={props.actions}
            fusion={props.fusion}
            selectedExtensionId={props.selectedExtensionId}
            onSelectExtension={props.onSelectExtension}
            onPromote={props.onPromote}
          />
        )}
      </div>
    </section>
  )
}
