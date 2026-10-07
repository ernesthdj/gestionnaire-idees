/**
 * Règles fixes d'audit d'un skill importé (spec 020 research R8, T028) : fonction pure, filet indépendant de Claude.
 * Une consigne cachée dans le texte ne peut pas adoucir ces règles ; elles priment sur l'avis de Claude quand elles sont
 * plus sévères (`mostSevere`).
 *
 * - « à revoir » : téléchargement, exécution dynamique, suppression récursive, contenu encodé exécuté, consigne
 *   d'outrepassement, accès à des secrets ;
 * - « dangereux » : téléchargement ET exécution sur la même ligne logique, ou exfiltration (envoi de fichiers ou de
 *   secrets vers le réseau).
 *
 * Les motifs sont insensibles à la casse ; le texte est normalisé (NFC, caractères invisibles retirés) et les lignes
 * continuées (`\` en fin de ligne shell, `` ` `` en PowerShell) sont réunies avant l'examen.
 */

export type AuditVerdict = 'sur' | 'a_revoir' | 'dangereux'

export interface AuditReason {
  readonly text: string
  /** Ligne (à partir de 1) de la première occurrence. */
  readonly line?: number
}

export interface AuditResult {
  readonly verdict: AuditVerdict
  readonly raisons: readonly AuditReason[]
}

export const AUDIT_REASONS_MAX = 8
/** Au-delà, une ligne est tronquée pour l'examen (motifs bornés, pas de coût quadratique). */
const LINE_MAX = 4_000

interface Rule {
  readonly severity: Exclude<AuditVerdict, 'sur'>
  readonly text: string
  readonly test: (line: string) => boolean
}

