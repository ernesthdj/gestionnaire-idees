import { useQueryClient } from '@tanstack/react-query'
import type { NodeProps } from '@xyflow/react'
import { useId, useState } from 'react'
import { useUiStore, type StructureView } from '../../app/uiStore'
import { usePopover } from '../../app/usePopover'
import { call, IpcFailure } from '../../lib/ipc'
import type { StructureBarNodeType } from '../buildGraph'
import { useMapping } from '../mapping/mappingStore'
import { RunButton } from '../../run/RunButton'
import {
  BRAINSTORM_SUBJECT_MAX,
  brainstormSubject,
  newBrainstormPrompt,
  reportStepsPrompt,
  strayLabel
} from '../workflow/prompts'
import { workflowUpdatePrompt } from '../workflow/updatePrompt'
import { workflowTree } from '../workflow/workflowTree'
import { useSidePanel } from '../side/sidePanelStore'
import type { WorkflowView } from '@shared/ipc/workflow'

/**
 * Bascule « Workflow | Progression | Architecture » d'une carte de projet lié (spec 023 D3) : sur la barre de la carte
 * et en tête des panneaux Progression et Architecture montés par-dessus la carte (spec 032 D12, D14). Les deux lisent
 * la doc et l'analyse du code (proposée si elle manque) : aucune ne demande de carte de structure dessinée.
 */
