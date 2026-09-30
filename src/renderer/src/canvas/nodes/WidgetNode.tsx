import { NodeResizer, type NodeProps } from '@xyflow/react'
import { useId, useState } from 'react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import { WIDGET_PROMPT_MAX_CHARS, type WidgetCodeView, type WidgetView } from '@shared/ipc/widgets'
import { useEffectiveSettings } from '../../app/useAppSettings'
import { AiThinking } from '../../dive/AiThinking'
import { useWidget, type WidgetActions } from '../../widgets/useWidget'
import { resolvedScheme, widgetFrameUrl } from '../../widgets/widgetFrame'
import type { WidgetNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'

const LIMITS = BLOCK_LIMITS.widget
const CODE_TABS = [
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['ts', 'TypeScript']
] as const

/** Onglet « Code » : le code de la version affichée, lu comme du TEXTE (jamais interprété dans l'app). */
function CodeView({ code }: { readonly code: WidgetCodeView }): React.JSX.Element {
  const [tab, setTab] = useState<(typeof CODE_TABS)[number][0]>('ts')
  return (
    <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="Parties du code"
        className="flex gap-1 border-b border-content-muted/20 px-2 py-1"
      >
        {CODE_TABS.map(([part, label]) => (
          <button
            key={part}
            type="button"
            role="tab"
            aria-selected={tab === part}
            onClick={() => setTab(part)}
            className={`rounded px-2 py-0.5 text-xs ${tab === part ? 'bg-surface-raised font-semibold' : 'text-content-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <pre
        role="tabpanel"
        tabIndex={0}
        aria-label={`Code ${tab}`}
        className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-snug whitespace-pre"
      >
        {code[tab]}
      </pre>
    </div>
  )
}

/** Conversation avec Claude : dernière réponse visible, historique dépliable, demande (Entrée envoie). */
function Chat({ view, actions }: { readonly view: WidgetView | undefined; readonly actions: WidgetActions }) {
  const fieldId = useId()
  const [text, setText] = useState('')
  const messages = view?.messages ?? []
  const last = messages.at(-1)
  const send = async (): Promise<void> => {
    const request = text.trim()
    if (request === '' || actions.busy) return
    if (await actions.prompt(request)) setText('')
  }
  return (
    <div className="nodrag nowheel shrink-0 space-y-1 border-t border-content-muted/20 bg-surface-raised/60 p-2">
      {actions.busy ? (
        <AiThinking thinking worker={actions.worker} />
      ) : last?.role === 'assistant' ? (
        <p role="status" className={`line-clamp-2 text-xs ${last.failed ? 'text-con' : 'text-content-muted'}`}>
          {last.failed ? '⚠ ' : ''}
          {last.text}
        </p>
      ) : null}
      {messages.length > 1 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-content-muted select-none">Conversation ({messages.length})</summary>
          <ol className="mt-1 max-h-32 space-y-1 overflow-y-auto">
            {messages.map((message) => (
              <li key={message.id} className={message.role === 'user' ? 'font-medium' : 'text-content-muted'}>
                {message.role === 'user'
                  ? 'Toi : '
                  : message.versionNumber === null
                    ? 'Claude : '
                    : `v${message.versionNumber} : `}
                {message.text}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <label htmlFor={fieldId} className="sr-only">
          Demande à Claude pour ce widget
        </label>
        <textarea
          id={fieldId}
          value={text}
          rows={1}
          maxLength={WIDGET_PROMPT_MAX_CHARS}
          readOnly={actions.busy}
          placeholder={view?.current === null ? 'Décris l’outil voulu…' : 'Demande une évolution…'}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          className="field-sizing-content max-h-24 min-h-8 flex-1 resize-none rounded-md bg-surface px-2 py-1.5 text-xs leading-5 read-only:cursor-wait read-only:opacity-60"
        />
        <button
          type="submit"
          disabled={actions.busy}
          className="h-8 shrink-0 rounded-md bg-accent px-3 text-xs font-semibold text-surface disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}

/**
 * Widget IA posé sur la carte (spec 004 US3) : l'outil tourne dans un cadre isolé (`gi-widget://`, bac à sable
 * sans réseau ni accès à l'app), la chatbox le fait évoluer avec Claude, chaque réponse crée une version.
 * Il se déplace en le saisissant n'importe où hors de ses zones interactives, et se redimensionne par les bords.
 */
export function WidgetNode({ id, selected, dragging }: NodeProps<WidgetNodeType>): React.JSX.Element {
  const blockActions = useBlockActions()
  const actions = useWidget(id)
  const settings = useEffectiveSettings()
  const view = actions.widget.data
  const current = view?.current ?? null
  const [showCode, setShowCode] = useState(false)
  const [resizing, setResizing] = useState(false)
  /** « Arrêter » recharge le cadre : un widget qui boucle ne bloque que lui-même. */
  const [run, setRun] = useState(0)
  const scheme = resolvedScheme(settings.theme)

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={LIMITS.minWidth}
        minHeight={LIMITS.minHeight}
        maxWidth={LIMITS.maxWidth}
        maxHeight={LIMITS.maxHeight}
        onResizeStart={() => setResizing(true)}
        onResizeEnd={(_event, box) => {
          setResizing(false)
          void blockActions.save(id, box)
        }}
      />
      <section
        aria-label={current === null ? 'Widget IA' : `Widget IA : ${current.title}`}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-content-muted/40 bg-surface text-content shadow-lg"
      >
        <header className="flex h-8 shrink-0 cursor-grab items-center gap-1 border-b border-content-muted/20 bg-surface-raised px-2 text-xs active:cursor-grabbing">
          <span aria-hidden="true">▣</span>
          <span className="flex-1 truncate font-semibold">{current?.title ?? 'Widget IA'}</span>
          {view !== undefined && view.versions.length > 1 && current !== null ? (
            <select
              aria-label="Version affichée"
              value={current.id}
              onChange={(event) => void actions.restore(event.target.value)}
              className="nodrag h-6 rounded bg-surface px-1 text-xs"
            >
              {view.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.number}
                </option>
              ))}
            </select>
          ) : null}
          {current === null ? null : (
            <>
              <button
                type="button"
                aria-pressed={showCode}
                aria-label="Voir le code"
                onClick={() => setShowCode((shown) => !shown)}
                className="nodrag flex h-7 min-w-7 items-center justify-center rounded-md px-1 font-mono hover:bg-surface"
              >
                {'</>'}
              </button>
              <button
                type="button"
                aria-label="Relancer le widget"
                title="Relancer (arrête un widget bloqué)"
                onClick={() => setRun((count) => count + 1)}
                className="nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
              >
                ↻
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Supprimer le widget"
            onClick={() => void blockActions.remove(id, 'widget')}
            className="nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
          >
            ×
          </button>
        </header>
        {current === null ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-xs text-content-muted">
            {actions.widget.isError
              ? 'Ce widget n’a pas pu être chargé.'
              : 'Décris l’outil voulu : Claude le fabriquera ici.'}
          </div>
        ) : showCode ? (
          <CodeView code={current} />
        ) : (
          <iframe
            key={`${current.id}-${scheme}-${run}`}
            title={current.title}
            src={widgetFrameUrl(id, current.id, scheme)}
            // Bac à sable (FR-007) : scripts seulement — ni même origine, ni fenêtres, ni boîtes de dialogue,
            // ni formulaires, ni navigation de la page. Le document interdit en plus tout réseau (CSP).
            // Inerte pendant un déplacement ou un redimensionnement : le cadre ne capture pas le glisser.
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            allow=""
            className={`nodrag nowheel min-h-0 w-full flex-1 border-0 bg-surface ${resizing || dragging ? 'pointer-events-none' : ''}`}
          />
        )}
        <Chat view={view} actions={actions} />
      </section>
    </>
  )
}
