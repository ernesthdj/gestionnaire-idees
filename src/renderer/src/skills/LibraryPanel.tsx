import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { LibraryRepoView, LibrarySkillDetailView, LibraryVerdict } from '@shared/ipc/skills'
import { useUiStore } from '../app/uiStore'
import { Markdown } from '../chat/Markdown'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { LIBRARY_ICON, VERDICTS } from './SkillNodes'

/** Nom court d'un dépôt à partir de son adresse : `auteur/dépôt`. */
export function repoLabel(repo: string): string {
  const path = repo.replace(/^https:\/\/[^/]+\//, '').replace(/^git@[^:]+:/, '')
  return path.replace(/\.git$/i, '').replace(/\/$/, '')
}

const LIBRARY_QUERIES = [['skillLibrary'], ['librarySkill'], ['skillDrafts']] as const

/**
 * Volet d'un skill disponible dans la bibliothèque (spec 020 US4, D12) : verdict (icône + libellé) et raisons, texte du
 * SKILL.md rendu sans HTML, scripts à autoriser un par un, déverrouillage d'un dangereux, puis « Installer » : audit de
 * Claude si besoin, et brouillon à installer (rien n'est écrit avant « Installer » dans le brouillon).
 */
export function LibrarySkillPanel({
  candidateId,
  onDraft,
  onClose
}: {
  readonly candidateId: string
  readonly onDraft: (draftId: string) => void
  readonly onClose: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const query = useQuery({
    queryKey: ['librarySkill', candidateId],
    queryFn: () => call<LibrarySkillDetailView>('skills:librarySkill', { candidateId })
  })
  const [scripts, setScripts] = useState<ReadonlySet<string>>(new Set())
  const [unlocked, setUnlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const detail = query.data
  const skill = detail?.skill
  const verdict = skill === undefined ? undefined : VERDICTS[skill.verdict]
  const locked = skill?.verdict === 'dangereux' && !unlocked
  const executables = skill?.files.filter((file) => file.executable) ?? []

  const install = async (seen: LibraryVerdict): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const { draftId } = await call<{ draftId: string }>('skills:libraryInstall', {
        candidateId,
        scripts: [...scripts],
        seen,
        ...(seen === 'dangereux' ? { unlockDangerous: true } : {})
      })
      await Promise.all(LIBRARY_QUERIES.map((queryKey) => client.invalidateQueries({ queryKey })))
      showToast('Brouillon prêt : vérifie les différences, puis Installer.')
      onDraft(draftId)
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'L’installation n’a pas pu être préparée.')
      // Le verdict a pu changer (audit de Claude) : la fiche est relue.
      if (failure instanceof IpcFailure && failure.code === 'VERDICT_CHANGED') setUnlocked(false)
      await Promise.all(LIBRARY_QUERIES.map((queryKey) => client.invalidateQueries({ queryKey })))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Skill de la bibliothèque" className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-content-muted/20 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{skill?.name ?? 'Skill disponible'}</h2>
          <p className="text-xs text-content-muted">
            <span aria-hidden="true">{LIBRARY_ICON}</span> Bibliothèque · {skill?.installed ? 'installé' : 'disponible'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="h-8 w-8 rounded-md hover:bg-surface-raised"
        >
          ✕
        </button>
      </header>
      {query.isError ? (
        <p role="alert" className="p-4 text-sm">
          {query.error instanceof IpcFailure ? query.error.message : 'Le skill n’a pas pu être lu.'}
        </p>
      ) : skill === undefined || verdict === undefined ? (
        <p className="p-4 text-sm text-content-muted">Lecture du skill…</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-sm">
          <p>{skill.description === '' ? 'Pas de description.' : skill.description}</p>
          <div className={`space-y-2 rounded-md border-2 p-3 ${verdict.tone}`}>
            <p className="font-semibold">
              <span aria-hidden="true">{verdict.icon}</span> Verdict : {verdict.label}
            </p>
            <p className="text-xs text-content-muted">
              {skill.auditedByClaude
                ? 'Audité par les règles fixes et par Claude (le plus sévère l’emporte).'
                : 'Règles fixes seulement : Claude l’auditera au clic Installer.'}
            </p>
            {skill.reasons.length === 0 ? null : (
              <ul className="list-disc pl-5 text-xs">
                {skill.reasons.map((reason, index) => (
                  <li key={index}>
                    {reason.text}
                    {reason.line === undefined ? '' : ` (ligne ${reason.line})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {skill.installed ? (
            <p role="note" className="text-xs">
              Un skill personnel « {skill.name} » existe : l’installer le remplacera (sa version actuelle est gardée).
            </p>
          ) : null}
          {skill.verdict === 'dangereux' ? (
            <label className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
              <input type="checkbox" checked={unlocked} onChange={(event) => setUnlocked(event.target.checked)} />
              Je comprends le risque et veux pouvoir installer ce skill malgré tout.
            </label>
          ) : null}
          {executables.length === 0 ? null : (
            <fieldset className="text-xs">
              <legend className="font-semibold">Scripts (exclus par défaut, jamais exécutés par l’app)</legend>
              {executables.map((file) => (
                <label key={file.path} className="flex items-center gap-2 font-mono">
                  <input
                    type="checkbox"
                    checked={scripts.has(file.path)}
                    onChange={(event) => {
                      const next = new Set(scripts)
                      if (event.target.checked) next.add(file.path)
                      else next.delete(file.path)
                      setScripts(next)
                    }}
                  />
                  ⚠ {file.path}
                </label>
              ))}
            </fieldset>
          )}
          {error === '' ? null : (
            <p role="alert" className="text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <Button variant="primary" disabled={busy || locked} onClick={() => void install(skill.verdict)}>
            {busy ? (skill.auditedByClaude ? 'Préparation…' : 'Audit par Claude…') : 'Installer…'}
          </Button>
          <div className="border-t border-content-muted/20 pt-4">
            <h3 className="mb-2 text-xs font-semibold text-content-muted">SKILL.md</h3>
            <Markdown text={detail?.markdown ?? ''} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Volet d'un dépôt de la bibliothèque (D12) : Mettre à jour, déplier ou replier sur la toile, Retirer. */
export function LibraryRepoPanel({
  repo,
  open,
  onToggle,
  onUpdate,
  onClose
}: {
  readonly repo: LibraryRepoView
  readonly open: boolean
  readonly onToggle: () => void
  readonly onUpdate: () => void
  readonly onClose: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await call('skills:libraryRemove', { repoId: repo.repoId, confirm: true })
      await client.invalidateQueries({ queryKey: ['skillLibrary'] })
      showToast(`« ${repoLabel(repo.repo)} » retiré de la bibliothèque.`)
      onClose()
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'Le dépôt n’a pas pu être retiré.')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <section aria-label="Dépôt de la bibliothèque" className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-content-muted/20 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            <span aria-hidden="true">{LIBRARY_ICON}</span> {repoLabel(repo.repo)}
          </h2>
          <p className="truncate text-xs text-content-muted">{repo.repo}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le dépôt"
          className="h-8 w-8 rounded-md hover:bg-surface-raised"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-content-muted">Skills</dt>
          <dd>{repo.skills.length}</dd>
          <dt className="text-content-muted">Version</dt>
          <dd className="font-mono">{repo.commit === null ? 'inconnue' : repo.commit.slice(0, 7)}</dd>
          <dt className="text-content-muted">Copiée le</dt>
          <dd>{new Date(repo.updatedAt).toLocaleString('fr-FR')}</dd>
        </dl>
        {repo.truncated ? (
          <p role="note" className="text-xs">
            Ce dépôt contient plus de 300 skills : seuls les 300 premiers sont listés.
          </p>
        ) : null}
        {repo.skippedCopies > 0 ? (
          <p className="text-xs text-content-muted">
            {repo.skippedCopies} copie{repo.skippedCopies > 1 ? 's' : ''} écartée{repo.skippedCopies > 1 ? 's' : ''}{' '}
            (traductions, dossiers d’autres outils) : un seul exemplaire par skill, pris dans <code>skills/</code> en
            priorité.
          </p>
        ) : null}
        <p className="text-xs text-content-muted">
          Copie gardée dans l’app, jamais exécutée. Installe un skill depuis sa fiche sur la toile.
        </p>
        {confirming ? (
          <div role="alert" className="space-y-2 rounded-md border border-red-500/40 p-2 text-xs">
            <p>
              Retirer « {repoLabel(repo.repo)} » de la bibliothèque ? Sa copie est supprimée ; les skills déjà installés
              et les brouillons ne bougent pas.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" autoFocus onClick={() => setConfirming(false)}>
                Garder
              </Button>
              <Button variant="danger" className="flex-1" disabled={busy} onClick={() => void remove()}>
                Retirer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onUpdate}>
              Mettre à jour
            </Button>
            <Button onClick={onToggle}>{open ? 'Replier sur la toile' : 'Déplier sur la toile'}</Button>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Retirer de la bibliothèque…
            </Button>
          </div>
        )}
        {error === '' ? null : (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
