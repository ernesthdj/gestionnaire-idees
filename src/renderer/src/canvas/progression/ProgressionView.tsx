import './progression.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { PROGRESSION_READINGS, type ProgressionReading } from '@shared/brainstorms/viewState'
import type { ExplorerMapView } from '@shared/ipc/reprise'
import type { WorkflowView } from '@shared/ipc/workflow'
import {
  progressionOf,
  type PartKind,
  type ProgressFamily,
  type ProgressLot,
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

const percent = (done: number, total: number): number => (total === 0 ? 0 : Math.round((done / total) * 100))
const tasksText = (done: number, total: number): string =>
  total === 0 ? 'pas encore de tâches' : `${done} / ${total} tâche${total > 1 ? 's' : ''}`
const shown = (mode: ProgressMode, kind: PartKind | 'hors'): boolean =>
  !((mode === 'reel' && kind === 'prevu') || (mode === 'prevu' && kind === 'hors'))
const fileName = (path: string): string => path.split('/').at(-1) ?? path
const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`

function stageOf(lot: ProgressLot): string {
  if (lot.source === 'doc' && lot.total === 0) return lot.maturity === 100 ? '◇ à spécifier' : '✦ à brainstormer'
  switch (lot.status) {
    case 'delivered':
      return '✔ livrée'
    case 'active':
      return '▶ en cours'
    case 'paused':
      return '⏸ en pause'
    case 'abandoned':
      return '✕ abandonnée'
    default:
      return lot.total > 0 && lot.done === lot.total ? '✔ faite' : '⏸ à venir'
  }
}

interface Stage {
  readonly label: string
  /** Couleur de l'étape, comme la maquette C (jamais seule : le mot et le symbole la disent aussi). */
  readonly tone: string
}

/** Étape d'une famille, d'après ses lots (lecture C, et briques du groupe « Bâti »). */
function familyStage(family: ProgressFamily): Stage {
  const { lots } = family
  if (lots.every((lot) => lot.source === 'doc' && lot.total === 0)) {
    return lots.every((lot) => lot.maturity === 100)
      ? { label: '◇ À spécifier', tone: 'text-seed' }
      : { label: '✦ À brainstormer', tone: 'text-idea' }
  }
  if (lots.every((lot) => lot.status === 'abandoned')) return { label: '✕ Abandonnée', tone: 'text-content-muted' }
  if (family.finished) return { label: '✔ Livrée', tone: 'text-pro' }
  if (lots.some((lot) => lot.status === 'active' || (lot.done > 0 && lot.done < lot.total))) {
    return { label: '▶ En cours', tone: 'text-accent' }
  }
  return { label: '⏸ À venir', tone: 'text-content-muted' }
}

function Bar({ done, total }: { readonly done: number; readonly total: number }): React.JSX.Element | null {
  if (total === 0) return null
  return (
    <span
      aria-hidden="true"
      className="progress-bar h-1.5 rounded-full"
      style={{ '--progress': `${percent(done, total)}%` } as React.CSSProperties}
    />
  )
}

/** Un lot. `bare` : la famille est ce lot (spec ou fichier de tâches sans L1), son titre est déjà au-dessus (Q7). */
function Brick({ lot, mode, bare }: { lot: ProgressLot; mode: ProgressMode; bare?: boolean }) {
  if (!shown(mode, lot.kind)) return null
  const state = lot.kind === 'reel' ? 'bâti' : 'prévu'
  return (
    <li
      data-kind={lot.kind}
      aria-label={`${lot.title} : ${state}, ${tasksText(lot.done, lot.total)}`}
      className="progress-brick flex flex-col gap-1 rounded-lg px-2.5 py-2"
    >
      {bare === true ? null : <span className="text-[13px] font-semibold leading-snug">{lot.title}</span>}
      <span className="text-[11px] text-content-muted">
        {lot.kind === 'prevu' ? '◌ prévu · ' : ''}
        {stageOf(lot)} · {tasksText(lot.done, lot.total)}
      </span>
      <Bar done={lot.done} total={lot.total} />
    </li>
  )
}

/** Les lots d'une famille, sans répéter son titre quand elle n'a qu'elle-même pour lot. */
function Lots({ family, mode, className }: { family: ProgressFamily; mode: ProgressMode; className: string }) {
  return (
    <ul className={className}>
      {family.lots.map((lot) => (
        <Brick key={lot.key} lot={lot} mode={mode} bare={lot.key === family.key} />
      ))}
    </ul>
  )
}

function Ring({ kind, done, total, size }: { kind: PartKind; done: number; total: number; size: 'md' | 'lg' }) {
  const outer = size === 'lg' ? 'h-[4.5rem] w-[4.5rem]' : 'h-12 w-12'
  const inner = size === 'lg' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-[11px]'
  if (kind === 'prevu') {
    return (
      <span
        aria-hidden="true"
        className={`${outer} flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-content-muted/60 text-[11px] text-content-muted`}
      >
        —
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`progress-ring ${outer} flex shrink-0 items-center justify-center rounded-full`}
      style={{ '--progress': `${percent(done, total)}%` } as React.CSSProperties}
    >
      <span className={`${inner} flex items-center justify-center rounded-full bg-surface font-bold`}>
        {total === 0 ? '—' : `${percent(done, total)} %`}
      </span>
    </span>
  )
}

function FamilyHead({ family, center }: { readonly family: ProgressFamily; readonly center?: boolean }) {
  return (
    <div className={`flex gap-2 ${center === true ? 'flex-col items-center text-center' : 'items-center'}`}>
      <Ring kind={family.kind} done={family.done} total={family.total} size="md" />
      <span className={`flex min-w-0 flex-col ${center === true ? 'items-center' : ''}`}>
        <span className="line-clamp-2 text-sm font-bold" title={family.title}>
          {family.title}
        </span>
        <span className="text-[11px] text-content-muted">
          {family.label}
          {family.kind === 'prevu' ? ' · prévu' : ''} · {tasksText(family.done, family.total)}
        </span>
      </span>
    </div>
  )
}

/** Le groupe des familles terminées (Q7) : un anneau, un compte, et ses familles en briques, repliées. */
function Built({ families, center }: { readonly families: readonly ProgressFamily[]; readonly center?: boolean }) {
  const done = families.reduce((sum, family) => sum + family.done, 0)
  const total = families.reduce((sum, family) => sum + family.total, 0)
  return (
    <div className={`flex flex-col gap-2 ${center === true ? 'items-center text-center' : ''}`}>
      <div className={`flex gap-2 ${center === true ? 'flex-col items-center' : 'items-center'}`}>
        <Ring kind="reel" done={done} total={total} size="md" />
        <span className={`flex flex-col ${center === true ? 'items-center' : ''}`}>
          <span className="text-sm font-bold text-pro">✔ Bâti</span>
          <span className="text-[11px] text-content-muted">
            {plural(families.length, 'famille')} terminée{families.length > 1 ? 's' : ''} · {tasksText(done, total)}
          </span>
        </span>
      </div>
      <details className="w-full text-left">
        <summary className="cursor-pointer text-xs font-medium text-accent">
          {families.length > 1 ? `Voir les ${families.length} familles` : 'Voir la famille'}
        </summary>
        <ul
          aria-label="Familles terminées"
          className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-1.5"
        >
          {families.map((family) => {
            const stage = familyStage(family)
            return (
              <li
                key={family.key}
                data-kind={family.kind}
                aria-label={`${family.title} : ${stage.label}, ${tasksText(family.done, family.total)}`}
                className="progress-brick flex flex-col gap-1 rounded-lg px-2.5 py-2"
              >
                <span className="line-clamp-2 text-[13px] font-semibold leading-snug" title={family.title}>
                  {family.title}
                </span>
                <span className="text-[11px] text-content-muted">
                  {family.label} · {stage.label} · {tasksText(family.done, family.total)}
                </span>
                <Bar done={family.done} total={family.total} />
              </li>
            )
          })}
        </ul>
      </details>
    </div>
  )
}

/** Le hors plan par dossier, replié en une ligne (Q6, Q7) : on sait qu'il existe et quoi en faire, sans noyer la vue. */
function StrayFolders({ view, mode }: { readonly view: Progression; readonly mode: ProgressMode }) {
  if (view.strays.length === 0 || !shown(mode, 'hors')) return null
  return (
    <section aria-label="Hors plan" className="progress-strays rounded-lg px-3 py-2 text-xs">
      <details>
        <summary className="cursor-pointer">
          <strong>⚠ Hors plan : {plural(view.strayCount, 'fichier')}</strong> dans{' '}
          {plural(view.strays.length, 'dossier')}, cités par aucune tâche — à décrire dans une spec, ou à retirer
        </summary>
        <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-1">
          {view.strays.map((folder) => (
            <li key={folder.path} aria-label={`${folder.path} : ${plural(folder.files.length, 'fichier')} hors plan`}>
              <details>
                <summary className="cursor-pointer truncate" title={folder.path}>
                  {folder.path === '.' ? 'racine du projet' : folder.path} · {plural(folder.files.length, 'fichier')}
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-[11px]">
                  {folder.files.map((path) => (
                    <li key={path} title={path}>
                      {fileName(path)}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

/** Familles ouvertes (montrées selon la bascule) et terminées (le groupe « Bâti », Q7). */
function split(view: Progression, mode: ProgressMode) {
  return {
    open: view.families.filter((family) => !family.finished && shown(mode, family.kind)),
    finished: view.families.filter((family) => family.finished)
  }
}

/** A — l'arbre qui pousse : le projet en haut, la branche « Bâti » puis une branche par famille ouverte. */
function TreeReading({ view, mode, name }: { view: Progression; mode: ProgressMode; name: string }) {
  const { open, finished } = split(view, mode)
  return (
    <div className="flex flex-col gap-6">
      {/* Le projet reste au centre du panneau ; seules les branches défilent, en entier (`w-max mx-auto` : centrées
          tant qu'elles tiennent, sinon calées à gauche pour ne jamais perdre la première). */}
      <div className="flex flex-col">
        <div className="flex flex-col items-center gap-1">
          <Ring kind="reel" done={view.done} total={view.total} size="lg" />
          <span className="text-sm font-bold">{name}</span>
          <span aria-hidden="true" className="progress-trunk h-5 w-0.5" />
        </div>
        <div className="overflow-x-auto pb-2">
          <ul className="progress-branches mx-auto flex w-max items-start" aria-label="Familles du projet">
            {finished.length === 0 ? null : (
              <li aria-label="Bâti" className="flex w-60 shrink-0 flex-col gap-2 px-2 pt-5">
                <Built families={finished} center />
              </li>
            )}
            {open.map((family) => (
              <li key={family.key} aria-label={family.title} className="flex w-60 shrink-0 flex-col gap-2 px-2 pt-5">
                <FamilyHead family={family} center />
                <Lots family={family} mode={mode} className="flex flex-col gap-2" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <StrayFolders view={view} mode={mode} />
    </div>
  )
}

const floorName = (level: number): string => (level === 0 ? 'Fondations' : `Étage ${level}`)

/** B — le chantier par étages : le bâti en fondations, en bas ; les familles ouvertes au-dessus, dans l'ordre. */
function FloorsReading({ view, mode }: { readonly view: Progression; readonly mode: ProgressMode }) {
  const { open, finished } = split(view, mode)
  // Sans rien de terminé, la première famille ouverte sert de fondations.
  const first = finished.length === 0 ? 0 : 1
  const floors = open.map((family, index) => ({ family, level: index + first })).reverse()
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2.5" aria-label="Étages du projet">
        {floors.map(({ family, level }) => (
          <li
            key={family.key}
            aria-label={`${floorName(level)} : ${family.title}`}
            className="progress-floor flex items-start gap-3 rounded-lg p-2.5"
          >
            <span className="w-20 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              {floorName(level)}
            </span>
            <div className="w-60 shrink-0">
              <FamilyHead family={family} />
            </div>
            <Lots
              family={family}
              mode={mode}
              className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2"
            />
          </li>
        ))}
        {finished.length === 0 ? null : (
          <li aria-label="Fondations : Bâti" className="progress-floor flex items-start gap-3 rounded-lg p-2.5">
            <span className="w-20 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
              Fondations
            </span>
            <div className="min-w-0 flex-1">
              <Built families={finished} />
            </div>
          </li>
        )}
      </ol>
      <StrayFolders view={view} mode={mode} />
    </div>
  )
}

/** C — les lots du Workflow : une colonne par famille, dans l'ordre du Workflow, avec son étape ; le hors plan dessous. */
function LotsReading({ view, mode }: { readonly view: Progression; readonly mode: ProgressMode }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3" aria-label="Lots du Workflow">
        {view.families
          .filter((family) => shown(mode, family.kind))
          .map((family) => {
            const stage = familyStage(family)
            return (
              <li
                key={family.key}
                aria-label={family.title}
                className="flex flex-col gap-2.5 rounded-xl bg-surface-raised p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${stage.tone}`}>
                    {stage.label}
                  </span>
                  <span className="line-clamp-2 text-[15px] font-bold leading-snug" title={family.title}>
                    {family.title}
                  </span>
                  <span className="text-xs text-content-muted">
                    {family.label} · {tasksText(family.done, family.total)}
                  </span>
                </div>
                <Lots family={family} mode={mode} className="flex flex-col gap-2" />
              </li>
            )
          })}
      </ul>
      <StrayFolders view={view} mode={mode} />
    </div>
  )
}

