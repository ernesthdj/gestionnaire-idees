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

/** Erreur non rattrapée de l'interface : son nom et ses emplacements, jamais son message. */
export function probeError(error: unknown): void {
  const name = error instanceof Error ? error.name : 'NonError'
  push({
    event: 'error.renderer',
    code: ProbeCode.safeParse(name).success ? name : 'Error',
    frames: framesOf(error instanceof Error ? error.stack : undefined)
  })
}

/** Écoute les erreurs globales de la fenêtre ; renvoie la fonction de désabonnement. */
export function listenToErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent): void => probeError(event.error)
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
