import { z } from 'zod'
import type { SkillDetailView, SkillDraftDiffView, SkillDraftView, SkillsView } from '@shared/ipc/skills'
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
    })
  ]
}
