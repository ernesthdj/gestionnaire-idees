import type { Node, NodeProps } from '@xyflow/react'
import { createContext, useContext, useId, useState } from 'react'
import type { MapFileView, MapModuleView } from '@shared/ipc/reprise'
import { Handles, ReplayBadge, useReplayBorder } from '../ExplorerNodes'
import { LAYER_LABELS } from '../labels'

/** Gestes offerts aux boîtes : ouvrir le code d'un fichier (liste d'un gros module). */
export interface BoxActions {
  readonly pickFile: (file: MapFileView) => void
  /** Fichier dont le code est ouvert à droite. */
  readonly openPath: string | null
}

export const BoxActionsContext = createContext<BoxActions>({ pickFile: () => undefined, openPath: null })

/** Données d'une boîte de module : le module, ouvert ou non, et ses fichiers (liste d'un gros module ouvert). */
export type ModuleBoxData = {
  readonly module: MapModuleView
  readonly open: boolean
  readonly big: boolean
  readonly files: readonly MapFileView[]
  readonly selected: boolean
}
/** Boîte d'un fichier ; `inside` : dans un module ouvert en grand (ses fonctions sont montrées). */
export type FileBoxData = { readonly file: MapFileView; readonly selected: boolean; readonly inside?: boolean }
/** Cadre d'un module ouvert en grand (spec 031 D5). */
export type FrameBoxData = { readonly module: MapModuleView; readonly selected: boolean }
/** Amorce d'un appel vers un module voisin, sur un bord du cadre. */
export type StubBoxData = { readonly module: MapModuleView; readonly side: 'in' | 'out' }
export type ModuleBoxNode = Node<ModuleBoxData, 'module'>
export type FileBoxNode = Node<FileBoxData, 'file'>
export type FrameBoxNode = Node<FrameBoxData, 'frame'>
export type StubBoxNode = Node<StubBoxData, 'stub'>

