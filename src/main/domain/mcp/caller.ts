/** Appelant d'un outil du pont : neurone de la conversation qui a lancé le relais (spec 008), s'il y en a un. */
export interface McpCaller {
  readonly neuronId: string | null
  /**
   * Session d'un agent du pipeline (L2-pipeline-optimal D11) : seuls les outils de lecture et le widget de sa tâche lui
   * sont ouverts.
   */
  readonly pipeline?: boolean
}
