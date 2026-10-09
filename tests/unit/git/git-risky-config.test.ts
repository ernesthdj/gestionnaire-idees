import { describe, expect, it } from 'vitest'
import { classifyConfig } from '../../../src/main/domain/git/riskyConfig'

describe('configuration locale à risque (spec 021 T007, research R3)', () => {
  it('should_block_keys_that_run_programs_and_only_mention_neutralized_ones', () => {
    const result = classifyConfig([
      'core.bare',
      'filter.x.clean',
      'Filter.LFS.Smudge',
      'core.sshCommand',
      'include.path',
      'includeIf.gitdir:~/x.path',
      'merge.ours.driver',
      'diff.pdf.command',
      'credential.helper',
      'credential.https://exemple.invalid.helper',
      'gpg.program',
      'gpg.ssh.program',
      'core.gitProxy',
      'remote.origin.uploadpack',
      'remote.origin.receivepack',
      'uploadpack.packObjectsHook',
      'core.fsmonitor',
      'core.hooksPath',
      'core.pager',
      'diff.external',
      'diff.pdf.textconv',
      'sequence.editor',
      'remote.origin.url',
      'user.email'
    ])
    expect(result.blocking).toEqual([
      'filter.x.clean',
      'filter.lfs.smudge',
      'core.sshcommand',
      'include.path',
      'includeif.gitdir:~/x.path',
      'merge.ours.driver',
      'diff.pdf.command',
      'credential.helper',
      'credential.https://exemple.invalid.helper',
      'gpg.program',
      'gpg.ssh.program',
      'core.gitproxy',
      'remote.origin.uploadpack',
      'remote.origin.receivepack',
      'uploadpack.packobjectshook'
    ])
    expect(result.neutralized).toEqual([
      'core.fsmonitor',
      'core.hookspath',
      'core.pager',
      'diff.external',
      'diff.pdf.textconv',
      'sequence.editor'
    ])
  })

  it('should_find_nothing_in_an_ordinary_config', () => {
    expect(classifyConfig(['core.bare', 'remote.origin.url', 'branch.main.remote'])).toEqual({
      blocking: [],
      neutralized: []
    })
  })
})
