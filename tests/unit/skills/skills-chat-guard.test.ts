import { describe, expect, it, vi } from 'vitest'
import { conversationArgs } from '../../../src/main/application/conversation/ConversationService'
import { createToolHandler } from '../../../src/main/application/mcp/toolHandler'

type HandlerArgs = Parameters<typeof createToolHandler>

const SETTINGS = {
  model: 'claude-sonnet-5-5',
  electronPath: 'C:/app/electron.exe',
  relayPath: 'C:/app/mcp-relay.js',
  profileDir: 'C:/profil',
  cwd: 'C:/profil/workspace'
}

const valueOf = (args: readonly string[], flag: string): string | undefined => args[args.indexOf(flag) + 1]

describe('conversations Skills sans écriture (spec 020 analyse H1)', () => {
  it('should_give_only_read_tools_and_the_two_skill_tools_whatever_the_permission_mode', () => {
    for (const permissionMode of ['default', 'acceptEdits', 'bypassPermissions'] as const) {
      const args = conversationArgs({
        sessionId: 's',
        resume: false,
        neuronId: '00000000-0000-4000-8000-000000000001',
        frame: 'CADRE',
        settings: SETTINGS as never,
        permissionMode,
        profile: 'skills'
      })
      expect(valueOf(args, '--tools')).toBe('Read Glob Grep')
      expect(valueOf(args, '--allowedTools')).toBe(
        'mcp__brainstormer__skills_lire mcp__brainstormer__skill_brouillon Read Glob Grep'
      )
      expect(valueOf(args, '--permission-mode')).toBe('default')
      expect(args).not.toContain('--allow-dangerously-skip-permissions')
      // Le hook de l'app (réglage --settings) cite Write / Edit comme filtre : seuls les outils donnés comptent.
      const given = `${valueOf(args, '--tools') ?? ''} ${valueOf(args, '--allowedTools') ?? ''}`
      for (const forbidden of ['Write', 'Edit', 'Bash', 'WebFetch']) expect(given).not.toContain(forbidden)
    }
  })

  it('should_keep_the_usual_tools_for_any_other_conversation', () => {
    const args = conversationArgs({
      sessionId: 's',
      resume: false,
      neuronId: '00000000-0000-4000-8000-000000000001',
      frame: 'CADRE',
      settings: SETTINGS as never,
      permissionMode: 'acceptEdits'
    })
    expect(valueOf(args, '--tools')).toBe('default')
    expect(valueOf(args, '--permission-mode')).toBe('acceptEdits')
  })

  it('should_refuse_map_tools_in_a_skills_chat_and_route_skill_tools', () => {
    const map = { handle: vi.fn(() => ({ text: 'carte' })) }
    const tools = { read: vi.fn(() => ({ text: 'toile' })), draft: vi.fn(() => ({ text: 'brouillon' })) }
    const handle = createToolHandler(
      ...([
        map,
        {},
        {},
        {},
        {},
        {},
        undefined,
        undefined,
        undefined,
        { tools, isSkillsChat: (id: string) => id === 'skills' }
      ] as unknown as HandlerArgs)
    )
    expect(() => handle('dessiner', {}, { neuronId: 'skills' })).toThrow(
      expect.objectContaining({ code: 'NON_MODIFIABLE' })
    )
    expect(map.handle).not.toHaveBeenCalled()
    expect(handle('skills_lire', {}, { neuronId: 'skills' })).toEqual({ text: 'toile' })
    expect(handle('etat', {}, { neuronId: 'autre' })).toEqual({ text: 'carte' })
  })
})
