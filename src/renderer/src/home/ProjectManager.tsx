import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { BrainstormListItem } from '@shared/ipc/brainstorms'
import type { ProjectSettingsView } from '@shared/ipc/projects'
import { Button } from '../components/atoms/Button'
import { PROJECT_SETTINGS_KEY } from '../chat/ProjectForm'
import { call, IpcFailure } from '../lib/ipc'
import { BrainstormList } from './BrainstormList'
import { NewBrainstorm } from './NewBrainstorm'
import { BRAINSTORMS_KEY, useBrainstormList, useOpenBrainstorm } from './useBrainstorms'

type Mode = 'load' | 'new'

const errorText = (error: unknown): string =>
  error instanceof IpcFailure ? error.message : 'Le brainstorm n’a pas pu être ouvert.'

/**
 * Project Manager (spec 024 US1, D5) : le premier écran de l'app. « Reprendre » le dernier brainstorm, « Charger un
 * brainstorm existant » (ceux de l'app et les projets du coffre) ou « Nouveau brainstorm ». Aucun canevas avant ce choix.
 */
export function ProjectManager(): React.JSX.Element {
  const id = useId()
  const client = useQueryClient()
  const settings = useQuery({
    queryKey: PROJECT_SETTINGS_KEY,
    queryFn: () => call<ProjectSettingsView>('project:settings')
  })
  const list = useBrainstormList()
  const open = useOpenBrainstorm()
  const [chosen, setChosen] = useState<Mode | null>(null)
  const chooseRoot = useMutation({
    mutationFn: () => call<ProjectSettingsView>('project:chooseRoot'),
    onSuccess: (view) => {
      client.setQueryData(PROJECT_SETTINGS_KEY, view)
      void client.invalidateQueries({ queryKey: BRAINSTORMS_KEY })
    }
  })
  const relink = useMutation({
    mutationFn: (item: BrainstormListItem) => call<{ ok: boolean }>('brainstorms:relink', { id: item.id }),
    onSuccess: () => void client.invalidateQueries({ queryKey: BRAINSTORMS_KEY })
  })
  const items = list.data ?? []
  const last = items.find((item) => item.last)
  const mode: Mode = chosen ?? (items.length > 0 ? 'load' : 'new')
  const root = settings.data?.root ?? null
  const openItem = (item: BrainstormListItem): void =>
    open.mutate(item.id === null ? { slug: item.slug } : { id: item.id })

  return (
    <section aria-labelledby={`${id}-title`} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-8">
        <header className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-2xl font-semibold">
            Project Manager
          </h2>
          <p className="text-sm text-content-muted">
            {root === null ? (
              'Aucun coffre choisi : indique le dossier projects de ton ProjectMaster.'
            ) : (
              <>
                Coffre : <span className="font-mono text-xs">{root}</span>
                {settings.data?.hub === true ? ' · registre ProjectMaster' : ' · sans registre ProjectMaster'}
              </>
            )}
          </p>
        </header>

        {root === null ? (
          <div className="flex items-center gap-4 rounded-lg border border-accent/50 bg-surface-raised p-4">
            <p className="flex-1 text-sm">
              Le coffre range tes projets : choisis le dossier <span className="font-mono">projects</span> de ton
              ProjectMaster (ou un dossier vide pour commencer).
            </p>
            <Button variant="primary" disabled={chooseRoot.isPending} onClick={() => chooseRoot.mutate()}>
              Choisir mon coffre
            </Button>
          </div>
        ) : null}

        {last === undefined ? null : (
          <button
            type="button"
            disabled={open.isPending || last.folderMissing}
            onClick={() => openItem(last)}
            className="flex h-16 items-center gap-4 rounded-lg bg-accent px-6 text-left text-surface transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-2xl">
              ↻
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-base font-semibold">Reprendre « {last.name} »</span>
              <span className="truncate text-xs opacity-80">là où tu t’étais arrêté</span>
            </span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-4" role="group" aria-label="Que veux-tu faire ?">
          {(
            [
              ['load', 'Charger un brainstorm existant', 'Reprendre un projet déjà travaillé ou un projet du coffre'],
              ['new', 'Nouveau brainstorm', 'De zéro, sur un projet en chantier ou depuis un lien Git']
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setChosen(value)}
              className={`flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors duration-150 ${
                mode === value
                  ? 'border-accent bg-accent/10'
                  : 'border-content-muted/30 hover:border-content-muted/60 hover:bg-surface-raised'
              }`}
            >
              <span className="text-base font-semibold">{label}</span>
              <span className="text-xs text-content-muted">{hint}</span>
            </button>
          ))}
        </div>

        {(open.error ?? relink.error) === null ? null : (
          <p role="alert" className="text-sm text-con">
            {errorText(open.error ?? relink.error)}
          </p>
        )}

        {mode === 'load' ? (
          list.isError ? (
            <p role="alert" className="text-sm text-con">
              La liste des brainstorms n’a pas pu être lue.
            </p>
          ) : (
            <BrainstormList
              items={items}
              loading={list.isPending}
              busy={open.isPending || relink.isPending}
              onOpen={openItem}
              onRelink={(item) => relink.mutate(item)}
            />
          )
        ) : (
          <NewBrainstorm root={root} />
        )}
      </div>
    </section>
  )
}
