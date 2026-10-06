import { useEffect, useId, useRef, useState } from 'react'
import type {
  ChatMessageView,
  ChatPermissionRequest,
  ChatSheetView,
  PermissionDecisionView,
  PermissionDetailView,
  ToolStatus
} from '@shared/ipc/chat'
import { CHAT_MESSAGE_MAX } from '@shared/ipc/chat'
import { CLAUDE_MODELS } from '@shared/ipc/ai'
import { Button } from '../components/atoms/Button'
import { Markdown } from './Markdown'
import { ProjectForm } from './ProjectForm'
import { UsageMeter } from './UsageMeter'
import { useChat } from './useChat'

const MATURITY_LABELS: Readonly<Record<string, string>> = {
  insufficient: 'insuffisant',
  sufficient: 'suffisant',
  complete: 'complet'
}

/** Noms courts des modèles dans le chat (spec 010). */
const SHORT_MODEL_NAMES: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Opus 5.5',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-opus-5': 'Opus 5'
}

/** Demande de cartographie d'un projet lié (spec 009) : Claude lit le projet et dessine sa carte de structure. */
/** Demande sans ambiguïté du plan d'attaque du neurone ouvert (spec 011) : l'outil est nommé, l'ordre exigé. */
export const PLAN_MESSAGE =
  'Propose le plan d’attaque de ce neurone : appelle l’outil plan_proposer (sans id) avec 1 à 12 étapes, dans l’ordre ' +
  'où les attaquer, chacune avec un titre court, une phrase « pourquoi » et ce qu’elle attend. N’utilise pas dessiner ' +
  'et ne crée aucune idée : je validerai les étapes sur la carte. Si ce neurone n’est pas assez mûr, dis-moi plutôt ce ' +
  'qui manque.'

/** Demande sans ambiguïté d'un document détaillant le neurone ouvert (spec 012) : l'outil est nommé. */
export const DOC_MESSAGE =
  'Rédige un document qui détaille ce neurone : appelle l’outil document_ecrire (sans id). Fais-en un livrable ' +
  'explicite et complet — objectif, contexte, décisions et leurs raisons, étapes, points de vigilance, questions ' +
  'ouvertes — structuré en titres Markdown, sans recopier notre conversation et sans HTML. N’utilise pas dessiner.'

/** Demande sans ambiguïté d'évaluer l'étape ouverte comme action finale (spec 013) : l'outil est nommé. */
export const FINAL_MESSAGE =
  'Cette étape est-elle prête à être réalisée d’un seul tenant, sans plus de brainstorm ni de découpage ? Si oui, ' +
  'appelle l’outil action_proposer (sans id) : `livrable` = ce que tu produiras précisément (chemins de fichiers du ' +
  'projet lié, ou documents), `raison` = pourquoi elle est prête. Sinon, dis-moi ce qui manque ou s’il faut la ' +
  'découper. N’écris encore aucun fichier.'

export const MAP_MESSAGE =
  'Cartographie ce projet : lis CLAUDE.md, la documentation (docs/, specs/) et l’arborescence du code, puis dessine ' +
  'sa carte de structure avec structure_dessiner (modules, fonctionnalités avec leur statut, composants avec leurs ' +
  'fichiers, données, interfaces, tâches, décisions) et les liens typés entre eux. Si une carte existe déjà, relis-la ' +
  'avec structure_lire et mets-la à jour avec les mêmes clés. Ensuite, résume-moi la structure en quelques lignes.'

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

/** Résultat réel d'un outil dans le fil (spec 014 US3) : jamais le libellé d'une réussite pour un refus. */
const TOOL_STATUS: Readonly<
  Record<ToolStatus, { readonly label: string; readonly icon: string; readonly tone: string }>
