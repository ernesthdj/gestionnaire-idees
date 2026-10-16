import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChatToolFileView, ToolPatch } from '@shared/ipc/chat'
import { highlight, splitHighlightLines, type HighlightNode } from '../lib/highlight'
import { Highlighted } from '../lib/Highlighted'
import { call, IpcFailure } from '../lib/ipc'
import { SourceCode } from '../lib/SourceCode'
import { Markdown } from './Markdown'

type Tab = 'change' | 'formatted' | 'file'

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  change: 'Modification',
  formatted: 'Mis en forme',
  file: 'Fichier'
}

/** Raison pour laquelle le contenu actuel n'est pas affiché ; `null` s'il l'est. */
function unreadable(file: ChatToolFileView): string | null {
  if (file.outside) return 'Ce fichier est hors des dossiers de la conversation : son contenu n’est pas affiché.'
  if (file.refused)
    return 'Fichier protégé (sensible, binaire ou lien qui sort du projet) : son contenu n’est pas affiché.'
  if (file.missing) return 'Ce fichier n’existe plus.'
  if (file.tooBig) return 'Fichier trop volumineux pour la fenêtre (plus de 1 Mo).'
  if (file.binary) return 'Ce fichier n’est pas un fichier texte.'
  return null
}

/**
 * Fenêtre d'une pastille de fichier du chat (spec 014 D9) : la modification faite par cet outil (retiré en rouge,
 * ajouté en vert, signes − / + et numéros de ligne, comme sur GitHub), le fichier actuel coloré, sa mise en forme pour
 * un `.md`. Lecture seule ; Échap ou × ferme.
 */