export function StructureViewSwitch({
  genesisId,
  view,
  pill = false
}: {
  readonly genesisId: string
  readonly view: StructureView | null
  /** Dans la barre fine (spec 033 D10) : arrondie et plus basse, comme la pastille git. */
  readonly pill?: boolean
}): React.JSX.Element {
  const setStructureView = useUiStore((state) => state.setStructureView)
  const segment = (target: StructureView, label: string): React.JSX.Element => (
    <button
      type="button"
      aria-pressed={view === target}
      onClick={(event) => {
        event.stopPropagation()
        setStructureView(genesisId, target)
      }}
      className={`${pill ? 'h-6' : 'h-7'} px-3 text-xs font-medium ${
        view === target ? 'bg-accent text-surface' : 'text-content hover:bg-surface-raised'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div
      role="group"
      aria-label="Vue de la carte"
      className={`flex shrink-0 overflow-hidden border ${pill ? 'rounded-full border-content-muted/30' : 'rounded-md border-content-muted/40'}`}
    >
      {segment('workflow', 'Workflow')}
      {segment('progression', 'Progression')}
      {segment('architecture', 'Architecture')}
    </div>
  )
}

/**
 * Barre d'une carte de projet lié (spec 017 D20, spec 023 D3) : bascule des vues (l'architecture se lit et se corrige
 * en tête de l'explorateur, spec 032 D15) ; en Workflow, « Relire » relit
 * les fichiers du projet. Le travail se fait dans le Workflow (D26, D27) : ce qui a été posé ailleurs (étapes nées dans
 * la vue, tâches et décisions de la carte) est signalé, à reporter dans les fichiers ou à retirer (D23, D28).
 */
export function StructureBarNode({ data }: NodeProps<StructureBarNodeType>): React.JSX.Element {
  return <StructureBar {...data} inHeader={false} />
}

/** Données de la barre, calculées par la carte (`buildGraph`). */
export type StructureBarData = StructureBarNodeType['data']

/**
 * La barre, sur la carte (au-dessus d'un genesis) ou dans la barre fine (`inHeader`, spec 033 D10) : mêmes actions, en
 * pastilles arrondies sur une ligne ; ce qui est à reporter y tient dans une pastille ⚠ qui ouvre ses deux actions.
 */
export function StructureBar({
  genesisId,
  view,
  hasMap,
  strays,
  inHeader
}: StructureBarData & { readonly inHeader: boolean }): React.JSX.Element {
  const strayCount = strays.steps.length + strays.elements.length
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  // Sujet du nouveau brainstorm (D26) ; `null` : le champ est fermé.
  const [subject, setSubject] = useState<string | null>(null)
  const subjectId = useId()
  const mapping = useMapping((state) => state.phases[genesisId] === 'running')
  // Mise à jour du Workflow (spec 032 D17) en cours : jusqu'à la fin du tour de Claude.
  const [updating, setUpdating] = useState(false)

  /**
   * « Mettre à jour la carte » (spec 022, 2026-10-10) : l'app liste ce qui a changé depuis la dernière cartographie ;
   * Claude ne met à jour que les éléments concernés, dans la conversation du genesis (l'orbe montre l'avancement).
   */
  const update = async (): Promise<void> => {
    setBusy(true)
    try {
      const plan = await call<{ readonly prompt: string | null; readonly files: number }>('structure:updatePlan', {
        genesisId
      })
      if (plan.prompt === null) {
        showToast('Rien n’a changé depuis la dernière cartographie : la carte est à jour.')
        return
      }
      useMapping.getState().start(genesisId)
      await call('chat:send', { neuronId: genesisId, text: plan.prompt })
      showToast(`Mise à jour de la carte lancée : ${plan.files} fichier(s) changé(s).`)
    } catch (error) {
      useMapping.getState().finish(genesisId, false)
      showToast(error instanceof IpcFailure ? error.message : 'La mise à jour de la carte n’a pas pu démarrer.')
    } finally {
      setBusy(false)
    }
  }
  /**
   * « Mettre à jour » dans la vue Workflow (spec 032 D17) : Claude remet les fichiers du projet au format du Workflow ;
   * à la fin de son tour, l'app relit l'arbre et centre la carte sur « ▶ Bosser ici », en surbrillance.
   */
  const updateWorkflow = async (): Promise<void> => {
    setBusy(true)
    // Son propre suivi : pas celui de la cartographie, dont la fin ferait avancer le repère des changements de la carte.
    const stops: (() => void)[] = []
    const done = (): void => {
      stops.forEach((stop) => stop())
      setUpdating(false)
    }
    try {
      const view = await call<WorkflowView>('workflow:read', { genesisId })
      setUpdating(true)
      const mine = (payload: unknown): boolean => (payload as { neuronId?: string } | null)?.neuronId === genesisId
      stops.push(
        window.api.on('chat:turnEnd', (payload) => {
          if (!mine(payload)) return
          done()
          void showNext()
        }),
        window.api.on('chat:error', (payload) => {
          if (!mine(payload)) return
          done()
          showToast('La mise à jour du Workflow s’est arrêtée.')
        })
      )
      await call('chat:send', { neuronId: genesisId, text: workflowUpdatePrompt(view) })
      showToast('Mise à jour du Workflow lancée : Claude remet les fichiers du projet au format.')
    } catch (error) {
      done()
      showToast(error instanceof IpcFailure ? error.message : 'La mise à jour du Workflow n’a pas pu démarrer.')
    } finally {
      setBusy(false)
    }
  }
  /** Relit le Workflow et met en avant la prochaine tâche (« ▶ Bosser ici »). */
  const showNext = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: ['workflow', genesisId] })
    const view = await client.fetchQuery({
      queryKey: ['workflow', genesisId],
      queryFn: () => call<WorkflowView>('workflow:read', { genesisId })
    })
    const items = workflowTree({ view }, genesisId).items
    // Une tâche travaillable (contexte complet), sinon le brainstorm à compléter d'abord (D18).
    const next = items.find((item) => item.next === true) ?? items.find((item) => item.complete === true)
    if (next === undefined) {
      showToast('Workflow à jour : plus rien à faire.')
      return
    }
    useUiStore.getState().arriveInWorkflow(next.key)
    useSidePanel.getState().requestFocus(next.key)
    showToast(
      next.complete === true
        ? `Aucune tâche n’a tout son contexte : complète d’abord « ${next.title} ».`
        : `Prochaine tâche : ${next.title}`
    )
  }
  /** Nouveau brainstorm (D26) : la consigne attend dans le chat du genesis, envoyée par mentalyas. */
  const startBrainstorm = (): void => {
    const clean = brainstormSubject(subject ?? '')
    if (clean === null) return
    const ui = useUiStore.getState()
    ui.seedChatDraft(genesisId, newBrainstormPrompt(clean))
    ui.openChat(genesisId)
    setSubject(null)
  }
  /** Ce qui a été posé hors du Workflow (D23, D28) : la consigne pour le reporter attend dans le chat du genesis. */
  const report = (): void => {
    const ui = useUiStore.getState()
    ui.seedChatDraft(genesisId, reportStepsPrompt(genesisId, strays.steps, strays.elements))
    ui.openChat(genesisId)
  }
  // Retirés par lots annulables : les étapes (racines, leurs sous-étapes suivent), puis les éléments (descendants compris).
  const removeStrays = async (): Promise<void> => {
    const stepIds = new Set(strays.steps.map((step) => step.id))
    const elementIds = new Set(strays.elements.map((element) => element.id))
    setBusy(true)
    try {
      if (stepIds.size > 0) {
        const { batchId } = await call<{ readonly batchId: string }>('plan:removeSteps', {
          stepIds: strays.steps.filter((step) => !stepIds.has(step.parentId)).map((step) => step.id)
        })
        showToast(`${stepIds.size} étape(s) retirée(s) de la carte.`, {
          batchId,
          undoneText: 'Étapes remises sur la carte.'
        })
      }
      if (elementIds.size > 0) {
        const { batchId } = await call<{ readonly batchId: string }>('structure:removeElements', {
          genesisId,
          elementIds: strays.elements
            .filter((element) => !elementIds.has(element.parentId))
            .map((element) => element.id)
        })
        showToast(`${elementIds.size} tâche(s) ou décision(s) retirée(s) de la carte.`, {
          batchId,
          undoneText: 'Tâches et décisions remises sur la carte.'
        })
      }
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Ces nœuds n’ont pas pu être retirés.')
    } finally {
      setBusy(false)
    }
  }
  const strayPopover = usePopover<HTMLDivElement>()
  // Mêmes boutons, deux habits : pastille arrondie dans la barre fine, bouton de la carte sinon.
  const action = inHeader
    ? 'h-6 shrink-0 whitespace-nowrap rounded-full border border-content-muted/30 px-2.5 text-xs text-content hover:bg-surface-raised disabled:opacity-50'
    : 'h-7 shrink-0 whitespace-nowrap rounded-md border border-content-muted/40 px-2 text-xs text-content hover:bg-surface disabled:opacity-50'
  const strayActions = (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          report()
        }}
        className="rounded px-1 underline hover:bg-surface disabled:opacity-50"
      >
        Les reporter dans les fichiers
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation()
          void removeStrays()
        }}
        className="rounded px-1 underline hover:bg-surface disabled:opacity-50"
      >
        Les retirer
      </button>
    </>
  )
  const strayTitle =
    view === 'workflow'
      ? 'La vue Workflow ne montre que les fichiers du projet : ces étapes y sont masquées.'
      : 'Le travail se fait dans le Workflow : cette vue ne fait que refléter la doc et le code.'
  return (
    <div
      role="group"
      aria-label="Lecture de la carte de structure"
      className={
        inHeader
          ? 'flex min-w-0 items-center gap-1.5'
          : 'nodrag flex flex-col items-start gap-2 rounded-lg border border-content-muted/30 bg-surface-raised px-3 py-2 shadow-sm'
      }
    >
      {/* Le bandeau (D23, D28) passe sous la ligne : la barre ne s'élargit pas vers la gauche de la carte. */}
      <div className={`flex items-center ${inHeader ? 'gap-1.5' : 'gap-3'}`}>
        <StructureViewSwitch genesisId={genesisId} view={view} pill={inHeader} />
        {view === 'workflow' ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void client.invalidateQueries({ queryKey: ['workflow', genesisId] })
            }}
            title="Relire les specs et les tâches du projet"
            className={action}
          >
            Relire
          </button>
        ) : null}
        {view !== 'workflow' ? null : subject === null ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setSubject('')
            }}
            title="Le brainstorm de départ se fait ici : il aboutit à un document et à ses tâches, que cette vue montre"
            className={action}
          >
            ✦ Nouveau brainstorm
          </button>
        ) : (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault()
              startBrainstorm()
            }}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Escape') setSubject(null)
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <label htmlFor={subjectId} className="sr-only">
              Sujet du brainstorm
            </label>
            <input
              id={subjectId}
              autoFocus
              value={subject}
              maxLength={BRAINSTORM_SUBJECT_MAX}
              placeholder="Sujet du brainstorm…"
              onChange={(event) => setSubject(event.target.value)}
              className="h-7 w-56 rounded-md border border-content-muted/40 bg-surface px-2 text-xs text-content"
            />
            <button
              type="submit"
              disabled={brainstormSubject(subject) === null}
              className="h-7 rounded-md bg-accent px-2 text-xs font-medium text-surface disabled:opacity-50"
            >
              Lancer
            </button>
            <button
              type="button"
              onClick={() => setSubject(null)}
              className="h-7 rounded-md px-2 text-xs text-content-muted hover:bg-surface"
            >
              Annuler
            </button>
          </form>
        )}
        <RunButton genesisId={genesisId} pill={inHeader} />
        {view === 'workflow' ? (
          <button
            type="button"
            disabled={busy || updating}
            onClick={(event) => {
              event.stopPropagation()
              void updateWorkflow()
            }}
            aria-label={updating ? 'Mise à jour du Workflow en cours' : 'Mettre à jour le Workflow'}
            title="Remettre les fichiers du projet au format du Workflow (en-têtes, tâches, état réel des cases) et montrer la prochaine tâche"
            className={action}
          >
            {updating ? 'Mise à jour…' : '↻ Mettre à jour'}
          </button>
        ) : !hasMap ? null : (
          <button
            type="button"
            disabled={busy || mapping}
            onClick={(event) => {
              event.stopPropagation()
              void update()
            }}
            aria-label={mapping ? 'Mise à jour de la carte en cours' : 'Mettre à jour la carte'}
            title="Mettre à jour la carte avec les derniers changements du projet (Claude ne touche qu’aux éléments concernés)"
            className={action}
          >
            {mapping ? 'Mise à jour…' : '↻ Mettre à jour'}
          </button>
        )}
      </div>
      {view === null || strayCount === 0 ? null : inHeader ? (
        <div ref={strayPopover.ref} className="relative">
          <button
            type="button"
            aria-expanded={strayPopover.open}
            onClick={strayPopover.toggle}
            title={strayTitle}
            className="flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-idea/50 px-2.5 text-xs text-content hover:bg-surface-raised"
          >
            <span aria-hidden="true" className="text-idea">
              ⚠
            </span>
            {strayCount} à reporter
          </button>
          {strayPopover.open ? (
            <div
              role="status"
              className="absolute left-0 top-full z-40 mt-1 flex w-80 flex-col items-start gap-1 rounded-xl bg-surface p-3 text-xs shadow-lg"
            >
              <span>{strayLabel(view, strays.steps.length, strays.elements.length)}</span>
              <span className="flex gap-2">{strayActions}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <span
          role="status"
          className="flex items-center gap-2 rounded-md border border-idea/50 px-2 py-1 text-xs text-content"
          title={strayTitle}
        >
          {strayLabel(view, strays.steps.length, strays.elements.length)}
          {strayActions}
        </span>
      )}
    </div>
  )
}
