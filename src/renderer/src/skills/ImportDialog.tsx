import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import type { LibraryRepoView, SkillImportProgressEvent } from '@shared/ipc/skills'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { repoLabel } from './LibraryPanel'
import { VERDICTS } from './SkillNodes'

const STEPS: Readonly<Record<SkillImportProgressEvent['step'], string>> = {
  clone: 'Copie du dépôt dans ta bibliothèque (rien n’est exécuté)…',
  reperage: 'Recherche des skills…',
  audit: 'Premier audit par les règles fixes…',
  pret: 'Le dépôt est dans ta bibliothèque.',
  echec: 'L’import a échoué.'
}

const ERRORS: Readonly<Record<string, string>> = {
  NOT_FOUND: 'Dépôt introuvable (adresse, ou dépôt privé ?).',
  AUTH_FAILED: 'Accès refusé : connecte git à GitHub sur ce poste, puis réessaie.',
  NETWORK: 'Réseau indisponible.',
  TIMEOUT: 'Le dépôt a mis trop de temps à arriver.',
  TOO_LARGE: 'Dépôt trop gros pour la bibliothèque (1 Go au plus).',
  DISK_FULL: 'Disque plein.',
  GIT_MISSING: 'git est introuvable sur ce poste.',
  NO_SKILL: 'Aucun SKILL.md trouvé dans ce dépôt.',
  BUSY: 'Un autre clone est en cours.',
  INVALID_PATH: 'Des chemins du dépôt sont trop longs pour Windows : active `core.longpaths` dans git, puis réessaie.',
  FAILED: 'git a échoué sur ce dépôt.',
  IMPORT_FAILED: 'Erreur interne pendant l’import (détail dans le terminal de l’app : skills.import_failed).'
}

/**
 * Importer un dépôt de skills dans la bibliothèque (spec 020 US4, D12) : adresse, progression, puis résumé. Les skills
 * apparaissent sur la toile en nœuds « disponible » ; l'installation se fait depuis leur fiche. Avec `repoUrl`, le
 * dépôt (déjà dans la bibliothèque) est mis à jour dès l'ouverture.
 */
export function ImportDialog({
  repoUrl,
  onDone,
  onClose
}: {
  readonly repoUrl?: string
  readonly onDone?: (repoId: string) => void
  readonly onClose: () => void
}): React.JSX.Element {
  const ids = { title: useId(), url: useId() }
  const client = useQueryClient()
  const [url, setUrl] = useState(repoUrl ?? '')
  const [importId, setImportId] = useState<string | null>(null)
  const [step, setStep] = useState<SkillImportProgressEvent | null>(null)
  const [repo, setRepo] = useState<LibraryRepoView | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const autoStarted = useRef(false)

  useEffect(
    () =>
      window.api.on('skills:importProgress', (payload) => {
        const event = payload as SkillImportProgressEvent
        if (importId === null || event.importId !== importId) return
        setStep(event)
        if (event.step === 'pret') {
          void client.invalidateQueries({ queryKey: ['skillLibrary'] })
          void call<LibraryRepoView[]>('skills:library', {}).then((repos) =>
            setRepo(repos.find((candidate) => candidate.repoId === importId) ?? null)
          )
        }
        if (event.step === 'echec')
          setError(ERRORS[event.errorCode ?? ''] ?? `L’import a échoué (code ${event.errorCode ?? 'inconnu'}).`)
      }),
    [importId, client]
  )

  const start = async (address: string): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      const result = await call<{ importId: string }>('skills:import', { url: address.trim() })
      setImportId(result.importId)
      setStep({ importId: result.importId, step: 'clone' })
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'L’import n’a pas pu démarrer.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (repoUrl === undefined || autoStarted.current) return
    autoStarted.current = true
    void start(repoUrl)
  }, [repoUrl])

  const running = importId !== null && step !== null && step.step !== 'pret' && step.step !== 'echec'
  const close = (): void => {
    // Fermer pendant la copie l'annule : le dossier temporaire est supprimé, la bibliothèque reste intacte.
    if (running) void call('skills:importCancel', { importId }).catch(() => undefined)
    onClose()
  }

  const count = (verdict: keyof typeof VERDICTS): number =>
    repo?.skills.filter((skill) => skill.verdict === verdict).length ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-hidden rounded-xl bg-surface p-4 text-content shadow-xl"
      >
        <header className="flex items-start justify-between gap-2">
          <div>
            <h2 id={ids.title} className="text-base font-semibold">
              {repoUrl === undefined ? 'Importer des skills depuis GitHub' : 'Mettre à jour un dépôt'}
            </h2>
            <p className="text-xs text-content-muted">
              Le dépôt est copié dans ta bibliothèque, rien n’y est exécuté. Ses skills apparaissent sur la toile ;
              Claude audite chacun au moment où tu l’installes.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={close}
            className="h-8 w-8 rounded-md hover:bg-surface-raised"
          >
            ✕
          </button>
        </header>

        {importId === null && repoUrl === undefined ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void start(url)
            }}
          >
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={ids.url} className="text-xs font-semibold">
                Adresse du dépôt (https:// ou git@)
              </label>
              <input
                id={ids.url}
                type="text"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://github.com/compte/depot"
                className="h-10 rounded-md border border-content-muted/30 bg-surface px-2 text-sm"
              />
            </div>
            <Button variant="primary" type="submit" disabled={busy || url.trim() === ''}>
              Importer
            </Button>
          </form>
        ) : (
          <p role="status" className="text-sm">
            {step === null ? '' : STEPS[step.step]}
          </p>
        )}

        {repo === null ? null : (
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-semibold">{repoLabel(repo.repo)}</span> : {repo.skills.length} skill
              {repo.skills.length > 1 ? 's' : ''}
              {repo.truncated ? ' (liste tronquée à 300)' : ''}.
            </p>
            <ul className="flex flex-wrap gap-3 text-xs">
              {(['sur', 'a_revoir', 'dangereux'] as const).map((verdict) => (
                <li key={verdict}>
                  <span aria-hidden="true">{VERDICTS[verdict].icon}</span> {count(verdict)} {VERDICTS[verdict].label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error === '' ? null : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        {repo === null ? null : (
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                onDone?.(repo.repoId)
                onClose()
              }}
            >
              Voir sur la toile
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
