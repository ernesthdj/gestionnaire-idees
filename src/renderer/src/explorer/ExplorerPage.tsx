import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CodeLang, ExplorerLinkView, ExplorerPlaceView, MapFileView } from '@shared/ipc/reprise'
import type { ExplorerMarks } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'
import { ConfidentialityBadge } from '../reprise/ConfidentialityBadge'
import { BoxActionsContext } from './boxes/BoxNodes'
import { BoxList } from './boxes/BoxList'
import { BoxMap } from './boxes/BoxMap'
import { shownBoxes, shownKeys } from './boxes/boxLayout'
import { useBoxMap } from './boxes/useBoxMap'
import { MarksKindContext, ReplayMarksContext } from './ExplorerNodes'
import { FilePanel, type OpenFile } from './FilePanel'
import { GuidePanel } from './GuidePanel'
import { LAYER_LABELS, PROVENANCE_LABELS } from './labels'
import { NodePanel } from './NodePanel'
import { ReplayBar } from './ReplayBar'
import { UpdatesBar } from './UpdatesBar'
import { ResolveLinks } from './ResolveLinks'
import { useExplorer } from './useExplorer'
import { useReplay } from './useReplay'
import { useUpdatesMarks } from './useUpdatesMarks'

const CODE_CATEGORIES_SHOWN = ['domain', 'orchestration', 'infrastructure'] as const

/**
 * Explorateur d'un projet repris (spec 031, qui remplace l'explorateur à paliers de la spec 017 D16) : la carte en
 * boîtes (62 %) et le panneau de droite (38 %) — élément choisi, code du fichier, guide de reprise ; analyse,
 * confidentialité, recherche, filtres (plomberie, langage), vue liste équivalente, rediffusion et nouveautés.
 */
