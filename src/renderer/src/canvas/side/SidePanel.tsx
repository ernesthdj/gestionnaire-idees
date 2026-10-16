import { useEffect, useId, useRef, useState } from 'react'
import { CHAT_PANEL_WIDTH } from '@shared/ipc/app'
import { RepoPanel } from '../../git/RepoPanel'
import { ChatTabContent } from './ChatTabContent'
import { usePanelWidth, useNarrowWindow, widthAfterKey, widthAt } from './panelWidth'
import { AgentsTabContent } from '../agents/AgentsTabContent'
import { isConversationTab, shownTab, useSidePanel } from './sidePanelStore'
import { SideTabs, tabId, tabPanelId } from './SideTabs'
import { WorkflowChatTabContent } from './WorkflowChatTabContent'
import './side.css'

/** Échap sans rien à replier : le focus revient à la carte, sur le nœud de l'onglet s'il est dessiné. */
export function focusCanvas(nodeId: string | null): void {
  const node =
    nodeId === null
      ? null
      : [...document.querySelectorAll<HTMLElement>('.react-flow__node')].find(
          (element) => element.dataset.id === nodeId
        )
  const target = node ?? document.querySelector<HTMLElement>('.react-flow__node') ?? null
  target?.focus({ preventScroll: true })
}

/**
 * Panneau de droite de l'écran Idées (spec 027) : hors de la carte (ni zoom ni déplacement), à côté d'elle (62 / 38).
 * Onglets : conversations des nœuds, tâches Workflow, Dépôt ; « Centrer sur le nœud » ramène la carte sur le nœud de
 * l'onglet affiché (D4). Sans onglet, il disparaît et la carte reprend la place.
 * Échap (FR-012) : un tour en cours est interrompu par la conversation elle-même ; sinon un lecteur revient à la
 * conversation ; sinon le focus revient à la carte. Échap ne ferme jamais un onglet.
 * Largeur (D6) : poignée sur le bord gauche (souris, ←/→ par 2 %, Début / Fin), de 25 à 55 %, gardée dans les réglages.
 * Fenêtre étroite (R10) : le panneau passe par-dessus la carte et se masque d'un geste, sans fermer ses onglets.
 */
export function SidePanel(): React.JSX.Element | null {
  const base = useId()
  const tabs = useSidePanel((state) => state.tabs)
  const shownKey = useSidePanel((state) => state.shownKey)
  const tab = useSidePanel(shownTab)
  const show = useSidePanel((state) => state.show)
  const close = useSidePanel((state) => state.close)
  const closeReader = useSidePanel((state) => state.closeReader)
  const requestFocus = useSidePanel((state) => state.requestFocus)
  const { width, preview, commit } = usePanelWidth()
  const narrow = useNarrowWindow()
  // Masqué en fenêtre étroite : il revient dès qu'un onglet est ouvert ou affiché.
  const [masked, setMasked] = useState(false)
  useEffect(() => setMasked(false), [shownKey, tabs.length])
  const root = useRef<HTMLElement>(null)
  if (tabs.length === 0) return null
  if (narrow && masked)
    return (
      <button type="button" className="side-unmask" onClick={() => setMasked(false)}>
        <span aria-hidden="true">◧ </span>Panneau ({tabs.length})
      </button>
    )

  // Glisser la poignée : la largeur suit le pointeur (zone = la ligne carte + panneau), enregistrée au lâcher.
  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const area = root.current?.parentElement?.getBoundingClientRect()
    if (event.button !== 0 || area === undefined) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    let last = width
    const move = (next: PointerEvent): void => {
      last = widthAt(next.clientX, area)
      preview(last)
    }
    const up = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      commit(last)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  }

  return (
    <aside
      ref={root}
      aria-label="Panneau de droite"
      className={`side-panel${narrow ? ' side-panel-overlay' : ''}`}
      style={{ width: `${width}%` }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || tab === null) return
        event.stopPropagation()
        if (isConversationTab(tab) && tab.reader !== null) closeReader(tab.key)
        else focusCanvas(tab.kind === 'repo' ? null : tab.nodeId)
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Largeur du panneau"
        aria-valuemin={CHAT_PANEL_WIDTH.min}
        aria-valuemax={CHAT_PANEL_WIDTH.max}
        aria-valuenow={width}
        aria-valuetext={`${width} % de l’écran`}
        tabIndex={0}
        className="side-resize"
        onPointerDown={startResize}
        onKeyDown={(event) => {
          const next = widthAfterKey(event.key, width)
          if (next === null) return
          event.preventDefault()
          commit(next, true)
        }}
      />
      <div className="side-tabbar">
        <SideTabs base={base} tabs={tabs} shownKey={shownKey} onShow={show} onClose={close} />
        {narrow ? (
          <button
            type="button"
            className="side-center"
            aria-label="Masquer le panneau"
            title="Masquer le panneau (ses onglets restent ouverts)"
            onClick={() => setMasked(true)}
          >
            <span aria-hidden="true">⇥ </span>Masquer
          </button>
        ) : null}
        {tab === null || tab.kind === 'repo' ? null : (
          <button
            type="button"
            className="side-center"
            aria-label="Centrer sur le nœud"
            title="Ramener la carte sur le nœud de cet onglet"
            onClick={() => requestFocus(tab.nodeId)}
          >
            <span aria-hidden="true">◎ </span>Centrer
          </button>
        )}
      </div>
      {tab === null ? null : (
        <div
          role="tabpanel"
          id={tabPanelId(base)}
          aria-labelledby={tabId(base, tab.key)}
          className="side-panel-content"
        >
          {tab.kind === 'repo' ? (
            <RepoPanel key={tab.key} genesisId={tab.genesisId} onClose={() => close(tab.key)} />
          ) : tab.kind === 'agents' ? (
            <AgentsTabContent key={tab.key} tab={tab} />
          ) : tab.kind === 'workflowChat' ? (
            <WorkflowChatTabContent key={tab.key} tab={tab} />
          ) : (
            <ChatTabContent key={tab.key} tab={tab} />
          )}
        </div>
      )}
    </aside>
  )
}
