import './progression.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PROGRESSION_READINGS, type ProgressionReading } from '@shared/brainstorms/viewState'
import type { ExplorerMapView } from '@shared/ipc/reprise'
import type { WorkflowView } from '@shared/ipc/workflow'
import {
  pathTo,
  progressionOf,
  type PartKind,
  type ProgressFamily,
  type ProgressLot,
  type ProgressionView as Progression
} from '@shared/workflow/progression'
import { useUiStore } from '../../app/uiStore'
import { useEffectiveSettings } from '../../app/useAppSettings'
import { call, IpcFailure } from '../../lib/ipc'
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference'
import { AnalyzeCodeForm, useCodeAnalysis } from '../../reprise/AnalyzeCode'
import { StructureViewSwitch } from '../nodes/StructureBarNode'
import { FoldPanelButton } from '../PanelFold'
import { useSidePanel } from '../side/sidePanelStore'
import { useWorkflowFold } from '../workflow/WorkflowCard'
import { roundNodeKey } from '../workflow/workflowTree'
import { ProgressionCanvas } from './ProgressionCanvas'

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

/** Étape d'une famille, d'après ses lots (lecture C, et briques des groupes). */
function familyStage(family: ProgressFamily): Stage {
  const { lots } = family
  if (family.later) return { label: '✦ Plus tard', tone: 'text-idea' }
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

/** Mène au Workflow, centré sur le rond de cette clé de l'arbre (Q8). */
type GoTo = (treeKey: string) => void

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

/** Un lot, cliquable. `bare` : la famille est ce lot (spec ou fichier de tâches sans L1), son titre est au-dessus. */
function Brick({ lot, mode, bare, goTo }: { lot: ProgressLot; mode: ProgressMode; bare: boolean; goTo: GoTo }) {
  if (!shown(mode, lot.kind)) return null
  const state = lot.kind === 'reel' ? 'bâti' : 'prévu'
  return (
    <li data-kind={lot.kind} aria-label={`${lot.title} : ${state}, ${tasksText(lot.done, lot.total)}`}>
      <button
        type="button"
        aria-label={`Voir les tâches de « ${lot.title} » dans le Workflow`}
        onClick={() => goTo(lot.key)}
        className="progress-brick flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left"
      >
        {bare ? null : <span className="text-[13px] font-semibold leading-snug">{lot.title}</span>}
        <span className="text-xs text-content-muted">
          {lot.kind === 'prevu' ? '◌ prévu · ' : ''}
          {stageOf(lot)} · {tasksText(lot.done, lot.total)}
        </span>
        <Bar done={lot.done} total={lot.total} />
      </button>
    </li>
  )
}

function Lots({
  family,
  mode,
  goTo,
  className
}: {
  family: ProgressFamily
  mode: ProgressMode
  goTo: GoTo
  className: string
}) {
  return (
    <ul className={className}>
      {family.lots.map((lot) => (
        <Brick key={lot.key} lot={lot} mode={mode} bare={lot.key === family.key} goTo={goTo} />
      ))}
    </ul>
  )
}

type RingTone = 'reel' | 'prevu' | 'built' | 'later'

/** Anneau à halo (matière organique, Q8) : plein = tâches cochées ; pointillé = prévu ; `count` : un groupe. */
function Ring({
  tone,
  done,
  total,
  size,
  count
}: {
  tone: RingTone
  done: number
  total: number
  size: 'md' | 'lg'
  count?: number
}) {
  const outer = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'
  const inner = size === 'lg' ? 'h-[4.5rem] w-[4.5rem] text-lg' : 'h-12 w-12 text-xs'
  if (tone === 'prevu' || tone === 'later') {
    return (
      <span
        aria-hidden="true"
        data-tone={tone}
        className={`progress-bud ${outer} flex shrink-0 items-center justify-center rounded-full border-2 border-dashed font-bold`}
      >
        {count ?? '—'}
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={`progress-ring ${outer} flex shrink-0 items-center justify-center rounded-full`}
      style={{ '--progress': `${percent(done, total)}%` } as React.CSSProperties}
    >
      <span className={`${inner} flex items-center justify-center rounded-full bg-surface font-extrabold`}>
        {total === 0 ? '—' : `${percent(done, total)} %`}
      </span>
    </span>
  )
}

function FamilyHead({ family, center, goTo }: { family: ProgressFamily; center: boolean; goTo: GoTo }) {
  const stage = familyStage(family)
  return (
    <button
      type="button"
      aria-label={`Voir « ${family.title} » dans le Workflow`}
      onClick={() => goTo(family.key)}
      className={`progress-head flex gap-2 rounded-xl p-1 ${center ? 'flex-col items-center text-center' : 'items-center text-left'}`}
    >
      <Ring tone={family.kind} done={family.done} total={family.total} size="md" />
      <span className={`flex min-w-0 flex-col gap-0.5 ${center ? 'items-center' : ''}`}>
        <span className={`text-[11px] font-bold uppercase tracking-wide ${stage.tone}`}>{stage.label}</span>
        <span className="line-clamp-2 text-sm font-bold" title={family.title}>
          {family.title}
        </span>
        <span className="text-xs text-content-muted">
          {family.label} · {tasksText(family.done, family.total)}
        </span>
      </span>
    </button>
  )
}

const GROUPS = {
  built: { title: '✔ Bâti', tone: 'text-pro', what: 'terminée' },
  later: { title: '✦ Plus tard', tone: 'text-idea', what: 'à brainstormer plus tard' }
} as const

/** Un groupe replié (Q7, Q8) : « ✔ Bâti » (les familles terminées) ou « ✦ Plus tard » (mises de côté). */
function Group({
  kind,
  families,
  center,
  goTo
}: {
  readonly kind: keyof typeof GROUPS
  readonly families: readonly ProgressFamily[]
  readonly center: boolean
  readonly goTo: GoTo
}) {
  const group = GROUPS[kind]
  const done = families.reduce((sum, family) => sum + family.done, 0)
  const total = families.reduce((sum, family) => sum + family.total, 0)
  const what = kind === 'built' && families.length > 1 ? 'terminées' : group.what
  return (
    <div className={`flex flex-col gap-2 ${center ? 'items-center text-center' : ''}`}>
      <div className={`flex gap-2 ${center ? 'flex-col items-center' : 'items-center'}`}>
        <Ring tone={kind} done={done} total={total} size="md" count={families.length} />
        <span className={`flex flex-col gap-0.5 ${center ? 'items-center' : ''}`}>
          <span className={`text-sm font-bold ${group.tone}`}>{group.title}</span>
          <span className="text-xs text-content-muted">
            {plural(families.length, 'famille')} {what}
            {kind === 'built' ? ` · ${tasksText(done, total)}` : ''}
          </span>
        </span>
      </div>
      <details className="w-full text-left">
        <summary className="cursor-pointer text-xs font-semibold text-accent">
          {families.length > 1 ? `Voir les ${families.length} familles` : 'Voir la famille'}
        </summary>
        <ul
          aria-label={kind === 'built' ? 'Familles terminées' : 'Familles à brainstormer plus tard'}
          className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-1.5"
        >
          {families.map((family) => {
            const stage = familyStage(family)
            return (
              <li
                key={family.key}
                data-kind={family.kind}
                aria-label={`${family.title} : ${stage.label}, ${tasksText(family.done, family.total)}`}
              >
                <button
                  type="button"
                  aria-label={`Voir « ${family.title} » dans le Workflow`}
                  onClick={() => goTo(family.key)}
                  className="progress-brick flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left"
                >
                  <span className="line-clamp-2 text-[13px] font-semibold leading-snug" title={family.title}>
                    {family.title}
                  </span>
                  <span className="text-[11px] text-content-muted">
                    {family.label} · {stage.label} · {tasksText(family.done, family.total)}
                  </span>
                  <Bar done={family.done} total={family.total} />
                </button>
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
    <section aria-label="Hors plan" className="progress-strays rounded-xl px-3 py-2 text-xs">
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

/** Familles ouvertes (montrées selon la bascule), terminées (« Bâti ») et mises de côté (« Plus tard »). */
function split(view: Progression, mode: ProgressMode) {
  return {
    open: view.families.filter((family) => !family.finished && !family.later && shown(mode, family.kind)),
    finished: view.families.filter((family) => family.finished),
    later: shown(mode, 'prevu') ? view.families.filter((family) => family.later) : []
  }
}

/** Largeur d'une branche de l'arbre (px) : les courbes partent du projet vers le milieu de chacune. */
const BRANCH = 240
const CURVE = 56

/** Une branche de l'arbre : sa sorte (le tracé de sa courbe) et son contenu. */
interface Branch {
  readonly key: string
  readonly tone: RingTone
  readonly label: string
  readonly body: React.JSX.Element
}

/** A — l'arbre qui pousse : le projet en haut, des courbes vers « Bâti », chaque famille ouverte, puis « Plus tard ». */
function TreeReading({
  view,
  mode,
  name,
  goTo,
  grow
}: {
  view: Progression
  mode: ProgressMode
  name: string
  goTo: GoTo
  grow: boolean
}) {
  const { open, finished, later } = split(view, mode)
  const branches: Branch[] = [
    ...(finished.length === 0
      ? []
      : [
          {
            key: 'bati',
            tone: 'built' as const,
            label: 'Bâti',
            body: <Group kind="built" families={finished} center goTo={goTo} />
          }
        ]),
    ...open.map((family) => ({
      key: family.key,
      tone: family.kind,
      label: family.title,
      body: (
        <>
          <FamilyHead family={family} center goTo={goTo} />
          <Lots family={family} mode={mode} goTo={goTo} className="flex flex-col gap-2" />
        </>
      )
    })),
    ...(later.length === 0
      ? []
      : [
          {
            key: 'later',
            tone: 'later' as const,
            label: 'Plus tard',
            body: <Group kind="later" families={later} center goTo={goTo} />
          }
        ])
  ]
  const width = Math.max(branches.length, 1) * BRANCH
  const middle = width / 2
  const curve = (index: number): string => {
    const x = index * BRANCH + BRANCH / 2
    return `M${middle} 0 C${middle} ${CURVE / 2} ${x} ${CURVE / 2} ${x} ${CURVE}`
  }
  return (
    <div className="flex flex-col gap-6" style={{ width }}>
      <div className="flex flex-col items-center gap-1.5">
        <Ring tone="reel" done={view.done} total={view.total} size="lg" />
        <span className="text-base font-bold">{name}</span>
      </div>
      <div>
        <svg aria-hidden="true" width={width} height={CURVE} className="block overflow-visible">
          {branches.map((branch, index) => (
            <path key={branch.key} d={curve(index)} className="progress-curve" data-tone={branch.tone} />
          ))}
        </svg>
        <ul className="flex items-start" aria-label="Familles du projet">
          {branches.map((branch, index) => (
            <li
              key={branch.key}
              aria-label={branch.label}
              className={`flex shrink-0 flex-col gap-2 px-2.5 pt-3 ${grow ? 'progress-grow' : ''}`}
              style={{ width: BRANCH, '--delay': `${index * 70}ms` } as React.CSSProperties}
            >
              {branch.body}
            </li>
          ))}
        </ul>
      </div>
      <StrayFolders view={view} mode={mode} />
    </div>
  )
}

const floorName = (level: number): string => (level === 0 ? 'Fondations' : `Étage ${level}`)
const FLOOR = 'progress-floor flex items-start gap-3 rounded-2xl p-3'
const FLOOR_NAME = 'w-20 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted'

/** B — le chantier par étages : « Plus tard » au sommet, les familles ouvertes au-dessus du bâti, en fondations. */
function FloorsReading({
  view,
  mode,
  goTo
}: {
  readonly view: Progression
  readonly mode: ProgressMode
  readonly goTo: GoTo
}) {
  const { open, finished, later } = split(view, mode)
  // Sans rien de terminé, la première famille ouverte sert de fondations.
  const first = finished.length === 0 ? 0 : 1
  const floors = open.map((family, index) => ({ family, level: index + first })).reverse()
  return (
    <div className="flex w-[64rem] flex-col gap-4">
      <ol className="flex flex-col gap-3" aria-label="Étages du projet">
        {later.length === 0 ? null : (
          <li aria-label="Plus tard" className={FLOOR}>
            <span className={FLOOR_NAME}>Plus tard</span>
            <div className="min-w-0 flex-1">
              <Group kind="later" families={later} center={false} goTo={goTo} />
            </div>
          </li>
        )}
        {floors.map(({ family, level }) => (
          <li key={family.key} aria-label={`${floorName(level)} : ${family.title}`} className={FLOOR}>
            <span className={FLOOR_NAME}>{floorName(level)}</span>
            <div className="w-64 shrink-0">
              <FamilyHead family={family} center={false} goTo={goTo} />
            </div>
            <Lots
              family={family}
              mode={mode}
              goTo={goTo}
              className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2"
            />
          </li>
        ))}
        {finished.length === 0 ? null : (
          <li aria-label="Fondations : Bâti" className={FLOOR}>
            <span className={FLOOR_NAME}>Fondations</span>
            <div className="min-w-0 flex-1">
              <Group kind="built" families={finished} center={false} goTo={goTo} />
            </div>
          </li>
        )}
      </ol>
      <StrayFolders view={view} mode={mode} />
    </div>
  )
}

/** C — les lots du Workflow : une colonne par famille, dans l'ordre du Workflow, avec son étape ; le hors plan dessous. */
function LotsReading({
  view,
  mode,
  goTo
}: {
  readonly view: Progression
  readonly mode: ProgressMode
  readonly goTo: GoTo
}) {
  return (
    <div className="flex w-[100rem] flex-col gap-4">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3" aria-label="Lots du Workflow">
        {view.families
          .filter((family) => shown(mode, family.kind))
          .map((family) => (
            <li
              key={family.key}
              aria-label={family.title}
              className="progress-column flex flex-col gap-2.5 rounded-2xl p-3"
            >
              <FamilyHead family={family} center={false} goTo={goTo} />
              <Lots family={family} mode={mode} goTo={goTo} className="flex flex-col gap-2" />
            </li>
          ))}
      </ul>
      <StrayFolders view={view} mode={mode} />
    </div>
  )
}

/**
 * Position « Progression » d'une carte de projet (spec 032 D12, D13, Q3, Q4, Q6, Q7, Q8) : où en est la construction,
 * prévue (la doc : les familles et les lots du Workflow) et réelle (l'analyse du code), en trois lectures au choix (gardé
 * par projet), avec la bascule Réel · Prévu · Les deux, sur un canevas (zoom, déplacement). Un clic mène au Workflow.
 * Montée par-dessus la carte, comme l'Architecture ; ne fait que refléter.
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
  const arriveInWorkflow = useUiStore((state) => state.arriveInWorkflow)
  const reduced = useReducedMotionPreference(useEffectiveSettings().motion)
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

  // Q8 : un clic mène au Workflow, centré sur le rond ; ce qui le cache (ancêtres repliés) et lui-même se déplient.
  const fold = useWorkflowFold(genesisId)
  const goTo = useCallback(
    (treeKey: string): void => {
      const data = workflow.data
      const key = roundNodeKey(genesisId, treeKey)
      if (data === undefined || key === null) return
      for (const node of pathTo(data.tree, treeKey)) {
        const nodeKey = roundNodeKey(genesisId, node.key)
        if (nodeKey === null) continue
        const collapsed = data.folded[nodeKey] ?? (node.total > 0 && node.done === node.total)
        if (collapsed) fold(nodeKey, false)
      }
      arriveInWorkflow(key)
      useSidePanel.getState().requestFocus(key)
    },
    [workflow.data, genesisId, fold, arriveInWorkflow]
  )

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
      {workflow.error !== null ? (
        <p role="alert" className="p-4 text-sm text-con">
          {workflow.error instanceof IpcFailure ? workflow.error.message : 'La doc du projet n’a pas pu être lue.'}
        </p>
      ) : view === null ? (
        <p className="p-4 text-sm text-content-muted">Chargement…</p>
      ) : (
        <ProgressionCanvas fitKey={`${reading}|${mode}|${view.families.length}|${view.analysed ? 'a' : ''}`}>
          {reading === 'etages' ? (
            <FloorsReading view={view} mode={mode} goTo={goTo} />
          ) : reading === 'lots' ? (
            <LotsReading view={view} mode={mode} goTo={goTo} />
          ) : (
            <TreeReading view={view} mode={mode} name={name} goTo={goTo} grow={!reduced} />
          )}
        </ProgressionCanvas>
      )}
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-content-muted/20 px-4 py-2 text-xs text-content-muted">
        <span>
          <strong className="text-content">Plein</strong> : dans le code, anneau et barre = tâches cochées
        </span>
        <span>
          <strong className="text-content">Pointillé</strong> : prévu par la doc
        </span>
        <span className="text-action">
          <strong>⚠ Orange</strong> : hors plan
        </span>
        <span>Molette : zoom · Glisser le fond : se déplacer · Clic : voir dans le Workflow</span>
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
