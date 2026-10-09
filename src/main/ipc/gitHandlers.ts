import {
  GitBranchInput,
  GitCommitInput,
  GitDiffInput,
  GitGenesisInput,
  GitLogInput,
  GitPathsInput,
  GitRevertInput
} from '@shared/ipc/git'
import { z } from 'zod'
import { Hash } from '@shared/git/model'
import { GitConfirmInput, GitMergeInput, GitPublishInput, GitPushInput } from '@shared/git/sync'
import type { GitService } from '../application/git/GitService'
import type { PublishService } from '../application/git/PublishService'
import type { ConflictService } from '../application/git/ConflictService'
import {
  ConflictDecideInput,
  ConflictPathInput,
  ConflictResolveInput,
  ConflictWholeFileInput,
  MergeFinishInput
} from '@shared/git/conflicts'
import type { SyncService } from '../application/git/SyncService'
import type { GhRunner } from '../infrastructure/git/GhRunner'
import { defineRoute, type IpcRoute } from './registry'

/**
 * Canaux du dépôt local (spec 021 US1, contracts/interfaces.md) : le renderer ne donne qu'un genesis, des chemins
 * relatifs, des noms de branche et des empreintes ; les écritures portent `confirm: true` et l'état vu (research R5).
 */
export function createGitRoutes(
  git: Pick<
    GitService,
    | 'status'
    | 'diff'
    | 'stage'
    | 'unstage'
    | 'proposeMessage'
    | 'commit'
    | 'branches'
    | 'createBranch'
    | 'switchBranch'
    | 'log'
    | 'revert'
    | 'updates'
    | 'markSeen'
  >
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'git:updates',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => git.updates(genesisId)
    }),
    defineRoute({
      channel: 'git:markSeen',
      input: z.strictObject({ genesisId: z.uuid(), hash: Hash }),
      handler: async ({ genesisId, hash }) => git.markSeen(genesisId, hash)
    }),
    defineRoute({
      channel: 'git:status',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => git.status(genesisId)
    }),
    defineRoute({
      channel: 'git:diff',
      input: GitDiffInput,
      handler: async ({ genesisId, path, staged }) => git.diff(genesisId, path, staged)
    }),
    defineRoute({
      channel: 'git:stage',
      input: GitPathsInput,
      handler: async ({ genesisId, paths }) => git.stage(genesisId, paths)
    }),
    defineRoute({
      channel: 'git:unstage',
      input: GitPathsInput,
      handler: async ({ genesisId, paths }) => git.unstage(genesisId, paths)
    }),
    defineRoute({
      channel: 'git:proposeMessage',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => git.proposeMessage(genesisId)
    }),
    defineRoute({
      channel: 'git:commit',
      input: GitCommitInput,
      handler: async ({ genesisId, message, expectedStaged }) => git.commit(genesisId, message, expectedStaged)
    }),
    defineRoute({
      channel: 'git:branches',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => git.branches(genesisId)
    }),
    defineRoute({
      channel: 'git:createBranch',
      input: GitBranchInput,
      handler: async ({ genesisId, name }) => git.createBranch(genesisId, name)
    }),
    defineRoute({
      channel: 'git:switchBranch',
      input: GitBranchInput,
      handler: async ({ genesisId, name }) => git.switchBranch(genesisId, name)
    }),
    defineRoute({
      channel: 'git:log',
      input: GitLogInput,
      handler: async ({ genesisId, limit }) => git.log(genesisId, limit)
    }),
    defineRoute({
      channel: 'git:revert',
      input: GitRevertInput,
      handler: async ({ genesisId, hash, expectedHead }) => git.revert(genesisId, hash, expectedHead)
    })
  ]
}

/**
 * Publier, tirer, pousser (spec 021 US2) : le renderer n'envoie que le genesis, l'état vu (empreintes, remote, branche)
 * et des identifiants de constats ; `confirm: true` sur chaque écriture.
 */
