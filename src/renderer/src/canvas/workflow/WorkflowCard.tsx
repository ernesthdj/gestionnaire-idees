import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import type { ElementView } from '@shared/ipc/canvas'
import type { WorkflowFileView, WorkflowView } from '@shared/ipc/workflow'
import { coveringElement, normalizeElementPath } from '@shared/structure/covers'
import { useUiStore } from '../../app/uiStore'
import { CodeLines } from '../../lib/CodeLines'
import { call, IpcFailure } from '../../lib/ipc'
import { cardHead } from '../cards/cardContent'
import { useCards, type OpenCard } from '../cards/cardsStore'
import { DetailCard, type NodeBox } from '../cards/DetailCard'
import { promptFor } from './prompts'
import type { WorkflowItem } from './workflowTree'

/**
 * « Discuter » sur un nœud Workflow (spec 023 D6) : la conversation du projet (genesis) s'ouvre dans sa carte, avec la
 * consigne pré-remplie ; rien n'est envoyé sans geste de mentalyas. Sans consigne (branche, spec), rien ne se passe.
 */
export function discussWorkflow(item: WorkflowItem, genesisId: string): boolean {
  const prompt = promptFor(item)
  if (prompt === null) return false
  useUiStore.getState().seedChatDraft(genesisId, prompt)
  useCards.getState().open(genesisId, { side: 'chat' })
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

/** Lecteur d'un fichier du projet dans une carte Workflow (spec 023) : texte brut numéroté, lecture seule. */
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
  const query = useQuery({
    queryKey: ['workflow', genesisId, 'file', path],
    queryFn: () => call<WorkflowFileView>('workflow:file', { genesisId, path })
  })
  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col gap-2 text-sm">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-content-muted">Fichier du projet · lecture seule</p>
          <h3 id={titleId} className="truncate font-mono text-sm font-semibold" title={path}>
            {path}
          </h3>
        </div>
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
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <CodeLines lines={query.data.lines} lang={query.data.lang} />
        </div>
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

/**
 * Rubrique « Fichiers » d'une carte Workflow (spec 023 US4, FR-012, FR-013) : chaque fichier cité s'ouvre avec son code
 * à droite ; un fichier introuvable est grisé ; « Voir dans la structure » mène à l'élément qui le couvre.
 */
function WorkflowFiles({
  files,
  missing,
  elements,
  onRead,
  onLocate
}: {
  readonly files: readonly string[]
  readonly missing: ReadonlySet<string>
  readonly elements: readonly ElementView[]
  readonly onRead: (path: string) => void
  readonly onLocate: (element: ElementView) => void
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
                <button
                  type="button"
                  className="shrink-0 rounded px-1 text-xs text-content-muted hover:bg-surface-raised hover:text-content"
                  aria-label={`Voir « ${element.title} » dans la structure`}
                  title={`Voir « ${element.title} » dans la structure`}
                  onClick={() => onLocate(element)}
                >
                  ↗ structure
                </button>
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
 * Carte de détails d'un nœud Workflow (spec 023 US2, US3) : en-tête (statut, avancement), « Discuter » qui ouvre la
 * conversation du projet avec la consigne pré-remplie, lecture des fichiers de méthode à droite, fiche (user stories,
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
  /** Éléments de la carte de structure du genesis (pont « Voir dans la structure »). */
  readonly elements: readonly ElementView[]
  readonly onGoto: (id: string) => void
}): React.JSX.Element {
  const cards = useCards()
  const setStructureView = useUiStore((state) => state.setStructureView)
  const workflow = useQuery({
    queryKey: ['workflow', genesisId],
    queryFn: () => call<WorkflowView>('workflow:read', { genesisId }),
    enabled: false
  })
  const files = filesOf(item)
  const missing = new Set(workflow.data?.missingFiles ?? [])
  // Pont vers la structure (D9) : bascule en Progression, puis la carte de l'élément s'ouvre et la vue glisse vers lui.
  const locate = (element: ElementView): void => {
    setStructureView(genesisId, 'progression')
    cards.open(element.id)
    window.setTimeout(() => onGoto(element.id), 80)
  }
  const fold = useWorkflowFold(genesisId)
  const read = (path: string): void => cards.setSide(card.id, 'reader', { source: 'workflow', path, tab: 'file' })
  const canDiscuss = promptFor(item) !== null
  const readables = readablesOf(item)
  const sheetKinds = new Set(['spec', 'story', 'socle', 'doc'])
  const actions =
    !canDiscuss && readables.length === 0 ? undefined : (
      <>
        {canDiscuss ? (
          <button
            type="button"
            className="card-button card-button-primary"
            onClick={() => discussWorkflow(item, genesisId)}
            title="Ouvre la conversation du projet avec la consigne pré-remplie (rien n’est envoyé sans toi)"
          >
            Discuter
          </button>
        ) : null}
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
      head={cardHead({ kind: 'workflow', item, genesisId })}
      {...(files.length === 0
        ? {}
        : {
            files: <WorkflowFiles files={files} missing={missing} elements={elements} onRead={read} onLocate={locate} />
          })}
      {...(actions === undefined ? {} : { actions })}
      {...(sheetKinds.has(item.subject.kind)
        ? { sheet: <WorkflowSheet item={item} onRead={read} />, sheetLabel: 'Détail' }
        : {})}
      canChat={false}
      {...(card.side === 'reader' && card.reader !== null
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
      onToggleChat={() => undefined}
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
