import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ConfirmView, SynthesisPatch, SynthesisView } from '@shared/ipc/neurons'
import { call, IpcFailure } from '../lib/ipc'

export type FusionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'insufficient'; readonly missing: readonly string[] }
  | { readonly kind: 'working'; readonly label: string }

export interface FusionActions {
  /** Aperçu en attente de décision (`null` : aucun). */
  readonly synthesis: SynthesisView | null
  /** L'idée a changé depuis l'aperçu : il n'est plus confirmable. */
  readonly stale: boolean
  readonly state: FusionState
  readonly error: string | null
  lock(force?: boolean): Promise<void>
  cancelWarning(): void
  edit(patch: SynthesisPatch): Promise<boolean>
  revise(instruction: string): Promise<void>
  reject(): Promise<void>
  /** Confirme : renvoie l'idée éclose, ou `null` si la confirmation a échoué (rien n'a été appliqué). */
  confirm(): Promise<ConfirmView | null>
}

function missingOf(error: IpcFailure): readonly string[] {
  const missing = error.details?.['missing']
  return Array.isArray(missing) ? missing.filter((entry): entry is string => typeof entry === 'string') : []
}

function explain(error: unknown): string {
  if (!(error instanceof IpcFailure)) return 'Une erreur inattendue est survenue.'
  switch (error.code) {
    case 'STALE':
      return 'L’idée a changé depuis cet aperçu : régénère-le.'
    case 'AI_UNAVAILABLE':
    case 'AI_TIMEOUT':
      return 'L’IA ne répond pas pour l’instant : réessaie un peu plus tard.'
    case 'BUDGET_EXCEEDED':
      return 'Le budget IA du mois est atteint (Réglages › IA).'
    case 'APPLY_FAILED':
      return 'L’éclosion n’a pas pu être enregistrée : rien n’a été modifié.'
    default:
      return error.message
  }
}

/**
 * Verrouillage, aperçu et confirmation (spec 003 US4) : rien n'est appliqué avant « Confirmer ».
 * Un aperçu laissé ouvert est retrouvé au retour dans la plongée (`fusion:getProposed`, sans appel à l'IA).
 */
export function useFusion(rootId: string): FusionActions {
  const client = useQueryClient()
  const key = ['synthesis', rootId]
  const proposed = useQuery({
    queryKey: key,
    queryFn: () => call<SynthesisView | null>('fusion:getProposed', { rootId })
  })
  const [state, setState] = useState<FusionState>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [staleId, setStaleId] = useState<string | null>(null)
  const synthesis = proposed.data ?? null

  useEffect(
    () =>
      window.api.on('synthesis:stale', (payload) => {
        if (typeof payload !== 'object' || payload === null || !('synthesisId' in payload)) return
        if (typeof payload.synthesisId === 'string') setStaleId(payload.synthesisId)
      }),
    []
  )

  const set = (next: SynthesisView | null): void => {
    client.setQueryData(key, next)
    setStaleId(null)
  }

  const work = async <T>(label: string, action: () => Promise<T>): Promise<T | null> => {
    setState({ kind: 'working', label })
    setError(null)
    try {
      return await action()
    } catch (failure) {
      if (failure instanceof IpcFailure && failure.code === 'CONTEXT_INSUFFICIENT') {
        setState({ kind: 'insufficient', missing: missingOf(failure) })
        return null
      }
      if (failure instanceof IpcFailure && failure.code === 'STALE' && synthesis !== null) setStaleId(synthesis.id)
      setError(explain(failure))
      return null
    } finally {
      setState((current) => (current.kind === 'working' ? { kind: 'idle' } : current))
    }
  }

  return {
    synthesis,
    stale: synthesis !== null && staleId === synthesis.id,
    state,
    error,
    lock: async (force = false) => {
      const view = await work('Synthèse en cours…', () =>
        call<SynthesisView>('fusion:lock', force ? { rootId, force: true } : { rootId })
      )
      if (view !== null) set(view)
    },
    cancelWarning: () => setState({ kind: 'idle' }),
    edit: async (patch) => {
      if (synthesis === null) return false
      const view = await work('Enregistrement…', () =>
        call<SynthesisView>('fusion:editProposed', { synthesisId: synthesis.id, patch })
      )
      if (view !== null) set(view)
      return view !== null
    },
    revise: async (instruction) => {
      if (synthesis === null) return
      const view = await work('Révision en cours…', () =>
        call<SynthesisView>('fusion:revise', { synthesisId: synthesis.id, instruction })
      )
      if (view !== null) set(view)
    },
    reject: async () => {
      if (synthesis === null) return
      const done = await work('Refus…', () => call('fusion:reject', { synthesisId: synthesis.id }))
      if (done !== null) set(null)
    },
    confirm: async () => {
      if (synthesis === null) return null
      const confirmed = await work('Éclosion…', () =>
        call<ConfirmView>('fusion:confirm', { synthesisId: synthesis.id })
      )
      if (confirmed !== null) {
        set(null)
        await Promise.all([
          client.invalidateQueries({ queryKey: ['canvas'] }),
          client.invalidateQueries({ queryKey: ['dive', rootId] })
        ])
      }
      return confirmed
    }
  }
}
