import type { AppApi, CaptureApi } from '../shared/app-api'

declare global {
  interface Window {
    /** Fenêtre principale uniquement. */
    readonly api: AppApi
    /** Fenêtre de capture uniquement. */
    readonly captureApi: CaptureApi
  }
}

export {}
