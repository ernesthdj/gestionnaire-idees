import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThinkingIndicator } from '../../../src/renderer/src/chat/ThinkingIndicator'
import { thinkingPhase } from '../../../src/renderer/src/chat/thinkingPhase'
import type { ChatMessageView } from '../../../src/shared/ipc/chat'
import { expectNoAxeViolations } from '../../support/axe'
import { installFakeApi } from './support/fakeApi'

const message = (role: ChatMessageView['role'], text: string): ChatMessageView => ({
  id: `${role}-${text}`,
  role,
  text,
  createdAt: '2026-10-08T12:00:00.000Z'
})

describe('indicateur « Claude réfléchit » (référence 21st.dev)', () => {
  it('should_name_the_real_activity_from_the_last_tools_since_the_last_user_message', () => {
    expect(thinkingPhase([message('user', 'Bonjour')])).toBe('reflexion')
    expect(thinkingPhase([message('user', 'a'), message('tool', 'fichier lu : a.ts')])).toBe('lecture')
    expect(thinkingPhase([message('user', 'a'), message('tool', 'recherche dans les fichiers')])).toBe('recherche')
    expect(thinkingPhase([message('user', 'a'), message('tool', 'commande : npm test')])).toBe('commande')
    expect(thinkingPhase([message('user', 'a'), message('tool', 'fichier modifié : b.ts')])).toBe('ecriture')
    // Les actions d'avant le dernier message de mentalyas ne comptent plus.
    expect(thinkingPhase([message('tool', 'fichier modifié : b.ts'), message('user', 'et ensuite ?')])).toBe(
      'reflexion'
    )
  })

  it('should_show_the_activity_label_and_a_stable_text_for_screen_readers', async () => {
    installFakeApi({})
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ThinkingIndicator messages={[message('user', 'a'), message('tool', 'fichier lu : a.ts')]} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Claude réfléchit…')).toBeTruthy()
    expect(screen.getByText('Lecture')).toBeTruthy()
    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true')
    await expectNoAxeViolations(container)
  })
})
