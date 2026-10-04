/** Sélection courante de l'interface (spec 007 FR-006), tenue en mémoire par le main pour `selection_lire`. */
export class SelectionStore {
  private ids: readonly string[] = []

  set(ids: readonly string[]): void {
    this.ids = [...new Set(ids)]
  }

  get(): readonly string[] {
    return this.ids
  }
}
