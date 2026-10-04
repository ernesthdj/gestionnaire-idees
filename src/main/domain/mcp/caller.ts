/** Appelant d'un outil du pont : neurone de la conversation qui a lancé le relais (spec 008), s'il y en a un. */
export interface McpCaller {
  readonly neuronId: string | null
}
