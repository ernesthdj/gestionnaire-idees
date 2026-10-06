import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { ProjectCommandsView } from '@shared/ipc/finals'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'

export const commandsKey = (genesisId: string): readonly string[] => ['commands', genesisId]

/**
 * Scripts du projet lié que Claude peut lancer pendant une exécution (spec 013 D2 bis) : rien n'est coché par défaut ;
 * un script approuvé puis modifié est signalé « à réapprouver » (il n'est plus lançable).
 */
export function CommandsSection({ genesisId }: { readonly genesisId: string }): React.JSX.Element | null {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const titleId = useId()
  const query = useQuery({
    queryKey: commandsKey(genesisId),
    queryFn: () => call<ProjectCommandsView>('commands:get', { genesisId })
  })
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (query.data !== undefined) {
      setChecked(new Set(query.data.scripts.filter((script) => script.approved).map((script) => script.name)))
    }
  }, [query.data])

  const view = query.data
  if (view === undefined || !view.linked) return null

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await call('commands:approve', { genesisId, scripts: [...checked] })
      showToast('Commandes autorisées enregistrées.')
      await Promise.all([
        client.invalidateQueries({ queryKey: commandsKey(genesisId) }),
        client.invalidateQueries({ queryKey: ['canvas'] })
      ])
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Les commandes n’ont pas pu être enregistrées.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 border-t border-content-muted/20 pt-3">
      <h3 id={titleId} className="text-xs font-semibold text-content-muted uppercase">
        Commandes que Claude peut lancer
      </h3>
      {!view.packageJson ? (
        <p className="text-xs text-content-muted">
          Le projet n’a pas de package.json : Claude ne peut ni tester ni compiler. Il peut en écrire un pendant une
          exécution ; tu approuveras ensuite ses scripts ici.
        </p>
      ) : view.scripts.length === 0 ? (
        <p className="text-xs text-content-muted">Le package.json ne déclare aucun script.</p>
      ) : (
        <>
          <p className="text-xs text-content-muted">
            Coche les scripts (npm run …) que Claude peut lancer pendant une exécution, par exemple les tests et la
            compilation. Un script approuvé exécute du code du projet, y compris celui que Claude écrit.
          </p>
          <ul className="flex flex-col gap-1">
            {view.scripts.map((script) => (
              <li key={script.name}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked.has(script.name)}
                    onChange={(event) => {
                      const next = new Set(checked)
                      if (event.target.checked) next.add(script.name)
                      else next.delete(script.name)
                      setChecked(next)
                    }}
                  />
                  <span className="min-w-0">
                    <span className="font-semibold">{script.name}</span>
                    {script.changed ? (
                      <span className="ml-2 rounded bg-con/15 px-1 text-xs text-con">
                        modifié depuis : à réapprouver
                      </span>
                    ) : null}
                    <code className="block truncate text-xs text-content-muted" title={script.text}>
                      {script.text}
                    </code>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="h-9 rounded-md border border-content-muted/40 px-3 disabled:opacity-50"
            >
              Enregistrer les commandes autorisées
            </button>
          </div>
        </>
      )}
    </section>
  )
}
