/** Surface minimale de `globalShortcut` d'Electron (remplaçable par un double en test). */
export interface ShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
}

/**
 * Raccourci global de capture (FR-006). Un seul raccourci actif ; en cas d'échec (déjà pris par une autre
 * application), l'ancien reste actif et l'appelant décide comment prévenir l'utilisateur.
 */
export class GlobalShortcut {
  private current: string | undefined

  constructor(
    private readonly registry: ShortcutRegistry,
    private readonly onPressed: () => void
  ) {}

  get active(): string | undefined {
    return this.current
  }

  /** Active `accelerator` à la place du raccourci courant ; renvoie `false` (rien ne change) s'il est indisponible. */
  replace(accelerator: string): boolean {
    if (accelerator === this.current) return true
    if (!this.registry.register(accelerator, this.onPressed)) return false
    if (this.current !== undefined) this.registry.unregister(this.current)
    this.current = accelerator
    return true
  }
}
