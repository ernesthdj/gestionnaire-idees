import { renameSync, writeFileSync } from 'node:fs'
import type { GitStatusView } from '@shared/git/model'
import type {
  ConflictFileView,
  ConflictHunkView,
  ConflictKind,
  HunkChoice,
  MergeStateView
} from '@shared/git/conflicts'
import * as args from '../../domain/git/args'
import {
  assemble,
  eolOf,
  hasMarkers,
  newLines,
  previewHash,
  splitHunks,
  type HunkDecision,
  type Segment
} from '../../domain/git/splitHunks'
import { AppError } from '../../domain/errors'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { GitWriteQueue } from '../../infrastructure/git/GitWriteQueue'
import { gitConflictInput, GIT_CONFLICT_LIMITS, type ConflictProposal } from '../ai/GitConflictTask'
import { lastLines, type GitAccess, type ReadyRepo } from './GitAccess'

export interface ConflictDeps {
  readonly access: GitAccess
  readonly queue: Pick<GitWriteQueue, 'run'>
  readonly repository: Pick<GitRepository, 'openSession' | 'closeSession' | 'hunks' | 'saveHunk' | 'resolvedPaths'>
  readonly status: (genesisId: string) => Promise<GitStatusView>
  readonly changed: (genesisId: string) => void
  /** Projet « Local uniquement » : rien n'est envoyé à Claude (FR-038). */
  readonly localOnly: (genesisId: string) => boolean
  /** Tâche `git_conflict` relue (`null` : indisponible ou sortie invalide). */
  readonly propose: (input: string, indexes: readonly number[]) => Promise<readonly ConflictProposal[] | null>
}

/** Au-delà, ou binaire : choix entier du fichier (L3 §6). */
const MAX_FILE_BYTES = 1024 * 1024
/** Bloc « fichier résolu » (choix entier ou validation) : la résolution reste connue jusqu'à la fin de la fusion. */
const RESOLVED_MARK = -1

interface Versions {
  readonly base: string | null
  readonly ours: string | null
  readonly theirs: string | null
  readonly binary: boolean
}

const joinLines = (lines: readonly string[]): string => lines.join('\n')

/**
 * Résolution d'un conflit avec Claude (spec 021 US4, L3 conflits) : les trois versions viennent de l'index de git,
 * jamais du fichier à marqueurs ; mentalyas décide bloc par bloc (la sienne, la leur, les deux, la proposition de
 * Claude, ou un texte édité), valide chaque fichier sur l'aperçu qu'il a vu, puis termine la fusion ou l'abandonne.
 * Les propositions et décisions sont effacées à la fin : le code d'un collègue ne reste pas en base.
 */
export class ConflictService {
  constructor(private readonly deps: ConflictDeps) {}

  async mergeState(genesisId: string): Promise<MergeStateView> {
    const { repo, session } = await this.session(genesisId)
    const unmerged = await this.unmerged(repo)
    const status = await this.deps.access.readStatus(repo)
    const resolved = new Set<string>()
    for (const path of [...unmerged.keys(), ...this.resolvedPaths(session.id)]) {
      if (!unmerged.has(path)) resolved.add(path)
    }
    const files: MergeStateView['files'][number][] = []
    for (const [path, stages] of unmerged) {
      files.push({ path, kind: await this.kindOf(repo, path, stages), state: 'unresolved' })
    }
    for (const path of resolved) files.push({ path, kind: 'content', state: 'resolved' })
    return {
      into: status.branch ?? 'HEAD',
      from:
        status.upstream === null
          ? session.mergeHead.slice(0, 7)
          : `${status.upstream.remote}/${status.upstream.branch}`,
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      startedAt: session.startedAt
    }
  }

  async file(genesisId: string, path: string): Promise<ConflictFileView> {
    const { repo, session } = await this.session(genesisId)
    return this.view(repo, session.id, path)
  }

