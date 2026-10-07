import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { CodeCategory, ExplorerLinkView, ExplorerNodeDetailView } from '@shared/ipc/reprise'
import { CODE_CATEGORIES } from '@shared/ipc/reprise'
import { call, IpcFailure } from '../lib/ipc'
import { CodeExcerpt } from './CodeExcerpt'
import { CATEGORY_LABELS, KIND_LABELS, PROVENANCE_LABELS } from './labels'

type Tab = 'summary' | 'code'

const SOURCES: Readonly<Record<ExplorerNodeDetailView['categorySource'], string>> = {
  rules: 'proposée par les règles',
  claude: 'proposée par Claude',
  ollama: 'proposée par le modèle local',
  user: 'choisie par toi'
}

function Links({
  title,
  links,
  onGo
}: {
  readonly title: string
  readonly links: readonly ExplorerLinkView[]
  readonly onGo: (link: ExplorerLinkView) => void
}): React.JSX.Element {
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-semibold text-content-muted">
        {title} ({links.length === 50 ? '50 et plus' : links.length})
      </h3>
      {links.length === 0 ? (
        <p className="text-xs text-content-muted">aucun dans le projet</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {links.map((link, index) => (
            <li key={`${link.key}-${index}`} className="flex items-baseline gap-2 text-xs">
              <span aria-hidden="true" title={PROVENANCE_LABELS[link.provenance].text}>
                {PROVENANCE_LABELS[link.provenance].mark}
              </span>
              <button type="button" className="min-w-0 truncate text-left underline" onClick={() => onGo(link)}>
                {link.title}
              </button>
              <span className="shrink-0 text-content-muted">
                {PROVENANCE_LABELS[link.provenance].text}
                {link.reason === null ? '' : ` — ${link.reason}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Panneau de l'élément sélectionné (spec 017 US2, L4d E4 38 %) : ce que c'est (analogie du module si le guide l'a
 * produite), sa catégorie et d'où elle vient, qui l'appelle et qui il appelle, et son code en lecture seule.
 */
export function NodePanel({
  genesisId,
  nodeKey,
  onGo,
  onOpen
}: {
  readonly genesisId: string
  readonly nodeKey: string
  /** Ouvrir l'élément lié (appelant / appelé) : son fichier dans le volet de code (D16). */
  readonly onGo: (link: ExplorerLinkView) => void
  /** Ouvrir le niveau qui contient l'élément, ou ses enfants. */
  readonly onOpen: (parentKey: string, select: string) => void
}): React.JSX.Element {
  const client = useQueryClient()
  const [tab, setTab] = useState<Tab>('summary')
  const [problem, setProblem] = useState<string | null>(null)
  const ids = { title: useId(), category: useId() }
  const query = useQuery({
    queryKey: ['explorer', genesisId, 'node', nodeKey],
    queryFn: () => call<ExplorerNodeDetailView>('explorer:node', { genesisId, nodeKey })
  })
  const detail = query.data
  const symbolId = nodeKey.startsWith('s:') ? nodeKey.slice(2) : null

  const changeCategory = async (category: CodeCategory): Promise<void> => {
    if (symbolId === null) return
    setProblem(null)
    try {
      await call('reprise:setCategory', { genesisId, symbolId, category })
      await client.invalidateQueries({ queryKey: ['explorer', genesisId] })
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'La catégorie n’a pas pu être changée.')
    }
  }

  if (detail === undefined) {
    return (
      <p className="p-4 text-sm text-content-muted">
        {query.error instanceof IpcFailure ? query.error.message : 'Lecture de l’élément…'}
      </p>
    )
  }
  const category = CATEGORY_LABELS[detail.category]
  return (
    <section aria-labelledby={ids.title} className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 text-sm">
      <header>
        <p className="text-xs text-content-muted">
          <span aria-hidden="true">{KIND_LABELS[detail.kind].icon}</span> {KIND_LABELS[detail.kind].text}
          {detail.lang === null || detail.lang === 'other' ? '' : ` · ${detail.lang}`}
          {detail.lines === null ? '' : ` · ${detail.lines} lignes`}
        </p>
        <h2 id={ids.title} className="truncate text-base font-semibold" title={detail.title}>
          {detail.title}
        </h2>
        {detail.path === null ? null : <p className="truncate text-xs text-content-muted">{detail.path}</p>}
      </header>

      <div role="tablist" aria-label="Contenu du panneau" className="flex gap-1">
        {(['summary', 'code'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            disabled={value === 'code' && symbolId === null}
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1 text-xs disabled:opacity-40 ${
              tab === value ? 'bg-surface-raised font-semibold' : 'text-content-muted'
            }`}
          >
            {value === 'summary' ? 'Résumé' : 'Code'}
          </button>
        ))}
      </div>

      {tab === 'code' && symbolId !== null ? (
        <CodeExcerpt genesisId={genesisId} symbolId={symbolId} />
      ) : (
        <>
          {detail.analogy === null && detail.summary === null ? null : (
            <section aria-label="En une image" className="rounded-lg bg-surface-raised p-3">
              {detail.analogy === null ? null : <p className="italic">« {detail.analogy} »</p>}
              {detail.summary === null ? null : <p className="mt-1">{detail.summary}</p>}
            </section>
          )}
          {detail.error === null ? null : (
            <p role="alert" className="text-con">
              Non analysé : {detail.error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${category.tone}`}>
              <span aria-hidden="true">{category.icon}</span> {category.text}
            </span>
            <span className="text-xs text-content-muted">{SOURCES[detail.categorySource]}</span>
            {symbolId === null ? null : (
              <>
                <label htmlFor={ids.category} className="sr-only">
                  Corriger la catégorie
                </label>
                <select
                  id={ids.category}
                  value={detail.category}
                  onChange={(event) => void changeCategory(event.target.value as CodeCategory)}
                  className="h-7 rounded-md bg-surface-raised px-1 text-xs"
                >
                  {CODE_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_LABELS[value].text}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          {problem === null ? null : (
            <p role="alert" className="text-xs text-con">
              {problem}
            </p>
          )}
          <Links title="Qui l’appelle" links={detail.callers} onGo={onGo} />
          <Links title="Ce qu’il appelle" links={detail.callees} onGo={onGo} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="text-xs underline" onClick={() => onOpen(detail.parentKey, detail.key)}>
              Le montrer sur la carte
            </button>
          </div>
        </>
      )}
    </section>
  )
}
