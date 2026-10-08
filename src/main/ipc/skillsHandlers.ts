import { z } from 'zod'
import { SEMANTIC_LINK_KINDS, type SemanticLinkKind } from '@shared/skills/card'
import type {
  LibraryRepoView,
  LibrarySkillDetailView,
  LibraryVerdict,
  SkillDetailView,
  SkillDraftDiffView,
  SkillCardsView,
  SkillDraftView,
  SkillsView,
  SkillUsageView
} from '@shared/ipc/skills'
import { defineRoute, type IpcRoute } from './registry'

export interface SkillsRoutesDeps {
  readonly inventory: {
    refresh(): SkillsView
    get(skillId: string): Omit<SkillDetailView, 'versions'>
    watch(): void
  }
  readonly skills?: {
    versionsOf(skillId: string): number
    conversation(skillId?: string): { neuronId: string }
    drafts(skillId?: string): SkillDraftView[]
    diff(draftId: string): SkillDraftDiffView
    install(draftId: string, acceptDiskChange?: boolean): { batchId: string; skillId: string }
    discard(draftId: string): void
    restore(skillId: string): { batchId: string }
    remove(skillId: string): { batchId: string }
    duplicate(skillId: string): { draftId: string }
  }
  readonly cards?: {
    view(): SkillCardsView
    analyze(skillIds?: readonly string[]): { analysisId: string; total: number }
    setStars(skillId: string, stars: number | null): { batchId: string }
    setDomain(skillId: string, domainId: string): { batchId: string }
    acceptDomain(domainId: string): void
    link(from: string, to: string, kind: SemanticLinkKind): { batchId: string }
    unlink(linkId: string): { batchId: string }
    usage(): Promise<Record<string, SkillUsageView>>
  }
  readonly imports?: {
    start(url: string): { importId: string }
    cancel(importId: string): void
    library(): LibraryRepoView[]
    librarySkill(candidateId: string): LibrarySkillDetailView
    install(input: {
      readonly candidateId: string
      readonly scripts: readonly string[]
      readonly seen: LibraryVerdict
      readonly unlockDangerous?: boolean
    }): Promise<{ draftId: string; verdict: LibraryVerdict }>
    remove(repoId: string): void
  }
}

const SkillId = z.string().min(3).max(300)
const DraftId = z.uuid()

/**
 * Canaux de l'arbre de skills (spec 020 US1, US3). Le renderer ne donne jamais de chemin : seulement un identifiant de
 * skill calculé par le main, ou de brouillon. Écrire sur le disque demande `confirm: true` (geste de mentalyas).
 */
export function createSkillsRoutes(deps: SkillsRoutesDeps): IpcRoute[] {
  const skills = deps.skills
  const routes: IpcRoute[] = [
    defineRoute({
      channel: 'skills:list',
      input: z.undefined(),
      // Ouverture de la page : inventaire complet (plugins compris) et surveillance réarmée sur les projets liés.
      handler: async () => {
        const view = deps.inventory.refresh()
        deps.inventory.watch()
        return view
      }
    }),
    defineRoute({
      channel: 'skills:get',
      input: z.object({ skillId: SkillId }).strict(),
      handler: async ({ skillId }): Promise<SkillDetailView> => ({
        ...deps.inventory.get(skillId),
        versions: skills?.versionsOf(skillId) ?? 0
      })
    })
  ]
  if (skills === undefined) return routes
  return [
    ...routes,
    defineRoute({
      channel: 'skills:conversation',
      input: z.object({ skillId: SkillId.optional() }).strict(),
      handler: async ({ skillId }) => skills.conversation(skillId)
    }),
    defineRoute({
      channel: 'skills:drafts',
      input: z.object({ skillId: SkillId.optional() }).strict(),
      handler: async ({ skillId }) => skills.drafts(skillId)
    }),
    defineRoute({
      channel: 'skills:draftDiff',
      input: z.object({ draftId: DraftId }).strict(),
      handler: async ({ draftId }) => skills.diff(draftId)
    }),
    defineRoute({
      channel: 'skills:install',
      input: z
        .object({ draftId: DraftId, confirm: z.literal(true), acceptDiskChange: z.literal(true).optional() })
        .strict(),
      handler: async ({ draftId, acceptDiskChange }) => skills.install(draftId, acceptDiskChange === true)
    }),
    defineRoute({
      channel: 'skills:discardDraft',
      input: z.object({ draftId: DraftId }).strict(),
      handler: async ({ draftId }) => {
        skills.discard(draftId)
        return {}
      }
    }),
    defineRoute({
      channel: 'skills:restore',
      input: z.object({ skillId: SkillId, confirm: z.literal(true) }).strict(),
      handler: async ({ skillId }) => skills.restore(skillId)
    }),
    defineRoute({
      channel: 'skills:remove',
      input: z.object({ skillId: SkillId, confirm: z.literal(true) }).strict(),
      handler: async ({ skillId }) => skills.remove(skillId)
    }),
    defineRoute({
      channel: 'skills:duplicate',
      input: z.object({ skillId: SkillId }).strict(),
      handler: async ({ skillId }) => skills.duplicate(skillId)
    }),
    ...importRoutes(deps.imports),
    ...cardRoutes(deps.cards)
  ]
}