  /** Proposition de Claude pour les blocs d'un fichier, sur clic (jamais en rafale). */
  async propose(genesisId: string, path: string): Promise<ConflictFileView> {
    if (this.deps.localOnly(genesisId)) {
      throw new AppError(
        'LOCAL_ONLY',
        'Projet « Local uniquement » : rien n’est envoyé à Claude, résous ce fichier à la main.'
      )
    }
    const { repo, session } = await this.session(genesisId)
    const versions = await this.versions(repo, path)
    if (versions.binary || versions.ours === null || versions.theirs === null) {
      throw new AppError(
        'TOO_LARGE',
        'Fichier binaire, trop grand ou supprimé d’un côté : choisis une version entière.'
      )
    }
    const segments = splitHunks(versions.base, versions.ours, versions.theirs)
    const hunks = hunkInputs(segments)
    const commits = [
      ...(await this.subjects(repo, 'HEAD', path)).map((subject) => `ta branche : ${subject}`),
      ...(await this.subjects(repo, 'MERGE_HEAD', path)).map((subject) => `leur branche : ${subject}`)
    ]
    const input = gitConflictInput({ path, hunks, commits })
    if (input === null) {
      throw new AppError(
        'TOO_LARGE',
        `Trop de blocs ou trop de code pour Claude (${GIT_CONFLICT_LIMITS.hunks} blocs au plus) : résous à la main.`
      )
    }
    const proposals = await this.deps.propose(
      input,
      hunks.map((hunk) => hunk.index)
    )
    if (proposals === null)
      throw new AppError('AI_UNAVAILABLE', 'Claude n’a pas pu proposer de fusion pour ce fichier.')
    for (const proposal of proposals) {
      this.deps.repository.saveHunk(session.id, path, proposal.index, {
        proposal: proposal.text,
        explanation: [proposal.explanation, proposal.risk === '' ? '' : `Risque : ${proposal.risk}`]
          .filter((part) => part !== '')
          .join(' '),
        confidence: proposal.confidence
      })
    }
    return this.view(repo, session.id, path)
  }

  async decide(input: {
    readonly genesisId: string
    readonly path: string
    readonly hunkIndex: number
    readonly choice: HunkChoice
    readonly manualText?: string
  }): Promise<ConflictFileView> {
    const { repo, session } = await this.session(input.genesisId)
    const view = await this.view(repo, session.id, input.path)
    const hunk = view.hunks.find((entry) => entry.index === input.hunkIndex)
    if (hunk === undefined) throw new AppError('STALE', 'Ce bloc n’existe plus : le fichier a changé, relis-le.')
    if (input.choice === 'claude' && hunk.proposal === undefined) {
      throw new AppError('VALIDATION', 'Aucune proposition de Claude pour ce bloc.')
    }
    if (input.choice === 'manual' && input.manualText === undefined) {
      throw new AppError('VALIDATION', 'Écris le texte de ce bloc.')
    }
    this.deps.repository.saveHunk(session.id, input.path, input.hunkIndex, {
      decision: input.choice,
      manualText: input.choice === 'manual' ? (input.manualText ?? '') : null
    })
    return this.view(repo, session.id, input.path)
  }

