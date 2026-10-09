import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { GitStatusView } from '@shared/git/model'
import { call } from '../lib/ipc'

/** Clés des requêtes git d'un projet (toutes sous `['git', genesisId]`, relues sur `git:changed`). */
export const gitKeys = {
  all: (genesisId: string) => ['git', genesisId] as const,
  status: (genesisId: string) => ['git', genesisId, 'status'] as const,
  branches: (genesisId: string) => ['git', genesisId, 'branches'] as const,
  log: (genesisId: string) => ['git', genesisId, 'log'] as const,
  diff: (genesisId: string, path: string, staged: boolean) => ['git', genesisId, 'diff', path, staged] as const
}

/** État du dépôt : relu au retour du focus de la fenêtre (research R5), jamais par surveillance du disque. */
export function useGitStatus(genesisId: string): ReturnType<typeof useQuery<GitStatusView>> {
  return useQuery({
    queryKey: gitKeys.status(genesisId),
    queryFn: () => call<GitStatusView>('git:status', { genesisId }),
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: false
  })
}

/** Après une écriture : tout ce qui concerne ce dépôt se relit. */
export function refreshGit(client: QueryClient, genesisId: string): Promise<void> {
  return client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
}

export function useRefreshGit(genesisId: string): () => Promise<void> {
  const client = useQueryClient()
  return () => refreshGit(client, genesisId)
}
