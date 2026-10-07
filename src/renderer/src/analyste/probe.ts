import {
  PROBE_LIMITS,
  ProbeCode,
  ProbeFrame,
  type ProbeAction,
  type ProbeScreen,
  type ProbeSubjectKind,
  type ProbeVia,
  type RendererProbeEvent
} from '@shared/analyste/events'

/**
 * Sonde côté interface (spec 019 T012) : navigation, erreurs et actions, envoyées par lots au main qui les valide et
 * les pseudonymise. Jamais de texte saisi ni de message d'erreur. Inerte tant que le main ne l'a pas déclarée active.
 */

const FLUSH_MS = 2_000

let enabled = false
let queue: RendererProbeEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null
let send: (events: readonly RendererProbeEvent[]) => Promise<unknown> = (events) =>
  window.api.invoke('analyste:events', { events })

function push(event: RendererProbeEvent): void {
  if (!enabled) return
  queue.push(event)
  if (queue.length >= PROBE_LIMITS.batch) flushProbe()
}

export function flushProbe(): void {
  if (queue.length === 0) return
  const batch = queue.slice(0, PROBE_LIMITS.batch)
  queue = queue.slice(PROBE_LIMITS.batch)
  // Une sonde indisponible ne doit jamais gêner l'app : l'échec est ignoré.
  void send(batch).catch(() => undefined)
}

/** Active ou coupe la sonde (statut `analyste:repo:status`). Couper vide la file. */
export function enableProbe(on: boolean): void {
  enabled = on
  if (!on) {
    queue = []
    if (timer !== null) clearInterval(timer)
    timer = null
    return
  }
  timer ??= setInterval(flushProbe, FLUSH_MS)
}

/** Action de mentalyas : l'objet est désigné par son type et son identifiant (pseudonymisé par le main). */
export function probeAction(
  event: ProbeAction,
  subjectKind: ProbeSubjectKind,
  via: ProbeVia,
  subjectId?: string
): void {
  push({
    event,
    subjectKind,
    via,
    ...(subjectId === undefined || subjectId.length > PROBE_LIMITS.subjectId ? {} : { subjectId })
  })
}

const opened = new Map<ProbeScreen, number>()

/** Écran ou volet ouvert ; sa fermeture enregistre la durée passée dessus. */
export function probeScreen(screen: ProbeScreen, open: boolean, now = Date.now()): void {
  if (open) {
    opened.set(screen, now)
    push({ event: 'screen.open', screen })
    return
  }
  const since = opened.get(screen)
  if (since === undefined) return
  opened.delete(screen)
  push({ event: 'panel.close', screen, durationMs: Math.max(0, Math.min(now - since, 86_400_000)) })
}

/**
 * Emplacements d'une pile d'appels ramenés au dépôt : `…/src/canvas/x.ts:12:3` (serveur de dev) devient
 * `src/renderer/src/canvas/x.ts:12`. Les dépendances et tout le reste sont ignorés.
 */
export function framesOf(stack: string | undefined): string[] {
  if (stack === undefined) return []
  const frames: string[] = []
  for (const match of stack.matchAll(
    /(?:https?:\/\/[^/\s]+)?\/(src\/[^\s?:()]+\.[A-Za-z]+)(?:\?[^\s:()]*)?:(\d+)(?::\d+)?/g
  )) {
    const [, path, line] = match
    if (path === undefined || line === undefined || path.includes('node_modules')) continue
    const frame = `src/renderer/${path}:${line}`
    if (ProbeFrame.safeParse(frame).success) frames.push(frame)
    if (frames.length === PROBE_LIMITS.frames) break
  }
  return frames
}

/** Sorte d'une valeur rejetée qui n'est pas une `Error` : `NonError.<type>` ou `NonError.<constructeur>`, jamais son contenu. */
function nonErrorCode(value: unknown): string {
  const kind =
    typeof value === 'object' && value !== null
      ? (Object.getPrototypeOf(value)?.constructor?.name ?? 'object')
      : typeof value
  const code = `NonError.${typeof kind === 'string' ? kind : 'object'}`
  return ProbeCode.safeParse(code).success ? code : 'NonError.object'
}

/**
 * Erreur non rattrapée de l'interface : son nom et ses emplacements, jamais son message. `location` = fichier et ligne
 * d'un `ErrorEvent` sans objet `error` (erreur de script, boucle de `ResizeObserver`).
 */
export function probeError(error: unknown, location?: { readonly filename: string; readonly lineno: number }): void {
  if (error instanceof Error) {
    push({
      event: 'error.renderer',
      code: ProbeCode.safeParse(error.name).success ? error.name : 'Error',
      frames: framesOf(error.stack)
    })
    return
  }
  const where =
    location === undefined || location.filename === '' ? undefined : `${location.filename}:${location.lineno}`
  push({
    event: 'error.renderer',
    code: location === undefined ? nonErrorCode(error) : 'ErrorEvent',
    frames: framesOf(where)
  })
}

/** Écoute les erreurs globales de la fenêtre ; renvoie la fonction de désabonnement. */
export function listenToErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent): void =>
    event.error instanceof Error
      ? probeError(event.error)
      : probeError(event.error, { filename: event.filename, lineno: event.lineno })
  const onRejection = (event: PromiseRejectionEvent): void => probeError(event.reason)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}

/** Tests : remplace l'envoi et remet la sonde à zéro. */
export function resetProbeForTests(sender: (events: readonly RendererProbeEvent[]) => Promise<unknown>): void {
  enableProbe(false)
  opened.clear()
  send = sender
}
