import './progression.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { PROGRESSION_READINGS, type ProgressionReading } from '@shared/brainstorms/viewState'
import type { ExplorerMapView } from '@shared/ipc/reprise'
import type { WorkflowView } from '@shared/ipc/workflow'
import {
  progressionOf,
  type ProgressGroup,
  type ProgressLot,
  type ProgressPart,
  type ProgressionView as Progression
} from '@shared/workflow/progression'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'
import { AnalyzeCodeForm, useCodeAnalysis } from '../../reprise/AnalyzeCode'
import { StructureViewSwitch } from '../nodes/StructureBarNode'
import { FoldPanelButton } from '../PanelFold'

/** Bascule Réel · Prévu · Les deux (D13). */
export type ProgressMode = 'reel' | 'prevu' | 'deux'
const MODES: readonly [ProgressMode, string][] = [
  ['reel', 'Réel'],
  ['prevu', 'Prévu'],
  ['deux', 'Les deux']
]
const READING_LABELS: Readonly<Record<ProgressionReading, string>> = {
  arbre: 'A · L’arbre qui pousse',
  etages: 'B · Le chantier par étages',
  lots: 'C · Les lots du Workflow'
}
/** Fichiers hors plan montrés par module ; les autres sont comptés. */
const STRAYS_SHOWN = 6

const percent = (done: number, total: number): number => (total === 0 ? 0 : Math.round((done / total) * 100))
const tasksText = (done: number, total: number): string =>
  total === 0 ? 'pas encore de tâches' : `${done} / ${total} tâche${total > 1 ? 's' : ''}`
const shown = (mode: ProgressMode, kind: ProgressPart['kind'] | 'hors'): boolean =>
  !((mode === 'reel' && kind === 'prevu') || (mode === 'prevu' && kind === 'hors'))
const fileName = (path: string): string => path.split('/').at(-1) ?? path

function Brick({ part, mode }: { readonly part: ProgressPart; readonly mode: ProgressMode }): React.JSX.Element | null {
  if (!shown(mode, part.kind)) return null
  const state = part.kind === 'reel' ? 'bâtie' : 'prévue'
  return (
    <li
      data-kind={part.kind}
      aria-label={`${part.title} : ${state}, ${tasksText(part.done, part.total)}`}
      className="progress-brick flex flex-col gap-1 rounded-md px-2 py-1.5 text-xs"
    >
      <span className="font-medium">{part.title}</span>
      <span className="text-[11px] text-content-muted">
        {part.kind === 'prevu' ? '◌ prévu · ' : ''}
        {tasksText(part.done, part.total)}
      </span>
      {part.total === 0 ? null : (
        <span
          aria-hidden="true"
          className="progress-bar h-1 rounded-full"
          style={{ '--progress': `${percent(part.done, part.total)}%` } as React.CSSProperties}
        />
      )}
    </li>
  )
}

function Strays({ paths, mode }: { readonly paths: readonly string[]; readonly mode: ProgressMode }) {
  if (paths.length === 0 || !shown(mode, 'hors')) return null
  const rest = paths.length - STRAYS_SHOWN
  return (
    <>
      {paths.slice(0, STRAYS_SHOWN).map((path) => (
        <li
          key={path}
          data-kind="hors"
          title={path}
          aria-label={`${path} : hors plan, dans le code mais cité par aucune tâche`}
          className="progress-brick rounded-md px-2 py-1 text-xs"
        >
          ⚠ {fileName(path)} <span className="text-[11px]">· hors plan</span>
        </li>
      ))}
      {rest <= 0 ? null : (
        <li className="px-2 text-[11px] text-action">
          + {rest} {rest > 1 ? 'autres fichiers' : 'autre fichier'} hors plan
        </li>
      )}
    </>
  )
}