export function ExplorerPage({
  genesisId,
  marks: marksAtOpen = null,
  onClose
}: {
  readonly genesisId: string
  /**
   * Marques à l'ouverture : rediffusion (« Rejouer sur la carte » de l'onglet Historique, spec 021 US5) ou nouveautés
   * depuis la dernière visite (« Voir sur la carte », T030).
   */
  readonly marks?: ExplorerMarks | null
  readonly onClose: () => void
}): React.JSX.Element {
  const explorer = useExplorer(genesisId)
  const map = useBoxMap(genesisId)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [caption, setCaption] = useState<string | null>(null)
  // Filtres retenus (spec 031 D12c) : la plomberie (masquée par défaut) et un langage.
  const hidePlumbing = !explorer.filters.categories.includes('plumbing')
  const lang = (explorer.filters.langs[0] as CodeLang | undefined) ?? null
  const shown = useMemo(
    () => (map.data === undefined ? null : shownBoxes(map.data, hidePlumbing, lang)),
    [map.data, hidePlumbing, lang]
  )
  const [marksShown, setMarksShown] = useState<ExplorerMarks | null>(marksAtOpen)
  const replaying = marksShown === 'replay'
  const visibleKeys = useMemo(() => (shown === null ? [] : shownKeys(shown, open)), [shown, open])
  const replay = useReplay(genesisId, replaying, visibleKeys)
  const updates = useUpdatesMarks(genesisId, marksShown === 'updates', visibleKeys)
  const quitMarks = useCallback(() => setMarksShown(null), [])
  const ids = { title: useId(), search: useId(), lang: useId() }
  const [list, setList] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    readonly (ExplorerPlaceView & { readonly key: string; readonly title: string; readonly where: string })[]
  >([])
  const project = explorer.project
  const [aside, setAside] = useState<'element' | 'code' | 'guide'>('element')
  const [file, setFile] = useState<OpenFile | null>(null)
  const guideId = project?.guide.documentId ?? null
  // Un guide qui vient d'exister (rédigé après la première analyse) s'ouvre dans le panneau (spec 017 US4).
  const knownGuide = useRef<string | null>(null)
  useEffect(() => {
    if (knownGuide.current === null && guideId !== null) setAside('guide')
    knownGuide.current = guideId
  }, [guideId])

  const select = (key: string | null): void => {
    explorer.select(key)
    if (key !== null) setAside('element')
  }
  // Fichier montré dans le volet ; `show` : passer sur l'onglet « Code » (pas depuis le guide).
  const openFile = (next: OpenFile, show = true): void => {
    setFile(next)
    if (show) setAside('code')
  }
  const moduleOfPath = (path: string): string | null =>
    map.data?.files.find((entry) => entry.path === path)?.moduleKey ?? null
  // Un fichier lu ou cherché : son module s'ouvre sur la carte et le fichier y est choisi.
  const reveal = (path: string): void => {
    const moduleKey = moduleOfPath(path)
    if (moduleKey !== null) setOpen((current) => new Set([...current, moduleKey]))
    explorer.select(`f:${path}`)
  }
  const toggleModule = (key: string): void => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    select(key)
  }
  const pickFile = (entry: MapFileView): void => {
    explorer.select(entry.key)
    openFile({ path: entry.path, line: null, symbolId: null })
  }
  const closeAll = (): void => {
    setOpen(new Set())
    explorer.select(null)
  }
  const goTo = (place: ExplorerPlaceView, show = true): void => {
    if (place.path === null) return
    reveal(place.path)
    openFile({ path: place.path, line: null, symbolId: place.symbolId }, show)
  }
  const linkGo = (link: ExplorerLinkView): void => {
    if (link.path !== null) {
      openFile({ path: link.path, line: null, symbolId: link.key.startsWith('s:') ? link.key.slice(2) : null })
    }
  }

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      call<{ readonly results: typeof results }>('explorer:search', { genesisId, query: trimmed })
        .then((found) => setResults(found.results))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, genesisId])

  const setHidePlumbing = (hide: boolean): void =>
    explorer.setFilters({
      ...explorer.filters,
      categories: hide ? [...CODE_CATEGORIES_SHOWN] : [...CODE_CATEGORIES_SHOWN, 'plumbing']
    })

  const analysis = project?.analysis
  const neverAnalyzed = analysis !== undefined && analysis.analyzedAt === null && analysis.state !== 'running'
  const folderMissing = map.data?.folderMissing === true
  const problem = map.error instanceof Error ? map.error.message : explorer.problem
  const fileCount = shown === null ? 0 : [...shown.filesOf.values()].reduce((sum, files) => sum + files.length, 0)
  return (
    <section aria-labelledby={ids.title} className="flex h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-content-muted/20 px-4 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onClose}>← Carte</Button>
          <h2 id={ids.title} className="text-base font-semibold">
            Explorateur · {project?.name ?? '…'}
          </h2>
          {project === undefined ? null : (
            <ConfidentialityBadge genesisId={genesisId} level={project.confidentiality} onChanged={() => undefined} />
          )}
          <div className="ml-auto flex items-center gap-2">
            {explorer.progress !== null ? (
              <>
                <p role="status" className="text-xs">
                  Analyse en cours…
                  {explorer.progress.total === 0
                    ? ''
                    : ` ${explorer.progress.done} / ${explorer.progress.total} fichiers`}
                </p>
                <Button onClick={explorer.cancelAnalysis}>Annuler</Button>
              </>
            ) : (
              <Button onClick={() => void explorer.analyze()} disabled={folderMissing}>
                {neverAnalyzed ? 'Analyser' : 'Réanalyser'}
              </Button>
            )}
            {project === undefined || explorer.progress !== null ? null : (
              <ResolveLinks
                genesisId={genesisId}
                resolution={project.resolution}
                confidentiality={project.confidentiality}
                disabled={project.analysis.analyzedAt === null || folderMissing}
              />
            )}
            <Button
              onClick={() => setMarksShown((current) => (current === 'replay' ? null : 'replay'))}
              aria-pressed={replaying}
            >
              Rediffusion
            </Button>
            <Button onClick={() => setList((current) => !current)} aria-pressed={list}>
              {list ? 'Vue carte' : 'Vue liste'}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <details className="relative">
            <summary className="cursor-pointer rounded-md border border-content-muted/40 px-2 py-0.5">Filtres</summary>
            <div className="absolute z-20 mt-1 flex w-56 flex-col gap-2 rounded-md border border-content-muted/30 bg-surface p-2 shadow-lg">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hidePlumbing} onChange={() => setHidePlumbing(!hidePlumbing)} />
                Masquer la plomberie
              </label>
              <label htmlFor={ids.lang} className="flex flex-col gap-1">
                Langage
                <select
                  id={ids.lang}
                  value={lang ?? ''}
                  onChange={(event) =>
                    explorer.setFilters({
                      ...explorer.filters,
                      langs: event.target.value === '' ? [] : [event.target.value as CodeLang]
                    })
                  }
                  className="h-7 rounded-md bg-surface-raised px-1"
                >
                  <option value="">Tous les langages</option>
                  <option value="ts">TypeScript</option>
                  <option value="tsx">TypeScript (JSX)</option>
                  <option value="js">JavaScript</option>
                  <option value="cs">C#</option>
                  <option value="php">PHP</option>
                </select>
              </label>
            </div>
          </details>
          {shown === null ? null : (
            <p className="text-content-muted" aria-live="polite">
              {shown.modules.length} module{shown.modules.length > 1 ? 's' : ''} · {fileCount} fichier
              {fileCount > 1 ? 's' : ''}
              {map.data?.truncated === true ? ' · carte tronquée (projet très grand)' : ''}
            </p>
          )}
          <div className="relative ml-auto">
            <label htmlFor={ids.search} className="sr-only">
              Rechercher un élément
            </label>
            <input
              id={ids.search}
              type="search"
              value={query}
              maxLength={100}
              placeholder="Rechercher un fichier, une classe…"
              onChange={(event) => setQuery(event.target.value)}
              className="h-7 w-64 rounded-md bg-surface-raised px-2"
            />
            {results.length === 0 ? null : (
              <ul
                aria-label="Résultats de la recherche"
                className="absolute right-0 z-10 mt-1 max-h-72 w-96 overflow-y-auto rounded-md bg-surface p-1 shadow-lg"
              >
                {results.map((result) => (
                  <li key={result.key}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left hover:bg-surface-raised"
                      onClick={() => {
                        goTo(result)
                        setQuery('')
                      }}
                    >
                      <span className="font-semibold">{result.title}</span>{' '}
                      <span className="text-content-muted">{result.where}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {folderMissing ? (
          <p role="alert" className="text-xs text-con">
            Le dossier du projet est introuvable (déplacé ou supprimé ?) : la dernière analyse reste lisible.
          </p>
        ) : null}
        {neverAnalyzed ? (
          <p role="status" className="text-xs">
            Ce projet n’a pas encore été analysé : lance « Analyser ».
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 basis-[62%] flex-col">
          <div className="min-h-0 flex-1">
            {problem !== null ? (
              <p role="alert" className="p-4 text-sm text-con">
                {problem}
              </p>
            ) : shown === null || map.data === undefined ? (
              <p className="p-4 text-sm text-content-muted">Chargement…</p>
            ) : list ? (
              <BoxList
                shown={shown}
                selected={explorer.selected}
                openPath={file?.path ?? null}
                onModule={(key) => select(key)}
                onFile={pickFile}
              />
            ) : (
              <BoxActionsContext.Provider value={{ pickFile, openPath: file?.path ?? null }}>
                <MarksKindContext.Provider value={marksShown ?? 'replay'}>
                  <ReplayMarksContext.Provider
                    value={marksShown === 'replay' ? replay.marks : marksShown === 'updates' ? updates.marks : null}
                  >
                    <ReactFlowProvider>
                      <BoxMap
                        map={map.data}
                        shown={shown}
                        open={open}
                        selected={explorer.selected}
                        onModule={toggleModule}
                        onFile={pickFile}
                        onCloseAll={closeAll}
                        onCaption={setCaption}
                      />
                    </ReactFlowProvider>
                  </ReplayMarksContext.Provider>
                </MarksKindContext.Provider>
              </BoxActionsContext.Provider>
            )}
          </div>
          {list ? null : (
            <p role="status" className="min-h-9 border-t border-content-muted/20 px-4 py-2 text-xs text-content-muted">
              {caption ??
                'Clic : ouvrir un module · clic dans le vide : refermer · survol d’un trait : l’appel en mots'}
            </p>
          )}
        </div>
        <aside
          aria-label={aside === 'guide' ? 'Guide de reprise' : aside === 'code' ? 'Code du fichier' : 'Élément choisi'}
          className={`flex min-w-0 flex-col border-l border-content-muted/20 ${
            aside === 'code' ? 'basis-[50%]' : 'basis-[38%]'
          }`}
        >
          <div
            role="tablist"
            aria-label="Panneau de droite"
            className="flex gap-1 border-b border-content-muted/20 px-4 py-2"
          >
            {(['element', 'code', 'guide'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={aside === value}
                disabled={value === 'code' && file === null}
                onClick={() => setAside(value)}
                className={`max-w-[50%] truncate rounded-md px-3 py-1 text-xs disabled:opacity-40 ${
                  aside === value ? 'bg-surface-raised font-semibold' : 'text-content-muted'
                }`}
              >
                {value === 'element'
                  ? 'Élément'
                  : value === 'guide'
                    ? 'Guide de reprise'
                    : file === null
                      ? 'Code'
                      : `Code · ${file.path.split('/').at(-1) ?? ''}`}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {aside === 'guide' && project !== undefined ? (
              <GuidePanel
                genesisId={genesisId}
                guide={project.guide}
                analyzed={project.analysis.analyzedAt !== null}
                onLocate={(place) => goTo(place, false)}
              />
            ) : aside === 'code' && file !== null ? (
              <FilePanel
                genesisId={genesisId}
                file={file}
                onOpenFile={openFile}
                onPlaced={(place) => place.path !== null && reveal(place.path)}
              />
            ) : explorer.selected === null ? (
              <div className="flex flex-col gap-2 p-4 text-sm text-content-muted">
                <p>Choisis un module pour voir à quoi il sert, qui l’appelle et ce qu’il appelle.</p>
                <p>Un clic ouvre le module sur place ; un clic sur un de ses fichiers ouvre son code ici.</p>
              </div>
            ) : (
              <NodePanel
                genesisId={genesisId}
                nodeKey={explorer.selected}
                onGo={linkGo}
                onOpen={(_parentKey, key) => (key === null ? undefined : reveal(key.replace(/^f:/, '')))}
              />
            )}
          </div>
        </aside>
      </div>

      {replaying ? (
        <ReplayBar
          replay={replay}
          selected={explorer.selected === null ? undefined : (replay.marks.get(explorer.selected) ?? null)}
          selectedTitle={
            map.data?.modules.find((module) => module.key === explorer.selected)?.title ??
            map.data?.files.find((entry) => entry.key === explorer.selected)?.title ??
            null
          }
          onQuit={quitMarks}
        />
      ) : marksShown === 'updates' ? (
        <UpdatesBar updates={updates} onQuit={quitMarks} />
      ) : null}
      <details className="border-t border-content-muted/20 px-4 py-1 text-xs">
        <summary className="cursor-pointer">Légende</summary>
        <p className="py-1">
          {Object.values(LAYER_LABELS)
            .map((layer) => `${layer.text} : ${layer.hint}`)
            .join(' · ')}
        </p>
        <p className="pb-1">
          {Object.values(PROVENANCE_LABELS)
            .filter((entry, index, all) => all.findIndex((other) => other.text === entry.text) === index)
            .map((entry) => `${entry.mark} ${entry.text}`)
            .join(' · ')}{' '}
          · la flèche va de celui qui demande vers celui qui fait · épaisseur = nombre d’appels · en accent : appels
          entre fichiers d’un même module
        </p>
      </details>
    </section>
  )
}