> = {
  running: { label: 'en cours', icon: '…', tone: 'bg-accent/10 text-accent' },
  ok: { label: 'fait', icon: '✓', tone: 'bg-accent/10 text-accent' },
  denied: { label: 'refusé', icon: '⛔', tone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  error: { label: 'échoué', icon: '✕', tone: 'bg-red-500/10 text-red-700 dark:text-red-400' }
}

function ToolMessage({ message }: { readonly message: ChatMessageView }): React.JSX.Element {
  // Ancien fil (avant spec 014) : pas de statut, pastille neutre.
  const status = message.toolStatus === undefined ? null : TOOL_STATUS[message.toolStatus]
  const reason = message.toolReason ?? ''
  const label =
    status === null
      ? `Action de Claude : ${message.text}`
      : `Action de Claude : ${message.text} — ${status.label}${reason === '' ? '' : ` : ${reason}`}`
  return (
    <p
      className={`max-w-[85%] self-start rounded-2xl px-3 py-0.5 text-xs ${status?.tone ?? 'bg-accent/10 text-accent'}`}
      aria-label={label}
      title={reason === '' ? undefined : reason}
    >
      {status === null ? '⚙' : status.icon} {message.text}
      {status === null || message.toolStatus === 'ok' ? null : <span className="font-semibold"> — {status.label}</span>}
      {reason === '' || message.toolStatus === 'ok' ? null : <span className="block opacity-80">{reason}</span>}
    </p>
  )
}

const DECISION_LABELS: Readonly<Record<PermissionDecisionView, string>> = {
  allow: 'Autoriser',
  always: 'Toujours pour ce projet',
  deny: 'Refuser'
}

/** Ce que Claude veut faire, montré tel quel (texte, jamais interprété) avant la décision (spec 014 FR-004). */
function PermissionDetail({ detail }: { readonly detail: PermissionDetailView }): React.JSX.Element {
  if (detail.kind === 'write') {
    return (
      <>
        <p className="text-xs text-content-muted">
          Écrire dans <code className="break-all text-content">{detail.path}</code>
        </p>
        {detail.preview === '' ? null : (
          <pre
            aria-label="Aperçu du changement"
            className="max-h-48 overflow-auto rounded-md bg-surface px-2 py-1 text-xs whitespace-pre-wrap"
          >
            {detail.preview}
          </pre>
        )}
      </>
    )
  }
  if (detail.kind === 'command') {
    return (
      <>
        <pre
          aria-label="Commande exacte"
          className="max-h-32 overflow-auto rounded-md bg-surface px-2 py-1 text-xs whitespace-pre-wrap"
        >
          {detail.command}
        </pre>
        {detail.cwd === null ? null : (
          <p className="text-xs text-content-muted">
            Dans <code className="break-all text-content">{detail.cwd}</code>
          </p>
        )}
      </>
    )
  }
  return (
    <pre className="max-h-32 overflow-auto rounded-md bg-surface px-2 py-1 text-xs whitespace-pre-wrap">
      {detail.input}
    </pre>
  )
}

/**
 * Demande de permission de Claude Code (spec 014 US1) : une à la fois, dans l'ordre d'arrivée ; refuser l'une
 * n'autorise ni ne refuse les suivantes.
 */
function PermissionCard({
  request,
  waiting,
  onDecide
}: {
  readonly request: ChatPermissionRequest
  readonly waiting: number
  readonly onDecide: (decision: PermissionDecisionView) => void
}): React.JSX.Element {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="mx-3 mb-2 flex flex-col gap-2 rounded-lg border border-amber-500/60 bg-surface-raised px-3 py-2 text-sm"
    >
      <h3 id={titleId} className="font-semibold">
        Claude demande{' '}
        {request.detail.kind === 'write'
          ? 'à écrire un fichier'
          : request.detail.kind === 'command'
            ? 'à lancer une commande'
            : `l’outil ${request.tool}`}
      </h3>
      <PermissionDetail detail={request.detail} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => onDecide('allow')}>
          {DECISION_LABELS.allow}
        </Button>
        <Button onClick={() => onDecide('always')}>{DECISION_LABELS.always}</Button>
        <Button onClick={() => onDecide('deny')}>{DECISION_LABELS.deny}</Button>
        {waiting === 0 ? null : (
          <span className="text-xs text-content-muted">
            {waiting === 1 ? '1 autre demande en attente' : `${waiting} autres demandes en attente`}
          </span>
        )}
      </div>
    </section>
  )
}