function GroupHead({ group }: { readonly group: ProgressGroup }): React.JSX.Element {
  const value = percent(group.done, group.total)
  return (
    <div className="flex items-center gap-2">
      {group.kind === 'prevu' ? (
        <span
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-content-muted/60"
        />
      ) : (
        <span
          aria-hidden="true"
          className="progress-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ '--progress': `${value}%` } as React.CSSProperties}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[10px] font-semibold">
            {group.total === 0 ? '—' : `${value}`}
          </span>
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{group.title}</span>
        <span className="text-[11px] text-content-muted">
          {group.kind === 'prevu' ? 'prévu · ' : 'module · '}
          {tasksText(group.done, group.total)}
        </span>
      </span>
    </div>
  )
}

/** A — l'arbre qui pousse : un module (ou un lot pas encore bâti) par colonne, ses parties dessous. */
function TreeReading({ view, mode }: { readonly view: Progression; readonly mode: ProgressMode }) {
  return (
    <ul className="flex items-start gap-4" aria-label="Modules du projet">
      {view.groups
        .filter((group) => shown(mode, group.kind))
        .map((group) => (
          <li key={group.key} aria-label={group.title} className="flex w-56 shrink-0 flex-col gap-2">
            <GroupHead group={group} />
            <ul className="flex flex-col gap-1.5 border-l border-content-muted/30 pl-3">
              {group.parts.map((part) => (
                <Brick key={part.key} part={part} mode={mode} />
              ))}
              <Strays paths={group.strays} mode={mode} />
            </ul>
          </li>
        ))}
    </ul>
  )
}

/** B — le chantier par étages : les fondations (modules les plus appelés) en bas, le prévu au sommet. */
function FloorsReading({ view, mode }: { readonly view: Progression; readonly mode: ProgressMode }) {
  const floors = [
    ...view.groups.filter((group) => group.column === null),
    ...view.groups.filter((group) => group.column !== null)
  ].filter((group) => shown(mode, group.kind))
  return (
    <ol className="flex flex-col gap-2" aria-label="Étages du projet">
      {floors.map((group, index) => {
        const level = floors.length - 1 - index
        return (
          <li
            key={group.key}
            aria-label={`${level === 0 ? 'Fondations' : `Étage ${level}`} : ${group.title}`}
            className="flex items-start gap-3 rounded-md bg-surface-raised p-2"
          >
            <span className="w-24 shrink-0 pt-1 text-[11px] font-semibold uppercase text-content-muted">
              {level === 0 ? 'Fondations' : `Étage ${level}`}
            </span>
            <div className="w-48 shrink-0">
              <GroupHead group={group} />
            </div>
            <ul className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5">
              {group.parts.map((part) => (
                <Brick key={part.key} part={part} mode={mode} />
              ))}
              <Strays paths={group.strays} mode={mode} />
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

function stageOf(lot: ProgressLot): string {
  if (lot.source === 'doc') return '✦ À brainstormer'
  switch (lot.status) {
    case 'delivered':
      return '✔ Livrée'
    case 'active':
      return '▶ En cours'
    case 'paused':
      return '⏸ En pause'
    case 'abandoned':
      return '✕ Abandonnée'
    default:
      return '⏸ À venir'
  }
}

/** C — les lots du Workflow : une colonne par spec ou fichier de tâches, dans l'ordre de l'arbre ; le hors plan à part. */
function LotsReading({ view, mode }: { readonly view: Progression; readonly mode: ProgressMode }) {
  const strays = view.groups.flatMap((group) => group.strays)
  return (
    <ul className="flex items-start gap-4" aria-label="Lots du Workflow">
      {view.lots.map((lot) => (
        <li key={lot.key} aria-label={lot.title} className="flex w-56 shrink-0 flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-content-muted">{stageOf(lot)}</span>
            <span className="truncate text-sm font-semibold">{lot.title}</span>
            <span className="text-[11px] text-content-muted">{tasksText(lot.done, lot.total)}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {lot.parts.map((part) => (
              <Brick key={part.key} part={part} mode={mode} />
            ))}
          </ul>
        </li>
      ))}
      {strays.length === 0 || !shown(mode, 'hors') ? null : (
        <li aria-label="Hors plan" className="flex w-56 shrink-0 flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-action">⚠ Hors plan</span>
            <span className="text-sm font-semibold">Dans le code, pas dans la doc</span>
            <span className="text-[11px] text-content-muted">
              {strays.length} fichier{strays.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            <Strays paths={strays} mode={mode} />
          </ul>
        </li>
      )}
    </ul>
  )
}

/**
 * Position « Progression » d'une carte de projet (spec 032 D12, D13, Q3, Q4) : où en est la construction, prévue (la
 * doc : les ronds et carrés du Workflow) et réelle (l'analyse du code), en trois lectures au choix (gardé par projet),
 * avec la bascule Réel · Prévu · Les deux. Montée par-dessus la carte, comme l'Architecture ; ne fait que refléter.
 */
export function ProgressionView({ genesisId }: { readonly genesisId: string }): React.JSX.Element {
  const reading = useUiStore((state) => state.progressionReadings[genesisId] ?? 'arbre')
  const setReading = useUiStore((state) => state.setProgressionReading)
  const [mode, setMode] = useState<ProgressMode>('deux')
  const workflow = useQuery({
    queryKey: ['workflow', genesisId],
    queryFn: () => call<WorkflowView>('workflow:read', { genesisId }),
    retry: false
  })
  const { target, notAnalyzed } = useCodeAnalysis(genesisId)
  const map = useQuery({
    queryKey: ['explorer', target, 'map'],
    queryFn: () => call<ExplorerMapView>('explorer:map', { genesisId: target }),
    enabled: target !== null
  })
  // Relue quand l'analyse du code se termine ou change, et quand Claude a fini un tour (il a pu cocher une case).
  const client = useQueryClient()
  useEffect(() => {
    const refreshCode = (payload: unknown): void => {
      const id = typeof payload === 'object' && payload !== null ? (payload as { genesisId?: unknown }).genesisId : null
      if (id !== genesisId && id !== target) return
      void client.invalidateQueries({ queryKey: ['explorer', target] })
      void client.invalidateQueries({ queryKey: ['reprise', genesisId] })
    }
    const offs = [
      window.api.on('reprise:changed', refreshCode),
      window.api.on('reprise:analysisDone', refreshCode),
      window.api.on('chat:turnEnd', () => void client.invalidateQueries({ queryKey: ['workflow', genesisId] }))
    ]
    return () => offs.forEach((off) => off())
  }, [client, genesisId, target])
  const view = useMemo(
    () =>
      workflow.data === undefined
        ? null
        : progressionOf(
            workflow.data.tree,
            map.data === undefined
              ? null
              : {
                  modules: map.data.modules.map((entry) => ({
                    key: entry.key,
                    title: entry.title,
                    column: entry.column
                  })),
                  // Le code seulement : un document ou un manifeste (`.md`, `.csproj`) n'est jamais hors plan.
                  files: map.data.files
                    .filter((entry) => entry.lang !== 'other')
                    .map((entry) => ({
                      path: entry.path,
                      moduleKey: entry.moduleKey,
                      plumbing: entry.plumbing
                    }))
                }
          ),
    [workflow.data, map.data]
  )
  const parts = view?.lots.flatMap((lot) => lot.parts) ?? []
  const built = parts.filter((part) => part.kind === 'reel').length

  return (
    <section
      aria-label="Progression du projet"
      data-progress-mode={mode}
      className="absolute inset-0 z-20 flex flex-col bg-surface"
    >
      <header className="flex flex-col gap-2 border-b border-content-muted/20 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <StructureViewSwitch genesisId={genesisId} view="progression" />
          <FoldPanelButton />
          <div
            role="group"
            aria-label="Lecture"
            className="flex overflow-hidden rounded-md border border-content-muted/40"
          >
            {PROGRESSION_READINGS.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={reading === entry}
                onClick={() => setReading(genesisId, entry)}
                className={`h-7 px-3 font-medium ${reading === entry ? 'bg-accent text-surface' : 'hover:bg-surface-raised'}`}
              >
                {READING_LABELS[entry]}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Montrer"
            className="flex overflow-hidden rounded-md border border-content-muted/40"
          >
            {MODES.map(([entry, label]) => (
              <button
                key={entry}
                type="button"
                aria-pressed={mode === entry}
                onClick={() => setMode(entry)}
                className={`h-7 px-3 font-medium ${mode === entry ? 'bg-accent text-surface' : 'hover:bg-surface-raised'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === null ? null : (
            <p className="text-content-muted" aria-live="polite">
              {built} partie{built > 1 ? 's' : ''} bâtie{built > 1 ? 's' : ''} · {parts.length - built} prévue
              {parts.length - built > 1 ? 's' : ''}
              {view.analysed ? ` · ${view.strays} fichier${view.strays > 1 ? 's' : ''} hors plan` : ''}
            </p>
          )}
        </div>
        <p className="flex flex-wrap gap-3 text-[11px] text-content-muted">
          <span>▭ Plein : dans le code (barre = tâches cochées)</span>
          <span>◌ Pointillé : prévu par la doc</span>
          <span className="text-action">⚠ Orange : hors plan</span>
        </p>
        {notAnalyzed ? (
          <details className="text-xs">
            <summary className="cursor-pointer">
              Le code n’est pas analysé : seules les cases cochées disent ce qui est bâti. Analyser le code…
            </summary>
            <div className="mt-2 flex max-w-md flex-col gap-2">
              <AnalyzeCodeForm genesisId={genesisId} onAnalyzed={() => undefined} />
            </div>
          </details>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {workflow.error !== null ? (
          <p role="alert" className="text-sm text-con">
            {workflow.error instanceof IpcFailure ? workflow.error.message : 'La doc du projet n’a pas pu être lue.'}
          </p>
        ) : view === null ? (
          <p className="text-sm text-content-muted">Chargement…</p>
        ) : reading === 'etages' ? (
          <FloorsReading view={view} mode={mode} />
        ) : reading === 'lots' ? (
          <LotsReading view={view} mode={mode} />
        ) : (
          <TreeReading view={view} mode={mode} />
        )}
      </div>
    </section>
  )
}