/** Liste compacte et filtrable d'un gros module ouvert (spec 031 D3) : rien n'est caché, un point marque les fichiers reliés. */
function FileList({
  module,
  files
}: {
  readonly module: MapModuleView
  readonly files: readonly MapFileView[]
}): React.JSX.Element {
  const actions = useContext(BoxActionsContext)
  const filterId = useId()
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const shown = files.filter(
    (file) =>
      needle === '' ||
      file.title.toLowerCase().includes(needle) ||
      file.functions.some((name) => name.toLowerCase().includes(needle))
  )
  return (
    <div className="nodrag nowheel mt-1 flex min-h-0 flex-col gap-1">
      <label htmlFor={filterId} className="sr-only">
        Filtrer les fichiers de {module.title}
      </label>
      <input
        id={filterId}
        type="search"
        value={filter}
        placeholder={`Filtrer les ${files.length} fichiers…`}
        onChange={(event) => setFilter(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className="h-7 rounded-md border border-content-muted/30 bg-surface px-2 text-xs"
      />
      <ul
        aria-label={`Fichiers de ${module.title}`}
        className="min-h-0 flex-1 overflow-y-auto rounded-md border border-content-muted/30 bg-surface p-0.5"
      >
        {shown.length === 0 ? (
          <li className="px-2 py-1 text-xs text-content-muted">Aucun fichier</li>
        ) : (
          shown.map((file) => (
            <li key={file.key}>
              <button
                type="button"
                title={file.role ?? file.path}
                aria-current={actions.openPath === file.path ? 'true' : undefined}
                onClick={(event) => {
                  event.stopPropagation()
                  actions.pickFile(file)
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs hover:bg-surface-raised ${
                  actions.openPath === file.path ? 'bg-surface-raised font-semibold' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full border ${file.external ? 'border-accent bg-accent' : 'border-content-muted'}`}
                />
                <span className="truncate">{file.title}</span>
                {file.external ? <span className="sr-only">(relié à un autre module)</span> : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

/** Boîte d'un module (spec 031 D2) : sa couche, son nom, son rôle en une phrase, sa taille ; ouverte, ses fichiers. */
export function ModuleBox({ id, data }: NodeProps<ModuleBoxNode>): React.JSX.Element {
  const { module, open, big, files, selected } = data
  const layer = LAYER_LABELS[module.layer]
  const border = useReplayBorder(id)
  return (
    <div
      style={border}
      className={`relative flex h-full w-full flex-col gap-1 rounded-xl border border-l-[5px] border-content-muted/30 bg-surface-raised px-3 py-2 shadow-sm ${layer.border} ${
        selected ? 'ring-2 ring-focus' : ''
      }`}
    >
      <Handles />
      <ReplayBadge id={id} />
      <p
        className={`box-kind flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide ${layer.color}`}
      >
        <span>{module.plumbing ? `${layer.text} · plomberie` : layer.text}</span>
        <span aria-hidden="true" className="normal-case tracking-normal text-accent">
          {open ? '▾ Fermer' : '▸ Ouvrir'}
        </span>
      </p>
      <p className="box-title self-start text-base font-semibold leading-tight">{module.title}</p>
      <p
        className={`line-clamp-3 text-xs ${module.role === null ? 'italic text-content-muted' : 'text-content-muted'}`}
      >
        {module.role ?? 'Rôle pas encore écrit : le guide de reprise le rédige.'}
      </p>
      {open ? null : (
        <p className="mt-auto text-[11px] text-content-muted">
          {module.files} fichier{module.files > 1 ? 's' : ''} · {module.lines} lignes
        </p>
      )}
      {open && big ? <FileList module={module} files={files} /> : null}
    </div>
  )
}

/** Boîte d'un fichier dans un module ouvert : son nom, et son rôle (ou son dossier et ses fonctions). */
export function FileBox({ id, data }: NodeProps<FileBoxNode>): React.JSX.Element {
  const { file, selected, inside = false } = data
  const actions = useContext(BoxActionsContext)
  const border = useReplayBorder(id)
  // Dedans, les fonctions sont en puces : le sous-titre ne dit que le rôle, ou le dossier d'origine.
  const hint = inside
    ? (file.role ?? file.folder)
    : (file.role ?? [file.folder, file.functions.slice(0, 3).join(', ')].filter((part) => part !== '').join(' · '))
  return (
    <div
      style={border}
      className={`relative flex h-full w-full flex-col justify-center rounded-lg border border-content-muted/30 bg-surface px-2 text-xs ${
        selected || actions.openPath === file.path ? 'ring-2 ring-focus' : ''
      }`}
    >
      <Handles />
      <ReplayBadge id={id} />
      <p className="flex items-center gap-1 truncate font-mono font-semibold">
        {file.external ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
        <span className="truncate">{file.title}</span>
      </p>
      {hint === '' ? null : <p className="truncate text-content-muted">{hint}</p>}
      {inside && file.functions.length > 0 ? (
        <p className="mt-0.5 flex gap-1 overflow-hidden">
          {file.functions.slice(0, 4).map((name) => (
            <span
              key={name}
              className="shrink-0 rounded border border-content-muted/30 px-1 font-mono text-[10px] text-accent"
            >
              {name}()
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}

/** Cadre d'un module ouvert en grand (spec 031 D5) : sa couche, son nom, son rôle ; ses fichiers sont posés dedans. */
export function FrameBox({ data }: NodeProps<FrameBoxNode>): React.JSX.Element {
  const { module, selected } = data
  const layer = LAYER_LABELS[module.layer]
  return (
    <div
      className={`relative flex h-full w-full flex-col gap-1 rounded-2xl border border-l-[5px] border-content-muted/30 bg-surface-raised/60 px-4 py-3 shadow-lg ${layer.border} ${
        selected ? 'ring-2 ring-focus' : ''
      }`}
    >
      <p
        className={`box-kind flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide ${layer.color}`}
      >
        <span>{layer.text} · à l’intérieur</span>
        <span className="normal-case tracking-normal text-accent">Échap : ressortir</span>
      </p>
      <p className="box-title self-start text-base font-semibold leading-tight">{module.title}</p>
      <p className="max-w-[60ch] text-xs text-content-muted">
        {module.role ?? 'Rôle pas encore écrit : le guide de reprise le rédige.'} · {module.files} fichier
        {module.files > 1 ? 's' : ''} · {module.lines} lignes
      </p>
    </div>
  )
}

/** Amorce sur un bord du cadre : « ← Controllers » (il l'appelle), « Logging → » (il l'appelle) ; un clic y entre. */
export function StubBox({ data }: NodeProps<StubBoxNode>): React.JSX.Element {
  const { module, side } = data
  const layer = LAYER_LABELS[module.layer]
  return (
    <div
      className={`stub-pill relative flex h-full w-full items-center justify-center rounded-full border border-dashed bg-surface text-xs font-semibold ${layer.color}`}
      style={{ borderColor: `var(${layer.css})` }}
    >
      <Handles />
      <span className="stub-name truncate text-content">
        {side === 'in' ? `← ${module.title}` : `${module.title} →`}
      </span>
    </div>
  )
}
