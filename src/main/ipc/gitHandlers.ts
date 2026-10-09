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
import { GitConfirmInput, GitMergeInput, GitPublishInput, GitPushInput } from '@shared/git/sync'
import type { GitService } from '../application/git/GitService'
import type { PublishService } from '../application/git/PublishService'
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
  >
): IpcRoute[] {
  return [
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
  sync: Pick<SyncService, 'fetch' | 'pull' | 'merge' | 'mergeAbort' | 'pushPreview' | 'push'>,
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
      channel: 'git:mergeAbort',
      input: GitConfirmInput,
      handler: async ({ genesisId }) => sync.mergeAbort(genesisId)
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
