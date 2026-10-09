import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { useCallback, useId, useRef, useState } from 'react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import { WIDGET_PROMPT_MAX_CHARS, type WidgetBuild, type WidgetView } from '@shared/ipc/widgets'
import { useEffectiveSettings } from '../../app/useAppSettings'
import { AiThinking } from '../../widgets/AiThinking'
import { CodeView } from '../../widgets/CodeView'
import { useWidget, type WidgetActions } from '../../widgets/useWidget'
import { useWidgetBridge } from '../../widgets/useWidgetBridge'
import { WidgetFullscreen } from '../../widgets/WidgetFullscreen'
import { useWidgetIo, useWidgetReview } from '../../widgets/useWidgetIo'
import { resolvedScheme, widgetFrameUrl } from '../../widgets/widgetFrame'
import type { WidgetNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'

const LIMITS = BLOCK_LIMITS.widget
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

/** Constructions prédéfinies (spec 026) : leur consigne complète est figée dans le main. */
const BUILDS: readonly { readonly action: WidgetBuild; readonly label: string; readonly hint: string }[] = [
  { action: 'wireframe', label: '🖼 Wireframe', hint: 'Écrans basse fidélité tirés du nœud, avec panneau de réglages' },
  { action: 'parcours', label: '🔀 Parcours', hint: 'Parcours jouable de l’utilisateur, écran par écran' },
  { action: 'adapter', label: '🛠 Adapter au nœud', hint: 'Claude choisit l’outil le plus utile pour ce nœud' }
]

/** Barre des constructions, visible dès qu'un nœud est branché sur le widget. */
function BuildBar({ actions }: { readonly actions: WidgetActions }) {
  return (
    <div
      role="group"
      aria-label="Générer à partir du nœud branché"
      className="nodrag flex shrink-0 flex-wrap gap-1 border-t border-content-muted/20 bg-surface-raised/60 px-2 pt-2"
    >
      {BUILDS.map((build) => (
        <button
          key={build.action}
          type="button"
          title={build.hint}
          disabled={actions.busy}
          onClick={() => void actions.build(build.action)}
          className="h-7 rounded-md border border-content-muted/30 bg-surface px-2 text-xs font-medium hover:border-accent disabled:opacity-50"
        >
          {build.label}
        </button>
      ))}
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
  /** Plein écran (spec 026 D8) : le cadre isolé quitte la carte pour une vue à taille réelle. */
  const [full, setFull] = useState(false)
  const closeFull = useCallback(() => setFull(false), [])
  /** « Arrêter » recharge le cadre : un widget qui boucle ne bloque que lui-même. */
  const [run, setRun] = useState(0)
  const scheme = resolvedScheme(settings.theme)
  // Entrées (spec 005) : ce qui est branché, et si la version affichée est autorisée à le lire.
  const io = useWidgetIo(id)
  const openReview = useWidgetReview((state) => state.open)
  const frame = useRef<HTMLIFrameElement>(null)
  useWidgetBridge(frame, id, current?.id ?? null, run)
  const inputCount = io.state.data?.inputs.length ?? 0
  // Un outil sans code n'a encore rien à revoir : la revue vient avec sa première version.
  const toReview = current !== null && inputCount > 0 && io.state.data?.approved === false
  const title = current?.title ?? 'Widget IA'
  const frameOf = (className: string): React.JSX.Element | null =>
    current === null ? null : (
      <iframe
        ref={frame}
        key={`${current.id}-${scheme}-${run}`}
        title={current.title}
        src={widgetFrameUrl(id, current.id, scheme)}
        // Bac à sable (FR-007) : scripts seulement — ni même origine, ni fenêtres, ni boîtes de dialogue,
        // ni formulaires, ni navigation de la page. Le document interdit en plus tout réseau (CSP).
        // Inerte pendant un déplacement ou un redimensionnement : le cadre ne capture pas le glisser.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        allow=""
        className={className}
      />
    )

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
        aria-label={title === 'Widget IA' ? 'Widget IA' : `Widget IA : ${title}`}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-content-muted/40 bg-surface text-content shadow-lg"
      >
        <header className="flex h-8 shrink-0 cursor-grab items-center gap-1 border-b border-content-muted/20 bg-surface-raised px-2 text-xs active:cursor-grabbing">
          <span aria-hidden="true">▣</span>
          <span className="flex-1 truncate font-semibold">{title}</span>
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
                aria-label="Plein écran"
                title="Ouvrir à taille réelle, avec les réglages à côté"
                onClick={() => setFull(true)}
                className="nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
              >
                ⤢
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
          {inputCount === 0 ? null : (
            <button
              type="button"
              aria-label={`Entrées du widget : ${inputCount}${toReview ? ', à revoir' : ''}`}
              title="Ce que ce widget lit : revoir, régler, débrancher"
              onClick={() => openReview(id)}
              className={`nodrag flex h-7 items-center justify-center gap-1 rounded-md px-1.5 hover:bg-surface ${toReview ? 'font-semibold text-con' : ''}`}
            >
              <span aria-hidden="true">⇢</span>
              {inputCount}
            </button>
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
              : inputCount === 0
                ? 'Tire un lien d’une idée ou d’une étape jusqu’ici pour générer un wireframe ou un parcours, ou décris l’outil voulu.'
                : 'Choisis Wireframe, Parcours ou Adapter, ou décris l’outil voulu : Claude le fabriquera ici.'}
          </div>
        ) : showCode ? (
          <CodeView code={current} />
        ) : full ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-xs text-content-muted">
            Ouvert en plein écran.
          </div>
        ) : (
          frameOf(
            `nodrag nowheel min-h-0 w-full flex-1 border-0 bg-surface ${resizing || dragging ? 'pointer-events-none' : ''}`
          )
        )}
        {toReview ? (
          <div role="alert" className="nodrag flex shrink-0 items-center gap-2 bg-con/10 px-2 py-1.5 text-xs">
            <p className="flex-1">
              À revoir : ce widget ne reçoit rien tant que tu n’as pas autorisé cette version à lire ce qui est branché.
            </p>
            <button
              type="button"
              onClick={() => openReview(id)}
              className="h-7 shrink-0 rounded-md bg-accent px-2 font-semibold text-surface"
            >
              Revoir
            </button>
          </div>
        ) : null}
        {inputCount === 0 ? null : <BuildBar actions={actions} />}
        <Chat view={view} actions={actions} />
        {/* Point d'arrivée d'un lien tiré depuis une idée ou une prochaine étape (spec 005 FR-001). */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectableStart={false}
          className="io-target"
          title="Tire un lien d’une idée jusqu’ici pour la brancher sur ce widget"
        />
      </section>
      {full && current !== null && !showCode ? (
        <WidgetFullscreen
          blockId={id}
          title={title}
          frame={frameOf('min-h-0 w-full flex-1 border-0 bg-surface')}
          footer={
            <>
              {inputCount === 0 ? null : <BuildBar actions={actions} />}
              <Chat view={view} actions={actions} />
            </>
          }
          onClose={closeFull}
        />
      ) : null}
    </>
  )
}
