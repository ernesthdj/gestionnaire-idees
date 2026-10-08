import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { SkillUsageView, SkillView } from '@shared/ipc/skills'
import { winningNames } from './SkillCardService'

/** Fenêtre de l'usage affiché (FR-014). */
export const USAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
/** Agrégat recalculé au plus une fois par heure. */
export const USAGE_TTL_MS = 60 * 60 * 1000

/** Nom de skill plausible (`hub`, `vercel:deploy`) : tout le reste est ignoré. */
const SKILL_REF = /^[a-z0-9][a-z0-9_-]{0,63}(?::[a-z0-9][a-z0-9_-]{0,63})?$/i
const COMMAND = /<command-name>\/?([^<]{1,130})<\/command-name>/

export interface SkillUsageDeps {
  /** `~/.claude/projects` : un dossier par projet, des historiques `*.jsonl`. */
  readonly projectsDir: string
  readonly now?: () => number
}

type Counts = Map<string, { calls30d: number; lastAt: number }>

/**
 * Usage réel des skills (spec 020 US2, FR-014, research R4 amendée) : les historiques de Claude Code des 30 derniers
 * jours sont lus ligne à ligne, en flux asynchrone (le main reste libre) ; une ligne n'est analysée que si un test
 * textuel rapide y voit un appel de skill, et seuls le nom du skill et l'horodatage en sont tirés. Aucun texte de
 * conversation n'est conservé : l'agrégat ne contient que des noms et des nombres.
 */
export class SkillUsageScanner {
  private cache: { readonly at: number; readonly counts: Counts } | null = null
  private pending: Promise<Counts> | null = null

  constructor(private readonly deps: SkillUsageDeps) {}

  /** Usage par identifiant de skill (nom → skill qui l'emporte ; nom inconnu ignoré). */
  async usage(skills: readonly SkillView[]): Promise<Record<string, SkillUsageView>> {
    const counts = await this.counts()
    const names = winningNames(skills)
    const plugins = new Map(
      skills
        .filter((skill) => skill.family === 'plugin')
        .map((skill) => [`${skill.id.split('/')[1]?.split(':')[0] ?? ''}:${skill.name}`, skill.id])
    )
    const out: Record<string, SkillUsageView> = {}
    for (const [name, value] of counts) {
      const id = name.includes(':') ? plugins.get(name) : names.get(name)
      if (id === undefined) continue
      const previous = out[id]
      out[id] = {
        calls30d: (previous?.calls30d ?? 0) + value.calls30d,
        lastAt: Math.max(previous?.lastAt ?? 0, value.lastAt)
      }
    }
    return out
  }

  private async counts(): Promise<Counts> {
    const now = this.now()
    if (this.cache !== null && now - this.cache.at < USAGE_TTL_MS) return this.cache.counts
    this.pending ??= scanUsage(this.deps.projectsDir, now - USAGE_WINDOW_MS)
      .then((counts) => {
        this.cache = { at: now, counts }
        return counts
      })
      .finally(() => {
        this.pending = null
      })
    return this.pending
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }
}

/** Parcours des historiques modifiés depuis `since` ; un fichier illisible est ignoré. */
export async function scanUsage(projectsDir: string, since: number): Promise<Counts> {
  const counts: Counts = new Map()
  const add = (name: string, at: number): void => {
    if (!SKILL_REF.test(name) || !(at >= since)) return
    const previous = counts.get(name)
    counts.set(name, { calls30d: (previous?.calls30d ?? 0) + 1, lastAt: Math.max(previous?.lastAt ?? 0, at) })
  }
  const projects = await readdir(projectsDir, { withFileTypes: true }).catch(() => [])
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const dir = join(projectsDir, project.name)
    const files = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.jsonl')) continue
      const path = join(dir, file.name)
      const info = await stat(path).catch(() => null)
      if (info === null || info.mtimeMs < since) continue
      await scanFile(path, add).catch(() => undefined)
    }
  }
  return counts
}

async function scanFile(path: string, add: (name: string, at: number) => void): Promise<void> {
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of lines) {
    const tool = line.includes('"name":"Skill"')
    const command = line.includes('<command-name>')
    if (!tool && !command) continue
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as { type?: unknown; timestamp?: unknown; message?: { content?: unknown } }
    const at = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : Number.NaN
    if (tool && Array.isArray(record.message?.content)) {
      for (const part of record.message.content as unknown[]) {
        const use = part as { type?: unknown; name?: unknown; input?: { skill?: unknown } }
        if (use?.type === 'tool_use' && use.name === 'Skill' && typeof use.input?.skill === 'string') {
          add(use.input.skill, at)
        }
      }
    }
    // Une commande tapée par mentalyas (`/hub`) : ligne de l'utilisateur seulement, jamais une réponse qui la cite.
    if (command && record.type === 'user') {
      const match = COMMAND.exec(line)
      if (match?.[1] !== undefined) add(match[1].trim(), at)
    }
  }
}
