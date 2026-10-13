import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { ExtractPreviewView } from '@shared/git/extract'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’extraction a échoué.')
const VERDICTS: Readonly<Record<ExtractPreviewView['license']['verdict'], string>> = {
  permise: '✓ copie permise',
  reciprocite: '⚠ copie permise avec réciprocité',
  inconnue: '✕ licence inconnue : note d’étude seulement'
}
/** Nom proposé : celui du fichier, ou sa note d'étude (`.md`). */
const nameFor = (path: string, note: boolean): string => {
  const name = (path.split('/').at(-1) ?? 'extrait').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 90) || 'extrait'
  return note ? `${name.replace(/\.[^.]+$/, '')}.etude.md` : name
}

/**
 * Extraire un morceau (spec 021 US7, L4g E8) : la licence s'affiche avant toute copie ; une licence qui le permet
 * propose la copie avec son en-tête d'attribution (montré), sinon seulement une note d'étude ; la destination est un
 * dossier de `snippets/` ou `techno/` du workspace. Rien n'est commité ni exécuté.
 */
export function ExtractDialog({
  genesisId,
  path,
  lineCount,
  onClose
}: {
  readonly genesisId: string
  readonly path: string
  readonly lineCount: number
  readonly onClose: () => void
}): React.JSX.Element {
  const ids = { from: useId(), to: useId(), root: useId(), folder: useId(), name: useId() }
  const [range, setRange] = useState<{ readonly from: number; readonly to: number } | null>(null)
  const preview = useQuery({
    queryKey: ['extract', genesisId, path, range],
    queryFn: () =>
      call<ExtractPreviewView>('git:extractPreview', { genesisId, path, ...(range === null ? {} : { lines: range }) }),
    retry: false
  })
  const view = preview.data
  const [mode, setMode] = useState<'copy' | 'study_note' | null>(null)
  const chosen = mode ?? (view?.studyNoteOnly === false ? 'copy' : 'study_note')
  const [root, setRoot] = useState<'snippets' | 'techno'>('snippets')
  const [folder, setFolder] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const name = fileName ?? nameFor(path, chosen === 'study_note')
  const extract = useMutation({
    mutationFn: () =>
      call<{ readonly written: string }>('git:extract', {
        genesisId,
        path,
        root,
        folder,
        fileName: name,
        mode: chosen,
        confirm: true,
        ...(range === null ? {} : { lines: range })
      })
  })
  const error = preview.error ?? extract.error
  const folders = view?.destinations.find((entry) => entry.root === root)?.folders ?? []
  return (
    <section
      aria-label="Extraire ce fichier"
      className="flex flex-col gap-2 rounded-md border border-accent/40 p-2 text-xs"
    >
      <div className="flex items-center gap-2">
        <p className="flex-1 font-semibold">Extraire {path}</p>
        <button type="button" aria-label="Fermer l’extraction" className="detail-card-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Partie du fichier</legend>
        <label className="flex items-center gap-1">
          <input type="radio" checked={range === null} onChange={() => setRange(null)} />
          Tout le fichier
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={range !== null}
            onChange={() => setRange({ from: 1, to: Math.max(1, lineCount) })}
          />
          Lignes
        </label>
        {range === null ? null : (
          <>
            <label htmlFor={ids.from} className="sr-only">
              Première ligne
            </label>
            <input
              id={ids.from}
              type="number"
              min={1}
              max={lineCount}
              value={range.from}
              onChange={(event) => setRange({ ...range, from: Number(event.target.value) || 1 })}
              className="h-7 w-16 rounded-md bg-surface-raised px-1"
            />
            à
            <label htmlFor={ids.to} className="sr-only">
              Dernière ligne
            </label>
            <input
              id={ids.to}
              type="number"
              min={1}
              max={lineCount}
              value={range.to}
              onChange={(event) => setRange({ ...range, to: Number(event.target.value) || 1 })}
              className="h-7 w-16 rounded-md bg-surface-raised px-1"
            />
          </>
        )}
      </fieldset>
      {view === undefined ? (
        <p className="text-content-muted">{error === null ? 'Lecture de la licence…' : ''}</p>
      ) : extract.data !== undefined ? (
        <p role="status">Écrit dans le workspace : {extract.data.written} (ni commité ni lancé).</p>
      ) : (
        <>
          <p role="status">
            Licence : <span className="font-semibold">{view.license.spdx ?? 'inconnue'}</span> —{' '}
            {VERDICTS[view.license.verdict]}. {view.license.summary}
          </p>
          <p className="text-content-muted">
            Origine : {view.origin} · commit {view.commit.slice(0, 7)}
          </p>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">Ce qui est écrit</legend>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={chosen === 'copy'}
                disabled={view.studyNoteOnly}
                onChange={() => {
                  setMode('copy')
                  setFileName(null)
                }}
              />
              Copier avec l’en-tête d’attribution
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={chosen === 'study_note'}
                onChange={() => {
                  setMode('study_note')
                  setFileName(null)
                }}
              />
              Note d’étude (sans le code)
            </label>
          </fieldset>
          {chosen === 'copy' && view.header !== '' ? (
            <pre
              aria-label="En-tête d’attribution"
              className="overflow-x-auto rounded-md bg-surface-raised p-2 text-[11px]"
            >
              {view.header}
            </pre>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={ids.root}>Dans</label>
            <select
              id={ids.root}
              value={root}
              onChange={(event) => setRoot(event.target.value as 'snippets' | 'techno')}
              className="h-7 rounded-md bg-surface-raised px-1"
            >
              <option value="snippets">snippets/</option>
              <option value="techno">techno/</option>
            </select>
            <label htmlFor={ids.folder} className="sr-only">
              Dossier
            </label>
            <input
              id={ids.folder}
              list={`${ids.folder}-liste`}
              value={folder}
              maxLength={40}
              placeholder="dossier (ex. auth)"
              onChange={(event) => setFolder(event.target.value.toLowerCase())}
              className="h-7 w-32 rounded-md bg-surface-raised px-2"
            />
            <datalist id={`${ids.folder}-liste`}>
              {folders.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
            <label htmlFor={ids.name} className="sr-only">
              Nom du fichier
            </label>
            <input
              id={ids.name}
              value={name}
              maxLength={100}
              onChange={(event) => setFileName(event.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md bg-surface-raised px-2 font-mono"
            />
          </div>
          <Button
            variant="primary"
            className="self-start"
            disabled={!/^[a-z0-9-]{1,40}$/.test(folder) || extract.isPending}
            onClick={() => extract.mutate()}
          >
            {chosen === 'copy' ? 'Copier dans le workspace' : 'Écrire la note d’étude'}
          </Button>
        </>
      )}
      {error === null ? null : (
        <p role="alert" className="text-con">
          {errorText(error)}
        </p>
      )}
    </section>
  )
}
