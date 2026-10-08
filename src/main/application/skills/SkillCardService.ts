import { randomUUID } from 'node:crypto'
import type {
  SkillAnalyzeProgressEvent,
  SkillCardsView,
  SkillCardView,
  SkillsView,
  SkillView
} from '@shared/ipc/skills'
import { SkillCard, type SemanticLinkKind } from '@shared/skills/card'
import type { AIError, Result } from '../../domain/ai/types'
import { AppError } from '../../domain/errors'
import { cardCheck } from '../../domain/skills/cardCheck'
import type { SkillCardRow, SkillLinkRow, SkillRepository } from '../../infrastructure/db/repositories/SkillRepository'
import type { CardInput } from '../ai/SkillCardTask'
import type { EntityHandler } from '../history/HistoryService'
import type { SkillInventory } from './SkillInventory'

/** Analyses menées en parallèle (`L3-skills-comprendre.md` §2). */
export const CARD_CONCURRENCY = 3
/** Skills désignés au plus par une demande explicite (« Réanalyser »). */
export const CARD_EXPLICIT_MAX = 30

/** Famille qui l'emporte quand deux skills portent le même nom (ombre). */
const FAMILY_RANK: Readonly<Record<SkillView['family'], number>> = { perso: 0, projet: 1, plugin: 2 }

export interface SkillCardDeps {
  readonly repository: SkillRepository
  readonly inventory: Pick<SkillInventory, 'list' | 'get'>
  /** Tâche `skill_card` (Claude sans outil). */
  readonly card: (
    input: CardInput,
    requestId: string,
    signal: AbortSignal
  ) => Promise<Result<{ readonly data: SkillCard; readonly model: string }, AIError>>
  readonly emit: (event: SkillAnalyzeProgressEvent) => void
  /** Les fiches ont changé : le renderer relit. */
  readonly onChanged: () => void
  readonly concurrency?: number
  readonly now?: () => number
  readonly newId?: () => string
}

/**
 * Fiches techniques des skills (spec 020 US2, FR-009 à FR-015) : analyse à la demande, trois à la fois, un skill
 * inchangé ignoré ; la note et le domaine de mentalyas priment et survivent aux analyses ; un lien de Claude retiré par
 * mentalyas n'est jamais reproposé. Chaque correction est un lot annulable de l'Historique.
 */
export class SkillCardService {
  private running: { readonly id: string; readonly controller: AbortController; done: Promise<void> } | null = null

  constructor(private readonly deps: SkillCardDeps) {}

  view(): SkillCardsView {
    const { repository } = this.deps
    const hashes = new Map(this.deps.inventory.list().skills.map((skill) => [skill.id, skill.contentHash]))
    const cards: Record<string, SkillCardView> = {}
    for (const row of repository.cards()) {
      const view = cardView(row, hashes.get(row.skillId))
      if (view !== null) cards[row.skillId] = view
    }
    return {
      cards,
      domains: repository.domains().map((row) => ({ ...row })),
      links: repository.links().map((row) => ({
        id: row.id,
        from: row.fromId,
        to: row.toId,
        kind: row.kind as SemanticLinkKind,
        origin: row.origin,
        reason: row.reason
      }))
    }
  }

  /**
   * Lance une analyse : les skills désignés (forcée), ou ceux sans fiche ou modifiés depuis la leur. Un skill abîmé
   * n'est jamais analysé.
   */
  analyze(skillIds?: readonly string[]): { analysisId: string; total: number } {
    if (this.running !== null) throw new AppError('ANALYSIS_RUNNING', 'Une analyse est déjà en cours')
    if (skillIds !== undefined && skillIds.length > CARD_EXPLICIT_MAX) {
      throw new AppError('VALIDATION', `${CARD_EXPLICIT_MAX} skills au plus par analyse`)
    }
    const view = this.deps.inventory.list()
    const cards = new Map(this.deps.repository.cards().map((row) => [row.skillId, row]))
    const wanted = skillIds === undefined ? null : new Set(skillIds)
    const targets = view.skills.filter(
      (skill) =>
        !skill.damaged &&
        (wanted === null ? cards.get(skill.id)?.contentHash !== skill.contentHash : wanted.has(skill.id))
    )
    const id = this.newId()
    const controller = new AbortController()
    const running = { id, controller, done: Promise.resolve() }
    this.running = running
    running.done = this.run(id, view, targets, controller.signal).finally(() => {
      this.running = null
      this.deps.onChanged()
    })
    return { analysisId: id, total: targets.length }
  }

