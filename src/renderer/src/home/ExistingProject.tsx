import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { ExistingPreview } from '@shared/ipc/brainstorms'
import { PROJECT_LIMITS } from '@shared/ipc/projects'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { BRAINSTORMS_KEY, useOpenBrainstorm } from './useBrainstorms'

type Role = 'owner' | 'none'

const errorText = (error: unknown, fallback: string): string => (error instanceof IpcFailure ? error.message : fallback)

/**
 * « Nouveau brainstorm › Projet en chantier » (spec 024 US4, D9, D10) : mentalyas choisit le dossier (sélecteur natif),
 * voit ce que l'app y écrira (vault `.brainstormer/`, ligne du `.gitignore`) et dit comment il travaille ; le dossier
 * n'est jamais déplacé, aucune commande git n'est lancée.
 */
export function ExistingProject(): React.JSX.Element {
  const id = useId()
  const client = useQueryClient()
  const open = useOpenBrainstorm()
  const [preview, setPreview] = useState<ExistingPreview | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<Role>('owner')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const choose = async (): Promise<void> => {
    setBusy(true)
    setProblem('')
    try {
      const picked = await call<ExistingPreview | null>('brainstorms:pickExisting')
      if (picked === null) return
      setPreview(picked)
      setName(picked.suggestedName)
      setRole(picked.isRepo ? 'owner' : 'none')
    } catch (error) {
      setProblem(errorText(error, 'Le dossier n’a pas pu être lu.'))
    } finally {
      setBusy(false)
    }
  }

  const adopt = async (): Promise<void> => {
    if (preview === null) return
    setBusy(true)
    setProblem('')
    try {
      const adopted = await call<{ id: string }>('brainstorms:adoptExisting', {
        pickId: preview.pickId,
        name: name.trim(),
        description: description.trim(),
        role
      })
      void client.invalidateQueries({ queryKey: BRAINSTORMS_KEY })
      await open.mutateAsync({ id: adopted.id })
    } catch (error) {
      setProblem(errorText(error, 'Le projet n’a pas pu être ouvert.'))
    } finally {
      setBusy(false)
    }
  }

  const ready = preview !== null && preview.problem === null && name.trim() !== '' && !busy

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-content-muted/20 bg-surface-raised p-4 text-sm">
      <h3 id={`${id}-title`} className="font-semibold">
        Projet en chantier
      </h3>
      <p className="text-xs text-content-muted">
        Un projet existant, ailleurs sur ton PC (ex. un projet de groupe) : il reste où il est. L’app y pose seulement
        son dossier <span className="font-mono">.brainstormer/</span> (ignoré par git) ; ta carte reste dans l’app.
      </p>
      <div>
        <Button variant={preview === null ? 'primary' : 'secondary'} disabled={busy} onClick={() => void choose()}>
          {preview === null ? 'Choisir le dossier du projet…' : 'Choisir un autre dossier…'}
        </Button>
      </div>
      {preview === null ? null : (
        <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-3">
          <h4 id={`${id}-preview`} className="sr-only">
            Aperçu
          </h4>
          <p className="truncate font-mono text-xs" title={preview.folder}>
            {preview.folder}
          </p>
          <p className="text-xs">
            {preview.isRepo
              ? `Dépôt git${preview.branch === null ? '' : ` · branche ${preview.branch}`}`
              : 'Pas de dépôt git'}
            {preview.vault === 'known'
              ? ' · déjà un brainstorm de l’app : il sera rouvert'
              : preview.vault === 'foreign'
                ? ' · dossier .brainstormer déjà présent : repris tel quel'
                : ''}
          </p>
          {preview.problem === null ? (
            <>
              {preview.writes.length === 0 ? (
                <p className="text-xs text-content-muted">Rien ne sera écrit dans le projet.</p>
              ) : (
                <div className="text-xs">
                  <p className="font-semibold">L’app écrira dans le projet :</p>
                  <ul aria-label="Écritures prévues" className="ml-4 list-disc">
                    {preview.writes.map((write) => (
                      <li key={write} className="font-mono">
                        {write}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.vault === 'known' ? null : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold">Nom</span>
                    <input
                      value={name}
                      maxLength={PROJECT_LIMITS.name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-8 rounded-md bg-surface px-2"
                    />
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
                  <fieldset className="flex flex-col gap-1">
                    <legend className="text-xs font-semibold">Comment je travaille dans ce projet</legend>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name={`${id}-role`}
                        checked={role === 'owner'}
                        disabled={!preview.isRepo}
                        onChange={() => setRole('owner')}
                      />
                      Mon propre dépôt
                    </label>
                    <label className="flex items-center gap-2 text-xs text-content-muted">
                      <input type="radio" name={`${id}-role`} checked={false} disabled readOnly />
                      Collaborateur, sur ma branche (bientôt, avec la spec 021)
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name={`${id}-role`}
                        checked={role === 'none'}
                        disabled={preview.isRepo}
                        onChange={() => setRole('none')}
                      />
                      Pas de dépôt git pour l’instant
                    </label>
                  </fieldset>
                </>
              )}
              <div>
                <Button variant="primary" disabled={!ready} onClick={() => void adopt()}>
                  {busy
                    ? 'Ouverture…'
                    : preview.vault === 'known'
                      ? 'Rouvrir ce brainstorm'
                      : 'Poser le vault et ouvrir'}
                </Button>
              </div>
            </>
          ) : (
            <p role="alert" className="text-xs text-con">
              {preview.problem}
            </p>
          )}
        </section>
      )}
      {problem === '' ? null : (
        <p role="alert" className="text-xs text-con">
          {problem}
        </p>
      )}
    </div>
  )
}
