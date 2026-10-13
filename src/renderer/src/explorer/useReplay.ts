import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { NodeReplayView, ReplayStepsView } from '@shared/git/history'
import type { AuthorView } from '@shared/git/model'
import { call } from '../lib/ipc'
import { gitKeys } from '../git/gitQueries'

export type ReplayMode = 'main' | 'last'

/** Marque d'un nœud en rediffusion : l'auteur retenu (couleur + initiales) et les parts ; `null` : jamais touché. */
export interface ReplayMark {
  readonly author: AuthorView
  readonly shares: readonly { readonly author: AuthorView; readonly percent: number }[]
}

export interface Replay {
  readonly steps: ReplayStepsView | undefined
  readonly error: Error | null
  /** Position du curseur (0 : le plus ancien). */
  readonly at: number
  readonly commit: ReplayStepsView['commits'][number] | null
  /** Marque des nœuds visibles touchés jusqu'au commit choisi. */
  readonly marks: ReadonlyMap<string, ReplayMark>
  readonly mode: ReplayMode
  setMode(mode: ReplayMode): void
  readonly playing: boolean
  play(): void
  pause(): void
  seek(index: number): void
  readonly fetchAll: UseMutationResult<unknown, Error, void>
}

/** Pas de la lecture ▶ (un commit toutes les 400 ms). */
const PLAY_STEP_MS = 400

/**
 * Rediffusion de l'explorateur (spec 021 US5 lot 2, E6) : les commits du dépôt en curseur (le plus récent par défaut),
 * la lecture ▶, le mode « principal » / « dernier » et la marque de chaque nœud visible au commit choisi. Rien n'est lu
 * tant que la rediffusion n'est pas active.
 */
export function useReplay(genesisId: string, active: boolean, keys: readonly string[]): Replay {
  const client = useQueryClient()
  const [index, setIndex] = useState<number | null>(null)
  const [mode, setMode] = useState<ReplayMode>('main')
  const [playing, setPlaying] = useState(false)
  const steps = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'replaySteps'],
    enabled: active,
    queryFn: () => call<ReplayStepsView>('git:replaySteps', { genesisId })
  })
  const commits = steps.data?.commits ?? []
  const last = commits.length - 1
  const at = index === null || index > last ? last : index
  const hash = commits[at]?.hash ?? null
  const nodes = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'replay', hash, keys],
    enabled: active && hash !== null && keys.length > 0,
    placeholderData: (previous) => previous,
    queryFn: () => call<{ readonly nodes: readonly NodeReplayView[] }>('git:replay', { genesisId, at: hash, keys })
  })
  const fetchAll = useMutation({
    mutationFn: () => call('git:fetchAll', { genesisId, confirm: true }),
    onSuccess: () => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  })

  // Lecture : un commit après l'autre jusqu'au plus récent.
  useEffect(() => {
    if (!playing) return
    if (at >= last) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setIndex(at + 1), PLAY_STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, at, last])
  useEffect(() => {
    if (!active) {
      setPlaying(false)
      setIndex(null)
    }
  }, [active])

  const authors = steps.data?.authors
  const marks = useMemo(() => {
    const byKey = new Map((authors ?? []).map((author) => [author.key, author] as const))
    const result = new Map<string, ReplayMark>()
    for (const node of nodes.data?.nodes ?? []) {
      const author = byKey.get(mode === 'main' ? node.main : node.last)
      if (author === undefined) continue
      const shares = node.shares.flatMap((share) => {
        const owner = byKey.get(share.authorKey)
        return owner === undefined ? [] : [{ author: owner, percent: share.percent }]
      })
      result.set(node.key, { author, shares })
    }
    return result
  }, [authors, nodes.data, mode])

  return {
    steps: steps.data,
    error: steps.error ?? nodes.error ?? fetchAll.error,
    at,
    commit: commits[at] ?? null,
    marks,
    mode,
    setMode,
    playing,
    play: () => {
      if (at >= last) setIndex(0)
      setPlaying(true)
    },
    pause: () => setPlaying(false),
    seek: (next: number) => {
      setPlaying(false)
      setIndex(Math.max(0, Math.min(last, next)))
    },
    fetchAll
  }
}
