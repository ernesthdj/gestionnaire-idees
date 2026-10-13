import { useQuery } from '@tanstack/react-query'
import type { IssueLinkView } from '@shared/git/github'
import { useUiStore } from '../app/uiStore'
import { call } from '../lib/ipc'
import { gitKeys } from './gitQueries'

/**
 * Pastilles `#n` des issues et PR reliées à une idée (spec 021 T049) : le numéro seul (lu dans l'app, sans GitHub), un
 * clic ouvre le volet Dépôt. Une seule lecture par projet, partagée par ses nœuds.
 */
export function IssueChips({
  genesisId,
  neuronId
}: {
  readonly genesisId: string
  readonly neuronId: string
}): React.JSX.Element | null {
  const openRepo = useUiStore((state) => state.openRepo)
  const links = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'issueLinks'],
    queryFn: () => call<readonly IssueLinkView[]>('git:issueLinks', { genesisId }),
    retry: false,
    staleTime: 60_000
  })
  const mine = (links.data ?? []).filter((link) => link.neuronId === neuronId)
  if (mine.length === 0) return null
  const label = mine.map((link) => `${link.kind === 'pr' ? 'PR' : 'issue'} #${link.number}`).join(', ')
  return (
    <button
      type="button"
      className="nodrag absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-content shadow"
      aria-label={`Reliée à ${label} : ouvrir le volet Dépôt`}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        openRepo(genesisId)
      }}
    >
      {mine.map((link) => `#${link.number}`).join(' ')}
    </button>
  )
}
