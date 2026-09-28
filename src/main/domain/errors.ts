/** Erreur métier attendue : son code, son message et ses détails peuvent être renvoyés au renderer. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Données non sensibles utiles à l'interface (ex. dimensions manquantes). */
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message)
    this.name = 'AppError'
  }
}
