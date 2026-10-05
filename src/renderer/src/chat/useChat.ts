import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type {
  ChatDeltaEvent,
  ChatErrorEvent,
  ChatMessageView,
  ChatSheetEvent,
  ChatSheetView,
  ChatToolEvent,
  ChatTurnEndEvent,
  ChatUsageEvent,
  ChatUsageView,
  ChatView
} from '@shared/ipc/chat'
import { call, IpcFailure } from '../lib/ipc'

export interface ChatState {
  readonly loading: boolean
  readonly title: string
  readonly messages: readonly ChatMessageView[]
  readonly sheet: ChatSheetView | null
  readonly maturity: string | null
  readonly busy: boolean
  /** Réponse de Claude en train de s'écrire. */
  readonly partial: string
  readonly usage: ChatUsageView | null
  /** Dossier de projet lié (nom) ; `null` : aucun. */
  readonly folder: string | null
  readonly role: 'genesis' | 'element'
  readonly elementType: string | null
  /** Modèle utilisé ; `modelChoice` : celui choisi pour cette conversation (`null` : défaut de son usage). */
  readonly model: string
  readonly modelChoice: string | null
  readonly problem: string | null
}

export interface ChatActions {
  send(text: string): Promise<void>
  stop(): void
  /** Lie un dossier de projet (sélecteur natif du main) ; `unlink` le délie. */
  linkFolder(unlink?: boolean): Promise<void>
  /** Modèle de cette conversation (`null` : défaut de son usage). */
  setModel(model: string | null): Promise<void>
}

const forNeuron = <T extends { readonly neuronId: string }>(neuronId: string, payload: unknown): T | null =>
  typeof payload === 'object' && payload !== null && (payload as { neuronId?: unknown }).neuronId === neuronId
    ? (payload as T)
    : null

/**
 * Chat d'un neurone (spec 008) : ouvre la conversation, relaie le flux du main (texte qui s'écrit, actions de Claude,
 * fin de tour, erreurs, quota) et ferme la conversation quand le panneau se ferme.
 */
export function useChat(neuronId: string): ChatState & ChatActions {
  const client = useQueryClient()
  const [state, setState] = useState<ChatState>({
    loading: true,
    title: '',
    messages: [],
    sheet: null,
    maturity: null,
    busy: false,
    partial: '',
    usage: null,
    folder: null,
    role: 'genesis',
    elementType: null,
    model: '',
    modelChoice: null,
    problem: null
  })

  const refreshSheet = useCallback(async () => {
    try {
      const view = await call<ChatView>('chat:open', { neuronId })
      setState((current) => ({ ...current, sheet: view.sheet, maturity: view.maturity }))
    } catch {
      // Le neurone a pu être retiré : le panneau se fermera avec la carte.
    }
  }, [neuronId])

  useEffect(() => {
    let alive = true
    call<ChatView>('chat:open', { neuronId })
      .then((view) => {
        if (!alive) return
        setState((current) => ({
          ...current,
          loading: false,
          title: view.title,
          messages: view.messages,
          sheet: view.sheet,
          maturity: view.maturity,
          busy: view.busy,
          partial: view.partial,
          usage: view.usage ?? null,
          folder: view.folder ?? null,
          role: view.role ?? 'genesis',
          elementType: view.elementType ?? null,
          model: view.model ?? '',
          modelChoice: view.modelChoice ?? null
        }))
      })
      .catch((error: unknown) => {
        if (alive) {
          setState((current) => ({
            ...current,
            loading: false,
            problem: error instanceof IpcFailure ? error.message : 'La conversation n’a pas pu s’ouvrir.'
          }))
        }
      })
    const append = (message: ChatMessageView): void =>
      setState((current) => ({ ...current, messages: [...current.messages, message] }))
    const offs = [
      window.api.on('chat:delta', (payload) => {
        const event = forNeuron<ChatDeltaEvent>(neuronId, payload)
        if (event !== null) setState((current) => ({ ...current, partial: current.partial + event.text }))
      }),
      window.api.on('chat:tool', (payload) => {
        const event = forNeuron<ChatToolEvent>(neuronId, payload)
        if (event !== null) append(event.message)
      }),
      window.api.on('chat:turnEnd', (payload) => {
        const event = forNeuron<ChatTurnEndEvent>(neuronId, payload)
        if (event === null) return
        setState((current) => ({
          ...current,
          busy: false,
          partial: '',
          messages: event.message === null ? current.messages : [...current.messages, event.message]
        }))
      }),
      window.api.on('chat:error', (payload) => {
        const event = forNeuron<ChatErrorEvent>(neuronId, payload)
        if (event === null) return
        setState((current) => ({
          ...current,
          busy: false,
          partial: '',
          messages: [...current.messages, event.message]
        }))
      }),
      window.api.on('chat:usage', (payload) => {
        const event = forNeuron<ChatUsageEvent>(neuronId, payload)
        if (event !== null) setState((current) => ({ ...current, usage: event.usage }))
      }),
      window.api.on('chat:sheet', (payload) => {
        if (forNeuron<ChatSheetEvent>(neuronId, payload) === null) return
        void refreshSheet()
        void client.invalidateQueries({ queryKey: ['canvas'] })
      })
    ]
    return () => {
      alive = false
      offs.forEach((off) => off())
      call('chat:close', { neuronId }).catch(() => undefined)
    }
  }, [neuronId, client, refreshSheet])

  const send = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (trimmed === '') return
      const optimistic: ChatMessageView = { id: `local-${Date.now()}`, role: 'user', text: trimmed, createdAt: '' }
      setState((current) => ({ ...current, busy: true, partial: '', messages: [...current.messages, optimistic] }))
      try {
        await call('chat:send', { neuronId, text: trimmed })
      } catch (error) {
        const message: ChatMessageView = {
          id: `local-error-${Date.now()}`,
          role: 'error',
          text: error instanceof IpcFailure ? error.message : 'Le message n’a pas pu partir.',
          createdAt: ''
        }
        setState((current) => ({ ...current, busy: false, messages: [...current.messages, message] }))
      }
    },
    [neuronId]
  )

  const stop = useCallback(() => {
    call('chat:stop', { neuronId }).catch(() => undefined)
  }, [neuronId])

  const linkFolder = useCallback(
    async (unlink = false): Promise<void> => {
      try {
        const { folder } = await call<{ readonly folder: string | null }>('chat:linkFolder', { neuronId, unlink })
        setState((current) => ({ ...current, folder }))
      } catch (error) {
        const message: ChatMessageView = {
          id: `local-error-${Date.now()}`,
          role: 'error',
          text: error instanceof IpcFailure ? error.message : 'Le dossier n’a pas pu être lié.',
          createdAt: ''
        }
        setState((current) => ({ ...current, messages: [...current.messages, message] }))
      }
    },
    [neuronId]
  )

  const setModel = useCallback(
    async (model: string | null): Promise<void> => {
      try {
        const view = await call<ChatView>('chat:setModel', { neuronId, model })
        setState((current) => ({ ...current, model: view.model, modelChoice: view.modelChoice }))
      } catch (error) {
        const message: ChatMessageView = {
          id: `local-error-${Date.now()}`,
          role: 'error',
          text: error instanceof IpcFailure ? error.message : 'Le modèle n’a pas pu être changé.',
          createdAt: ''
        }
        setState((current) => ({ ...current, messages: [...current.messages, message] }))
      }
    },
    [neuronId]
  )

  return { ...state, send, stop, linkFolder, setModel }
}
