import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { BrainstormCreatedView } from '@shared/ipc/brainstorms'
import { PROJECT_LIMITS, PROJECT_TYPES, type ProjectType } from '@shared/ipc/projects'
import { slugify, slugProblem } from '@shared/projects/slug'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { BRAINSTORMS_KEY, useOpenBrainstorm } from './useBrainstorms'

type Source = 'scratch' | 'existing' | 'clone'

const SOURCES: readonly { readonly source: Source; readonly label: string; readonly hint: string }[] = [
  { source: 'scratch', label: 'De zéro', hint: 'Un nouveau projet, créé dans ton coffre' },
  { source: 'existing', label: 'Projet en chantier', hint: 'Bientôt : un dossier existant, ailleurs sur ton PC' },
  { source: 'clone', label: 'Depuis un lien Git', hint: 'Bientôt : cloner un dépôt dans ton coffre' }
]

/** Première consigne du brainstorm (spec 024 D8) : ciblée par le nom et la description, jamais envoyée sans geste. */
export function brainstormPrompt(name: string, description: string): string {
  const about = description.trim() === '' ? '' : ` (${description.trim()})`
  return `Lançons le brainstorm du projet « ${name.trim()} »${about}. Pose-moi d’abord les questions qui comptent pour cadrer ce projet, une à la fois.`
}

/**
 * « Nouveau brainstorm » (spec 024 US3) : de zéro, le projet naît dans le coffre avec la structure ProjectMaster et son
 * dépôt git local ; son canevas s'ouvre sur la conversation du genesis, la première consigne pré-remplie.
 */
export function NewBrainstorm({ root }: { readonly root: string | null }): React.JSX.Element {
  const id = useId()
  const client = useQueryClient()
  const open = useOpenBrainstorm()
  const [source, setSource] = useState<Source>('scratch')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [type, setType] = useState<ProjectType | ''>('')
  const [description, setDescription] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const slugIssue = slug === '' ? null : slugProblem(slug)
  const ready = root !== null && name.trim() !== '' && type !== '' && slug !== '' && slugIssue === null && !busy

  const submit = async (): Promise<void> => {
    if (!ready) return
    setBusy(true)
    setProblem('')
    try {
      const created = await call<BrainstormCreatedView>('brainstorms:createScratch', {
        name: name.trim(),
        slug,
        description: description.trim(),
        type,
        github: false
      })
      void client.invalidateQueries({ queryKey: BRAINSTORMS_KEY })
      const opened = await open.mutateAsync({ id: created.id })
      const genesisId = opened.brainstorm.genesisId
      const ui = useUiStore.getState()
      if (genesisId !== null) {
        ui.seedChatDraft(genesisId, brainstormPrompt(name, description))
        ui.openChat(genesisId)
      }
      if (created.warning !== null) ui.showToast(created.warning)
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Le projet n’a pas pu être créé.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Point de départ">
        {SOURCES.map((entry) => (
          <button
            key={entry.source}
            type="button"
            aria-pressed={source === entry.source}
            disabled={entry.source !== 'scratch'}
            onClick={() => setSource(entry.source)}
            className={`flex flex-col gap-1 rounded-md border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
              source === entry.source ? 'border-accent bg-accent/10' : 'border-content-muted/30'
            }`}
          >
            <span className="text-sm font-semibold">{entry.label}</span>
            <span className="text-xs text-content-muted">{entry.hint}</span>
          </button>
        ))}
      </div>
      <form
        aria-labelledby={`${id}-title`}
        className="flex flex-col gap-3 rounded-lg border border-content-muted/20 bg-surface-raised p-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h3 id={`${id}-title`} className="font-semibold">
          Nouveau projet de zéro
        </h3>
        <p className="text-xs text-content-muted">
          {root === null
            ? 'Choisis d’abord ton coffre (en haut).'
            : `Dossier créé dans ${root}, avec CLAUDE.md, docs/JOURNAL.md, src/, tests/ et un dépôt git local.`}
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Nom</span>
          <input
            value={name}
            maxLength={PROJECT_LIMITS.name}
            onChange={(event) => {
              setName(event.target.value)
              if (!slugEdited) setSlug(slugify(event.target.value))
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Description</span>
          <textarea
            value={description}
            rows={2}
            maxLength={PROJECT_LIMITS.description}
            onChange={(event) => setDescription(event.target.value)}
            className="resize-none rounded-md bg-surface px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-content-muted">
          <input type="checkbox" checked={false} disabled readOnly />
          Créer aussi le dépôt GitHub (bientôt, avec la spec 021)
        </label>
        {problem === '' ? null : (
          <p role="alert" className="text-xs text-con">
            {problem}
          </p>
        )}
        <div>
          <Button type="submit" variant="primary" disabled={!ready}>
            {busy ? 'Création…' : 'Créer et ouvrir le canevas'}
          </Button>
        </div>
      </form>
    </div>
  )
}
