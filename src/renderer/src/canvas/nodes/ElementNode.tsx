import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import { ARCHITECTURES } from '@shared/structure/architecture'
import { useUiStore } from '../../app/uiStore'
import type { ElementStatus, ElementType } from '@shared/ipc/canvas'
import { call } from '../../lib/ipc'
import type { ElementNodeType } from '../buildGraph'
import { contentLabel } from '../elementContent'
import { ELEMENT_SIZE } from '../structureGraph'

/** Pastille de chaque type d'élément (L1e §3) : symbole et couleur, toujours accompagnés du libellé (pas la couleur seule). */
export const ELEMENT_STYLES: Readonly<
  Record<ElementType, { readonly icon: string; readonly label: string; readonly tone: string }>
> = {
  module: { icon: '▣', label: 'Module', tone: 'border-sky-500/60 text-sky-700 dark:text-sky-300' },
  fonctionnalite: {
    icon: '◆',
    label: 'Fonctionnalité',
    tone: 'border-violet-500/60 text-violet-700 dark:text-violet-300'
  },
  composant: { icon: '▢', label: 'Composant', tone: 'border-emerald-500/60 text-emerald-700 dark:text-emerald-300' },
  donnee: { icon: '⛁', label: 'Donnée', tone: 'border-amber-500/60 text-amber-700 dark:text-amber-300' },
  interface: { icon: '⇄', label: 'Interface', tone: 'border-cyan-500/60 text-cyan-700 dark:text-cyan-300' },
  tache: { icon: '☐', label: 'Tâche', tone: 'border-rose-500/60 text-rose-700 dark:text-rose-300' },
  decision: { icon: '◇', label: 'Décision', tone: 'border-zinc-500/60 text-zinc-700 dark:text-zinc-300' },
  operation: { icon: '✚', label: 'Opération', tone: 'border-orange-500/60 text-orange-700 dark:text-orange-300' }
}

export const STATUS_LABELS: Readonly<Record<ElementStatus, string>> = {
  idee: 'idée',
  specifiee: 'spécifiée',
  en_cours: 'en cours',
  livree: 'livrée',
  a_faire: 'à faire',
  faite: 'faite',
  bloquee: 'bloquée'
}

/**
 * État visuel du statut (spec 017 D19) : pastille (icône + libellé, jamais la couleur seule) et bande latérale ; un
 * élément bloqué a en plus un contour en pointillés.
 */
const STATUS_STYLES: Readonly<
  Record<
    ElementStatus,
    { readonly icon: string; readonly pill: string; readonly stripe: string; readonly ring?: string }
  >
> = {
  idee: { icon: '○', pill: 'bg-zinc-200 text-zinc-800', stripe: 'bg-zinc-400' },
  specifiee: { icon: '◇', pill: 'bg-zinc-200 text-zinc-800', stripe: 'bg-zinc-400' },
  a_faire: { icon: '○', pill: 'bg-zinc-200 text-zinc-800', stripe: 'bg-zinc-400' },
  en_cours: { icon: '◐', pill: 'bg-blue-600 text-white', stripe: 'bg-blue-500' },
  livree: { icon: '✓', pill: 'bg-green-700 text-white', stripe: 'bg-green-500' },
  faite: { icon: '✓', pill: 'bg-green-700 text-white', stripe: 'bg-green-500' },
  bloquee: {
    icon: '⛔',
    pill: 'bg-red-700 text-white',
    stripe: 'bg-red-500',
    ring: 'outline-2 outline-offset-2 outline-dashed outline-red-500'
  }
}

/**
 * Aspect selon le contenu réel (spec 017 D18) : une page pour la documentation, un éditeur pour le code. Les couleurs
 * de texte sont fixées par aspect pour garder le contraste dans les deux thèmes ; le type de Claude reste affiché.
 */
const SKINS = {
  none: {
    article: 'border-2 bg-surface-raised',
    header: '',
    title: 'text-content',
    muted: 'text-content-muted',
    pill: 'bg-surface text-content-muted'
  },
  code: {
    article: 'border-2 bg-zinc-900',
    header: 'text-zinc-100',
    title: 'text-zinc-50',
    muted: 'text-zinc-300',
    pill: 'bg-zinc-700 text-zinc-100'
  },
  doc: {
    article: 'border bg-stone-50 dark:bg-stone-100',
    header: 'text-stone-800',
    title: 'text-stone-900',
    muted: 'text-stone-600',
    pill: 'bg-stone-200 text-stone-700'
  }
} as const

/**
 * Élément d'une carte de structure (spec 009) : type, titre, statut, résumé, fichiers, et « ▸ N » pour déplier ses
 * enfants. Un clic sur la carte ouvre sa conversation (géré par la carte) ; le bouton de repli ne l'ouvre pas.
 */
