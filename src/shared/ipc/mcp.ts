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
}

/** Nombre maximal d'éléments sélectionnés transmis au main. */
export const SELECTION_MAX = 500