export function ToolFileDialog({
  neuronId,
  messageId,
  title,
  onClose
}: {
  readonly neuronId: string
  readonly messageId: string
  /** Titre de la pastille (« fichier modifié : a.ts »), affiché pendant le chargement. */
  readonly title: string
  readonly onClose: () => void
}): React.JSX.Element {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const query = useQuery({
    queryKey: ['chat', neuronId, 'toolFile', messageId],
    queryFn: () => call<ChatToolFileView>('chat:toolFile', { neuronId, messageId })
  })
  const file = query.data
  const isMarkdown = file !== undefined && /\.md$/i.test(file.path)
  const tabs: Tab[] =
    file === undefined
      ? []
      : [
          ...(file.change === null ? [] : (['change'] as const)),
          ...(isMarkdown && file.current !== null ? (['formatted'] as const) : []),
          'file'
        ]
  const [chosen, setChosen] = useState<Tab | null>(null)
  const tab = chosen !== null && tabs.includes(chosen) ? chosen : (tabs[0] ?? 'file')

  useEffect(() => closeRef.current?.focus(), [])

  // Hors du panneau du chat (animé : un `transform` parent piégerait `position: fixed`).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-surface text-sm text-content shadow-xl"
      >
        <header className="flex items-start gap-2 border-b border-content-muted/20 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-content-muted">Fichier touché par Claude · lecture seule</p>
            <h2 id={titleId} className="truncate font-mono text-sm font-semibold" title={file?.path ?? title}>
              {file?.path ?? title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre du fichier"
            className="h-8 w-8 shrink-0 rounded-md hover:bg-surface-raised"
          >
            ×
          </button>
        </header>
        {query.isError ? (
          <p role="alert" className="p-4 text-con">
            {query.error instanceof IpcFailure ? query.error.message : 'Le fichier n’a pas pu être lu.'}
          </p>
        ) : file === undefined ? (
          <p className="p-4 text-content-muted">Lecture du fichier…</p>
        ) : (
          <>
            <div role="tablist" aria-label="Affichage" className="flex gap-1 border-b border-content-muted/20 px-4">
              {tabs.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={id === tab}
                  onClick={() => setChosen(id)}
                  className={`-mb-px h-9 border-b-2 px-3 ${id === tab ? 'border-action font-semibold' : 'border-transparent text-content-muted'}`}
                >
                  {TAB_LABELS[id]}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={TAB_LABELS[tab]} className="min-h-0 flex-1 overflow-auto" tabIndex={0}>
              {tab === 'change' && file.change !== null ? (
                <PatchView patch={file.change} language={file.language} />
              ) : (
                <CurrentView file={file} formatted={tab === 'formatted'} />
              )}
            </div>
          </>
        )}
      </section>
    </div>,
    document.body
  )
}

function CurrentView({
  file,
  formatted
}: {
  readonly file: ChatToolFileView
  readonly formatted: boolean
}): React.JSX.Element {
  const note = unreadable(file)
  if (note !== null || file.current === null) return <p className="p-4 text-content-muted">{note}</p>
  if (formatted) {
    return (
      <div className="px-4 py-2">
        <Markdown inertLinks text={file.current} />
      </div>
    )
  }
  return <SourceCode text={file.current} language={file.language} />
}

interface PatchRow {
  readonly kind: 'header' | 'added' | 'removed' | 'same' | 'note'
  readonly text: string
  readonly oldNo: number | null
  readonly newNo: number | null
  /** Ligne colorée ; absente : texte brut (langage inconnu, en-tête, note). */
  readonly tokens?: readonly HighlightNode[]
}

/** Texte d'un côté du bloc coloré en entier puis redécoupé en lignes : une chaîne sur plusieurs lignes reste juste. */
function coloredSide(lines: readonly string[], language: string | null): HighlightNode[][] | null {
  const tree = highlight(lines.join('\n'), language)
  return tree === null ? null : splitHighlightLines(tree)
}

/**
 * Lignes du diff numérotées (`oldStart` / `newStart` de chaque bloc) et colorées : une ligne retirée prend la couleur
 * du côté d'avant (contexte + retirées), une ligne ajoutée ou de contexte celle du côté d'après.
 */
function rowsOf(patch: ToolPatch, language: string | null): PatchRow[] {
  const rows: PatchRow[] = []
  for (const hunk of patch.hunks) {
    rows.push({ kind: 'header', text: `@@ −${hunk.oldStart} +${hunk.newStart} @@`, oldNo: null, newNo: null })
    const body = hunk.lines.filter((line) => !line.startsWith('\\'))
    const before = coloredSide(
      body.filter((line) => !line.startsWith('+')).map((line) => line.slice(1)),
      language
    )
    const after = coloredSide(
      body.filter((line) => !line.startsWith('-')).map((line) => line.slice(1)),
      language
    )
    let oldNo = hunk.oldStart
    let newNo = hunk.newStart
    let a = 0
    let b = 0
    const tokensOf = (side: HighlightNode[][] | null, index: number) => {
      const tokens = side?.[index]
      return tokens === undefined ? {} : { tokens }
    }
    for (const line of hunk.lines) {
      const sign = line.charAt(0)
      const text = line.slice(1)
      if (sign === '+') rows.push({ kind: 'added', text, oldNo: null, newNo: newNo++, ...tokensOf(after, b++) })
      else if (sign === '-') rows.push({ kind: 'removed', text, oldNo: oldNo++, newNo: null, ...tokensOf(before, a++) })
      else if (sign === '\\') rows.push({ kind: 'note', text: line, oldNo: null, newNo: null })
      else {
        a++
        rows.push({ kind: 'same', text, oldNo: oldNo++, newNo: newNo++, ...tokensOf(after, b++) })
      }
    }
  }
  return rows
}

const ROW_CLASS: Readonly<Record<PatchRow['kind'], string>> = {
  header: 'bg-surface-raised text-content-muted',
  added: 'viewer-diff-added',
  removed: 'viewer-diff-removed',
  same: '',
  note: 'text-content-muted italic'
}

const ROW_SIGN: Readonly<Record<PatchRow['kind'], string>> = {
  header: '',
  added: '+',
  removed: '−',
  same: '',
  note: ''
}

const ROW_READ: Readonly<Record<PatchRow['kind'], string>> = {
  header: '',
  added: 'ajoutée : ',
  removed: 'retirée : ',
  same: '',
  note: ''
}

function PatchView({
  patch,
  language
}: {
  readonly patch: ToolPatch
  readonly language: string | null
}): React.JSX.Element {
  const rows = useMemo(() => rowsOf(patch, language), [patch, language])
  const added = rows.filter((row) => row.kind === 'added').length
  const removed = rows.filter((row) => row.kind === 'removed').length
  return (
    <div className="flex flex-col">
      <p className="px-4 pt-3 text-xs text-content-muted">
        <span className="text-pro">+{added}</span> · <span className="text-con">−{removed}</span>
        {patch.created ? ' · fichier créé' : ''}
        {patch.truncated ? ' · modification trop longue, coupée' : ''}
      </p>
      <pre className="viewer-code hljs py-2 font-mono text-xs">
        {rows.map((row, index) => (
          <div key={index} className={`flex ${ROW_CLASS[row.kind]}`}>
            <span aria-hidden="true" className="w-10 shrink-0 pr-2 text-right text-content-muted select-none">
              {row.oldNo ?? ''}
            </span>
            <span aria-hidden="true" className="w-10 shrink-0 pr-2 text-right text-content-muted select-none">
              {row.newNo ?? ''}
            </span>
            <span aria-hidden="true" className="w-4 shrink-0 text-center select-none">
              {ROW_SIGN[row.kind]}
            </span>
            <span className="sr-only">{ROW_READ[row.kind]}</span>
            <span className="pr-4">
              {row.text === '' ? ' ' : row.tokens === undefined ? row.text : <Highlighted nodes={row.tokens} />}
            </span>
          </div>
        ))}
      </pre>
    </div>
  )
}