/**
 * Position « Progression » d'une carte de projet (spec 032 D12, D13, Q3, Q4, Q6) : où en est la construction, prévue
 * (la doc : les familles et les lots du Workflow) et réelle (l'analyse du code), en trois lectures au choix (gardé par
 * projet), avec la bascule Réel · Prévu · Les deux. Montée par-dessus la carte, comme l'Architecture ; ne fait que
 * refléter.
 */
export function ProgressionView({
  genesisId,
  name
}: {
  readonly genesisId: string
  readonly name: string
}): React.JSX.Element {
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
            // Pendant une première analyse, la carte du code est vide : rien n'est encore « réel » ni hors plan.
            map.data === undefined || map.data.files.length === 0
              ? null
              : {
                  // Le code seulement : un document ou un manifeste (`.md`, `.csproj`) n'est jamais hors plan.
                  files: map.data.files
                    .filter((entry) => entry.lang !== 'other')
                    .map((entry) => ({ path: entry.path, plumbing: entry.plumbing }))
                }
          ),
    [workflow.data, map.data]
  )
  const lots = view?.families.flatMap((family) => family.lots) ?? []
  const built = lots.filter((lot) => lot.kind === 'reel').length

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
        </div>
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
          <TreeReading view={view} mode={mode} name={name} />
        )}
      </div>
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-content-muted/20 px-4 py-2 text-xs text-content-muted">
        <span>
          <strong className="text-content">▭ Plein</strong> : dans le code, anneau et barre = tâches cochées
        </span>
        <span>
          <strong className="text-content">◌ Pointillé</strong> : prévu par la doc
        </span>
        <span className="text-action">
          <strong>⚠ Orange</strong> : hors plan
        </span>
        {view === null ? null : (
          <p className="ml-auto" aria-live="polite">
            {plural(built, 'lot')} bâti{built > 1 ? 's' : ''} · {lots.length - built} prévu
            {lots.length - built > 1 ? 's' : ''}
            {view.analysed ? ` · ${plural(view.strayCount, 'fichier')} hors plan` : ''}
          </p>
        )}
      </footer>
    </section>
  )
}
