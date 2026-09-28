/** Erreur métier attendue : son code et son message peuvent être renvoyés au renderer. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
