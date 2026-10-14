import type { MapFileView } from '@shared/ipc/reprise'
import { LAYER_LABELS } from '../labels'
import type { ShownBoxes } from './boxLayout'

/**
 * Vue liste (spec 031 D12b) : la même carte, lisible au clavier et au lecteur d'écran — chaque module avec sa couche et
 * son rôle, puis tous ses fichiers ; un clic sur un module le choisit, un clic sur un fichier ouvre son code.
 */
export function BoxList({
  shown,
  selected,
  openPath,
  onModule,
  onFile
}: {
  readonly shown: ShownBoxes
  readonly selected: string | null
  readonly openPath: string | null
  readonly onModule: (key: string) => void
  readonly onFile: (file: MapFileView) => void
}): React.JSX.Element {
  return (
    <section aria-label="Modules et fichiers" className="h-full overflow-y-auto p-4">
      <ul className="flex flex-col gap-4">
        {shown.modules.map((module) => {
          const layer = LAYER_LABELS[module.layer]
          return (
            <li key={module.key} className={`rounded-lg border-l-[5px] bg-surface-raised p-3 ${layer.border}`}>
              <button
                type="button"
                aria-current={selected === module.key ? 'true' : undefined}
                onClick={() => onModule(module.key)}
                className="w-full text-left"
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${layer.color}`}>{layer.text}</span>
                <span className="block font-semibold">{module.title}</span>
                {module.role === null ? null : <span className="block text-xs text-content-muted">{module.role}</span>}
              </button>
              <ul aria-label={`Fichiers de ${module.title}`} className="mt-2 flex flex-col gap-0.5">
                {(shown.filesOf.get(module.key) ?? []).map((file) => (
                  <li key={file.key}>
                    <button
                      type="button"
                      aria-current={openPath === file.path ? 'true' : undefined}
                      onClick={() => onFile(file)}
                      className={`w-full rounded px-2 py-0.5 text-left text-xs hover:bg-surface ${
                        openPath === file.path ? 'bg-surface font-semibold' : ''
                      }`}
                    >
                      <span className="font-mono">{file.path}</span>
                      {file.role === null ? null : <span className="text-content-muted"> — {file.role}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
