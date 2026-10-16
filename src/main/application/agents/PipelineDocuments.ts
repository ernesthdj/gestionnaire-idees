import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DOCUMENT_MAX_BYTES,
  GLOBAL_JOURNAL_FILE,
  GLOBAL_JOURNAL_KEEP_ENTRIES,
  GLOBAL_JOURNAL_MAX_CONDENSED,
  GLOBAL_JOURNAL_MAX_ENTRIES,
  JOURNAL_MESSAGE_MAX,
  PIPELINE_DIR,
  PROJECT_JOURNAL_FILE,
  SPEC_OWNER_ROLE,
  isValidTaskId,
  type JournalEntry,
  type PipelineReport,
  type PipelineSpec
} from '@shared/agents/documents'
import { PASS_NATURES, isValidAgentId, type PassIndex, type PassNature } from '@shared/agents/pipeline'
import { AGENT_ROLES, type AgentRole } from '@shared/agents/profile'
import { parseLotPlan } from '@shared/agents/lotPlan'
import { parseSpecAgents } from '@shared/agents/recommendation'
import { AppError } from '../../domain/errors'

export interface PipelineDocumentsDeps {
  /** Dossier du projet lié (spec, rapports et journal du projet y sont écrits, versionnés avec lui). */
  readonly projectDir: string
  /** Nom du projet, inscrit dans le journal global. */
  readonly projectName: string
  /** Dossier du profil de l'app (journal global, commun à tous les projets). */
  readonly profileDir: string
  /**
   * Journal du projet (défaut : `docs/pipeline/JOURNAL.md` du projet). Les agents travaillant dans leurs worktrees, le
   * moteur le place hors du dépôt : deux branches qui l'allongent en parallèle se fusionneraient en conflit.
   */
  readonly projectJournalFile?: string
  readonly now?: () => number
}

const SPEC_HEADER = /^<!-- pipeline:spec signee-par=(\S+) version=(\d+) le=(\d+) -->\n/
const REPORT_HEADER =
  /^<!-- pipeline:rapport role=(\S+) agent=(\S+) passe=(\d+) nature=(\S+) spec=(\d+|-) le=(\d+) -->\n/
const CONDENSED = /^- ~ (.+) · (\S+) : (\d+) entrées, jusqu'au (\S+)$/
const ENTRY = /^- (\S+) · (.+) · (\S+) · (\S+) · (.*)$/

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, JOURNAL_MESSAGE_MAX)

/** Un document relu depuis un worktree peut avoir des fins de ligne CRLF (`core.autocrlf` de git sous Windows). */
const readDocument = (file: string): string => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

const isNature = (value: string): value is PassNature => (PASS_NATURES as readonly string[]).includes(value)

const isRole = (value: string): value is AgentRole => (AGENT_ROLES as readonly string[]).includes(value)

/** Au-delà du plafond, les entrées anciennes deviennent une ligne par (projet, tâche) ; les condensés eux-mêmes sont bornés. */
export const condense = (lines: readonly string[]): string[] => {
  const condensed = lines.filter((l) => CONDENSED.test(l))
  const entries = lines.filter((l) => !CONDENSED.test(l))
  if (entries.length <= GLOBAL_JOURNAL_MAX_ENTRIES) return [...condensed, ...entries]
  const old = entries.slice(0, entries.length - GLOBAL_JOURNAL_KEEP_ENTRIES)
  const recent = entries.slice(entries.length - GLOBAL_JOURNAL_KEEP_ENTRIES)
  const groups = new Map<string, { project: string; taskId: string; count: number; until: string }>()
  const add = (project: string, taskId: string, count: number, until: string): void => {
    const key = `${project}\u0000${taskId}`
    const group = groups.get(key)
    if (group === undefined) groups.set(key, { project, taskId, count, until })
    else {
      group.count += count
      if (until > group.until) group.until = until
    }
  }
  for (const line of condensed) {
    const m = CONDENSED.exec(line)
    if (m !== null) add(m[1] as string, m[2] as string, Number(m[3]), m[4] as string)
  }
  for (const line of old) {
    const m = ENTRY.exec(line)
    if (m !== null) add(m[2] as string, m[3] as string, 1, m[1] as string)
  }
  const merged = [...groups.values()]
    .sort((a, b) => a.until.localeCompare(b.until))
    .slice(-GLOBAL_JOURNAL_MAX_CONDENSED)
    .map((g) => `- ~ ${g.project} · ${g.taskId} : ${g.count} entrées, jusqu'au ${g.until}`)
  return [...merged, ...recent]
}

/** Documents d'un pipeline (T002) : spec signée du PO, rapports d'agents, journal du projet et journal global court. */
export class PipelineDocuments {
  private readonly now: () => number

  constructor(private readonly deps: PipelineDocumentsDeps) {
    this.now = deps.now ?? Date.now
  }

