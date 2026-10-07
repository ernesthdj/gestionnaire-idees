import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PROBE_FAMILIES, type ProbeFamily } from '@shared/analyste/events'
import type { ObservationsPageView, ObservationView } from '@shared/ipc/analyste'
import { EVENT_LABELS, FAMILY_LABELS, SCREEN_LABELS, SUBJECT_LABELS, VIA_LABELS } from '../../analyste/labels'
import { Button } from '../../components/atoms/Button'
import { call } from '../../lib/ipc'

const PAGE = 50

/** Détail lisible d'une observation : jamais de contenu, seulement des types, des durées et des emplacements. */
function detailOf(item: ObservationView): string {
  const parts: string[] = []
  if (item.screen !== null) parts.push(SCREEN_LABELS[item.screen])
  if (item.subjectKind !== null) parts.push(SUBJECT_LABELS[item.subjectKind])
  if (item.subjectRef !== null) parts.push(`#${item.subjectRef.slice(0, 6)}`)
  if (item.via !== null) parts.push(`par ${VIA_LABELS[item.via]}`)
  if (item.channel !== null) parts.push(item.channel)
  if (item.code !== null) parts.push(item.code)
  if (item.frames.length > 0) parts.push(item.frames[0] ?? '')
  if (item.durationMs !== null) parts.push(`${item.durationMs} ms`)
  if (item.status === 'error') parts.push('échec')
  if (item.count > 1) parts.push(`×${item.count}`)
  return parts.join(' · ')
}

const time = (at: number): string =>
  new Date(at).toLocaleString('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

/** Ce que la sonde a gardé (spec 019 US1, E6) : tableau filtrable, compteurs, page suivante. */
export function ObservationsPage(): React.JSX.Element {
  const [family, setFamily] = useState<ProbeFamily | 'all'>('all')
  const [cursors, setCursors] = useState<readonly number[]>([])
  const cursor = cursors.at(-1)
  const query = useQuery({
    queryKey: ['analyste', 'observations', family, cursor],
    queryFn: () =>
      call<ObservationsPageView>('analyste:observations', {
        limit: PAGE,
        ...(family === 'all' ? {} : { family }),
        ...(cursor === undefined ? {} : { cursor })
      })
  })
  const page = query.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          Famille
          <select
            value={family}
            onChange={(event) => {
              setFamily(event.target.value as ProbeFamily | 'all')
              setCursors([])
            }}
            className="h-8 rounded-md border border-content-muted/40 bg-surface px-2 text-sm"
          >
            <option value="all">Toutes</option>
            {PROBE_FAMILIES.map((entry) => (
              <option key={entry} value={entry}>
                {FAMILY_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
        {page === undefined ? null : (
          <p className="text-sm text-content-muted">
            {PROBE_FAMILIES.map((entry) => `${FAMILY_LABELS[entry]} : ${page.totals[entry]}`).join(' · ')}
          </p>
        )}
      </div>
      {page === undefined ? (
        <p className="text-sm text-content-muted">Chargement…</p>
      ) : page.items.length === 0 ? (
        <p className="text-sm text-content-muted">Aucune observation pour l’instant.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Observations de la sonde, des plus récentes aux plus anciennes</caption>
          <thead className="text-content-muted">
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Quand
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Famille
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Événement
              </th>
              <th scope="col" className="py-1 font-medium">
                Détail
              </th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <tr key={item.id} className="border-t border-content-muted/10">
                <td className="py-1 pr-4 whitespace-nowrap tabular-nums">{time(item.at)}</td>
                <td className="py-1 pr-4">{FAMILY_LABELS[item.family]}</td>
                <td className="py-1 pr-4">{EVENT_LABELS[item.event] ?? item.event}</td>
                <td className="py-1 break-all text-content-muted">{detailOf(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-2">
        {cursors.length === 0 ? null : <Button onClick={() => setCursors(cursors.slice(0, -1))}>Plus récentes</Button>}
        {page?.next === null || page === undefined ? null : (
          <Button onClick={() => setCursors([...cursors, page.next ?? 0])}>Plus anciennes</Button>
        )}
      </div>
    </div>
  )
}