  /** Valide un fichier sur l'aperçu vu : tous les blocs décidés, aucun marqueur, écriture atomique, puis `add`. */
  async resolveFile(genesisId: string, path: string, expectedPreviewHash: string): Promise<MergeStateView> {
    const { repo, session } = await this.session(genesisId)
    await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const view = await this.view(repo, session.id, path)
      if (view.kind === 'binary' || view.kind === 'delete_modify') {
        throw new AppError('VALIDATION', 'Ce fichier se résout en choisissant une version entière.')
      }
      if (view.hunks.some((hunk) => hunk.decision === undefined)) {
        throw new AppError('UNDECIDED_HUNKS', 'Des blocs ne sont pas encore décidés.')
      }
      if (view.previewHash !== expectedPreviewHash) {
        throw new AppError('STALE', 'Le fichier a changé depuis ton aperçu : relis-le avant de valider.')
      }
      if (hasMarkers(view.preview))
        throw new AppError('MARKERS_LEFT', 'Il reste des marqueurs de conflit dans l’aperçu.')
      const full = this.deps.access.inside(repo, path)
      const temporary = `${full}.${process.pid}.tmp`
      writeFileSync(temporary, view.preview, 'utf8')
      renameSync(temporary, full)
      await this.deps.access.write(repo, args.stageArgs([path]))
      this.deps.repository.saveHunk(session.id, path, RESOLVED_MARK, { decision: 'manual' })
    })
    this.deps.changed(genesisId)
    return this.mergeState(genesisId)
  }

  /** Choix entier : ta version, la leur, ou la suppression (binaire, trop grand, suppression contre modification). */
  async wholeFile(genesisId: string, path: string, choice: 'ours' | 'theirs' | 'delete'): Promise<MergeStateView> {
    const { repo, session } = await this.session(genesisId)
    await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const stages = (await this.unmerged(repo)).get(path)
      if (stages === undefined) throw new AppError('NOT_FOUND', 'Ce fichier n’est plus en conflit.')
      const side = choice === 'ours' ? 2 : choice === 'theirs' ? 3 : null
      if (side === null || !stages.has(side)) await this.deps.access.write(repo, args.removeArgs(path))
      else {
        await this.deps.access.write(repo, args.checkoutSideArgs(choice === 'ours' ? 'ours' : 'theirs', path))
        await this.deps.access.write(repo, args.stageArgs([path]))
      }
      this.deps.repository.saveHunk(session.id, path, RESOLVED_MARK, {
        decision: choice === 'theirs' ? 'theirs' : 'ours'
      })
    })
    this.deps.changed(genesisId)
    return this.mergeState(genesisId)
  }

  /** Termine la fusion sur clic : plus aucun fichier en conflit (vérifié par git), commit de fusion. */
  async finish(genesisId: string, message: string | undefined): Promise<{ readonly hash: string }> {
    const { repo, session } = await this.session(genesisId)
    const hash = await this.deps.queue.run(genesisId, repo.gitDir, async () => {
      const unresolved = (await this.deps.access.read(repo, args.unresolvedArgs())).stdout.split('\0').filter(Boolean)
      if (unresolved.length > 0) {
        throw new AppError('UNRESOLVED_FILES', `${unresolved.length} fichier(s) encore en conflit.`, {
          files: unresolved.slice(0, 50)
        })
      }
      const text = message?.trim() ?? ''
      const result = await this.deps.access.run(
        repo,
        args.mergeCommitArgs(text !== ''),
        text === '' ? {} : { stdin: text }
      )
      if (result.code !== 0) {
        throw new AppError('HOOK_FAILED', 'Le commit de fusion a été refusé (hook).', {
          hookOutput: lastLines(`${result.stdout}\n${result.stderr}`.trim(), 8_000)
        })
      }
      return (await this.deps.access.head(repo)) ?? ''
    })
    this.deps.repository.closeSession(session.id, 'merged')
    this.deps.changed(genesisId)
    return { hash }
  }

  /** Abandon confirmé : le dépôt revient à son état d'avant la fusion (`merge --abort`). */
  async abort(genesisId: string): Promise<GitStatusView> {
    const repo = await this.deps.access.ready(genesisId)
    const session = this.deps.repository.openSession(genesisId)
    if (session === undefined || this.deps.access.operationOf(repo) !== 'merge') {
      throw new AppError('NO_MERGE', 'Aucune fusion en cours.')
    }
    await this.deps.queue.run(genesisId, repo.gitDir, () => this.deps.access.write(repo, args.mergeAbortArgs()))
    this.deps.repository.closeSession(session.id, 'aborted')
    this.deps.changed(genesisId)
    return this.deps.status(genesisId)
  }

  /** Session ouverte et toujours vraie ; une fusion terminée ou abandonnée en terminal devient « perdue ». */
  private async session(genesisId: string): Promise<{
    readonly repo: ReadyRepo
    readonly session: NonNullable<ReturnType<ConflictDeps['repository']['openSession']>>
  }> {
    const repo = await this.deps.access.ready(genesisId)
    const session = this.deps.repository.openSession(genesisId)
    if (session === undefined) throw new AppError('NO_MERGE', 'Aucune fusion en cours.')
    const mergeHead = await this.deps.access.read(repo, args.mergeHeadArgs())
    if (mergeHead.code !== 0 || mergeHead.stdout.trim() !== session.mergeHead) {
      this.deps.repository.closeSession(session.id, 'lost')
      throw new AppError('NO_MERGE', 'La fusion a été terminée ou abandonnée hors de l’app.')
    }
    return { repo, session }
  }

  /** Chemins en conflit et leurs étapes présentes (1 base, 2 la tienne, 3 la leur). */
  private async unmerged(repo: ReadyRepo): Promise<Map<string, Set<number>>> {
    const output = (await this.deps.access.read(repo, args.unmergedArgs())).stdout
    const files = new Map<string, Set<number>>()
    for (const record of output.split('\0')) {
      const match = /^\d+ [0-9a-f]+ ([123])\t(.+)$/s.exec(record)
      if (match === null) continue
      const path = match[2] ?? ''
      files.set(path, (files.get(path) ?? new Set<number>()).add(Number(match[1])))
    }
    return files
  }

  private resolvedPaths(sessionId: string): string[] {
    return this.deps.repository.resolvedPaths(sessionId)
  }

  private async kindOf(repo: ReadyRepo, path: string, stages: ReadonlySet<number>): Promise<ConflictKind> {
    if (!stages.has(2) || !stages.has(3)) return 'delete_modify'
    const versions = await this.versions(repo, path)
    if (versions.binary) return 'binary'
    return stages.has(1) ? 'content' : 'add_add'
  }

  private async versions(repo: ReadyRepo, path: string): Promise<Versions> {
    const read = async (stage: 1 | 2 | 3): Promise<{ text: string | null; binary: boolean }> => {
      const result = await this.deps.access.read(repo, args.stageBlobArgs(stage, path), { maxOutput: MAX_FILE_BYTES })
      if (result.code !== 0) return { text: null, binary: false }
      return { text: result.stdout, binary: result.truncated || result.stdout.includes('\0') }
    }
    const [base, ours, theirs] = [await read(1), await read(2), await read(3)]
    return {
      base: base.text,
      ours: ours.text,
      theirs: theirs.text,
      binary: base.binary || ours.binary || theirs.binary
    }
  }

  private async subjects(repo: ReadyRepo, ref: 'HEAD' | 'MERGE_HEAD', path: string): Promise<string[]> {
    const result = await this.deps.access.read(repo, ['log', '-n5', '--no-color', '--format=%s', ref, '--', path])
    return result.code === 0 ? result.stdout.split('\n').filter((line) => line.trim() !== '') : []
  }

  private async view(repo: ReadyRepo, sessionId: string, path: string): Promise<ConflictFileView> {
    const stages = (await this.unmerged(repo)).get(path)
    if (stages === undefined) throw new AppError('NOT_FOUND', 'Ce fichier n’est pas (ou plus) en conflit.')
    const kind = await this.kindOf(repo, path, stages)
    const localOnly = this.deps.localOnly(repo.genesisId)
    if (kind === 'binary' || kind === 'delete_modify') {
      return { path, kind, hunks: [], preview: '', previewHash: previewHash(''), localOnly }
    }
    const versions = await this.versions(repo, path)
    const segments = splitHunks(versions.base, versions.ours ?? '', versions.theirs ?? '')
    const rows = new Map(this.deps.repository.hunks(sessionId, path).map((row) => [row.hunkIndex, row] as const))
    const decisions = new Map<number, HunkDecision>()
    const hunks: ConflictHunkView[] = []
    segments.forEach((segment, position) => {
      if (segment.kind !== 'conflict') return
      const row = rows.get(segment.index)
      const decision = row?.decision ?? undefined
      if (decision !== undefined && decision !== null) {
        decisions.set(segment.index, {
          choice: decision,
          ...(decision === 'claude'
            ? { text: row?.proposal ?? '' }
            : decision === 'manual'
              ? { text: row?.manualText ?? '' }
              : {})
        })
      }
      hunks.push({
        index: segment.index,
        base: versions.base === null ? null : joinLines(segment.base),
        ours: joinLines(segment.ours),
        theirs: joinLines(segment.theirs),
        contextBefore: joinLines(stableAt(segments, position - 1).slice(-3)),
        contextAfter: joinLines(stableAt(segments, position + 1).slice(0, 3)),
        ...(row?.proposal === null || row?.proposal === undefined
          ? {}
          : {
              proposal: {
                text: row.proposal,
                explanation: row.explanation ?? '',
                confidence: row.confidence ?? 'check',
                newLines: newLines(row.proposal, segment.ours, segment.theirs)
              }
            }),
        ...(decision === undefined || decision === null ? {} : { decision }),
        ...(row?.manualText === null || row?.manualText === undefined ? {} : { manualText: row.manualText })
      })
    })
    const preview = assemble(segments, decisions, eolOf(versions.ours ?? ''))
    return { path, kind, hunks, preview, previewHash: previewHash(preview), localOnly }
  }
}

const stableAt = (segments: readonly Segment[], index: number): readonly string[] => {
  const segment = segments[index]
  return segment?.kind === 'stable' ? segment.lines : []
}

/** Blocs donnés à Claude, avec 15 lignes de contexte de chaque côté. */
function hunkInputs(segments: readonly Segment[]): {
  index: number
  base: string
  ours: string
  theirs: string
  before: string
  after: string
}[] {
  return segments.flatMap((segment, position) =>
    segment.kind !== 'conflict'
      ? []
      : [
          {
            index: segment.index,
            base: joinLines(segment.base),
            ours: joinLines(segment.ours),
            theirs: joinLines(segment.theirs),
            before: joinLines(stableAt(segments, position - 1).slice(-GIT_CONFLICT_LIMITS.context)),
            after: joinLines(stableAt(segments, position + 1).slice(0, GIT_CONFLICT_LIMITS.context))
          }
        ]
  )
}