  /** Attend la fin de l'analyse en cours (tests, arrêt de l'app). */
  async idle(): Promise<void> {
    await this.running?.done
  }

  stop(): void {
    this.running?.controller.abort()
  }

  /** Note de mentalyas (1–5), ou `null` pour rendre la main à la grille de Claude. */
  setStars(skillId: string, stars: number | null): { batchId: string } {
    return this.correct(skillId, (card) => ({
      starsUser: stars,
      domainId: card.domainId,
      domainSource: card.domainSource
    }))
  }

  setDomain(skillId: string, domainId: string): { batchId: string } {
    if (!this.deps.repository.domains().some((domain) => domain.id === domainId)) {
      throw new AppError('VALIDATION', 'Domaine inconnu')
    }
    return this.correct(skillId, (card) => ({ starsUser: card.starsUser, domainId, domainSource: 'user' }))
  }

  acceptDomain(domainId: string): void {
    if (!this.deps.repository.acceptDomain(domainId)) throw new AppError('NOT_FOUND', 'Domaine introuvable')
    this.deps.onChanged()
  }

  /** Lien de sens ajouté par mentalyas (un lien de Claude qu'elle avait retiré est rétabli). */
  link(from: string, to: string, kind: SemanticLinkKind): { batchId: string } {
    const ids = new Set(this.deps.inventory.list().skills.map((skill) => skill.id))
    if (from === to || !ids.has(from) || !ids.has(to)) throw new AppError('VALIDATION', 'Lien invalide')
    const { repository } = this.deps
    const existing = repository.linkBetween(from, to, kind)
    if (existing !== undefined && !existing.removed) throw new AppError('VALIDATION', 'Ce lien existe déjà')
    const batchId = this.newId()
    repository.transaction(() => {
      if (existing === undefined) {
        repository.insertLink({
          id: this.newId(),
          fromId: from,
          toId: to,
          kind,
          origin: 'user',
          reason: null,
          removed: false
        })
      } else repository.updateLink(existing.id, { removed: false })
      const after = repository.linkBetween(from, to, kind) as SkillLinkRow
      repository.log(batchId, [linkChange(after.id, existing ?? null, after)], 'user')
    })
    this.deps.onChanged()
    return { batchId }
  }

