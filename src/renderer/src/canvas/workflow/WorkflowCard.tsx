import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { ElementView } from '@shared/ipc/canvas'
import type { WorkflowFileView, WorkflowSymbolView, WorkflowView } from '@shared/ipc/workflow'
import { KIND_LABELS } from '../../explorer/labels'
import { coveringElement, normalizeElementPath } from '@shared/structure/covers'
import { useUiStore } from '../../app/uiStore'
import { ChatPanel } from '../../chat/ChatPanel'
import { Markdown } from '../../chat/Markdown'
import { CodeLines } from '../../lib/CodeLines'
import { call, IpcFailure } from '../../lib/ipc'
import { cardHead } from '../cards/cardContent'
import { useCards, type OpenCard } from '../cards/cardsStore'
import { DetailCard, type NodeBox } from '../cards/DetailCard'
import { promptFor } from './prompts'
import { decorateTasks } from './tasksMarkdown'
import type { WorkflowItem } from './workflowTree'

/**
 * « Discuter » sur un nœud Workflow (spec 023 D6, précisé le 2026-10-09) : la carte du nœud s'étire vers la droite avec
 * **sa propre conversation** (créée au premier « Discuter », reprise ensuite), la consigne pré-remplie dans le champ ;
 * rien n'est envoyé sans geste de mentalyas. Sans consigne (branche, message), rien ne se passe.
 */
export function discussWorkflow(item: WorkflowItem): boolean {
  const prompt = promptFor(item)
  if (prompt === null) return false
  useUiStore.getState().seedChatDraft(item.key, prompt)
  useCards.getState().open(item.key, { side: 'chat' })
  return true
}

/** Repli d'un nœud Workflow : la vue en cache change tout de suite, le choix est mémorisé ensuite (FR-016). */
export function useWorkflowFold(genesisId: string): (key: string, folded: boolean) => void {
  const client = useQueryClient()
  return (key, folded) => {
    client.setQueryData<WorkflowView>(['workflow', genesisId], (current) =>
      current === undefined ? current : { ...current, folded: { ...current.folded, [key]: folded } }
    )
    void call('workflow:setFolded', { genesisId, key, folded }).catch(() =>
      client.invalidateQueries({ queryKey: ['workflow', genesisId] })
    )
  }
}

/**
 * Lecteur d'un fichier du projet dans une carte Workflow (spec 023) : code numéroté et coloré, lecture seule ; au-dessus,
 * les raccourcis vers ses classes, fonctions et méthodes repérées par l'analyse syntaxique (D12) — un clic surligne
 * le code concerné et la vue s'y place. Un fichier Markdown s'affiche mis en forme, ou en texte brut à la demande (D13).
 */
