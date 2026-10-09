import { useEffect } from 'react'
import { create } from 'zustand'
import type { RunOutputEvent, RunView } from '@shared/run/run'
import { call } from '../lib/ipc'

/** Lignes gardées par onglet (comme le main, spec 025 D4). */
const MAX_LINES = 2_000

/** Séquences ANSI (couleurs, curseur) retirées à l'affichage (D4). */
// eslint-disable-next-line no-control-regex -- les séquences ANSI commencent par le caractère ESC
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g
export const stripAnsi = (text: string): string => text.replace(ANSI, '')

interface RunsState {
  readonly runs: readonly RunView[]
  readonly activeId: string | null
  readonly open: boolean
  setAll(runs: readonly RunView[]): void
  upsert(view: RunView): void
  append(event: RunOutputEvent): void
  remove(runId: string): void
  show(runId: string): void
  toggle(open?: boolean): void
}

const bounded = (text: string): string => {
  const lines = text.split(/(?<=\n)/)
  return lines.length > MAX_LINES ? lines.slice(-MAX_LINES).join('') : text
}

/** Lancements de projets (spec 025) : état et sortie de chaque onglet du panneau. */
export const useRuns = create<RunsState>()((set) => ({
  runs: [],
  activeId: null,
  open: false,
  setAll: (runs) => set({ runs: runs.map((run) => ({ ...run, output: stripAnsi(run.output) })) }),
  upsert: (view) =>
    set((state) => {
      const known = state.runs.find((run) => run.runId === view.runId)
      const next = { ...view, output: known?.output ?? stripAnsi(view.output) }
      return known === undefined
        ? { runs: [...state.runs, next], activeId: view.runId, open: true }
        : { runs: state.runs.map((run) => (run.runId === view.runId ? next : run)) }
    }),
  append: ({ runId, chunk }) =>
    set((state) => ({
      runs: state.runs.map((run) =>
        run.runId === runId ? { ...run, output: bounded(run.output + stripAnsi(chunk)) } : run
      )
    })),
  remove: (runId) =>
    set((state) => {
      const runs = state.runs.filter((run) => run.runId !== runId)
      return {
        runs,
        activeId: state.activeId === runId ? (runs.at(-1)?.runId ?? null) : state.activeId,
        open: runs.length > 0 && state.open
      }
    }),
  show: (runId) => set({ activeId: runId, open: true }),
  toggle: (open) => set((state) => ({ open: open ?? !state.open }))
}))

const isView = (payload: unknown): payload is RunView =>
  typeof payload === 'object' && payload !== null && typeof (payload as RunView).runId === 'string'
const isOutput = (payload: unknown): payload is RunOutputEvent =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as RunOutputEvent).runId === 'string' &&
  typeof (payload as RunOutputEvent).chunk === 'string'

/** Suit les lancements partout dans l'app ; relit ceux en cours après un rechargement de l'interface. */
export function useRunEvents(): void {
  useEffect(() => {
    void call<RunView[]>('run:list')
      .then((runs) => useRuns.getState().setAll(runs))
      .catch(() => undefined)
    const stops = [
      window.api.on('run:changed', (payload) => {
        if (isView(payload)) useRuns.getState().upsert(payload)
      }),
      window.api.on('run:output', (payload) => {
        if (isOutput(payload)) useRuns.getState().append(payload)
      })
    ]
    return () => stops.forEach((stop) => stop())
  }, [])
}
