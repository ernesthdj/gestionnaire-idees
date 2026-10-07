import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { lineDiff } from '@shared/diff/lineDiff'
import type { SkillDraftDiffView, SkillFileDiffView } from '@shared/ipc/skills'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import '../canvas/canvas.css'

const STATUS_LABELS: Readonly<Record<SkillFileDiffView['status'], string>> = {
  ajout: 'nouveau',
  modifie: 'modifié',
  inchange: 'inchangé'
}

/**
 * Brouillon d'un skill (spec 020 US3, FR-018, FR-019) : différences fichier par fichier avec la version installée,
 * puis « Installer » (version actuelle sauvegardée, annulable) ou « Jeter ». Rien n'est écrit avant le clic.
 */
export function DraftPanel({
  draftId,
  onDone
}: {
  readonly draftId: string
  readonly onDone: (skillId: string | null) => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['skillDraftDiff', draftId],
    queryFn: () => call<SkillDraftDiffView>('skills:draftDiff', { draftId })
  })
  const view = query.data

  const refresh = async (): Promise<void> => {
    await Promise.all(
      [['skills'], ['skill'], ['skillDrafts'], ['skillDraftDiff'], ['history']].map((queryKey) =>
        client.invalidateQueries({ queryKey })
      )
    )
  }

  const install = async (): Promise<void> => {
    if (view === undefined || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await call<{ batchId: string; skillId: string }>('skills:install', {
        draftId,
        confirm: true,
        ...(view.diskChanged ? { acceptDiskChange: true } : {})
      })
      showToast(`Skill « ${view.draft.name} » installé.`, {
        batchId: result.batchId,
        undoneText: 'Installation annulée : la version précédente est rétablie.'
      })
      await refresh()
      onDone(result.skillId)
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'L’installation a échoué.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const discard = async (): Promise<void> => {
    setBusy(true)
    try {
      await call('skills:discardDraft', { draftId })
      await refresh()
      onDone(null)
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'Le brouillon n’a pas pu être jeté.')
    } finally {
      setBusy(false)
    }
  }

  if (query.isError) {
    return (
      <p role="alert" className="p-4 text-sm">
        {query.error instanceof IpcFailure ? query.error.message : 'Le brouillon n’a pas pu être lu.'}
      </p>
    )
  }
  if (view === undefined) return <p className="p-4 text-sm text-content-muted">Lecture du brouillon…</p>
  const changed = view.files.filter((file) => file.status !== 'inchange').length
  return (
    <section aria-label={`Brouillon de ${view.draft.name}`} className="flex flex-col gap-3 p-4 text-sm">
      <header>
        <h3 className="font-semibold">
          Brouillon {view.draft.isNew ? 'd’un nouveau skill' : 'd’amélioration'} · {view.draft.name}
        </h3>
        <p className="text-xs text-content-muted">
          {view.draft.origin === 'claude' ? 'Proposé par Claude' : view.draft.origin === 'import' ? 'Importé' : 'Copie'}{' '}
          · {changed} fichier{changed > 1 ? 's' : ''} changé{changed > 1 ? 's' : ''} · {view.draft.description}
        </p>
      </header>
      {view.diskChanged && !view.draft.isNew ? (
        <p role="alert" className="rounded-md border border-amber-600/50 p-2 text-xs">
          Le skill a été modifié ailleurs depuis ce brouillon. Relis les différences : « Installer » remplacera la
          version actuelle (elle sera sauvegardée).
        </p>
      ) : null}
      {view.files.map((file) => (
        <FileDiff key={file.path} file={file} />
      ))}
      {error === '' ? null : (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => void discard()}>
          Jeter
        </Button>
        <Button variant="primary" className="flex-1" disabled={busy || changed === 0} onClick={() => void install()}>
          Installer
        </Button>
      </div>
      <p className="text-xs text-content-muted">
        Installer change Claude Code dans tous tes projets{view.draft.family === 'projet' ? ' liés à ce dépôt' : ''} ;
        la version remplacée est gardée (« Revenir », ou « Annuler » dans l’Historique).
      </p>
    </section>
  )
}

function FileDiff({ file }: { readonly file: SkillFileDiffView }): React.JSX.Element {
  const diff = useMemo(() => lineDiff(file.before, file.after), [file.before, file.after])
  return (
    <details open={file.status !== 'inchange'} className="rounded-md border border-content-muted/20">
      <summary className="cursor-pointer px-3 py-2 font-mono text-xs">
        {file.path} · {STATUS_LABELS[file.status]}
      </summary>
      {file.status === 'inchange' ? null : diff.kind === 'summary' ? (
        <p className="px-3 pb-2 text-xs text-content-muted">
          Différence trop grande pour être détaillée : {diff.beforeLines} lignes avant, {diff.afterLines} après.
        </p>
      ) : (
        <pre className="max-h-96 overflow-auto py-2 font-mono text-xs">
          {diff.lines.map((line, index) => (
            <div key={index} className={`viewer-diff-${line.kind} px-3`}>
              <span aria-hidden="true" className="inline-block w-4 select-none">
                {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
              </span>
              <span className="sr-only">
                {line.kind === 'added' ? 'ajoutée : ' : line.kind === 'removed' ? 'retirée : ' : ''}
              </span>
              {line.text === '' ? ' ' : line.text}
            </div>
          ))}
        </pre>
      )}
    </details>
  )
}
