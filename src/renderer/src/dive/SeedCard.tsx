import { useQuery } from '@tanstack/react-query'
import type { IdeaSummaryView, RootView } from '@shared/ipc/neurons'
import { call } from '../lib/ipc'

/**
 * Fiche de l'idée de départ (l'hexagone de la carte) : son texte d'origine, toujours, puis le résumé de ce que le
 * brainstorming lui a apporté (IA locale, recalculé seulement quand l'idée a changé).
 */
export function SeedCard({ root }: { readonly root: RootView }): React.JSX.Element {
  const summary = useQuery({
    queryKey: ['summary', root.id, root.version],
    queryFn: () => call<IdeaSummaryView>('neuron:summary', { rootId: root.id }),
    staleTime: Infinity,
    retry: false
  })
  return (
    <section
      aria-label="Idée de départ"
      className="rounded-md border-l-4 border-seed bg-surface-raised px-3 py-2 text-xs"
    >
      <p className="font-semibold text-seed">
        {/* Hexagone dessiné : le caractère ⬢ manque dans la police de l'interface. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="mr-1 inline-block h-3 w-3 align-[-1px]"
          fill="currentColor"
        >
          <polygon points="50,2 92,26 92,74 50,98 8,74 8,26" />
        </svg>
        Idée de départ
      </p>
      <p className="mt-1 whitespace-pre-line">{root.content ?? root.title}</p>
      {summary.isPending ? (
        <p role="status" className="mt-2 text-content-muted">
          L’IA locale résume l’idée…
        </p>
      ) : summary.data?.summary ? (
        <p className="mt-2 text-content-muted">
          {summary.data.stale ? <span className="italic">Résumé d’avant les derniers changements : </span> : null}
          {summary.data.summary}
        </p>
      ) : null}
    </section>
  )
}
