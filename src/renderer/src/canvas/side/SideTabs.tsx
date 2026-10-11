import { useEffect, useRef } from 'react'
import { useWaitingChats } from '../../chat/waitingChats'
import { useRunningChats } from '../workflow/runningChats'
import { neuronOfTab, type SideTab } from './sidePanelStore'

/** Identifiants d'un onglet et de son contenu (motif ARIA des onglets). */
export const tabId = (base: string, key: string): string => `${base}-tab-${key}`
export const tabPanelId = (base: string): string => `${base}-panel`

/** Libellé d'un onglet : titre du nœud, ou « ⎇ Dépôt ». */
export const tabLabel = (tab: SideTab): string => (tab.kind === 'repo' ? '⎇ Dépôt' : tab.title)

/** Onglet visé par une touche de la barre (←/→ en boucle, Début, Fin) ; `null` pour une autre touche. */
export function targetIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null
  if (key === 'ArrowRight') return (current + 1) % count
  if (key === 'ArrowLeft') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * Barre d'onglets du panneau de droite (spec 027 D2, D3, FR-003, FR-011) : un onglet par conversation ouverte et
 * l'onglet Dépôt ; un clic ou ←/→, Début, Fin affichent un onglet. Chaque onglet dit si Claude écrit (●) ou attend ton
 * accord (⏸), avec un texte lu par les lecteurs d'écran. Fermer (aucun tour n'est interrompu) : le × de l'onglet à la
 * souris, Suppr au clavier, ou le bouton de fermeture de l'en-tête (une liste d'onglets ne contient que des onglets : le
 * × n'y est pas un bouton). Le titre est du texte, jamais du balisage.
 */
export function SideTabs({
  base,
  tabs,
  shownKey,
  onShow,
  onClose
}: {
  readonly base: string
  readonly tabs: readonly SideTab[]
  readonly shownKey: string | null
  readonly onShow: (key: string) => void
  readonly onClose: (key: string) => void
}): React.JSX.Element {
  const running = useRunningChats((state) => state.running)
  const waiting = useWaitingChats((state) => state.waiting)
  const list = useRef<HTMLDivElement>(null)
  // L'onglet affiché reste visible quand la barre défile (beaucoup d'onglets).
  useEffect(() => {
    if (shownKey === null) return
    const shown = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    shown?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [shownKey])

  const move = (event: React.KeyboardEvent, index: number): void => {
    const next = targetIndex(event.key, index, tabs.length)
    const tab = next === null ? undefined : tabs[next]
    if (tab === undefined) return
    event.preventDefault()
    onShow(tab.key)
    document.getElementById(tabId(base, tab.key))?.focus()
  }

  return (
    <div ref={list} role="tablist" aria-label="Onglets du panneau" className="side-tabs">
      {tabs.map((tab, index) => {
        const selected = tab.key === shownKey
        const label = tabLabel(tab)
        const neuronId = neuronOfTab(tab)
        const writing = neuronId !== null && running.has(neuronId)
        const asking = neuronId !== null && (waiting.get(neuronId)?.size ?? 0) > 0
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={tabId(base, tab.key)}
            aria-selected={selected}
            aria-controls={tabPanelId(base)}
            aria-keyshortcuts="Delete"
            tabIndex={selected ? 0 : -1}
            className={`side-tab${selected ? ' side-tab-shown' : ''}`}
            title={`${label} (Suppr : fermer l’onglet)`}
            onClick={() => onShow(tab.key)}
            onKeyDown={(event) => {
              if (event.key !== 'Delete') {
                move(event, index)
                return
              }
              event.preventDefault()
              onClose(tab.key)
            }}
          >
            <span className="side-tab-label">{label}</span>
            {asking ? (
              <span className="side-tab-asking">
                <span aria-hidden="true">⏸</span>
                <span className="sr-only"> (attend ton accord)</span>
              </span>
            ) : writing ? (
              <span className="side-tab-writing">
                <span aria-hidden="true" className="side-tab-dot" />
                <span className="sr-only"> (Claude écrit)</span>
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className="side-tab-close"
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.key)
              }}
            >
              ×
            </span>
          </button>
        )
      })}
    </div>
  )
}
