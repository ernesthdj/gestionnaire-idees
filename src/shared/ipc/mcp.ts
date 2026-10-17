/** Vues IPC du pont MCP (spec 007 contracts/pipe-and-ipc.md). */

export interface McpStatusView {
  /** Le canal du pont écoute (l'app accepte les relais de Claude Code). */
  readonly listening: boolean
  /** Relais connectés en ce moment. */
  readonly clients: number
  /** Commande d'enregistrement dans Claude Code, à copier ; ne contient aucun secret. */
  readonly command: string
}

/** Écriture de Claude appliquée sur la carte : rafraîchir et proposer « Annuler ». */
export interface MapChangedPayload {
  readonly batchId: string
  readonly summary: string
  readonly count: number
  /**
   * Widget posé par Claude et relié à un nœud dont seule l'interface connaît la place (nœud du Workflow, élément de
   * structure, étape de plan) : l'interface le pose à côté de ce nœud (spec 026 D11).
   */
  readonly widget?: WidgetPlacement
}

/** Widget à poser à côté d'un nœud de la carte. */
export interface WidgetPlacement {
  readonly blockId: string
  /** Identifiant du nœud sur la carte (clé `wf:…` d'un nœud du Workflow, id d'un élément ou d'une étape). */
  readonly anchorId: string
}

/** Nombre maximal d'éléments sélectionnés transmis au main. */
export const SELECTION_MAX = 500
