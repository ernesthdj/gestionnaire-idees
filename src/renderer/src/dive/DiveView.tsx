import './dive.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { useEffectiveSettings } from '../app/useAppSettings'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { Breadcrumb } from './Breadcrumb'
import { DiveStage } from './DiveStage'
import { diveModel } from './diveModel'
import { QuestionPanel } from './QuestionPanel'
import { useDive, type DiveActions } from './useDive'

interface DiveViewProps {
  readonly rootId: string
  readonly onClose: () => void
}

/**
 * Plongée dans une idée (spec 003 US3) : scène radiale (62 %) et panneau de questions (38 %, nombre d'or).
 * Échap remonte d'un niveau, puis revient à la carte.
 */
export function DiveView({ rootId, onClose }: DiveViewProps): React.JSX.Element {
  const client = useQueryClient()
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const dive = useDive(rootId)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null)
  const ids = { nature: useId(), category: useId() }
  // Même clé que l'écran Idées : les catégories viennent du cache s'il est déjà chargé.
  const canvas = useQuery({ queryKey: ['canvas', {}], queryFn: () => call<IdeasCanvasView>('canvas:get', {}) })

  const upRef = useRef<() => void>(() => undefined)
  // Échap remonte, où que soit le focus (il se perd quand l'élément cliqué disparaît) ; jamais depuis un champ.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select') !== null) return
      event.preventDefault()
      upRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const model = useMemo(
    () => (dive.tree.data === undefined ? null : diveModel(dive.tree.data, focusId)),
    [dive.tree.data, focusId]
  )

  if (dive.tree.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p role="alert" className="text-sm">
          Cette idée n’a pas pu être ouverte.
        </p>
        <Button onClick={onClose}>Retour aux idées</Button>
      </div>
    )
  }
  if (model === null) {
    return (
      <p role="status" className="p-8 text-center text-sm text-content-muted">
        Ouverture de l’idée…
      </p>
    )
  }

  const goTo = (neuronId: string | null): void => {
    setFocusId(neuronId === model.root.id ? null : neuronId)
    setSelectedExtensionId(null)
  }
  const up = (): void => {
    if (model.parent === null) onClose()
    else goTo(model.parent.id)
  }
  upRef.current = up
  // Supprimer le neurone ciblé ramène à son parent.
  const actions: DiveActions = {
    ...dive,
    deleteBranch: async (neuronId) => {
      const parentId = model.parent?.id ?? null
      const ok = await dive.deleteBranch(neuronId)
      if (ok && neuronId === model.focus.id) goTo(parentId)
      return ok
    }
  }

  const updateRoot = async (patch: { nature?: string; categorySlug?: string }): Promise<void> => {
    await call('neuron:update', { id: model.root.id, ...patch }).catch(() => undefined)
    await Promise.all([
      client.invalidateQueries({ queryKey: ['dive', rootId] }),
      client.invalidateQueries({ queryKey: ['canvas'] })
    ])
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-content-muted/20 px-4 py-2">
        <Breadcrumb steps={model.breadcrumb} onIdeas={onClose} onStep={(id) => goTo(id)} />
        <div className="flex items-center gap-2 text-sm">
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
            {(canvas.data?.categories ?? (model.root.category === null ? [] : [model.root.category])).map(
              (category) => (
                <option key={category.id} value={category.slug}>
                  {category.label}
                </option>
              )
            )}
          </select>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <section aria-label={`Plongée dans ${model.focus.title}`} className="min-w-0 basis-[62%]">
          <DiveStage
            model={model}
            pending={dive.pending}
            reduced={reduced}
            categoryColor={model.root.category?.color ?? '#71717a'}
            selectedExtensionId={selectedExtensionId}
            onOpen={(id) => goTo(id)}
            onUp={up}
            onSelectExtension={setSelectedExtensionId}
            onAcceptSuggestion={(id) => void dive.acceptSuggestion(id)}
            onDismissSuggestion={(id) => void dive.dismissSuggestion(id)}
          />
        </section>
        <div className="min-w-0 basis-[38%] border-l border-content-muted/20">
          <QuestionPanel
            model={model}
            actions={actions}
            selectedExtensionId={selectedExtensionId}
            onSelectExtension={setSelectedExtensionId}
          />
        </div>
      </div>
    </div>
  )
}
