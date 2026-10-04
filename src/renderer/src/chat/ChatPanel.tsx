import { useEffect, useId, useRef, useState } from 'react'
import type { ChatMessageView, ChatSheetView } from '@shared/ipc/chat'
import { CHAT_MESSAGE_MAX } from '@shared/ipc/chat'
import { Button } from '../components/atoms/Button'
import { UsageMeter } from './UsageMeter'
import { useChat } from './useChat'

const MATURITY_LABELS: Readonly<Record<string, string>> = {
  insufficient: 'insuffisant',
  sufficient: 'suffisant',
  complete: 'complet'
}

/** Premier message proposé quand la conversation est vide : Claude ouvre le cadrage. */
export const OPENING_MESSAGE = 'Commençons le brainstorm de cette idée.'

const SECTIONS: ReadonlyArray<readonly [keyof Omit<ChatSheetView, 'resume'>, string]> = [
  ['points_cles', 'Points clés'],
  ['decisions', 'Décisions'],
  ['questions_ouvertes', 'Questions ouvertes'],
  ['manques', 'Manques']
]

function Sheet({ sheet }: { readonly sheet: ChatSheetView }): React.JSX.Element {
  const empty = sheet.resume === '' && SECTIONS.every(([key]) => sheet[key].length === 0)
  return (
    <details className="rounded-lg bg-surface-raised px-3 py-2 text-sm" open={!empty}>
      <summary className="cursor-pointer font-semibold">Fiche du neurone</summary>
      {empty ? (
        <p className="mt-2 text-content-muted">Vide pour l’instant : Claude la remplit au fil de la conversation.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {sheet.resume === '' ? null : <p>{sheet.resume}</p>}
          {SECTIONS.filter(([key]) => sheet[key].length > 0).map(([key, label]) => (
            <section key={key}>
              <h3 className="text-xs font-semibold text-content-muted uppercase">{label}</h3>
              <ul className="list-disc pl-5">
                {sheet[key].map((item, index) => (
                  <li key={`${key}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </details>
  )
}

function Message({ message }: { readonly message: ChatMessageView }): React.JSX.Element {
  if (message.role === 'tool') {
    return (
      <p
        className="self-start rounded-full bg-accent/10 px-3 py-0.5 text-xs text-accent"
        aria-label={`Action de Claude : ${message.text}`}
      >
        ⚙ {message.text}
      </p>
    )
  }
  if (message.role === 'error') {
    return (
      <p role="alert" className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {message.text}
      </p>
    )
  }
  const mine = message.role === 'user'
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        mine ? 'self-end bg-accent text-surface' : 'self-start bg-surface-raised text-content'
      }`}
    >
      <span className="sr-only">{mine ? 'Toi : ' : 'Claude : '}</span>
      {message.text}
    </div>
  )
}

/**
 * Chat d'un neurone (spec 008 lot A) : une vraie conversation Claude Code. La réponse s'écrit au fil de l'eau, les
 * actions de Claude apparaissent en pastilles, la fiche du neurone se met à jour au-dessus. Entrée envoie,
 * Maj+Entrée va à la ligne. Tout est affiché comme du texte.
 */
export function ChatPanel({
  neuronId,
  onClose
}: {
  readonly neuronId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const chat = useChat(neuronId)
  const [draft, setDraft] = useState('')
  const fieldId = useId()
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [chat.messages.length, chat.partial])

  const submit = (): void => {
    if (chat.busy || draft.trim() === '') return
    const text = draft
    setDraft('')
    void chat.send(text)
  }

  return (
    <section aria-label={`Conversation : ${chat.title}`} className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-content-muted/20 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{chat.title === '' ? 'Conversation' : chat.title}</h2>
          <p className="text-xs text-content-muted">
            Genesis · conversation Claude Code
            {chat.maturity === null ? '' : ` · maturité : ${MATURITY_LABELS[chat.maturity] ?? chat.maturity}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {chat.folder === null ? (
              <button
                type="button"
                onClick={() => void chat.linkFolder()}
                disabled={chat.busy}
                className="rounded-md border border-content-muted/40 px-2 py-0.5 hover:bg-surface-raised disabled:opacity-50"
              >
                Lier un dossier de projet…
              </button>
            ) : (
              <>
                <span
                  className="rounded-full bg-surface-raised px-2 py-0.5"
                  title="Dossier de travail de cette conversation"
                >
                  Dossier : {chat.folder}
                </span>
                <button
                  type="button"
                  onClick={() => void chat.linkFolder()}
                  disabled={chat.busy}
                  className="underline disabled:opacity-50"
                >
                  Changer
                </button>
                <button
                  type="button"
                  onClick={() => void chat.linkFolder(true)}
                  disabled={chat.busy}
                  className="underline disabled:opacity-50"
                >
                  Délier
                </button>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Fermer la conversation"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-raised"
        >
          ×
        </button>
      </header>

      {chat.usage === null ? null : <UsageMeter usage={chat.usage} />}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {chat.sheet === null ? null : <Sheet sheet={chat.sheet} />}
        {chat.problem === null ? null : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {chat.problem}
          </p>
        )}
        <div aria-live="polite" className="flex flex-col gap-2">
          {chat.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {chat.busy ? (
            <div className="max-w-[85%] self-start rounded-2xl bg-surface-raised px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
              {chat.partial === '' ? <span className="text-content-muted">Claude réfléchit…</span> : chat.partial}
            </div>
          ) : null}
        </div>
        {!chat.loading && chat.messages.length === 0 && !chat.busy ? (
          <div className="flex flex-col items-start gap-2 text-sm text-content-muted">
            <p>Claude connaît déjà le titre de l’idée et sa fiche. Lance le cadrage, ou écris directement.</p>
            <Button variant="primary" onClick={() => void chat.send(OPENING_MESSAGE)}>
              Commencer le brainstorm
            </Button>
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-content-muted/20 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor={fieldId} className="sr-only">
          Message à Claude
        </label>
        <textarea
          id={fieldId}
          value={draft}
          rows={2}
          maxLength={CHAT_MESSAGE_MAX}
          placeholder="Ta réponse, une idée, une question…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          className="min-h-10 flex-1 resize-none rounded-md bg-surface-raised px-3 py-2 text-sm outline-none"
        />
        {chat.busy ? (
          <Button onClick={chat.stop}>Arrêter</Button>
        ) : (
          <Button type="submit" variant="primary" disabled={draft.trim() === ''}>
            Envoyer
          </Button>
        )}
      </form>
    </section>
  )
}