export function WorkflowFileReader({
  genesisId,
  path,
  onClose
}: {
  readonly genesisId: string
  readonly path: string
  readonly onClose: () => void
}): React.JSX.Element {
  const titleId = useId()
  const [marked, setMarked] = useState<{ readonly from: number; readonly to: number } | null>(null)
  const query = useQuery({
    queryKey: ['workflow', genesisId, 'file', path],
    queryFn: () => call<WorkflowFileView>('workflow:file', { genesisId, path })
  })
  // Analyse en parallèle de la lecture : le code s'affiche tout de suite, les raccourcis dès qu'ils sont prêts.
  const symbols = useQuery({
    queryKey: ['workflow', genesisId, 'symbols', path],
    queryFn: () => call<readonly WorkflowSymbolView[]>('workflow:symbols', { genesisId, path }),
    enabled: query.data !== undefined && query.data.lang !== 'other'
  })
  const shortcuts = symbols.data ?? []
  // Fichier de méthode Markdown (D13) : mis en forme par défaut, texte brut à la demande.
  const isMarkdown = /\.md$/i.test(path)
  const [formatted, setFormatted] = useState(true)
  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col gap-2 text-sm">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-content-muted">Fichier du projet · lecture seule</p>
          <h3 id={titleId} className="truncate font-mono text-sm font-semibold" title={path}>
            {path}
          </h3>
        </div>
        {isMarkdown ? (
          <div role="group" aria-label="Affichage du fichier" className="flex shrink-0 gap-0.5">
            {[
              { value: true, label: 'Mis en forme' },
              { value: false, label: 'Texte brut' }
            ].map((mode) => (
              <button
                key={mode.label}
                type="button"
                aria-pressed={formatted === mode.value}
                onClick={() => setFormatted(mode.value)}
                className={`rounded px-1.5 py-0.5 text-xs hover:bg-surface-raised ${
                  formatted === mode.value ? 'bg-accent/15 font-semibold' : 'text-content-muted'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="detail-card-close" aria-label="Fermer le fichier" onClick={onClose}>
          ✕
        </button>
      </header>
      {query.error !== null ? (
        <p role="alert" className="text-con">
          {query.error instanceof IpcFailure ? query.error.message : 'Le fichier n’a pas pu être lu.'}
        </p>
      ) : query.data === undefined ? (
        <p className="text-content-muted">Lecture du fichier…</p>
      ) : isMarkdown && formatted ? (
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <Markdown
            inertLinks
            text={
              /(^|\/)tasks\.md$/i.test(path) ? decorateTasks(query.data.lines.join('\n')) : query.data.lines.join('\n')
            }
          />
        </div>
      ) : (
        <>
          {shortcuts.length === 0 ? null : (
            <nav aria-label="Raccourcis du fichier" className="max-h-36 shrink-0 overflow-y-auto">
              <ul className="flex flex-col gap-0.5">
                {shortcuts.map((symbol) => (
                  <li key={`${symbol.kind}:${symbol.name}:${symbol.startLine}`}>
                    <button
                      type="button"
                      aria-pressed={marked?.from === symbol.startLine}
                      onClick={() => setMarked({ from: symbol.startLine, to: symbol.endLine })}
                      className={`w-full truncate rounded px-1 text-left text-xs hover:bg-surface-raised ${
                        symbol.kind === 'method' ? 'pl-4' : ''
                      } ${marked?.from === symbol.startLine ? 'bg-accent/15' : ''}`}
                    >
                      <span aria-hidden="true">{KIND_LABELS[symbol.kind].icon} </span>
                      <span className="font-mono">{symbol.name}</span>
                      <span className="text-content-muted">
                        {' '}
                        · {KIND_LABELS[symbol.kind].text} · ligne {symbol.startLine}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            <CodeLines lines={query.data.lines} lang={query.data.lang} marked={marked} />
          </div>
        </>
      )}
    </section>
  )
}

/** Petit bouton de lecture d'un fichier dans la carte. */
function ReadButton({
  path,
  label,
  onRead
}: {
  readonly path: string
  readonly label: string
  readonly onRead: (path: string) => void
}): React.JSX.Element {
  return (
    <button type="button" className="card-button card-button-ghost" onClick={() => onRead(path)} title={path}>
      {label}
    </button>
  )
}

/** Fiche (étirement vers le bas) d'un nœud Workflow : ce qu'il contient, sans ouvrir de fichier. */
function WorkflowSheet({
  item,
  onRead
}: {
  readonly item: WorkflowItem
  readonly onRead: (path: string) => void
}): React.JSX.Element | null {
  const { subject } = item
  const taskList = (tasks: readonly { id: string; text: string }[], empty: string): React.JSX.Element =>
    tasks.length === 0 ? (
      <p className="text-content-muted">{empty}</p>
    ) : (
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <li key={task.id}>
            <span className="font-mono text-xs font-semibold">{task.id}</span> {task.text.replace(/`/g, '')}
          </li>
        ))}
      </ul>
    )
  switch (subject.kind) {
    case 'spec': {
      const { spec } = subject
      return (
        <div className="flex flex-col gap-3 text-sm">
          <section aria-label="User stories">
            <h4 className="mb-1 text-xs font-semibold text-content-muted">User stories</h4>
            {spec.stories.length === 0 ? (
              <p className="text-content-muted">Aucune user story décrite.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {spec.stories.map((story) => (
                  <li key={story.number}>
                    {story.delivered ? '✔ ' : ''}
                    <span className="font-semibold">
                      US{story.number}
                      {story.priority === null ? '' : ` · P${story.priority}`}
                    </span>{' '}
                    {story.described ? story.title : '(user story non décrite)'}
                    {story.total === 0 ? null : (
                      <span className="text-content-muted">
                        {' '}
                        · {story.done}/{story.total}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {spec.leftovers.length === 0 ? null : (
            <section aria-label="Reliquats">
              <h4 className="mb-1 text-xs font-semibold text-content-muted">Reliquats ({spec.leftovers.length})</h4>
              {taskList(spec.leftovers, '')}
            </section>
          )}
          {spec.citedDocs.length === 0 ? null : (
            <section aria-label="Brainstorm d’origine">
              <h4 className="mb-1 text-xs font-semibold text-content-muted">Brainstorm d’origine</h4>
              <div className="flex flex-wrap gap-1">
                {spec.citedDocs.map((name) => (
                  <ReadButton key={name} path={`docs/brainstorm/${name}`} label={name} onRead={onRead} />
                ))}
              </div>
            </section>
          )}
        </div>
      )
    }
    case 'story':
      return taskList(
        subject.story.tasks.filter((task) => !task.done),
        'Toutes ses tâches sont faites.'
      )
    case 'socle':
      return taskList(
        subject.spec.socle.filter((task) => !task.done),
        'Toutes les tâches du socle sont faites.'
      )
    case 'doc':
      return subject.family.length === 0 ? (
        <p className="text-content-muted">Pas encore de document de détail.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {subject.family.map((doc) => (
            <ReadButton key={doc.name} path={`docs/brainstorm/${doc.name}`} label={doc.name} onRead={onRead} />
          ))}
        </div>
      )
    default:
      return null
  }
}

/** Fichiers de code cités par un nœud (spec 023 D9) : la tâche, l'union de ses tâches pour une user story, un socle, une spec. */
export function filesOf(item: WorkflowItem): readonly string[] {
  const { subject } = item
  const union = (tasks: readonly { readonly files: readonly string[] }[]): string[] => [
    ...new Set(tasks.flatMap((task) => task.files))
  ]
  switch (subject.kind) {
    case 'task':
      return subject.task.files
    case 'story':
      return subject.story.files
    case 'socle':
      return union(subject.spec.socle)
    case 'spec':
      return union([...subject.spec.socle, ...subject.spec.stories.flatMap((story) => story.tasks)])
    default:
      return []
  }
}

/** Élément de la carte de structure qui couvre un fichier, parmi ceux du genesis (le plus profond, le plus précis). */
export function elementCovering(elements: readonly ElementView[], file: string): ElementView | null {
  const byId = new Map(elements.map((element) => [element.id, element] as const))
  const depthOf = (element: ElementView): number => {
    let depth = 0
    for (let parent = byId.get(element.parentId); parent !== undefined && depth < 100; depth++) {
      parent = byId.get(parent.parentId)
    }
    return depth
  }
  const id = coveringElement(
    elements.map((element) => ({
      id: element.id,
      depth: depthOf(element),
      paths: element.paths.map(normalizeElementPath).filter((path) => path !== '')
    })),
    file
  )
  return id === null ? null : (byId.get(id) ?? null)
}

/** Nom d'un élément de structure précédé de celui de son parent (s'il en a un sous le genesis) : « Carte › Workflow ». */
export function trailOf(elements: readonly ElementView[], element: ElementView): string {
  const parent = elements.find((candidate) => candidate.id === element.parentId)
  return parent === undefined ? element.title : `${parent.title} › ${element.title}`
}

/**
 * Rubrique « Fichiers » d'une carte Workflow (spec 023 US4, FR-012, FR-013) : chaque fichier cité s'ouvre avec son code
 * à droite ; un fichier introuvable est grisé ; le module de la structure qui le couvre s'affiche à côté, sur place
 * (D9 révisé le 2026-10-09 : plus de bascule en Progression).
 */
function WorkflowFiles({
  files,
  missing,
  elements,
  onRead
}: {
  readonly files: readonly string[]
  readonly missing: ReadonlySet<string>
  readonly elements: readonly ElementView[]
  readonly onRead: (path: string) => void
}): React.JSX.Element {
  return (
    <details open className="text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-content-muted">Fichiers ({files.length})</summary>
      <ul className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {files.map((file) => {
          const absent = missing.has(file)
          const element = absent ? null : elementCovering(elements, file)
          return (
            <li key={file} className="flex items-center gap-1">
              {absent ? (
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs text-content-muted line-through"
                  title={`${file} : introuvable dans le dossier du projet`}
                >
                  {file}
                </span>
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate rounded px-1 text-left font-mono text-xs hover:bg-surface-raised"
                  title={`Lire ${file}`}
                  onClick={() => onRead(file)}
                >
                  {file}
                </button>
              )}
              {element === null ? null : (
                <span
                  className="max-w-[45%] shrink-0 truncate text-xs text-content-muted"
                  title={`Module de la structure : ${trailOf(elements, element)}`}
                >
                  · {trailOf(elements, element)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

/** Fichiers de méthode à lire depuis la carte d'un nœud. */
function readablesOf(item: WorkflowItem): { path: string; label: string }[] {
  const { subject } = item
  switch (subject.kind) {
    case 'spec':
      return [
        { path: `${subject.spec.dir}/spec.md`, label: 'Lire la spec' },
        { path: `${subject.spec.dir}/tasks.md`, label: 'Lire les tâches' },
        { path: `${subject.spec.dir}/plan.md`, label: 'Lire le plan' }
      ]
    case 'story':
    case 'socle':
    case 'task':
      return [{ path: `${subject.spec.dir}/tasks.md`, label: 'Lire les tâches' }]
    case 'doc':
      return [{ path: `docs/brainstorm/${subject.doc.name}`, label: 'Lire le document' }]
    default:
      return []
  }
}

/**
 * Carte de détails d'un nœud Workflow (spec 023 US2, US3) : en-tête (statut, avancement), « Discuter » qui étire la
 * carte vers la droite avec la conversation propre au nœud et la consigne pré-remplie, lecture des fichiers de méthode à droite, fiche (user stories,
 * reliquats, brainstorm d'origine, tâches restantes) vers le bas, repli de ses sous-nœuds.
 */
export function WorkflowCard({
  card,
  active,
  anchor,
  zoom,
  item,
  genesisId,
  elements,
  onGoto
}: {
  readonly card: OpenCard
  readonly active: boolean
  readonly anchor: NodeBox
  readonly zoom: number
  readonly item: WorkflowItem
  readonly genesisId: string
  /** Éléments de la carte de structure du genesis (module qui couvre chaque fichier cité). */
  readonly elements: readonly ElementView[]
  readonly onGoto: (id: string) => void
}): React.JSX.Element {
  const cards = useCards()
  const workflow = useQuery({
    queryKey: ['workflow', genesisId],
    queryFn: () => call<WorkflowView>('workflow:read', { genesisId }),
    enabled: false
  })
  const files = filesOf(item)
  const missing = new Set(workflow.data?.missingFiles ?? [])
  const fold = useWorkflowFold(genesisId)
  const read = (path: string): void => cards.setSide(card.id, 'reader', { source: 'workflow', path, tab: 'file' })
  const canDiscuss = promptFor(item) !== null
  // Conversation propre au nœud : retrouvée ou créée quand la discussion s'ouvre (spec 023 D6).
  const head = cardHead({ kind: 'workflow', item, genesisId })
  const chat = useQuery({
    queryKey: ['workflow-chat', item.key],
    queryFn: () =>
      call<{ readonly neuronId: string }>('workflow:chat', {
        genesisId,
        key: item.key,
        title: `${head.badge} · ${head.title}`.slice(0, 200)
      }),
    enabled: card.side === 'chat' && canDiscuss,
    staleTime: Infinity
  })
  const readables = readablesOf(item)
  const sheetKinds = new Set(['spec', 'story', 'socle', 'doc'])
  const actions =
    readables.length === 0 ? undefined : (
      <>
        {readables.map((entry) => (
          <ReadButton key={entry.path} path={entry.path} label={entry.label} onRead={read} />
        ))}
      </>
    )
  return (
    <DetailCard
      card={card}
      active={active}
      anchor={anchor}
      zoom={zoom}
      head={head}
      {...(files.length === 0
        ? {}
        : {
            files: <WorkflowFiles files={files} missing={missing} elements={elements} onRead={read} />
          })}
      {...(actions === undefined ? {} : { actions })}
      {...(sheetKinds.has(item.subject.kind)
        ? { sheet: <WorkflowSheet item={item} onRead={read} />, sheetLabel: 'Détail' }
        : {})}
      canChat={canDiscuss}
      {...(card.side === 'chat' && canDiscuss
        ? {
            side:
              chat.data === undefined ? (
                <p
                  className={chat.error === null ? 'text-content-muted' : 'text-con'}
                  role={chat.error === null ? undefined : 'alert'}
                >
                  {chat.error === null
                    ? 'Ouverture de la conversation…'
                    : chat.error instanceof IpcFailure
                      ? chat.error.message
                      : 'La conversation n’a pas pu être ouverte.'}
                </p>
              ) : (
                <ChatPanel
                  neuronId={chat.data.neuronId}
                  draftKey={card.id}
                  onClose={() => cards.setSide(card.id, null)}
                />
              )
          }
        : card.side === 'reader' && card.reader !== null
          ? {
              side: (
                <WorkflowFileReader
                  key={card.reader.path}
                  genesisId={genesisId}
                  path={card.reader.path}
                  onClose={() => cards.setSide(card.id, null)}
                />
              )
            }
          : {})}
      {...(item.descendants === 0
        ? {}
        : {
            fold: {
              collapsed: item.collapsed,
              count: item.descendants,
              onToggle: () => fold(item.key, !item.collapsed),
              noun: 'sous-nœuds'
            }
          })}
      onActivate={() => cards.activate(card.id)}
      onClose={() => cards.close(card.id)}
      onMove={(offset) => cards.move(card.id, offset)}
      onToggleSheet={() => cards.toggleSheet(card.id)}
      onTogglePin={() => cards.togglePin(card.id)}
      onToggleChat={() => (card.side === 'chat' ? cards.setSide(card.id, null) : discussWorkflow(item))}
      onEscape={() => (card.side === 'reader' ? cards.setSide(card.id, null) : cards.close(card.id))}
      onGoto={onGoto}
    />
  )
}

/**
 * Fondation du projet dans la carte de son genesis, en vue Workflow (spec 023 US3, FR-014) : résumé de
 * `docs/FOUNDATION.md` et lecture dans la carte. Lue dans la vue déjà chargée (aucune lecture de plus).
 */
export function WorkflowFoundation({
  genesisId,
  onRead
}: {
  readonly genesisId: string
  readonly onRead: (path: string) => void
}): React.JSX.Element | null {
  const query = useQuery({
    queryKey: ['workflow', genesisId],
    queryFn: () => call<WorkflowView>('workflow:read', { genesisId }),
    enabled: false
  })
  const foundation = query.data?.foundation ?? null
  if (foundation === null) return null
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="text-xs font-semibold text-content-muted">Fondation du projet</p>
      <p className="detail-card-summary">{foundation.summary}</p>
      <div>
        <ReadButton path={foundation.path} label="Lire la fondation" onRead={onRead} />
      </div>
    </div>
  )
}
