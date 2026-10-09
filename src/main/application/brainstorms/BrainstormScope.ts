/**
 * Brainstorm actif (spec 024 R1, R4) : la carte ne montre que ses genesis et ses blocs, et ce qui naît sur la carte lui
 * appartient. Sans brainstorm actif (Project Manager affiché), une idée capturée va dans « Idées en vrac ».
 */
export class BrainstormScope {
  private current: string | null = null

  constructor(private readonly loose: () => string) {}

  active(): string | null {
    return this.current
  }

  set(id: string | null): void {
    this.current = id
  }

  /** Brainstorm de ce qui naît maintenant : l'actif, sinon « Idées en vrac » (créé au besoin). */
  forNew(): string {
    return this.current ?? this.loose()
  }
}
