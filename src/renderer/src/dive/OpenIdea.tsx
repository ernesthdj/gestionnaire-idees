import './dive.css'
import { useQueryClient } from '@tanstack/react-query'
import { useReactFlow } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CategoryView, ConfirmView, GrowthResultView, SeedView, TreeView } from '@shared/ipc/neurons'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { ideaTreeLayout, type Point } from '../canvas/ideaTreeLayout'
import { useOpenTree, type OpenTreeActions } from '../canvas/treeStore'
import { useFusion } from '../fusion/useFusion'
import { timingFor } from '../motion/durations'
import { diveModel } from './diveModel'
import { IdeaPanel } from './IdeaPanel'
import { useDive, type DiveActions } from './useDive'

interface OpenIdeaProps {
  readonly rootId: string
  /** Centre de l'idée sur la carte : la vue s'y centre à l'ouverture (son arbre se déploie autour). */
  readonly center: Point
  /** Colonne de droite où le volet est affiché. */
  readonly panelHost: HTMLElement | null
  readonly categories: readonly CategoryView[]
  readonly bornFrom: SeedView['parents'] | undefined
  readonly reduced: boolean
}

/**
 * Idée ouverte sur la carte (spec 003 US3 révisée) : un clic sur une idée déploie son arbre autour d'elle et ouvre le
 * volet de droite, sans quitter la carte. Monté une fois par idée ouverte (clé = idée) : son état repart de zéro.
 * `Échap` remonte d'un niveau, puis referme le volet.
 */