function Message({ message }: { readonly message: ChatMessageView }): React.JSX.Element {
  if (message.role === 'tool') return <ToolMessage message={message} />
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
      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        mine ? 'self-end bg-accent whitespace-pre-wrap text-surface' : 'self-start bg-surface-raised text-content'
      }`}
    >
      <span className="sr-only">{mine ? 'Toi : ' : 'Claude : '}</span>
      {/* Ce que tu écris reste du texte ; les réponses de Claude sont mises en forme (Markdown sûr). */}
      {mine ? message.text : <Markdown text={message.text} />}
    </div>
  )
}

/**
 * Chat d'un neurone (spec 008 lot A) : une vraie conversation Claude Code. La réponse s'écrit au fil de l'eau, les
 * actions de Claude apparaissent en pastilles, la fiche du neurone se met à jour au-dessus. Entrée envoie,
 * Maj+Entrée va à la ligne. Les réponses sont mises en forme en Markdown, sans jamais interpréter de HTML.
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
  const nextRequest = chat.pending[0]
  const [projectForm, setProjectForm] = useState(false)
  // Après le premier brainstorm (maturité suffisante), devenir un projet est l'étape suivante : le bouton est mis en avant.
  const brainstormed = chat.maturity === 'sufficient' || chat.maturity === 'complete'

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
            {chat.role === 'element'
              ? `${chat.elementType ?? 'Élément'} du projet`
              : chat.role === 'step'
                ? `Étape ${chat.stepLabel ?? ''} du plan d’attaque`
                : chat.folder === null
                  ? 'Genesis'
                  : 'Projet'}{' '}
            · conversation Claude Code
            {chat.maturity === null ? '' : ` · maturité : ${MATURITY_LABELS[chat.maturity] ?? chat.maturity}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {chat.role !== 'genesis' ? null : chat.folder === null ? (
              <>
                <button
                  type="button"
                  onClick={() => setProjectForm(true)}
                  disabled={chat.busy || projectForm}
                  className={`rounded-md px-2 py-0.5 disabled:opacity-50 ${
                    brainstormed ? 'bg-accent text-surface' : 'border border-accent text-accent hover:bg-surface-raised'
                  }`}
                >
                  Faire de ce genesis un projet
                </button>
                <button
                  type="button"
                  onClick={() => void chat.linkFolder()}
                  disabled={chat.busy}
                  className="underline disabled:opacity-50"
                >
                  Lier un dossier existant…
                </button>
              </>
            ) : (
              <>
                <span
                  className="rounded-full bg-surface-raised px-2 py-0.5"
                  title="Dossier de travail de cette conversation"
                >
                  Dossier : {chat.folder}
                  {chat.git ? ' · git' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => void chat.linkFolder()}
                  disabled={chat.busy}
                  className="underline disabled:opacity-50"
                >
                  Changer
                </button>
                {chat.git ? null : (
                  <button
                    type="button"
                    onClick={() => void chat.initGit()}
                    disabled={chat.busy}
                    className="rounded-md border border-content-muted/40 px-2 py-0.5 hover:bg-surface-raised disabled:opacity-50"
                  >
                    Initialiser git
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void chat.send(MAP_MESSAGE)}
                  disabled={chat.busy}
                  className="rounded-md bg-accent px-2 py-0.5 text-surface disabled:opacity-50"
                >
                  Cartographier ce projet
                </button>
              </>
            )}
            {chat.role === 'element' ? null : (
              <button
                type="button"
                onClick={() => void chat.send(PLAN_MESSAGE)}
                disabled={chat.busy}
                className="rounded-md border border-accent px-2 py-0.5 text-accent hover:bg-surface-raised disabled:opacity-50"
              >
                Proposer un plan d’attaque
              </button>
            )}
            {chat.role === 'element' ? null : (
              <button
                type="button"
                onClick={() => void chat.send(DOC_MESSAGE)}
                disabled={chat.busy}
                className="rounded-md border border-content-muted/40 px-2 py-0.5 hover:bg-surface-raised disabled:opacity-50"
              >
                Rédiger un document
              </button>
            )}
            {chat.role === 'step' ? (
              <button
                type="button"
                onClick={() => void chat.send(FINAL_MESSAGE)}
                disabled={chat.busy}
                className="rounded-md border border-action px-2 py-0.5 text-action hover:bg-surface-raised disabled:opacity-50"
              >
                Proposer l’action finale
              </button>
            ) : null}
          </div>
        </div>
        <label className="sr-only" htmlFor={`${fieldId}-model`}>
          Modèle de cette conversation
        </label>
        <select
          id={`${fieldId}-model`}
          value={chat.modelChoice ?? ''}
          disabled={chat.busy || chat.loading}
          onChange={(event) => void chat.setModel(event.target.value === '' ? null : event.target.value)}
          title="Modèle de cette conversation"
          className="h-8 max-w-44 rounded-md border border-content-muted/40 bg-surface px-1 text-xs"
        >
          <option value="">Défaut ({SHORT_MODEL_NAMES[chat.model] ?? chat.model})</option>
          {CLAUDE_MODELS.map((model) => (
            <option key={model} value={model}>
              {SHORT_MODEL_NAMES[model] ?? model}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Fermer la conversation"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-raised"
        >
          ×
        </button>
      </header>

      {projectForm && chat.role === 'genesis' && chat.folder === null ? (
        <ProjectForm
          neuronId={neuronId}
          title={chat.title}
          summary={chat.sheet?.resume ?? ''}
          onCancel={() => setProjectForm(false)}
          onDone={() => {
            setProjectForm(false)
            void chat.refreshProject()
          }}
        />
      ) : null}

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
            <div className="max-w-[85%] self-start rounded-2xl bg-surface-raised px-3 py-2 text-sm leading-relaxed">
              {chat.partial === '' ? (
                <span className="text-content-muted">Claude réfléchit…</span>
              ) : (
                <Markdown text={chat.partial} />
              )}
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

      {nextRequest === undefined ? null : (
        <PermissionCard
          key={nextRequest.id}
          request={nextRequest}
          waiting={chat.pending.length - 1}
          onDecide={(decision) => void chat.decide(nextRequest.id, decision)}
        />
      )}

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
