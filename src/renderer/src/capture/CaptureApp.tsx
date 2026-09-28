import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CAPTURE_MAX_CHARS, THEMES, type Theme } from '@shared/ipc/app'
import { useApplyTheme } from '../app/useApplyTheme'

/** Délai d'affichage de la confirmation avant fermeture (assez pour être lue, assez court pour ne pas gêner). */
export const CONFIRMATION_MS = 600
/** Enregistrement du brouillon après une pause de frappe. */
export const DRAFT_DEBOUNCE_MS = 300

type Status = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string }

function themeOf(payload: unknown): Theme | null {
  if (typeof payload !== 'object' || payload === null || !('theme' in payload)) return null
  const { theme } = payload
  return typeof theme === 'string' && (THEMES as readonly string[]).includes(theme) ? (theme as Theme) : null
}

/**
 * Fenêtre de capture (E1, spec 003 US1) : `Entrée` note l'idée, `Maj+Entrée` va à la ligne, `Ctrl+Entrée` note et
 * ouvre la plongée, `Échap` ferme en gardant le brouillon.
 */
export function CaptureApp(): React.JSX.Element {
  const api = window.captureApi
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  // Lu dans les gestionnaires d'événements (perte de focus) sans attendre un nouveau rendu.
  const busyRef = useRef(false)
  const [theme, setTheme] = useState<Theme>('system')
  const input = useRef<HTMLTextAreaElement>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ids = { input: useId(), hint: useId() }
  useApplyTheme(theme)

  const loadDraft = useCallback(async (): Promise<void> => {
    const result = await api.invoke<{ text: string }>('capture:getDraft')
    setText(result.success ? result.data.text : '')
    setStatus({ kind: 'idle' })
    input.current?.focus()
  }, [api])

  useEffect(() => {
    void loadDraft()
    return api.on('capture:shown', (payload) => {
      setTheme(themeOf(payload) ?? 'system')
      void loadDraft()
    })
  }, [api, loadDraft])

  useEffect(() => () => clearTimeout(draftTimer.current), [])

  const saveDraftNow = (value: string): void => {
    clearTimeout(draftTimer.current)
    void api.invoke('capture:saveDraft', { text: value })
  }

  const change = (value: string): void => {
    setText(value)
    if (status.kind === 'error') setStatus({ kind: 'idle' })
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => void api.invoke('capture:saveDraft', { text: value }), DRAFT_DEBOUNCE_MS)
  }

  const close = (): void => {
    saveDraftNow(text)
    void api.invoke('capture:close')
  }

  const submit = async (diveNow: boolean): Promise<void> => {
    if (busy || text.trim() === '') return
    clearTimeout(draftTimer.current)
    busyRef.current = true
    setBusy(true)
    const result = await api.invoke<{ rootId: string }>('capture:submit', { text, diveNow })
    busyRef.current = false
    setBusy(false)
    if (!result.success) {
      setStatus({ kind: 'error', message: "L'idée n'a pas pu être notée. Réessaie." })
      return
    }
    setText('')
    // En plongée, le main ferme lui-même la capture et ouvre la fenêtre principale.
    if (diveNow) return
    setStatus({ kind: 'saved' })
    setTimeout(() => void api.invoke('capture:close'), CONFIRMATION_MS)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit(event.ctrlKey)
    }
  }

  return (
    <main className="flex h-screen flex-col gap-2 bg-surface p-4 text-content">
      <label htmlFor={ids.input} className="sr-only">
        Ton idée
      </label>
      <textarea
        id={ids.input}
        ref={input}
        value={text}
        maxLength={CAPTURE_MAX_CHARS}
        rows={3}
        placeholder="Une idée ? Tape-la ici…"
        aria-describedby={ids.hint}
        aria-busy={busy}
        // Lecture seule plutôt que désactivé : désactiver retirerait le focus pendant l'envoi.
        readOnly={busy}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
        // Clic extérieur : le brouillon est enregistré tout de suite (sauf pendant l'envoi, qui le vide).
        onBlur={() => {
          if (!busyRef.current) saveDraftNow(text)
        }}
        className="min-h-0 flex-1 resize-none rounded-md bg-surface-raised p-2 text-base outline-none"
      />
      <div className="flex items-center justify-between gap-4 text-xs text-content-muted">
        <p id={ids.hint}>Entrée : noter · Maj+Entrée : à la ligne · Ctrl+Entrée : noter et plonger · Échap : fermer</p>
        <p aria-label={`${text.length} caractères sur ${CAPTURE_MAX_CHARS}`}>
          {text.length}/{CAPTURE_MAX_CHARS}
        </p>
      </div>
      <p role="status" className="min-h-4 text-xs font-medium">
        {status.kind === 'saved' ? '✓ Idée notée' : status.kind === 'error' ? status.message : ''}
      </p>
    </main>
  )
}