export function OpenIdea(props: OpenIdeaProps): React.JSX.Element | null {
  const { rootId } = props
  const flow = useReactFlow()
  const dive = useDive(rootId)
  const fusion = useFusion(rootId)
  const focusId = useUiStore((state) => state.focusId)
  const focus = useUiStore((state) => state.focus)
  const closeIdea = useUiStore((state) => state.closeIdea)
  const openIdea = useUiStore((state) => state.openIdea)
  const hatch = useUiStore((state) => state.hatch)
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null)
  const [fusing, setFusing] = useState(false)
  const fusionTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(fusionTimer.current), [])

  // Pendant l'éclosion, l'arbre d'avant reste affiché : ses sous-neurones (déjà absorbés en base) se résorbent.
  const [frozen, setFrozen] = useState<TreeView | null>(null)
  const tree = frozen ?? dive.tree.data
  const model = useMemo(() => (tree === undefined ? null : diveModel(tree, focusId)), [tree, focusId])
  // Question affichée retenue explicitement : de nouvelles questions arrivées en arrière-plan ne la remplacent pas
  // (sinon la question — et le texte en cours — changeaient pendant la frappe). Seule sa disparition (répondue,
  // écartée) ou un choix de l'utilisateur la change.
  const extensionIds = model?.extensions.map((extension) => extension.id).join(',') ?? ''
  useEffect(() => {
    const ids = extensionIds === '' ? [] : extensionIds.split(',')
    if (selectedExtensionId !== null && ids.includes(selectedExtensionId)) return
    const next = ids[0] ?? null
    if (next !== selectedExtensionId) setSelectedExtensionId(next)
  }, [extensionIds, selectedExtensionId])

  const layout = useMemo(
    () => (tree === undefined ? null : ideaTreeLayout(tree, model?.focus.id ?? rootId, dive.pending)),
    [tree, model, rootId, dive.pending]
  )

  // À l'ouverture, la vue se centre sur l'idée (dans la partie de carte laissée libre par le volet).
  const { center } = props
  // Seulement à l'ouverture : ni pendant un glisser de l'idée, ni à chaque réponse.
  const opening = useRef(center)
  const { reduced } = props
  useEffect(() => {
    const { x: centerX, y: centerY } = opening.current
    // Deux images plus tard : le volet vient d'apparaître, la carte a pris sa nouvelle largeur.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void flow.setCenter(centerX, centerY, {
          zoom: Math.max(flow.getZoom(), 0.8),
          duration: timingFor('dive', reduced).duration
        })
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [flow, reduced])

  // Échap remonte d'un niveau puis referme le volet, où que soit le focus ; jamais depuis un champ.
  const upRef = useRef<() => void>(() => undefined)
  upRef.current = () => {
    if (fusing) return
    if (model === null || model.parent === null) closeIdea()
    else focus(model.parent.id === rootId ? null : model.parent.id)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [role="dialog"]') !== null
      )
        return
      event.preventDefault()
      upRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onFocus = (neuronId: string | null): void => {
    focus(neuronId === rootId ? null : neuronId)
    setSelectedExtensionId(null)
  }

  // Confirmation : les sous-neurones se résorbent vers l'idée, qui grandit sur place (FR-019).
  const onConfirming = (): void => setFrozen(dive.tree.data ?? null)
  const onConfirmed = (confirmed: ConfirmView | null): void => {
    if (confirmed === null) {
      setFrozen(null)
      return
    }
    focus(null)
    setFusing(true)
    fusionTimer.current = setTimeout(() => {
      setFusing(false)
      setFrozen(null)
      hatch(`« ${confirmed.root.title} » a éclos.`, confirmed.batchId)
    }, timingFor('fusion', props.reduced).duration)
  }

  // Idée suggérée éclose à part (FR-036) : elle devient une idée de la carte, qui s'ouvre aussitôt ; « Annuler » la
  // remet dans l'arbre d'origine.
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const promote = async (neuronId: string): Promise<boolean> => {
    const title = tree?.neurons.find((neuron) => neuron.id === neuronId)?.title ?? 'L’idée'
    try {
      const result = await call<{ readonly rootId: string; readonly batchId: string }>('growth:promoteIdea', {
        neuronId
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ['canvas'] }),
        client.invalidateQueries({ queryKey: ['dive'] }),
        client.invalidateQueries({ queryKey: ['history'] })
      ])
      showToast(`« ${title} » est devenue une idée à part entière.`, {
        batchId: result.batchId,
        undoneText: 'L’idée est revenue dans son arbre d’origine.'
      })
      openIdea(result.rootId)
      return true
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'L’idée n’a pas pu éclore à part.')
      return false
    }
  }

  // Vérification web à la demande (T069) : la suggestion passe « en cours », le résultat arrive par événement.
  const research = async (suggestionId: string): Promise<void> => {
    try {
      const result = await call<GrowthResultView>('growth:researchSuggestion', { suggestionId })
      client.setQueryData(['dive', rootId], result.tree)
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'La vérification web n’a pas pu démarrer.')
    }
  }

  // Supprimer le neurone ciblé ramène à son parent.
  const actions: DiveActions = {
    ...dive,
    deleteBranch: async (neuronId) => {
      const parentId = model?.parent?.id ?? null
      const ok = await dive.deleteBranch(neuronId)
      if (ok && neuronId === model?.focus.id) onFocus(parentId)
      return ok
    }
  }

  const panel =
    model === null ? (
      <p role="status" className="p-4 text-sm text-content-muted">
        {dive.tree.isError ? 'Cette idée n’a pas pu être ouverte.' : 'Ouverture de l’idée…'}
      </p>
    ) : (
      <IdeaPanel
        model={model}
        actions={actions}
        fusion={fusion}
        categories={props.categories}
        bornFrom={props.bornFrom}
        fusing={fusing}
        selectedExtensionId={selectedExtensionId}
        onSelectExtension={setSelectedExtensionId}
        onFocus={onFocus}
        onOpenIdea={openIdea}
        onConfirming={onConfirming}
        onConfirmed={onConfirmed}
        onClose={closeIdea}
        onPromote={promote}
      />
    )

  // L'arbre est publié pour la carte, qui en fait des objets physiques (glissables, qui se repoussent).
  const treeActions = useRef<OpenTreeActions | null>(null)
  treeActions.current = {
    focus: (neuronId) => onFocus(neuronId),
    selectExtension: (extensionId) => setSelectedExtensionId(extensionId),
    acceptSuggestion: (suggestionId) => void dive.acceptSuggestion(suggestionId),
    dismissSuggestion: (suggestionId) => void dive.dismissSuggestion(suggestionId),
    researchSuggestion: (suggestionId) => void research(suggestionId)
  }
  const stableActions = useMemo<OpenTreeActions>(
    () => ({
      focus: (id) => treeActions.current?.focus(id),
      selectExtension: (id) => treeActions.current?.selectExtension(id),
      acceptSuggestion: (id) => treeActions.current?.acceptSuggestion(id),
      dismissSuggestion: (id) => treeActions.current?.dismissSuggestion(id),
      researchSuggestion: (id) => treeActions.current?.researchSuggestion(id)
    }),
    []
  )
  const publish = useOpenTree((state) => state.publish)
  const focusedId = model?.focus.id ?? rootId
  const categoryColor = model?.root.category?.color ?? '#71717a'
  useEffect(() => {
    publish(
      layout === null
        ? null
        : {
            rootId,
            items: layout.items,
            focusId: focusedId,
            selectedExtensionId,
            fusing,
            categoryColor,
            actions: stableActions
          }
    )
  }, [publish, layout, rootId, focusedId, selectedExtensionId, fusing, categoryColor, stableActions])
  useEffect(() => () => publish(null), [publish])

  return props.panelHost === null ? null : createPortal(panel, props.panelHost)
}
