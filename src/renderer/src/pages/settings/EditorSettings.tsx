import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { EditorChoice, EditorSettingsView } from '@shared/ipc/finals'
import { Button } from '../../components/atoms/Button'
import { Section } from '../../components/molecules/Section'
import { call, IpcFailure } from '../../lib/ipc'

const EDITOR_KEY = ['editor'] as const

const KIND_LABELS: Readonly<Record<NonNullable<EditorSettingsView['current']>['kind'], string>> = {
  vscode: 'VS Code',
  notepadpp: 'Notepad++',
  other: 'Autre éditeur'
}

/**
 * Réglages › Éditeur (spec 013 D4) : l'éditeur qui ouvre les fichiers du livrable. Le programme vient d'un éditeur
 * trouvé sur la machine ou du sélecteur natif de Windows, jamais d'un champ de saisie.
 */
export function EditorSettings(): React.JSX.Element {
  const client = useQueryClient()
  const query = useQuery({ queryKey: EDITOR_KEY, queryFn: () => call<EditorSettingsView>('editor:get') })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<EditorSettingsView>, done: string): Promise<void> => {
    setBusy(true)
    try {
      client.setQueryData(EDITOR_KEY, await action())
      setMessage(done)
    } catch (error) {
      setMessage(error instanceof IpcFailure ? error.message : 'Le réglage n’a pas pu être enregistré.')
    } finally {
      setBusy(false)
    }
  }
  const choose = (choice: EditorChoice): Promise<void> =>
    run(() => call<EditorSettingsView>('editor:choose', { choice }), 'Éditeur enregistré.')

  const view = query.data
  if (view === undefined) return <p className="p-8 text-center text-sm text-content-muted">Chargement…</p>

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Section title="Éditeur">
        <p className="text-sm text-content-muted">
          « Ouvrir dans l’éditeur », dans la visionneuse d’un livrable, ouvre le fichier avec ce programme, à la
          première ligne changée. Sans éditeur réglé, seuls les fichiers texte s’ouvrent avec l’application de Windows
          (jamais un script qu’elle exécuterait).
        </p>
        <p className="text-sm">
          {view.current === null ? (
            'Aucun éditeur réglé.'
          ) : (
            <>
              <span className="font-semibold">{KIND_LABELS[view.current.kind]}</span>
              <code className="mt-1 block truncate text-xs text-content-muted" title={view.current.program}>
                {view.current.program}
              </code>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {view.detected.map((editor) => (
            <Button key={editor.kind} variant="secondary" disabled={busy} onClick={() => void choose(editor.kind)}>
              {editor.name}
            </Button>
          ))}
          <Button variant="secondary" disabled={busy} onClick={() => void choose('browse')}>
            Autre éditeur…
          </Button>
          {view.current === null ? null : (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => call<EditorSettingsView>('editor:clear'), 'Plus d’éditeur réglé.')}
            >
              Retirer
            </Button>
          )}
        </div>
        {view.detected.length === 0 ? (
          <p className="text-xs text-content-muted">
            Ni VS Code ni Notepad++ n’ont été trouvés à leur emplacement habituel : « Autre éditeur… » permet de choisir
            le programme (fichier .exe).
          </p>
        ) : null}
        <p role="status" className="text-sm">
          {message}
        </p>
      </Section>
    </div>
  )
}