export function createGitSyncRoutes(
  sync: Pick<SyncService, 'fetch' | 'pull' | 'merge' | 'pushPreview' | 'push'>,
  publish: Pick<PublishService, 'preview' | 'publish' | 'addGitignore'>,
  gh: Pick<GhRunner, 'status'>
): IpcRoute[] {
  return [
    defineRoute({ channel: 'git:ghStatus', input: z.undefined(), handler: async () => gh.status() }),
    defineRoute({
      channel: 'git:fetch',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => sync.fetch(genesisId)
    }),
    defineRoute({
      channel: 'git:pull',
      input: GitConfirmInput,
      handler: async ({ genesisId }) => sync.pull(genesisId)
    }),
    defineRoute({
      channel: 'git:merge',
      input: GitMergeInput,
      handler: async ({ genesisId, expectedUpstreamHead }) => sync.merge(genesisId, expectedUpstreamHead)
    }),
    defineRoute({
      channel: 'git:pushPreview',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => sync.pushPreview(genesisId)
    }),
    defineRoute({
      channel: 'git:push',
      input: GitPushInput,
      handler: async (input) =>
        sync.push({
          genesisId: input.genesisId,
          expectedHead: input.expectedHead,
          expectedRemote: input.expectedRemote,
          expectedBranch: input.expectedBranch,
          acceptFindings: input.acceptFindings
        })
    }),
    defineRoute({
      channel: 'git:publishPreview',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => publish.preview(genesisId)
    }),
    defineRoute({
      channel: 'git:publish',
      input: GitPublishInput,
      handler: async (input) =>
        publish.publish({
          genesisId: input.genesisId,
          name: input.name,
          description: input.description,
          visibility: input.visibility,
          confirmPublic: input.confirmPublic === true,
          expectedHead: input.expectedHead
        })
    }),
    defineRoute({
      channel: 'git:addGitignore',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => publish.addGitignore(genesisId)
    })
  ]
}

/** Résolution d'un conflit (spec 021 US4) : chemins relatifs revalidés, `confirm: true` sur chaque écriture. */
export function createConflictRoutes(
  conflicts: Pick<
    ConflictService,
    'mergeState' | 'file' | 'propose' | 'decide' | 'resolveFile' | 'wholeFile' | 'finish' | 'abort'
  >
): IpcRoute[] {
  return [
    defineRoute({
      channel: 'git:mergeState',
      input: GitGenesisInput,
      handler: async ({ genesisId }) => conflicts.mergeState(genesisId)
    }),
    defineRoute({
      channel: 'git:conflictFile',
      input: ConflictPathInput,
      handler: async ({ genesisId, path }) => conflicts.file(genesisId, path)
    }),
    defineRoute({
      channel: 'git:conflictPropose',
      input: ConflictPathInput,
      handler: async ({ genesisId, path }) => conflicts.propose(genesisId, path)
    }),
    defineRoute({
      channel: 'git:conflictDecide',
      input: ConflictDecideInput,
      handler: async (input) =>
        conflicts.decide({
          genesisId: input.genesisId,
          path: input.path,
          hunkIndex: input.hunkIndex,
          choice: input.choice,
          ...(input.manualText === undefined ? {} : { manualText: input.manualText })
        })
    }),
    defineRoute({
      channel: 'git:conflictResolveFile',
      input: ConflictResolveInput,
      handler: async ({ genesisId, path, expectedPreviewHash }) =>
        conflicts.resolveFile(genesisId, path, expectedPreviewHash)
    }),
    defineRoute({
      channel: 'git:conflictWholeFile',
      input: ConflictWholeFileInput,
      handler: async ({ genesisId, path, choice }) => conflicts.wholeFile(genesisId, path, choice)
    }),
    defineRoute({
      channel: 'git:mergeFinish',
      input: MergeFinishInput,
      handler: async ({ genesisId, message }) => conflicts.finish(genesisId, message)
    }),
    defineRoute({
      channel: 'git:mergeAbort',
      input: GitConfirmInput,
      handler: async ({ genesisId }) => conflicts.abort(genesisId)
    })
  ]
}
