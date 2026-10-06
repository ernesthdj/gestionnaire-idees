import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { AnalysisProgressEvent, ExplorerFiltersView, ExplorerView, RepriseProjectView } from '@shared/ipc/reprise'
import { call } from '../lib/ipc'

export const DEFAULT_FILTERS: ExplorerFiltersView = {
  categories: ['domain', 'orchestration', 'infrastructure'],
  langs: [],
  hideUncertain: false
}

export interface ExplorerState {
  readonly project: RepriseProjectView | undefined
  readonly view: ExplorerView | undefined
  readonly loading: boolean
  readonly problem: string | null
  readonly parentKey: string
  readonly filters: ExplorerFiltersView
  readonly focusKey: string | null
  readonly selected: string | null
  readonly progress: { readonly done: number; readonly total: number } | null
}

export interface ExplorerActions {
  open(parentKey: string, select?: string | null): void
  setFilters(filters: ExplorerFiltersView): void
  isolate(key: string | null): void
  select(key: string | null): void
  analyze(): Promise<void>
  cancelAnalysis(): void
}

const forProject = (genesisId: string, payload: unknown): boolean =>
  typeof payload === 'object' && payload !== null && (payload as { genesisId?: unknown }).genesisId === genesisId

/**
 * État de l'explorateur d'un projet repris (spec 017 US2) : nœud ouvert, filtres et isolement retenus par projet,
 * vue agrégée du main, état de l'analyse. Les événements du main (analyse, correction) rafraîchissent la vue.
 */
export function useExplorer(genesisId: string): ExplorerState & ExplorerActions {
  const client = useQueryClient()
  const [parentKey, setParentKey] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<ExplorerFiltersView>(DEFAULT_FILTERS)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const project = useQuery({
    queryKey: ['reprise', genesisId],
    queryFn: () => call<RepriseProjectView>('reprise:get', { genesisId })
  })

  // État retenu (dernier nœud ouvert, filtres) : lu une fois à l'ouverture.
  useEffect(() => {
    let alive = true
    call<{ readonly parentKey: string; readonly filters: ExplorerFiltersView }>('explorer:state', { genesisId })
      .then((saved) => {
        if (!alive) return
        setParentKey(saved.parentKey)
        setFiltersState(saved.filters)
      })
      .catch(() => alive && setParentKey(''))
    return () => {
      alive = false
    }
  }, [genesisId])

  const view = useQuery({
    queryKey: ['explorer', genesisId, 'view', parentKey, filters, focusKey],
    enabled: parentKey !== null,
    queryFn: () =>
      call<ExplorerView>('explorer:view', {
        genesisId,
        parentKey: parentKey ?? '',
        filters,
        ...(focusKey === null ? {} : { focusKey, depth: 1 })
      })
  })

  useEffect(() => {
    const offs = [
      window.api.on('reprise:changed', (payload) => {
        if (!forProject(genesisId, payload)) return
        void client.invalidateQueries({ queryKey: ['explorer', genesisId] })
        void client.invalidateQueries({ queryKey: ['reprise', genesisId] })
      }),
      window.api.on('reprise:analysisProgress', (payload) => {
        if (!forProject(genesisId, payload)) return
        const event = payload as AnalysisProgressEvent
        if (event.phase === 'parse') setProgress({ done: event.done, total: event.total })
      }),
      window.api.on('reprise:analysisDone', (payload) => {
        if (forProject(genesisId, payload)) setProgress(null)
      })
    ]
    return () => offs.forEach((off) => off())
  }, [genesisId, client])

  const remember = useCallback(
    (nextParent: string, nextFilters: ExplorerFiltersView) => {
      call('explorer:saveState', { genesisId, parentKey: nextParent, filters: nextFilters }).catch(() => undefined)
    },
    [genesisId]
  )

  const open = useCallback(
    (key: string, select: string | null = null) => {
      setParentKey(key)
      setFocusKey(null)
      setSelected(select)
      remember(key, filters)
    },
    [filters, remember]
  )

  const setFilters = useCallback(
    (next: ExplorerFiltersView) => {
      setFiltersState(next)
      remember(parentKey ?? '', next)
    },
    [parentKey, remember]
  )

  const analyze = useCallback(async () => {
    setProgress({ done: 0, total: 0 })
    try {
      await call('reprise:analyze', { genesisId })
    } finally {
      void client.invalidateQueries({ queryKey: ['reprise', genesisId] })
    }
  }, [genesisId, client])

  const cancelAnalysis = useCallback(() => {
    call('reprise:cancelAnalysis', { genesisId }).catch(() => undefined)
  }, [genesisId])

  const problem =
    view.error instanceof Error ? view.error.message : project.error instanceof Error ? project.error.message : null

  return {
    project: project.data,
    view: view.data,
    loading: parentKey === null || view.isPending,
    problem,
    parentKey: parentKey ?? '',
    filters,
    focusKey,
    selected,
    progress: project.data?.analysis.state === 'running' ? (progress ?? { done: 0, total: 0 }) : null,
    open,
    setFilters,
    isolate: setFocusKey,
    select: setSelected,
    analyze,
    cancelAnalysis
  }
}
