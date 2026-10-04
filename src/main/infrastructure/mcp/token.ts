import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

/**
 * Secret du pont MCP (spec 007 FR-002, research R3) : 32 octets aléatoires, fichier du profil lisible par le seul
 * utilisateur (ACL de `%APPDATA%`). Jamais journalisé ni écrit dans la configuration de Claude Code : le relais le lit.
 */
export class McpToken {
  private current: string

  constructor(private readonly file: string) {
    this.current = this.load() ?? this.write()
  }

  value(): string {
    return this.current
  }

  /** Nouveau secret : les relais encore connectés avec l'ancien sont refusés à leur prochain appel. */
  rotate(): string {
    this.current = this.write()
    return this.current
  }

  /** Comparaison à temps constant (longueurs égales vérifiées avant). */
  matches(candidate: string): boolean {
    const expected = Buffer.from(this.current, 'utf8')
    const given = Buffer.from(candidate, 'utf8')
    return expected.length === given.length && timingSafeEqual(expected, given)
  }

  private load(): string | undefined {
    if (!existsSync(this.file)) return undefined
    const text = readFileSync(this.file, 'utf8').trim()
    return TOKEN_PATTERN.test(text) ? text : undefined
  }

  private write(): string {
    const token = randomBytes(32).toString('hex')
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, token, { encoding: 'utf8', mode: 0o600 })
    return token
  }
}

/** Lecture seule, côté relais : `undefined` si le fichier manque ou est corrompu. */
export function readToken(file: string): string | undefined {
  if (!existsSync(file)) return undefined
  const text = readFileSync(file, 'utf8').trim()
  return TOKEN_PATTERN.test(text) ? text : undefined
}
