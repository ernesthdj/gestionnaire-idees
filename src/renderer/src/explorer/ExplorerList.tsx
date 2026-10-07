import type { ExplorerView } from '@shared/ipc/reprise'
import { CATEGORY_LABELS, KIND_LABELS, PROVENANCE_LABELS } from './labels'

/**
 * Vue liste de l'explorateur (spec 017 FR-024) : les mêmes informations que la carte, au clavier et au lecteur
 * d'écran — éléments du niveau, leurs fichiers (un clic ouvre le code dans le volet, D16), leurs sous-dossiers, et
 * les appels entre eux.
 */
export function ExplorerList({
  view,
  selected,
  openPath,
  onSelect,
  onOpen,
  onOpenFile
}: {
  readonly view: ExplorerView
  readonly selected: string | null
  readonly openPath: string | null
  readonly onSelect: (key: string) => void
  readonly onOpen: (key: string) => void
  readonly onOpenFile: (path: string) => void
}): React.JSX.Element {
  const titleOf = new Map(view.nodes.map((node) => [node.key, node.title] as const))
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <section aria-label="Éléments de ce niveau">
        <ul className="space-y-2">
          {view.nodes.map((node) => (
            <li key={node.key}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={selected === node.key}
                  onClick={() => onSelect(node.key)}
                  className={`rounded-md px-2 py-1 text-left ${selected === node.key ? 'bg-surface-raised font-semibold' : ''}`}
                >
                  <span aria-hidden="true">{KIND_LABELS[node.kind].icon}</span> {node.title}
                </button>
                <span className="text-xs text-content-muted">
                  {KIND_LABELS[node.kind].text} · {CATEGORY_LABELS[node.category].text}
                </span>
                {node.childCount === 0 ? null : (
                  <button type="button" className="text-xs underline" onClick={() => onOpen(node.key)}>
                    Ouvrir ({node.childCount})
                  </button>
                )}
              </div>
              {node.files.length === 0 ? null : (
                <ul aria-label={`Fichiers de ${node.title}`} className="ml-6 mt-1 space-y-0.5 text-xs">
                  {node.files.map((file) => (
                    <li key={file.key}>
                      <button
                        type="button"
                        aria-current={openPath === file.path ? 'true' : undefined}
                        className={`underline ${openPath === file.path ? 'font-semibold' : ''}`}
                        onClick={() => onOpenFile(file.path)}
                      >
                        {file.title}
                      </button>
                    </li>
                  ))}
                  {node.hiddenFiles === 0 ? null : (
                    <li className="text-content-muted">+ {node.hiddenFiles} masqués (filtres)</li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {view.grouped.map((group) => (
          <p key={group.key} className="mt-2 text-xs text-content-muted">
            {group.title} regroupés : utilise la recherche ou un filtre.
          </p>
        ))}
      </section>
      <section aria-label="Appels entre ces éléments">
        <h3 className="text-xs font-semibold text-content-muted">Appels ({view.edges.length})</h3>
        <ul className="mt-1 space-y-1 text-xs">
          {view.edges.map((edge) => (
            <li key={`${edge.from}→${edge.to}`}>
              {titleOf.get(edge.from)} → {titleOf.get(edge.to)} : {edge.count} appel{edge.count > 1 ? 's' : ''},{' '}
              {PROVENANCE_LABELS[edge.provenance].text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