export function ElementNode({ data }: NodeProps<ElementNodeType>): React.JSX.Element {
  const { element, number } = data
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const layers =
    data.architecture === null || data.architecture === undefined ? [] : ARCHITECTURES[data.architecture].layers
  const style = ELEMENT_STYLES[element.type]
  const content = element.content ?? null
  const skin = SKINS[content?.kind ?? 'none']
  const status = element.status === null ? null : STATUS_STYLES[element.status]
  const toggle = (event: React.MouseEvent): void => {
    event.stopPropagation()
    void call('element:setCollapsed', { elementId: element.id, collapsed: !element.collapsed }).then(() =>
      client.invalidateQueries({ queryKey: ['canvas'] })
    )
  }
  const paths = `${element.paths.length} chemin${element.paths.length > 1 ? 's' : ''}`
  // Avancement (D21) : barre au pied du nœud, % dans le pied, reste à faire ou origine au survol.
  const progress = data.progress ?? null
  const progressTitle =
    progress === null
      ? ''
      : progress.fromChildren
        ? `Avancement ${progress.percent} % : moyenne de ses sous-éléments`
        : `Avancement ${progress.percent} %${element.progressNote === null || element.progressNote === undefined ? '' : ` — reste : ${element.progressNote}`}`
  // Couche (D20) : corrigée ici même, annulable par la notification.
  const setLayer = (value: string): void => {
    void call<{ readonly batchId: string }>('element:setLayer', {
      elementId: element.id,
      layer: value === '' ? null : value
    })
      .then(({ batchId }) => {
        showToast(`Couche de « ${element.title} » changée.`, { batchId, undoneText: 'Couche remise comme avant.' })
        return client.invalidateQueries({ queryKey: ['canvas'] })
      })
      .catch(() => showToast('La couche n’a pas pu être changée.'))
  }
  return (
    <article
      className={`relative flex flex-col gap-1 overflow-hidden rounded-lg py-3 pr-3 pl-4 shadow-sm ${skin.article} ${style.tone} ${status?.ring ?? ''}`}
      style={{ width: ELEMENT_SIZE.width, height: ELEMENT_SIZE.height }}
      data-content={content?.kind ?? 'none'}
      data-status={element.status ?? 'none'}
    >
      {status === null ? null : (
        // Bande du statut, sur toute la hauteur du bord gauche.
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${status.stripe}`} />
      )}
      {content?.kind === 'doc' ? (
        // Coin replié de la page.
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 h-4 w-4 bg-stone-300 [clip-path:polygon(0_0,100%_100%,0_100%)]"
        />
      ) : null}
      {/* Une seule ligne : rien ne passe à la ligne, le badge de contenu reste entier à droite. */}
      <header className={`flex h-5 items-center gap-2 text-xs font-medium whitespace-nowrap ${skin.header}`}>
        {number === '' ? null : (
          <span
            className="shrink-0 rounded bg-content px-1.5 font-mono text-[11px] leading-5 font-semibold text-surface"
            title="Numéro de progression : ordre logique de développement"
          >
            {number}
          </span>
        )}
        <span aria-hidden="true">{style.icon}</span>
        <span className="truncate">{style.label}</span>
        {element.status === null || status === null ? null : (
          <span className={`shrink-0 rounded-full px-1.5 leading-5 font-semibold ${status.pill}`}>
            <span aria-hidden="true">{status.icon}</span> {STATUS_LABELS[element.status]}
          </span>
        )}
        {content === null ? null : (
          <span
            className={`ml-auto shrink-0 rounded px-1.5 font-mono text-[11px] leading-5 ${skin.pill}`}
            title={`Cet élément ${contentLabel(content)}`}
          >
            {content.kind === 'doc' ? '📄 Doc' : `</> Code${content.doc > 0 ? ` + ${content.doc} doc` : ''}`}
          </span>
        )}
      </header>
      <h3 className={`line-clamp-2 text-sm leading-5 font-semibold break-words ${skin.title}`} title={element.title}>
        {element.title}
      </h3>
      {element.summary === null ? null : (
        <p className={`line-clamp-2 min-h-0 text-xs leading-4 break-words ${skin.muted}`} title={element.summary}>
          {element.summary}
        </p>
      )}
      {progress === null ? null : (
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 left-1 h-1 bg-content-muted/20"
          title={progressTitle}
          data-progress={progress.percent}
        >
          <span
            className={`block h-full ${progress.percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progress.percent}%` }}
          />
        </span>
      )}
      <footer className={`mt-auto flex h-5 items-center gap-2 text-[11px] leading-4 whitespace-nowrap ${skin.muted}`}>
        {layers.length === 0 ? null : (
          <span className="flex shrink-0 items-center gap-1">
            <select
              value={element.layer ?? ''}
              onChange={(event) => setLayer(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Couche de « ${element.title} »`}
              title={
                element.layerSource === 'deduite'
                  ? 'Couche déduite par l’app d’après les dossiers : choisis-la pour la fixer'
                  : element.layerSource === 'user'
                    ? 'Couche choisie par toi'
                    : 'Couche donnée par Claude'
              }
              className={`nodrag h-5 max-w-36 rounded border border-current/30 bg-transparent px-1 text-[11px] font-medium ${skin.title}`}
            >
              <option value="">Non classé</option>
              {layers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            {element.layerSource === 'deduite' ? <span className="italic">déduite</span> : null}
          </span>
        )}
        {element.paths.length === 0 ? null : (
          <span
            title={`Chemins donnés à l’élément (un dossier couvre tous ses fichiers) :\n${element.paths.join('\n')}`}
          >
            {paths}
          </span>
        )}
        {progress === null ? null : (
          <span className={`font-semibold ${skin.title}`} title={progressTitle}>
            {progress.percent} %
          </span>
        )}
        {element.childCount === 0 ? null : (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!element.collapsed}
            aria-label={`${element.collapsed ? 'Déplier' : 'Replier'} « ${element.title} » (${element.childCount} éléments)`}
            className={`nodrag ml-auto rounded px-1.5 text-xs hover:opacity-80 ${skin.title}`}
          >
            {element.collapsed ? `▸ ${element.childCount}` : '▾'}
          </button>
        )}
      </footer>
      <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
    </article>
  )
}
