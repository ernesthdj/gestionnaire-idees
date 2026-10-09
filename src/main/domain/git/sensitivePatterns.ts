import { z } from 'zod'

/**
 * Motifs de contenu sensible (spec 021 research R10), déclaratifs : une clé privée bloque toujours le push ; un préfixe
 * de jeton est signalé et peut être accepté un par un (faux positifs fréquents dans les tests). Validés par Zod au
 * chargement (une expression invalide arrête l'app au démarrage, jamais en plein push).
 */
const Pattern = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  kind: z.enum(['private_key', 'token_pattern']),
  source: z.string().min(4).max(200),
  reason: z.string().min(1).max(120)
})

const RAW = [
  {
    id: 'cle-privee',
    kind: 'private_key',
    source: '-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----',
    reason: 'En-tête de clé privée'
  },
  { id: 'jeton-github', kind: 'token_pattern', source: '\\bgh[pousr]_[A-Za-z0-9]{20,}', reason: 'Jeton GitHub' },
  {
    id: 'jeton-github-fin',
    kind: 'token_pattern',
    source: '\\bgithub_pat_[A-Za-z0-9_]{20,}',
    reason: 'Jeton GitHub à grain fin'
  },
  { id: 'cle-aws', kind: 'token_pattern', source: '\\bAKIA[0-9A-Z]{16}\\b', reason: 'Identifiant de clé AWS' },
  { id: 'jeton-slack', kind: 'token_pattern', source: '\\bxox[abprs]-[A-Za-z0-9-]{10,}', reason: 'Jeton Slack' },
  { id: 'cle-google', kind: 'token_pattern', source: '\\bAIza[0-9A-Za-z_-]{35}\\b', reason: 'Clé d’API Google' },
  { id: 'cle-sk', kind: 'token_pattern', source: '\\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}', reason: 'Clé d’API (sk-…)' }
] as const

export interface SensitivePattern {
  readonly id: string
  readonly kind: 'private_key' | 'token_pattern'
  readonly regex: RegExp
  readonly reason: string
}

export const SENSITIVE_PATTERNS: readonly SensitivePattern[] = z
  .array(Pattern)
  .parse(RAW)
  .map((pattern) => ({ id: pattern.id, kind: pattern.kind, regex: new RegExp(pattern.source), reason: pattern.reason }))
