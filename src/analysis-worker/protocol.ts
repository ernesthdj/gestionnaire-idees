import { z } from 'zod'

/**
 * Messages entre le main et le processus d'analyse (spec 017 contracts) : validés par Zod des deux côtés. Le main ne
 * fait pas confiance à ce qui revient (un fichier du projet a pu piéger l'analyse) ; le processus n'accepte que des
 * chemins relatifs, qu'il résout lui-même sous la racine.
 */

export const WORKER_LANGS = ['ts', 'tsx', 'js', 'cs', 'php'] as const

const RelativePath = z
  .string()
  .min(1)
  .max(1000)
  .refine(
    (path) => !path.startsWith('/') && !/^[a-zA-Z]:/.test(path) && !path.split('/').includes('..'),
    'chemin relatif'
  )

export const ParseRequest = z.strictObject({
  type: z.literal('parse'),
  root: z.string().min(1).max(1000),
  files: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(100),
        path: RelativePath,
        lang: z.enum(WORKER_LANGS),
        /** Empreinte connue : identique → fichier inchangé, rien n'est extrait. */
        knownHash: z.string().max(64).nullable()
      })
    )
    .max(25_000)
})
export type ParseRequest = z.infer<typeof ParseRequest>

export const WorkerRequest = z.union([ParseRequest, z.strictObject({ type: z.literal('cancel') })])
export type WorkerRequest = z.infer<typeof WorkerRequest>

const Text = (max: number) => z.string().max(max)

const RawSymbol = z.strictObject({
  key: z.number().int().nonnegative(),
  parent: z.number().int().nonnegative().nullable(),
  kind: z.enum(['namespace', 'class', 'interface', 'function', 'method']),
  name: Text(300),
  qualifiedName: Text(1000),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  complexity: z.number().int().positive(),
  bases: z.array(Text(300)).max(50),
  attributes: z.array(Text(200)).max(50),
  memberTypes: z.record(Text(300), Text(300))
})

const Extraction = z.strictObject({
  namespace: Text(1000).nullable(),
  symbols: z.array(RawSymbol).max(20_000),
  imports: z
    .array(
      z.strictObject({
        source: Text(1000),
        names: z.array(z.strictObject({ local: Text(300), imported: Text(300) })).max(500),
        line: z.number().int().positive()
      })
    )
    .max(5_000),
  calls: z
    .array(
      z.strictObject({
        from: z.number().int().nonnegative().nullable(),
        callee: Text(300),
        receiver: Text(1000).nullable(),
        isNew: z.boolean(),
        line: z.number().int().positive()
      })
    )
    .max(50_000),
  routes: z
    .array(
      z.strictObject({
        method: Text(20),
        path: Text(500),
        controller: Text(300),
        action: Text(300),
        line: z.number().int().positive()
      })
    )
    .max(5_000),
  registrations: z.array(z.strictObject({ service: Text(300), implementation: Text(300) })).max(5_000),
  topLevelCode: z.boolean()
})

export const WorkerMessage = z.union([
  z.strictObject({ type: z.literal('ready') }),
  z.strictObject({ type: z.literal('initError') }),
  z.strictObject({
    type: z.literal('file'),
    id: Text(100),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    lines: z.number().int().nonnegative(),
    extraction: Extraction
  }),
  z.strictObject({ type: z.literal('unchanged'), id: Text(100) }),
  z.strictObject({
    type: z.literal('fileError'),
    id: Text(100),
    status: z.enum(['parse_error', 'too_large']),
    reason: Text(200),
    hash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    lines: z.number().int().nonnegative()
  }),
  z.strictObject({ type: z.literal('done'), cancelled: z.boolean() })
])
export type WorkerMessage = z.infer<typeof WorkerMessage>