  /** Retire un lien : celui de Claude est marqué retiré (jamais reproposé), celui de mentalyas est supprimé. */
  unlink(linkId: string): { batchId: string } {
    const { repository } = this.deps
    const existing = repository.link(linkId)
    if (existing === undefined || existing.removed) throw new AppError('NOT_FOUND', 'Lien introuvable')
    const batchId = this.newId()
    repository.transaction(() => {
      if (existing.origin === 'claude') repository.updateLink(linkId, { removed: true })
      else repository.deleteLink(linkId)
      repository.log(batchId, [linkChange(linkId, existing, repository.link(linkId) ?? null)], 'user')
    })
    this.deps.onChanged()
    return { batchId }
  }

  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    const { repository } = this.deps
    return {
      skill_card_user: {
        snapshot: (skillId) => {
          const card = repository.card(skillId)
          return card === undefined ? null : userPart(card)
        },
        apply: (skillId, target) => {
          if (target !== null && repository.card(skillId) !== undefined) {
            repository.updateCard(skillId, target as Partial<SkillCardRow>)
          }
          this.deps.onChanged()
        }
      },
      skill_link: {
        snapshot: (linkId) => {
          const link = repository.link(linkId)
          return link === undefined ? null : { ...link }
        },
        apply: (linkId, target) => {
          if (target === null) repository.deleteLink(linkId)
          else if (repository.link(linkId) === undefined) repository.insertLink(target as SkillLinkRow)
          else repository.updateLink(linkId, target as Partial<SkillLinkRow>)
          this.deps.onChanged()
        }
      }
    }
  }

  // --- Interne ---------------------------------------------------------------------------------------------------

  private async run(id: string, view: SkillsView, targets: readonly SkillView[], signal: AbortSignal): Promise<void> {
    const progress = { done: 0, failed: 0 }
    const emit = (): void => this.deps.emit({ analysisId: id, total: targets.length, ...progress })
    emit()
    const names = winningNames(view.skills)
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < targets.length && !signal.aborted) {
        const skill = targets[next++] as SkillView
        const ok = await this.analyzeOne(skill, view, names, signal).catch(() => false)
        progress.done += 1
        if (!ok) progress.failed += 1
        emit()
      }
    }
    const workers = Math.min(this.deps.concurrency ?? CARD_CONCURRENCY, targets.length)
    await Promise.all(Array.from({ length: workers }, () => worker()))
  }

  private async analyzeOne(
    skill: SkillView,
    view: SkillsView,
    names: ReadonlyMap<string, string>,
    signal: AbortSignal
  ): Promise<boolean> {
    const { repository } = this.deps
    const detail = this.deps.inventory.get(skill.id)
    const domains = repository.domains()
    const result = await this.deps.card(
      {
        name: skill.name,
        family: skill.family,
        markdown: detail.markdown,
        canvas: view.skills
          .filter((other) => other.id !== skill.id && names.get(other.name) === other.id)
          .map((other) => ({ name: other.name, description: other.description })),
        domains: domains.map((domain) => ({ id: domain.id, label: domain.label }))
      },
      `skill_card:${skill.id}`,
      signal
    )
    if (!result.ok || signal.aborted) return false
    const card = result.value.data
    const checked = cardCheck({
      card,
      self: skill.name,
      skills: names,
      domains: new Set(domains.map((domain) => domain.id))
    })
    repository.transaction(() => {
      if (checked.domain.proposedLabel !== undefined) {
        repository.proposeDomain(checked.domain.id, checked.domain.proposedLabel)
      }
      const existing = repository.card(skill.id)
      const userDomain = existing?.domainSource === 'user'
      repository.upsertCard({
        skillId: skill.id,
        contentHash: skill.contentHash,
        card: JSON.stringify(card),
        grid: JSON.stringify({ grille: card.grille, justification: card.justification }),
        starsClaude: checked.stars,
        starsUser: existing?.starsUser ?? null,
        domainId: userDomain ? existing.domainId : checked.domain.id,
        domainSource: userDomain ? 'user' : 'claude',
        analyzedAt: this.now(),
        model: result.value.model
      })
      repository.replaceClaudeLinks(
        skill.id,
        checked.links.map((link) => ({ id: this.newId(), toId: link.to, kind: link.kind, reason: link.reason }))
      )
    })
    return true
  }

  /** Correction de la note ou du domaine : un lot annulable. */
  private correct(
    skillId: string,
    next: (card: SkillCardRow) => Pick<SkillCardRow, 'starsUser' | 'domainId' | 'domainSource'>
  ): { batchId: string } {
    const { repository } = this.deps
    const card = repository.card(skillId)
    if (card === undefined) throw new AppError('NOT_FOUND', 'Ce skill n’a pas encore de fiche')
    const batchId = this.newId()
    const after = next(card)
    repository.transaction(() => {
      repository.updateCard(skillId, after)
      repository.log(
        batchId,
        [{ kind: 'skills', entity: 'skill_card_user', entityId: skillId, before: userPart(card), after }],
        'user'
      )
    })
    this.deps.onChanged()
    return { batchId }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private newId(): string {
    return (this.deps.newId ?? randomUUID)()
  }
}

/** Nom → identifiant du skill qui l'emporte pour Claude Code (personnel, puis de projet, puis de plugin). */
export function winningNames(skills: readonly SkillView[]): Map<string, string> {
  const names = new Map<string, SkillView>()
  for (const skill of skills) {
    const current = names.get(skill.name)
    if (current === undefined || FAMILY_RANK[skill.family] < FAMILY_RANK[current.family]) names.set(skill.name, skill)
  }
  return new Map([...names].map(([name, skill]) => [name, skill.id]))
}

function userPart(card: SkillCardRow): Pick<SkillCardRow, 'starsUser' | 'domainId' | 'domainSource'> {
  return { starsUser: card.starsUser, domainId: card.domainId, domainSource: card.domainSource }
}

function linkChange(linkId: string, before: SkillLinkRow | null, after: SkillLinkRow | null) {
  return {
    kind: 'skills' as const,
    entity: 'skill_link',
    entityId: linkId,
    before: before === null ? null : { ...before },
    after: after === null ? null : { ...after }
  }
}

/** Fiche stockée → vue ; une fiche illisible (format d'une ancienne version) est ignorée, à refaire. */
function cardView(row: SkillCardRow, currentHash: string | undefined): SkillCardView | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(row.card)
  } catch {
    return null
  }
  const card = SkillCard.safeParse(parsed)
  if (!card.success) return null
  return {
    skillId: row.skillId,
    card: card.data,
    stars: row.starsUser ?? row.starsClaude,
    starsClaude: row.starsClaude,
    starsUser: row.starsUser,
    domainId: row.domainId,
    domainSource: row.domainSource,
    analyzedAt: row.analyzedAt,
    model: row.model,
    stale: currentHash !== undefined && currentHash !== row.contentHash
  }
}
