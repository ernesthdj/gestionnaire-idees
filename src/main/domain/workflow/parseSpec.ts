import type { SpecMarker } from '@shared/ipc/workflow'
import { clip, WORKFLOW_LIMITS } from './limits'

/** Ce qu'une `spec.md` dit d'elle-même (spec 023, research R2). */
export interface ParsedSpec {
  readonly title: string | null
  readonly statusLine: string | null
  readonly marker: SpecMarker | null
  readonly createdAt: string | null
  readonly decisions: number
  readonly stories: readonly { readonly number: number; readonly title: string; readonly priority: number | null }[]
  readonly citedDocs: readonly string[]
}

const STORY = /^###\s+User Story\s+(\d+)\s*[—–-]\s*(.+?)\s*$/
const PRIORITY = /\((?:Priority:\s*)?P(\d)\)/
const DECISION = /^\|\s*(D\d+)\b/
const CREATED = /\*\*Created\*\*:\s*(\d{4}-\d{2}-\d{2})/
const STATUS = /\*\*Status\*\*:\s*(.+)$/
const BRAINSTORM_DOC = /\bL\d[a-z]?-[a-z0-9-]+\.md\b/gi

/** Sans accents ni casse, pour reconnaître un marqueur écrit librement. */
const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Marqueur d'une ligne de statut : elle **commence** par « Livrée », « En pause » ou « Abandonnée » (ou leur forme
 * anglaise) ; un mot plus loin (« Draft — US1 livrée ») n'en est pas un. Sinon `null`.
 */
export function markerOf(statusLine: string): SpecMarker | null {
  const text = fold(statusLine).trimStart()
  if (/^(abandonnee|abandoned)\b/.test(text)) return 'abandoned'
  if (/^(livree|delivered)\b/.test(text)) return 'delivered'
  if (/^(en pause|paused)\b/.test(text)) return 'paused'
  return null
}

/**
 * Lit une `spec.md` ligne par ligne, sans jamais l'interpréter : titre (sans « Feature Specification: »), ligne
 * `**Status**` et son marqueur, date de création, nombre de décisions `| Dn |`, user stories (« — » ou « - »,
 * « (Priority: Pn) » ou « (Pn) »), documents de brainstorm cités. Pur.
 */
export function parseSpec(text: string): ParsedSpec {
  let title: string | null = null
  let statusLine: string | null = null
  let createdAt: string | null = null
  const decisions = new Set<string>()
  const stories = new Map<number, { number: number; title: string; priority: number | null }>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (title === null && line.startsWith('# ')) {
      const heading = line
        .slice(2)
        .replace(/^Feature Specification:\s*/i, '')
        .replace(/\s*\(spec \d+\)\s*$/i, '')
        .trim()
      title = heading === '' ? null : clip(heading, WORKFLOW_LIMITS.title)
      continue
    }
    if (statusLine === null) {
      const status = STATUS.exec(line)
      if (status !== null) {
        const value = (status[1] ?? '').split(' · ')[0]?.trim() ?? ''
        statusLine = value === '' ? null : clip(value, WORKFLOW_LIMITS.statusLine)
      }
    }
    if (createdAt === null) createdAt = CREATED.exec(line)?.[1] ?? null
    const decision = DECISION.exec(line)?.[1]
    if (decision !== undefined) decisions.add(decision)
    const story = STORY.exec(line)
    if (story !== null) {
      const number = Number(story[1])
      const rest = story[2] ?? ''
      const priority = PRIORITY.exec(rest)
      const storyTitle = (priority === null ? rest : rest.slice(0, priority.index)).trim()
      if (!stories.has(number)) {
        stories.set(number, {
          number,
          title: clip(storyTitle === '' ? `User story ${number}` : storyTitle, WORKFLOW_LIMITS.title),
          priority: priority === null ? null : Number(priority[1])
        })
      }
    }
  }
  const citedDocs = [...new Set([...text.matchAll(BRAINSTORM_DOC)].map((match) => match[0]))].sort()
  return {
    title,
    statusLine,
    marker: statusLine === null ? null : markerOf(statusLine),
    createdAt,
    decisions: decisions.size,
    stories: [...stories.values()].sort((a, b) => a.number - b.number),
    citedDocs
  }
}

/**
 * Résumé d'une fondation (`docs/FOUNDATION.md`) : premier paragraphe sous le premier sous-titre `## ` (texte ou
 * citation), à défaut le premier paragraphe du document ; `null` s'il n'y en a pas. Pur.
 */
export function foundationSummary(text: string): string | null {
  const lines = text.split(/\r?\n/)
  const firstSection = lines.findIndex((line) => line.startsWith('## '))
  const paragraph = (from: number): string | null => {
    const kept: string[] = []
    for (const raw of lines.slice(from)) {
      const line = raw.replace(/^>\s?/, '').trim()
      const structural = /^(#|---|\||- |\* |\d+\. )/.test(line)
      if (line === '' || structural) {
        if (kept.length > 0) break
        continue
      }
      kept.push(line)
    }
    return kept.length === 0 ? null : clip(kept.join(' '), WORKFLOW_LIMITS.foundationSummary)
  }
  return (firstSection >= 0 ? paragraph(firstSection + 1) : null) ?? paragraph(0)
}
