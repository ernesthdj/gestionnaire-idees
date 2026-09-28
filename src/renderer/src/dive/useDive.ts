import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MainWindowChannel } from '@shared/ipc/channels'
import type { GrowthResultView, TreeView } from '@shared/ipc/neurons'
import { call, IpcFailure } from '../lib/ipc'

export type Answer = { readonly choice: string } | { readonly text: string } | { readonly unknown: true }

export interface PendingChild {
  readonly extensionId: string
  readonly title: string
}

function rootIdOf(payload: unknown): string | null {
  return typeof payload === 'object' && payload !== null && 'rootId' in payload && typeof payload.rootId === 'string'
    ? payload.rootId
    : null
}

/** Messages clairs pour les échecs attendus (l'IA ne répond pas, budget, profondeur…). */
function explain(error: unknown): string {
  if (!(error instanceof IpcFailure)) return 'Une erreur inattendue est survenue.'
  switch (error.code) {
    case 'AI_UNAVAILABLE':
    case 'AI_TIMEOUT':
      return 'L’IA ne répond pas pour l’instant. Tes réponses sont gardées ; tu peux ajouter tes propres branches.'
    case 'BUDGET_EXCEEDED':
      return 'Le budget IA du mois est atteint (Réglages › IA). Tu peux continuer avec tes propres branches.'
    default:
      return error.message
  }
}

export interface DiveActions {
  readonly tree: UseQueryResult<TreeView>
  /** L'IA prépare les questions suivantes (ou une action est en cours). */
  readonly thinking: boolean
  /** Sous-neurone affiché avant la confirmation du moteur. */
  readonly pending: readonly PendingChild[]
  readonly message: { readonly tone: 'info' | 'error'; readonly text: string } | null
  dismissMessage(): void
  answer(extensionId: string, dimension: string, answer: Answer): Promise<boolean>
  more(neuronId: string): Promise<boolean>
  dismiss(extensionId: string): Promise<boolean>
  addBranch(parentId: string, title: string): Promise<boolean>
  editBranch(neuronId: string, title: string): Promise<boolean>
  deleteBranch(neuronId: string): Promise<boolean>
  acceptSuggestion(suggestionId: string): Promise<boolean>
  dismissSuggestion(suggestionId: string): Promise<boolean>
}

/**
 * Données et actions de la plongée (spec 003 US3) : arbre du moteur (002), indicateur « l'IA réfléchit » piloté par
 * les événements, sous-neurone affiché tout de suite (optimiste) puis confirmé par l'événement `neuron:created`.
 */
export function useDive(rootId: string): DiveActions {
  const client = useQueryClient()
  const tree = useQuery({ queryKey: ['dive', rootId], queryFn: () => call<TreeView>('neuron:getTree', { rootId }) })
  const [thinking, setThinking] = useState(false)
  const [pending, setPending] = useState<readonly PendingChild[]>([])
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const developed = useRef(false)

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['dive', rootId] }),
      client.invalidateQueries({ queryKey: ['canvas'] })
    ])
  }, [client, rootId])

  useEffect(() => {
    const mine = (payload: unknown): boolean => rootIdOf(payload) === rootId
    const offs = [
      window.api.on('neuron:thinking', (payload) => {
        if (mine(payload)) setThinking(true)
      }),
      window.api.on('neuron:thought', (payload) => {
        if (mine(payload)) setThinking(false)
      }),
      window.api.on('neuron:created', (payload) => {
        if (!mine(payload)) return
        void refresh().then(() => setPending([]))
      })
    ]
    return () => offs.forEach((off) => off())
  }, [rootId, refresh])

  /** Exécute une action `growth:*` ; l'arbre renvoyé remplace le cache, l'avertissement éventuel est affiché. */
  const run = useCallback(
    async (channel: MainWindowChannel, payload: unknown): Promise<boolean> => {
      setBusy(true)
      setMessage(null)
      try {
        const result = await call<GrowthResultView>(channel, payload)
        client.setQueryData(['dive', rootId], result.tree)
        if (result.notice !== undefined) setMessage({ tone: 'info', text: result.notice.message })
        void client.invalidateQueries({ queryKey: ['canvas'] })
        return true
      } catch (error) {
        setMessage({ tone: 'error', text: explain(error) })
        await refresh()
        return false
      } finally {
        setBusy(false)
        setThinking(false)
        setPending([])
      }
    },
    [client, rootId, refresh]
  )

  // Idée brute à l'ouverture : le développement se lance (US3 scénario 1).
  const state = tree.data?.root.state
  useEffect(() => {
    if (state !== 'raw' || developed.current) return
    developed.current = true
    void run('growth:develop', { rootId })
  }, [state, rootId, run])

  return {
    tree,
    thinking: thinking || busy,
    pending,
    message,
    dismissMessage: () => setMessage(null),
    answer: (extensionId: string, dimension: string, answer: Answer) => {
      const value = 'unknown' in answer ? null : 'choice' in answer ? answer.choice : answer.text
      setPending([{ extensionId, title: value === null ? `À trouver : ${dimension}` : `${dimension} : ${value}` }])
      return run('growth:answer', { extensionId, answer })
    },
    more: (neuronId: string) => run('growth:more', { neuronId }),
    dismiss: (extensionId: string) => run('growth:dismiss', { extensionId }),
    addBranch: (parentId: string, title: string) => run('growth:addBranch', { parentId, title }),
    editBranch: (neuronId: string, title: string) => run('growth:editBranch', { neuronId, title }),
    deleteBranch: (neuronId: string) => run('neuron:delete', { neuronId, confirm: true }),
    acceptSuggestion: (suggestionId: string) => run('growth:acceptSuggestion', { suggestionId }),
    dismissSuggestion: (suggestionId: string) => run('growth:dismissSuggestion', { suggestionId })
  }
}
