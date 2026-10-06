import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ProjectSettingsView } from '@shared/ipc/projects'
import { Button } from '../../components/atoms/Button'
import { Section } from '../../components/molecules/Section'
import { PROJECT_SETTINGS_KEY } from '../../chat/ProjectForm'
import { call, IpcFailure } from '../../lib/ipc'

/**
 * Réglages › Projets (spec 016 US3) : la racine où « Faire de ce genesis un projet » crée les dossiers. Choisie au
 * sélecteur natif ; le dossier `projects/` d'un workspace ProjectMaster y inscrit aussi les projets au registre.
 */
export function ProjectSettings(): React.JSX.Element {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: PROJECT_SETTINGS_KEY,
    queryFn: () => call<ProjectSettingsView>('project:settings')
  })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const choose = async (): Promise<void> => {
    setBusy(true)
    try {
      client.setQueryData(PROJECT_SETTINGS_KEY, await call<ProjectSettingsView>('project:chooseRoot'))
      setMessage('Racine enregistrée.')
    } catch (error) {
      setMessage(error instanceof IpcFailure ? error.message : 'La racine n’a pas pu être enregistrée.')
    } finally {
      setBusy(false)
    }
  }

  const view = query.data
  if (view === undefined) return <p className="p-8 text-center text-sm text-content-muted">Chargement…</p>

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Section title="Projets">
        <p className="text-sm text-content-muted">
          Après le brainstorm, « Faire de ce genesis un projet » crée son dossier dans cette racine (CLAUDE.md, journal,
          README) ; git s’initialise ensuite, quand tu veux. Choisis le dossier <code>projects</code> de ton workspace
          ProjectMaster pour que chaque projet y soit aussi inscrit au registre.
        </p>
        <p className="text-sm">
          {view.root === null ? (
            'Aucune racine choisie : elle sera demandée à la première création.'
          ) : (
            <>
              <code className="block truncate text-xs" title={view.root}>
                {view.root}
              </code>
              <span className="text-xs text-content-muted">
                {view.hub
                  ? 'Workspace ProjectMaster détecté : les projets sont inscrits au registre.'
                  : 'Dossier simple.'}
              </span>
            </>
          )}
        </p>
        <div>
          <Button variant="secondary" disabled={busy} onClick={() => void choose()}>
            {view.root === null ? 'Choisir la racine…' : 'Changer la racine…'}
          </Button>
        </div>
        <p role="status" className="text-sm">
          {message}
        </p>
      </Section>
    </div>
  )
}
