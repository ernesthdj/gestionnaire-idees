/**
 * Journal à liste blanche : seuls des champs techniques connus et des valeurs primitives courtes
 * sont conservés. Jamais de contenu d'idée, de montant, de jeton ni de donnée personnelle.
 */
const ALLOWED_FIELDS = new Set([
  'channel',
  'code',
  'count',
  'durationMs',
  'engine',
  'kind',
  'model',
  'stage',
  'status',
  'version'
])

const MAX_STRING_LENGTH = 64

export type LogLevel = 'info' | 'warn' | 'error'
export type LogValue = string | number | boolean
export type LogFields = Readonly<Record<string, LogValue>>

export interface LogRecord {
  readonly at: string
  readonly level: LogLevel
  readonly event: string
  readonly fields: Record<string, LogValue>
}

export interface Logger {
  info(event: string, fields?: LogFields): void
  warn(event: string, fields?: LogFields): void
  error(event: string, fields?: LogFields): void
}

function sanitize(fields: LogFields): Record<string, LogValue> {
  const clean: Record<string, LogValue> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue
    if (typeof value === 'string') clean[key] = value.slice(0, MAX_STRING_LENGTH)
    else if (typeof value === 'number' || typeof value === 'boolean') clean[key] = value
  }
  return clean
}

export function createLogger(sink: (record: LogRecord) => void): Logger {
  const write = (level: LogLevel, event: string, fields: LogFields = {}): void =>
    sink({ at: new Date().toISOString(), level, event: event.slice(0, MAX_STRING_LENGTH), fields: sanitize(fields) })
  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields)
  }
}

/** Plusieurs sorties pour un même journal (spec 019 : stdout + sonde) ; une sortie qui échoue n'arrête pas les autres. */
export function teeSink(...sinks: readonly ((record: LogRecord) => void)[]): (record: LogRecord) => void {
  return (record) => {
    for (const sink of sinks) {
      try {
        sink(record)
      } catch {
        // Une sortie défaillante ne doit jamais casser l'app ni les autres sorties.
      }
    }
  }
}

/** Sortie par défaut : une ligne JSON par événement sur la sortie standard du processus principal. */
export const stdoutSink = (record: LogRecord): void => {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}
