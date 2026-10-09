import { z } from 'zod'
import {
  BrainstormCloneInput,
  BrainstormOpenInput,
  BrainstormRelinkInput,
  ExistingAdoptInput,
  BrainstormScratchInput,
  BrainstormViewStateInput,
  SavePointCreateInput,
  SavePointIdInput,
  SavePointListInput,
  SavePointRenameInput,
  SavePointUndoInput
} from '@shared/ipc/brainstorms'
import type { BrainstormService } from '../application/brainstorms/BrainstormService'
import type { CloneBrainstormService } from '../application/brainstorms/CloneBrainstormService'
import type { ExistingProjectService } from '../application/brainstorms/ExistingProjectService'
import type { SavePointService } from '../application/brainstorms/SavePointService'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux du Project Manager (spec 024 US1, US3 ; contracts/interfaces.md) : aucun chemin ne vient de l'interface,
 * seulement un identifiant, un slug du registre ou un formulaire revalidé.
 */
export function createBrainstormRoutes(
  brainstorms: Pick<BrainstormService, 'list' | 'active' | 'open' | 'close' | 'saveViewState' | 'createScratch'>
): IpcRoute[] {
  return [
    defineRoute({ channel: 'brainstorms:list', input: z.undefined(), handler: async () => brainstorms.list() }),
    defineRoute({ channel: 'brainstorms:active', input: z.undefined(), handler: async () => brainstorms.active() }),
    defineRoute({
      channel: 'brainstorms:open',
      input: BrainstormOpenInput,
      handler: async (target) => brainstorms.open(target)
    }),
    defineRoute({ channel: 'brainstorms:close', input: z.undefined(), handler: async () => brainstorms.close() }),
    defineRoute({
      channel: 'brainstorms:viewState',
      input: BrainstormViewStateInput,
      handler: async ({ id, state }) => brainstorms.saveViewState(id, state)
    }),
    defineRoute({
      channel: 'brainstorms:createScratch',
      input: BrainstormScratchInput,
      handler: async (input) => brainstorms.createScratch(input)
    })
  ]
}

/** Points de sauvegarde (spec 024 US2) : identifiants et noms seulement. */
export function createSavePointRoutes(
  points: Pick<SavePointService, 'list' | 'create' | 'rename' | 'remove' | 'restore' | 'undoRestore'>
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'savepoints:list',
      input: SavePointListInput,
      handler: async ({ brainstormId }) => points.list(brainstormId)
    }),
    defineRoute({
      channel: 'savepoints:create',
      input: SavePointCreateInput,
      handler: async ({ brainstormId, name }) => points.create(brainstormId, name)
    }),
    defineRoute({
      channel: 'savepoints:rename',
      input: SavePointRenameInput,
      handler: async ({ id, name }) => points.rename(id, name)
    }),
    defineRoute({
      channel: 'savepoints:delete',
      input: SavePointIdInput,
      handler: async ({ id }) => points.remove(id)
    }),
    defineRoute({
      channel: 'savepoints:restore',
      input: SavePointIdInput,
      handler: async ({ id }) => points.restore(id)
    }),
    defineRoute({
      channel: 'savepoints:undoRestore',
      input: SavePointUndoInput,
      handler: async ({ undoId }) => points.undoRestore(undoId)
    })
  ]
}

/** Projet en chantier (spec 024 US4) : le dossier est choisi au sélecteur natif du main, l'interface n'envoie qu'un jeton. */
export function createExistingProjectRoutes(
  existing: Pick<ExistingProjectService, 'pick' | 'adopt' | 'relink'>
): IpcRoute[] {
  return [
    defineRoute({ channel: 'brainstorms:pickExisting', input: z.undefined(), handler: async () => existing.pick() }),
    defineRoute({
      channel: 'brainstorms:adoptExisting',
      input: ExistingAdoptInput,
      handler: async (input) => existing.adopt(input)
    }),
    defineRoute({
      channel: 'brainstorms:relink',
      input: BrainstormRelinkInput,
      handler: async ({ id }) => existing.relink(id)
    })
  ]
}

/** Depuis un lien Git (spec 024 US5) : l'adresse est contrôlée par le service de clone avant tout lancement. */
export function createCloneBrainstormRoutes(clones: Pick<CloneBrainstormService, 'clone' | 'cancel'>): IpcRoute[] {
  return [
    defineRoute({
      channel: 'brainstorms:clone',
      input: BrainstormCloneInput,
      handler: async (input) => clones.clone(input)
    }),
    defineRoute({ channel: 'brainstorms:cancelClone', input: z.undefined(), handler: async () => clones.cancel() })
  ]
}
