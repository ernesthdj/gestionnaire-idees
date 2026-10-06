import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import {
  PROJECT_LIMITS,
  PROJECT_TYPES,
  type ProjectCreatedView,
  type ProjectSettingsView,
  type ProjectType
} from '@shared/ipc/projects'
import { slugify, slugProblem } from '@shared/projects/slug'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

export const PROJECT_SETTINGS_KEY = ['project-settings'] as const

/**
 * « Faire de ce genesis un projet » (spec 016 US1) : nom, nom de dossier (proposé depuis le nom), type et description.
 * Le main construit le chemin (racine choisie au sélecteur natif + nom de dossier revalidé) ; git reste à part.
 */
export function ProjectForm({
  neuronId,
  title,
  summary,
  onDone,
  onCancel
}: {
  readonly neuronId: string
  readonly title: string
  readonly summary: string
  readonly onDone: (created: ProjectCreatedView) => void
  readonly onCancel: () => void
}): React.JSX.Element {
  const id = useId()
  const settings = useQuery({
    queryKey: PROJECT_SETTINGS_KEY,
    queryFn: () => call<ProjectSettingsView>('project:settings')
  })
  const [name, setName] = useState(title.slice(0, PROJECT_LIMITS.name))
  const [slug, setSlug] = useState(slugify(title))
  const [slugEdited, setSlugEdited] = useState(false)
  const [type, setType] = useState<ProjectType | ''>('')
  const [description, setDescription] = useState(summary.slice(0, PROJECT_LIMITS.description))
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const slugIssue = slug === '' ? null : slugProblem(slug)
  const ready = name.trim() !== '' && type !== '' && slug !== '' && slugIssue === null && !busy

  const submit = async (): Promise<void> => {
    if (!ready) return
    setBusy(true)
    setProblem('')
    try {
      const created = await call<ProjectCreatedView | null>('project:create', {
        neuronId,
        name: name.trim(),
        slug,
        type,
        description: description.trim()
      })
      if (created === null) setProblem('Aucune racine choisie : rien n’a été créé.')
      else onDone(created)
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Le projet n’a pas pu être créé.')
    } finally {
      setBusy(false)
    }
  }

  const root = settings.data?.root ?? null
  return (
    <form
      aria-labelledby={`${id}-title`}
      className="mx-3 my-2 flex flex-col gap-2 rounded-lg border border-accent/50 bg-surface-raised px-3 py-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h3 id={`${id}-title`} className="font-semibold">
        Faire de ce genesis un projet
      </h3>
      <p className="text-xs text-content-muted">
        {root === null
          ? 'Un dossier de projet sera créé ; la racine des projets te sera demandée.'
          : `Dossier créé dans ${root}${settings.data?.hub === true ? ' et inscrit au registre ProjectMaster' : ''}.`}{' '}
        git reste facultatif : tu pourras l’initialiser ensuite.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Nom</span>
        <input
          value={name}
          maxLength={PROJECT_LIMITS.name}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            setName(event.target.value)
            if (!slugEdited) setSlug(slugify(event.target.value))
          }}
          className="rounded-md bg-surface px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Nom du dossier</span>
        <input
          value={slug}
          maxLength={50}
          onKeyDown={(event) => event.stopPropagation()}
          aria-invalid={slugIssue !== null}
          aria-describedby={slugIssue === null ? undefined : `${id}-slug`}
          onChange={(event) => {
            setSlugEdited(true)
            setSlug(event.target.value.toLowerCase())
          }}
          className="rounded-md bg-surface px-2 py-1 font-mono text-xs"
        />
        {slugIssue === null ? null : (
          <span id={`${id}-slug`} className="text-xs text-red-700 dark:text-red-400">
            {slugIssue}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Type</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as ProjectType | '')}
          className="rounded-md border border-content-muted/40 bg-surface px-1 py-1"
        >
          <option value="">Choisir…</option>
          {PROJECT_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Description</span>
        <textarea
          value={description}
          rows={2}
          maxLength={PROJECT_LIMITS.description}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          className="resize-none rounded-md bg-surface px-2 py-1"
        />
      </label>
      {problem === '' ? null : (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!ready}>
          Créer le projet
        </Button>
        <Button onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  )
}
