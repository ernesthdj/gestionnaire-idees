import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef } from 'react'
import { IDEA_PART_LABELS, IDEA_PARTS, type WidgetInputView } from '@shared/ipc/widgetIo'
import type { WidgetView } from '@shared/ipc/widgets'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'
import { CodeView } from './CodeView'
import { useWidgetIo, useWidgetReview, type WidgetIoActions } from './useWidgetIo'

function sourceLabel(input: WidgetInputView): string {
  const title = input.title ?? 'idée supprimée'
  return input.sourceKind === 'idea' ? `Lire l’idée « ${title} »` : `Lire la prochaine étape de « ${title} »`
}

function InputRow({ input, io }: { readonly input: WidgetInputView; readonly io: WidgetIoActions }): React.JSX.Element {
  const toggle = (part: (typeof IDEA_PARTS)[number]): void => {
    const next = input.parts.includes(part) ? input.parts.filter((entry) => entry !== part) : [...input.parts, part]
    void io.setParts(input.id, next)
  }
  return (
    <li className="rounded-md bg-surface-raised p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{sourceLabel(input)}</p>
        <Button onClick={() => void io.disconnect(input.id)} aria-label={`Débrancher : ${sourceLabel(input)}`}>
          Débrancher
        </Button>
      </div>
      {input.sourceKind === 'step' ? (
        <p className="mt-1 text-xs text-content-muted">Transmis : le texte de l’étape et le titre de son idée.</p>
      ) : (
        <fieldset className="mt-2">
          <legend className="text-xs text-content-muted">Parties transmises</legend>
          <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {IDEA_PARTS.map((part) => (
              <li key={part}>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={input.parts.includes(part)} onChange={() => toggle(part)} />
                  {IDEA_PART_LABELS[part]}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </li>
  )
}

function ReviewDialog({ blockId }: { readonly blockId: string }): React.JSX.Element {
  const ids = { title: useId(), description: useId() }
  const close = useWidgetReview((state) => state.close)
  const io = useWidgetIo(blockId)
  const widget = useQuery({ queryKey: ['widget', blockId], queryFn: () => call<WidgetView>('widget:get', { blockId }) })
  const later = useRef<HTMLButtonElement>(null)
  useEffect(() => later.current?.focus(), [])

  const inputs = io.state.data?.inputs ?? []
  const approved = io.state.data?.approved ?? false
  const code = widget.data?.current ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        aria-describedby={ids.description}
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-xl bg-surface p-4 text-content shadow-xl"
      >
        <header>
          <h2 id={ids.title} className="text-base font-semibold">
            Revue du widget{code === null ? '' : ` « ${code.title} »`}
          </h2>
          <p id={ids.description} className="mt-1 text-xs text-content-muted">
            Ce widget demande à lire tes idées. Rien ne lui est transmis tant que tu n’as pas autorisé cette version. Il
            ne peut ni modifier tes idées ni envoyer quoi que ce soit hors de l’application.
          </p>
        </header>

        <section aria-label="Ce que le widget lira" className="min-h-0 overflow-y-auto">
          <h3 className="text-xs font-semibold text-content-muted">Ce qu’il lira</h3>
          {inputs.length === 0 ? (
            <p className="mt-1 text-sm">Rien n’est branché sur ce widget.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {inputs.map((input) => (
                <InputRow key={input.id} input={input} io={io} />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Code du widget" className="flex min-h-40 flex-1 flex-col overflow-hidden">
          <h3 className="text-xs font-semibold text-content-muted">
            Son code{code === null ? '' : ` (version ${code.number})`}
          </h3>
          {code === null ? (
            <p className="mt-1 text-sm">
              Ce widget n’a pas encore de code. Décris l’outil à Claude dans le widget : l’autorisation te sera demandée
              pour la version qu’il écrira.
            </p>
          ) : (
            <div className="mt-1 flex min-h-0 flex-1 flex-col rounded-md border border-content-muted/20">
              <CodeView code={code} />
            </div>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-end gap-2">
          {approved ? (
            <p role="status" className="mr-auto text-xs text-pro">
              ✓ Cette version est autorisée à lire ces entrées.
            </p>
          ) : null}
          <Button ref={later} onClick={close}>
            {approved ? 'Fermer' : 'Plus tard'}
          </Button>
          {approved ? null : (
            <Button
              variant="primary"
              disabled={code === null || inputs.length === 0}
              onClick={() => void io.approve().then((ok) => ok && close())}
            >
              Autoriser cette version
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

/** Revue avant exécution (spec 005 FR-002) : ce que le widget lira, son code, puis l'accord de l'utilisateur. */
export function WidgetReview(): React.JSX.Element | null {
  const blockId = useWidgetReview((state) => state.blockId)
  return blockId === null ? null : <ReviewDialog key={blockId} blockId={blockId} />
}
