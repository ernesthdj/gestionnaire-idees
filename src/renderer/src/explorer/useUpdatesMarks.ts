import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TouchedView } from '@shared/git/history'
import type { AuthorView } from '@shared/git/model'
import { call } from '../lib/ipc'
import { gitKeys } from '../git/gitQueries'
import type { ReplayMark } from './useReplay'

export interface UpdatesMarks {
  /** Commits arrivés depuis la dernière visite (`undefined` : pas encore lu). */
  readonly commits: number | undefined
  readonly authors: readonly AuthorView[]
  /** Nœuds visibles touchés : le dernier auteur qui y est passé et les parts (en commits). */
  readonly marks: ReadonlyMap<string, ReplayMark>
  readonly error: Error | null
}

interface UpdatesRange {
  readonly lastSeen: string | null
  readonly upstreamHead: string | null
}

/**
 * « Depuis ta dernière visite » sur la carte (spec 021 T030, D13) : les nœuds visibles touchés par les commits du
 * distant arrivés depuis le dernier vu, marqués comme en rediffusion (couleur ET initiales du dernier auteur). Même
 * requête `git:updates` que le volet Dépôt ; rien n'est lu tant que le mode n'est pas actif.
 */
export function useUpdatesMarks(genesisId: string, active: boolean, keys: readonly string[]): UpdatesMarks {
  const range = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'updates'],
    enabled: active,
    retry: false,
    queryFn: () => call<UpdatesRange>('git:updates', { genesisId })
  })
  const from = range.data?.lastSeen ?? null
  const to = range.data?.upstreamHead ?? null
  const empty = range.data !== undefined && (from === null || to === null || from === to)
  const touched = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'touched', from, to, keys],
    enabled: active && !empty && from !== null && to !== null && keys.length > 0,
    placeholderData: (previous) => previous,
    retry: false,
    queryFn: () => call<TouchedView>('git:touched', { genesisId, from, to, keys })
  })
  const data = touched.data
  const marks = useMemo(() => {
    const byKey = new Map((data?.authors ?? []).map((author) => [author.key, author] as const))
    const result = new Map<string, ReplayMark>()
    for (const node of data?.nodes ?? []) {
      const author = byKey.get(node.last)
      if (author === undefined) continue
      const shares = node.shares.flatMap((share) => {
        const owner = byKey.get(share.authorKey)
        return owner === undefined ? [] : [{ author: owner, percent: share.percent }]
      })
      result.set(node.key, { author, shares })
    }
    return result
  }, [data])
  return {
    commits: empty ? 0 : data?.commits,
    authors: empty ? [] : (data?.authors ?? []),
    marks: empty ? new Map() : marks,
    error: range.error ?? touched.error
  }
}
