/** Format uniforme de toute réponse IPC (constitution : `{ success, data, error }`). */
export interface IpcError {
  readonly code: string
  readonly message: string
  readonly details?: Readonly<Record<string, unknown>>
}

export type IpcResult<T> =
  { readonly success: true; readonly data: T } | { readonly success: false; readonly error: IpcError }
