import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { BrainstormCloneProgress } from '@shared/ipc/brainstorms'
import { PROJECT_LIMITS, PROJECT_TYPES, type ProjectType } from '@shared/ipc/projects'
import { slugify, slugProblem } from '@shared/projects/slug'
import { checkGitUrl, GIT_URL_MAX, type GitUrlRefusal } from '@shared/reprise/gitUrl'
import type { Confidentiality } from '@shared/ipc/reprise'
import { Button } from '../components/atoms/Button'
import { CHOICES } from '../reprise/ImportWizard'
import { call, IpcFailure } from '../lib/ipc'
import { BRAINSTORMS_KEY, useOpenBrainstorm } from './useBrainstorms'

const REFUSALS: Readonly<Record<GitUrlRefusal, string>> = {
  EMPTY: 'Colle le lien du dépôt.',
  TOO_LONG: 'Ce lien est trop long.',
  CONTROL_CHAR: 'Ce lien contient un caractère invisible.',
  WHITESPACE: 'Ce lien contient un espace.',
  NON_ASCII: 'Ce lien contient un caractère non accepté.',
  OPTION: 'Ce lien ressemble à une option de commande : refusé.',
  SCHEME: 'Seuls les liens https://… et git@hôte:… sont acceptés.',
  HOST: 'L’hôte de ce lien n’est pas valide.',
  PATH: 'Le chemin de ce lien n’est pas valide.'
}

const PHASES: Readonly<Record<BrainstormCloneProgress['phase'], string>> = {
  connexion: 'Connexion au dépôt…',
  reception: 'Réception des objets',
  resolution: 'Résolution des différences',
  extraction: 'Extraction des fichiers'
}

function isProgress(payload: unknown): payload is BrainstormCloneProgress {
  return typeof payload === 'object' && payload !== null && typeof (payload as { phase?: unknown }).phase === 'string'
}

/**
 * « Nouveau brainstorm › Depuis un lien Git » (spec 024 US5, D11) : le lien est vérifié pendant la saisie, le dépôt est
 * cloné dans le coffre (progression, annulation), puis son canevas s'ouvre. Le contenu cloné n'est jamais exécuté.
 */