  private taskDir(taskId: string): string {
    if (!isValidTaskId(taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    return join(this.deps.projectDir, PIPELINE_DIR, taskId)
  }

  private checkContent(content: string): string {
    const text = content.trim()
    if (text === '') throw new AppError('VALIDATION', 'Le document est vide.')
    if (Buffer.byteLength(text) > DOCUMENT_MAX_BYTES) throw new AppError('VALIDATION', 'Le document est trop long.')
    return text
  }

  private write(file: string, text: string): void {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text, 'utf8')
  }

  /** Spec de la tâche : seul le PO l'écrit ou la modifie ; chaque écriture la signe de nouveau, version suivante. */
  writeSpec(taskId: string, role: AgentRole, content: string): PipelineSpec {
    if (role !== SPEC_OWNER_ROLE) {
      throw new AppError('FORBIDDEN', 'Seul le Product Owner peut écrire ou modifier la spec d’une tâche.')
    }
    const dir = this.taskDir(taskId)
    const text = this.checkContent(content)
    const signedAt = this.now()
    const version = (this.readSpec(taskId)?.version ?? 0) + 1
    this.write(
      join(dir, 'spec.md'),
      `<!-- pipeline:spec signee-par=${role} version=${version} le=${signedAt} -->\n${text}\n`
    )
    this.appendJournal({ at: signedAt, taskId, role, message: `Spec v${version} signée.` })
    return {
      taskId,
      signedBy: role,
      version,
      signedAt,
      content: text,
      agents: parseSpecAgents(text),
      plan: parseLotPlan(text)
    }
  }

  readSpec(taskId: string): PipelineSpec | undefined {
    const file = join(this.taskDir(taskId), 'spec.md')
    if (!existsSync(file)) return undefined
    const raw = readDocument(file)
    const head = SPEC_HEADER.exec(raw)
    // Une spec sans signature (éditée à la main) n'est pas une spec signée : le moteur ne la lancera pas.
    if (head === null || !isRole(head[1] as string)) return undefined
    const content = raw.slice(head[0].length).trim()
    return {
      taskId,
      signedBy: head[1] as AgentRole,
      version: Number(head[2]),
      signedAt: Number(head[3]),
      content,
      agents: parseSpecAgents(content),
      plan: parseLotPlan(content)
    }
  }

  private reportPath(taskId: string, agentId: string): string {
    if (!isValidTaskId(taskId) || !isValidAgentId(agentId)) throw new AppError('VALIDATION', 'Identifiant invalide.')
    return `${PIPELINE_DIR}/${taskId}/rapport-${agentId}.md`
  }

  /** Rapport d'un agent sur une tâche : un rapport par agent et par tâche (le nouveau remplace l'ancien). */
  writeReport(
    taskId: string,
    agent: { readonly id: string; readonly role: AgentRole },
    content: string,
    index: PassIndex
  ): PipelineReport {
    const file = join(this.deps.projectDir, this.reportPath(taskId, agent.id))
    const text = this.checkContent(content)
    const writtenAt = this.now()
    const head = `role=${agent.role} agent=${agent.id} passe=${index.pass} nature=${index.nature}`
    this.write(file, `<!-- pipeline:rapport ${head} spec=${index.specVersion ?? '-'} le=${writtenAt} -->\n${text}\n`)
    this.appendJournal({
      at: writtenAt,
      taskId,
      role: agent.role,
      message: `Rapport rendu (${agent.id}, passe ${index.pass} ${index.nature}).`
    })
    return { taskId, agentId: agent.id, role: agent.role, index, writtenAt, content: text }
  }

  listReports(taskId: string): PipelineReport[] {
    const dir = this.taskDir(taskId)
    if (!existsSync(dir)) return []
    const reports: PipelineReport[] = []
    for (const name of readdirSync(dir).sort()) {
      if (!name.startsWith('rapport-') || !name.endsWith('.md')) continue
      const raw = readDocument(join(dir, name))
      const head = REPORT_HEADER.exec(raw)
      if (head === null || !isRole(head[1] as string) || !isNature(head[4] as string)) continue
      const spec = head[5] as string
      reports.push({
        taskId,
        agentId: head[2] as string,
        role: head[1] as AgentRole,
        index: {
          pass: Number(head[3]),
          nature: head[4] as PassNature,
          ...(spec === '-' ? {} : { specVersion: Number(spec) })
        },
        writtenAt: Number(head[6]),
        content: raw.slice(head[0].length).trim()
      })
    }
    return reports.sort((a, b) => a.writtenAt - b.writtenAt)
  }

  /** Journal du projet (`docs/pipeline/JOURNAL.md`, complet) et journal global court (profil, condensé). */
  appendJournal(entry: Omit<JournalEntry, 'project'>): void {
    if (!isValidTaskId(entry.taskId)) throw new AppError('VALIDATION', 'Identifiant de tâche invalide.')
    const date = new Date(entry.at).toISOString()
    const message = oneLine(entry.message)
    const project = oneLine(this.deps.projectName) || 'projet'
    const projectFile = this.projectJournalFile()
    mkdirSync(dirname(projectFile), { recursive: true })
    if (!existsSync(projectFile)) writeFileSync(projectFile, '# Journal du pipeline\n\n', 'utf8')
    appendFileSync(projectFile, `- ${date} · ${entry.taskId} · ${entry.role} · ${message}\n`, 'utf8')
    this.appendGlobal(`- ${date} · ${project} · ${entry.taskId} · ${entry.role} · ${message}`)
  }

  private projectJournalFile(): string {
    return this.deps.projectJournalFile ?? join(this.deps.projectDir, PROJECT_JOURNAL_FILE)
  }

  readProjectJournal(): string {
    const file = this.projectJournalFile()
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }

  readGlobalJournal(): string {
    const file = join(this.deps.profileDir, GLOBAL_JOURNAL_FILE)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }

  private appendGlobal(line: string): void {
    const lines = this.readGlobalJournal()
      .split('\n')
      .filter((l) => l.startsWith('- '))
    lines.push(line)
    const body = condense(lines).join('\n')
    this.write(join(this.deps.profileDir, GLOBAL_JOURNAL_FILE), `# Journal global des pipelines\n\n${body}\n`)
  }
}
