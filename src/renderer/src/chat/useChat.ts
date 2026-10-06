import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type {
  ChatDeltaEvent,
  ChatErrorEvent,
  ChatMessageView,
  ChatPermissionRequest,
  ChatPermissionResolvedEvent,
  ChatSheetEvent,
  ChatSheetView,
  ChatToolEvent,
  ChatTurnEndEvent,
  ChatUsageEvent,
  ChatUsageView,
  ChatView,
  PermissionDecisionView
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
  readonly role: 'genesis' | 'element' | 'step'
  readonly elementType: string | null
  readonly stepLabel: string | null
  /** Modèle utilisé ; `modelChoice` : celui choisi pour cette conversation (`null` : défaut de son usage). */
  readonly model: string
  readonly modelChoice: string | null
  readonly problem: string | null
  /** Demandes de permission de Claude en attente de ta réponse (spec 014 US1). */
  readonly pending: readonly ChatPermissionRequest[]
}

export interface ChatActions {
  send(text: string): Promise<void>
  stop(): void
  /** Lie un dossier de projet (sélecteur natif du main) ; `unlink` le délie. */
  linkFolder(unlink?: boolean): Promise<void>
  /** Modèle de cette conversation (`null` : défaut de son usage). */
  setModel(model: string | null): Promise<void>
  /** Réponse à une demande de permission. */
  decide(requestId: string, decision: PermissionDecisionView): Promise<void>
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
    stepLabel: null,
    model: '',
    modelChoice: null,
    problem: null,
    pending: []
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
          stepLabel: view.stepLabel ?? null,
          model: view.model ?? '',
          modelChoice: view.modelChoice ?? null,
          pending: view.pending ?? []
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
    // Un outil réapparaît avec son résultat réel (spec 014 R4) : il remplace sa pastille « en cours ».
    const upsert = (message: ChatMessageView): void =>
      setState((current) =>
        current.messages.some((entry) => entry.id === message.id)
          ? { ...current, messages: current.messages.map((entry) => (entry.id === message.id ? message : entry)) }
          : { ...current, messages: [...current.messages, message] }
      )
    const offs = [
      window.api.on('chat:delta', (payload) => {
        const event = forNeuron<ChatDeltaEvent>(neuronId, payload)
        if (event !== null) setState((current) => ({ ...current, partial: current.partial + event.text }))
      }),
      window.api.on('chat:tool', (payload) => {
        const event = forNeuron<ChatToolEvent>(neuronId, payload)
        if (event !== null) upsert(event.message)
      }),
      window.api.on('chat:permission', (payload) => {
        const request = forNeuron<ChatPermissionRequest>(neuronId, payload)
        if (request !== null) setState((current) => ({ ...current, pending: [...current.pending, request] }))
      }),
      window.api.on('chat:permissionResolved', (payload) => {
        const event = forNeuron<ChatPermissionResolvedEvent>(neuronId, payload)
        if (event === null) return
        setState((current) => ({
          ...current,
          pending: current.pending.filter((entry) => entry.id !== event.requestId)
        }))
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

  const decide = useCallback(async (requestId: string, decision: PermissionDecisionView): Promise<void> => {
    // La carte disparaît aussitôt ; l'événement de résolution du main la retire aussi des autres fenêtres.
    setState((current) => ({ ...current, pending: current.pending.filter((entry) => entry.id !== requestId) }))
    try {
      await call('chat:permissionDecide', { requestId, decision })
    } catch (error) {
      const message: ChatMessageView = {
        id: `local-error-${Date.now()}`,
        role: 'error',
        text: error instanceof IpcFailure ? error.message : 'La réponse n’a pas pu être transmise à Claude.',
        createdAt: ''
      }
      setState((current) => ({ ...current, messages: [...current.messages, message] }))
    }
  }, [])

  return { ...state, send, stop, linkFolder, setModel, decide }
}
