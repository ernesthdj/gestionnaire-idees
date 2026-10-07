import { z } from 'zod'
import type { SkillDetailView, SkillsView } from '@shared/ipc/skills'
import { defineRoute, type IpcRoute } from './registry'

export interface SkillsRoutesDeps {
  readonly inventory: {
    refresh(): SkillsView
    get(skillId: string): SkillDetailView
    watch(): void
  }
}

/**
 * Canaux de l'arbre de skills (spec 020 US1). Le renderer ne donne jamais de chemin : seulement un identifiant de
 * skill calculé par le main, cherché dans l'inventaire.
 */
export function createSkillsRoutes(deps: SkillsRoutesDeps): IpcRoute[] {
  return [
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
      input: z.object({ skillId: z.string().min(3).max(300) }).strict(),
      handler: async ({ skillId }) => deps.inventory.get(skillId)
    })
  ]
}