export function CloneProject({ root }: { readonly root: string | null }): React.JSX.Element {
  const id = useId()
  const client = useQueryClient()
  const open = useOpenBrainstorm()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [type, setType] = useState<ProjectType | ''>('')
  const [full, setFull] = useState(false)
  const [level, setLevel] = useState<Confidentiality | null>(null)
  /** Plus de 500 Mo reçus : la question « Continuer / Annuler » (le téléchargement continue pendant ce temps). */
  const [large, setLarge] = useState<number | null>(null)
  const [progress, setProgress] = useState<BrainstormCloneProgress | null>(null)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const offProgress = window.api.on('brainstorms:cloneProgress', (payload) => {
      if (isProgress(payload)) setProgress(payload)
    })
    const offLarge = window.api.on('brainstorms:cloneLarge', (payload) => {
      const bytes = (payload as { receivedBytes?: unknown } | null)?.receivedBytes
      if (typeof bytes === 'number') setLarge(bytes)
    })
    return () => {
      offProgress()
      offLarge()
    }
  }, [])

  const check = url.trim() === '' ? null : checkGitUrl(url.trim())
  const slugIssue = slug === '' ? null : slugProblem(slug)
  const ready =
    root !== null &&
    check?.ok === true &&
    name.trim() !== '' &&
    slug !== '' &&
    slugIssue === null &&
    type !== '' &&
    level !== null &&
    !busy

  const onUrl = (value: string): void => {
    setUrl(value)
    const checked = value.trim() === '' ? null : checkGitUrl(value.trim())
    const repo = checked?.ok === true ? (checked.repo ?? '') : ''
    if (repo === '') return
    if (!nameEdited) setName(repo)
    if (!slugEdited) setSlug(slugify(repo))
  }

  const submit = async (): Promise<void> => {
    if (!ready) return
    setBusy(true)
    setProblem('')
    setProgress({ phase: 'connexion' })
    try {
      const created = await call<{ id: string }>('brainstorms:clone', {
        url: url.trim(),
        name: name.trim(),
        slug,
        type,
        full,
        confidentiality: level
      })
      void client.invalidateQueries({ queryKey: BRAINSTORMS_KEY })
      await open.mutateAsync({ id: created.id })
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Le clone a échoué.')
    } finally {
      setBusy(false)
      setProgress(null)
      setLarge(null)
    }
  }

  return (
    <form
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 rounded-lg border border-content-muted/20 bg-surface-raised p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h3 id={`${id}-title`} className="font-semibold">
        Depuis un lien Git
      </h3>
      <p className="text-xs text-content-muted">
        {root === null
          ? 'Choisis d’abord ton coffre (en haut).'
          : `Le dépôt est cloné dans ${root} ; rien de ce qu’il contient n’est exécuté.`}
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Lien du dépôt</span>
        <input
          value={url}
          maxLength={GIT_URL_MAX}
          placeholder="https://github.com/compte/projet.git"
          aria-invalid={check !== null && !check.ok}
          aria-describedby={check !== null && !check.ok ? `${id}-url` : undefined}
          onChange={(event) => onUrl(event.target.value)}
          className="h-8 rounded-md bg-surface px-2 font-mono text-xs"
        />
        {check === null ? null : check.ok ? (
          <span className="text-xs text-content-muted">
            {check.display}
            {check.hadCredentials ? ' · l’identifiant du lien ne sera ni affiché ni gardé' : ''}
          </span>
        ) : (
          <span id={`${id}-url`} className="text-xs text-con">
            {REFUSALS[check.reason]}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Nom</span>
        <input
          value={name}
          maxLength={PROJECT_LIMITS.name}
          onChange={(event) => {
            setNameEdited(true)
            setName(event.target.value)
          }}
          className="h-8 rounded-md bg-surface px-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Nom du dossier</span>
        <input
          value={slug}
          maxLength={50}
          aria-invalid={slugIssue !== null}
          aria-describedby={slugIssue === null ? undefined : `${id}-slug`}
          onChange={(event) => {
            setSlugEdited(true)
            setSlug(event.target.value.toLowerCase())
          }}
          className="h-8 rounded-md bg-surface px-2 font-mono text-xs"
        />
        {slugIssue === null ? null : (
          <span id={`${id}-slug`} className="text-xs text-con">
            {slugIssue}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Type</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as ProjectType | '')}
          className="h-8 rounded-md border border-content-muted/40 bg-surface px-1"
        >
          <option value="">Choisir…</option>
          {PROJECT_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-semibold">Confidentialité de ce projet</legend>
        {CHOICES.map((choice) => (
          <label key={choice.level} className="flex items-start gap-2 text-xs">
            <input
              type="radio"
              name={`${id}-confidentiality`}
              checked={level === choice.level}
              onChange={() => setLevel(choice.level)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">{choice.title}</span>
              <span className="block text-content-muted">{choice.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={full} onChange={(event) => setFull(event.target.checked)} />
        Tout télécharger (sinon le contenu des anciennes versions arrive à la demande)
      </label>
      {progress === null ? null : (
        <div role="status" className="flex flex-col gap-1 text-xs">
          <span>
            {PHASES[progress.phase]}
            {progress.percent === undefined ? '' : ` · ${progress.percent} %`}
          </span>
          <progress max={100} value={progress.percent ?? 0} aria-label="Avancement du clone" className="w-full" />
        </div>
      )}
      {large === null ? null : (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-action/50 p-2 text-xs">
          <p>Ce dépôt dépasse 500 Mo ({Math.round(large / (1024 * 1024))} Mo reçus). Le téléchargement continue.</p>
          <div className="flex gap-2">
            <Button onClick={() => setLarge(null)}>Continuer</Button>
            <Button onClick={() => void call('brainstorms:cancelClone')}>Arrêter le clone</Button>
          </div>
        </div>
      )}
      {problem === '' ? null : (
        <p role="alert" className="text-xs text-con">
          {problem}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!ready}>
          {busy ? 'Clone…' : 'Cloner dans le coffre et ouvrir'}
        </Button>
        {busy ? <Button onClick={() => void call('brainstorms:cancelClone')}>Annuler le clone</Button> : null}
      </div>
    </form>
  )
}