/**
 * Import depuis GitHub et bibliothèque (US4, D12) : l'adresse est contrôlée par le main ; le reste ne porte que des
 * identifiants. Retirer un dépôt demande `confirm: true`.
 */
function importRoutes(imports: SkillsRoutesDeps['imports']): IpcRoute[] {
  if (imports === undefined) return []
  const Id = z.uuid()
  return [
    defineRoute({
      channel: 'skills:import',
      input: z.object({ url: z.string().min(1).max(500) }).strict(),
      handler: async ({ url }) => imports.start(url)
    }),
    defineRoute({
      channel: 'skills:importCancel',
      input: z.object({ importId: Id }).strict(),
      handler: async ({ importId }) => {
        imports.cancel(importId)
        return {}
      }
    }),
    defineRoute({
      channel: 'skills:library',
      input: z.object({}).strict(),
      handler: async () => imports.library()
    }),
    defineRoute({
      channel: 'skills:librarySkill',
      input: z.object({ candidateId: Id }).strict(),
      handler: async ({ candidateId }) => imports.librarySkill(candidateId)
    }),
    defineRoute({
      channel: 'skills:libraryInstall',
      input: z
        .object({
          candidateId: Id,
          scripts: z.array(z.string().min(1).max(260)).max(50),
          seen: z.enum(['sur', 'a_revoir', 'dangereux']),
          unlockDangerous: z.literal(true).optional()
        })
        .strict(),
      handler: async ({ candidateId, scripts, seen, unlockDangerous }) =>
        imports.install({ candidateId, scripts, seen, ...(unlockDangerous === undefined ? {} : { unlockDangerous }) })
    }),
    defineRoute({
      channel: 'skills:libraryRemove',
      input: z.object({ repoId: Id, confirm: z.literal(true) }).strict(),
      handler: async ({ repoId }) => {
        imports.remove(repoId)
        return {}
      }
    })
  ]
}

/** Fiches, notes, domaines et liens de sens (US2) : le renderer ne donne que des identifiants. */
function cardRoutes(cards: SkillsRoutesDeps['cards']): IpcRoute[] {
  if (cards === undefined) return []
  const DomainId = z.string().regex(/^[a-z0-9_]{2,32}$/)
  return [
    defineRoute({ channel: 'skills:cards', input: z.object({}).strict(), handler: async () => cards.view() }),
    defineRoute({
      channel: 'skills:analyze',
      input: z.object({ skillIds: z.array(SkillId).min(1).max(30).optional() }).strict(),
      handler: async ({ skillIds }) => cards.analyze(skillIds)
    }),
    defineRoute({
      channel: 'skills:setStars',
      input: z.object({ skillId: SkillId, stars: z.int().min(1).max(5).nullable() }).strict(),
      handler: async ({ skillId, stars }) => cards.setStars(skillId, stars)
    }),
    defineRoute({
      channel: 'skills:setDomain',
      input: z.object({ skillId: SkillId, domainId: DomainId }).strict(),
      handler: async ({ skillId, domainId }) => cards.setDomain(skillId, domainId)
    }),
    defineRoute({
      channel: 'skills:acceptDomain',
      input: z.object({ domainId: DomainId }).strict(),
      handler: async ({ domainId }) => {
        cards.acceptDomain(domainId)
        return {}
      }
    }),
    defineRoute({
      channel: 'skills:link',
      input: z.object({ from: SkillId, to: SkillId, kind: z.enum(SEMANTIC_LINK_KINDS) }).strict(),
      handler: async ({ from, to, kind }) => cards.link(from, to, kind)
    }),
    defineRoute({
      channel: 'skills:unlink',
      input: z.object({ linkId: z.uuid() }).strict(),
      handler: async ({ linkId }) => cards.unlink(linkId)
    }),
    defineRoute({ channel: 'skills:usage', input: z.object({}).strict(), handler: async () => cards.usage() })
  ]
}