const DOWNLOAD =
  /\b(?:curl|wget|invoke-webrequest|iwr|invoke-restmethod|irm|start-bitstransfer)\b|\bcertutil\b.*-urlcache|\bnet\.webclient\b|\bdownload(?:string|file)\s*\(/i
const PIPE_TO_SHELL = /\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|pwsh|powershell)(?:\.exe)?\b/i
const DYNAMIC_EXEC = /\b(?:iex|invoke-expression)\b/i
/** Exécution d'un contenu calculé, interpréteurs compris (utilisée seulement avec un téléchargement sur la ligne). */
const EXEC_SINK =
  /\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|pwsh|powershell|python[0-9.]*|node|perl|ruby|php)(?:\.exe)?\b|\b(?:iex|invoke-expression|eval)\b|\b(?:sh|bash|zsh)\s+(?:-c\s+)?["']?\$\(|<\(/i
const RECURSIVE_DELETE =
  /\brm\s+(?:-[a-z]+\s+)*(?:-[a-z]*r[a-z]*\b|--recursive\b)|\bremove-item\b.*-recurse\b|\b(?:rd|rmdir)\s+(?:\S+\s+)*\/s\b|\bdel\s+(?:\S+\s+)*\/s\b|\brmtree\s*\(|\brimraf\b|\b(?:rm|rmsync)\s*\(.*recursive\s*:\s*true/i
const ENCODED_EXEC =
  /\bbase64\s+(?:-d|-D|--decode)\b.*\||\bfrombase64string\b|\b(?:powershell|pwsh)(?:\.exe)?\b.*\s-(?:e|ec|enc|encodedcommand)\s+[a-z0-9+/=]{16,}/i
const OVERRIDE = [
  /\b(?:ignore[rz]?|oublie[rz]?|disregard|forget|outrepasse[rz]?|contourne[rz]?)\b.{0,40}\b(?:instructions?|consignes?|rules|r[eè]gles|system prompt|guidelines)\b/iu,
  /\b(?:d[ée]sactiv\w*|disable|skip|bypass)\b.{0,40}\b(?:confirmations?|permissions?|v[ée]rifications?|garde-fous|safeguards?)\b/iu,
  /\bsans\s+(?:(?:lui|le|leur|rien)\s+)?demander\b|\bwithout\s+(?:asking|(?:user\s+)?(?:confirmation|permission|consent))\b|(?:^|\s)[àa]\s+l['’]insu\b|\bdangerously-skip-permissions\b|\bbypasspermissions\b/iu,
  /\b(?:ne\s+(?:le\s+)?(?:dis|dites)\s+pas|don['’]?t\s+tell|do\s+not\s+tell|never\s+tell)\b.{0,30}\b(?:utilisateur|user|mentalyas)\b/iu
]
const SECRETS =
  /(?:^|[\s'"`/\\(=~:])\.ssh\b|\bid_(?:rsa|dsa|ecdsa|ed25519)\b|(?:^|[\s'"`/\\(=~:])\.env(?!\.(?:example|sample|template|dist)\b)(?:\.[a-z0-9_-]+)?\b|\bcredentials?\b|(?:^|[\s'"`/\\(=~:])\.(?:netrc|npmrc|pgpass|aws)\b/i
const EXFILTRATION = [
  // Options de curl sensibles à la casse (`-d` envoie, `-D` écrit les en-têtes) ; `@fichier` = contenu d'un fichier.
  /\b[Cc][Uu][Rr][Ll]\b.*\s(?:(?:-d|--data(?:-binary|-raw|-urlencode|-ascii)?)\s*['"]?@|(?:-F|--form)\s*['"]?[^\s'"=]*=[<@]|(?:-T|--upload-file)\s)/,
  /\bwget\b.*--post-file\b/i,
  /\b(?:invoke-webrequest|iwr|invoke-restmethod|irm)\b.*-infile\b/i,
  /\b(?:invoke-webrequest|iwr|invoke-restmethod|irm)\b.*-body\b.*\b(?:get-content|gc|cat|type)\b/i,
  /\b(?:nc|ncat|netcat)\b.*<|\|\s*(?:nc|ncat|netcat)\b/i,
  /\bexfiltr\w*/iu,
  /\b(?:envoie[rz]?|envoyer|transmet\w*|upload\w*|send|post)\b.{0,60}\b(?:fichiers?|files?|contenus?|contents?|secrets?|jetons?|tokens?|cl[ée]s?|keys?|mots de passe|passwords?).{0,60}https?:\/\//iu
]

const RULES: readonly Rule[] = [
  {
    severity: 'dangereux',
    text: 'Téléchargement exécuté directement',
    test: (line) => DOWNLOAD.test(line) && EXEC_SINK.test(line)
  },
  {
    severity: 'dangereux',
    text: 'Envoi de fichiers ou de secrets vers le réseau (exfiltration)',
    test: (line) => EXFILTRATION.some((rule) => rule.test(line)) || (DOWNLOAD.test(line) && SECRETS.test(line))
  },
  { severity: 'a_revoir', text: 'Téléchargement depuis le réseau', test: (line) => DOWNLOAD.test(line) },
  {
    severity: 'a_revoir',
    text: "Exécution d'un contenu dynamique",
    test: (line) => PIPE_TO_SHELL.test(line) || DYNAMIC_EXEC.test(line)
  },
  { severity: 'a_revoir', text: 'Suppression récursive de fichiers', test: (line) => RECURSIVE_DELETE.test(line) },
  { severity: 'a_revoir', text: 'Contenu encodé puis exécuté', test: (line) => ENCODED_EXEC.test(line) },
  {
    severity: 'a_revoir',
    text: "Consigne d'outrepassement (règles, confirmations ou utilisateur contournés)",
    test: (line) => OVERRIDE.some((rule) => rule.test(line))
  },
  { severity: 'a_revoir', text: 'Accès à des secrets (clés, identifiants, .env)', test: (line) => SECRETS.test(line) }
]

const RANK: Record<AuditVerdict, number> = { sur: 0, a_revoir: 1, dangereux: 2 }

/** Verdict le plus sévère des deux (règles fixes contre avis de Claude). */
export const mostSevere = (a: AuditVerdict, b: AuditVerdict): AuditVerdict => (RANK[a] >= RANK[b] ? a : b)

/** Examine un texte (SKILL.md, script) ; une raison par règle, à sa première ligne, au plus 8. */
export function auditText(text: string): AuditResult {
  const firstLine = new Map<Rule, number>()
  for (const { text: line, number } of logicalLines(text)) {
    for (const rule of RULES) {
      if (!firstLine.has(rule) && rule.test(line)) firstLine.set(rule, number)
    }
    if (firstLine.size === RULES.length) break
  }
  let verdict: AuditVerdict = 'sur'
  const raisons: AuditReason[] = []
  for (const rule of RULES) {
    const line = firstLine.get(rule)
    if (line === undefined) continue
    verdict = mostSevere(verdict, rule.severity)
    if (raisons.length < AUDIT_REASONS_MAX) raisons.push({ text: rule.text, line })
  }
  return { verdict, raisons }
}

/** Caractères invisibles qui pourraient couper un mot-clé (`ig` + U+200B + `nore`). */
const INVISIBLE = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g

/** Continuation shell (`\` final) ou PowerShell (`` ` `` final après un espace : pas un code Markdown en ligne). */
const CONTINUATION = /(?:\\|\s`)\s*$/

interface LogicalLine {
  readonly text: string
  readonly number: number
}

/** Lignes normalisées ; une ligne continuée (`\` ou `` ` `` final) est jointe à la suivante, numéro de la première. */
function logicalLines(text: string): LogicalLine[] {
  const physical = text
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .split(/\r\n|\r|\n/)
  const lines: LogicalLine[] = []
  let buffer = ''
  let start = 1
  physical.forEach((raw, index) => {
    const line = raw.slice(0, LINE_MAX)
    if (buffer === '') start = index + 1
    const continued = CONTINUATION.test(line)
    buffer += continued ? `${line.replace(CONTINUATION, '')} ` : line
    if (!continued || buffer.length > LINE_MAX) {
      lines.push({ text: buffer.slice(0, LINE_MAX * 2), number: start })
      buffer = ''
    }
  })
  if (buffer !== '') lines.push({ text: buffer, number: start })
  return lines
}
