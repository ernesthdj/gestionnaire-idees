import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import {
  AGENT_EFFORTS,
  AGENT_EFFORT_LABELS,
  AGENT_PERMISSION_LABELS,
  AGENT_ROLES,
  AGENT_ROLE_LABELS,
  PERMISSION_MODES,
  type AgentProfileInput,
  type AgentProfileProposal,
  type AgentProfileView
} from '@shared/agents/profile'
import { CLAUDE_MODELS } from '@shared/ipc/ai'
import type { SkillsView } from '@shared/ipc/skills'
import { useUiStore } from '../app/uiStore'
import { ChatPanel } from '../chat/ChatPanel'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const MODEL_LABELS: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Opus 5.5',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-haiku-5-5': 'Haiku 5.5',
  'claude-opus-5': 'Opus 5'
}

const BLANK: AgentProfileInput = {
  name: '',
  role: 'backend',
  instructions: '',
  permissionMode: 'default',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  skills: []
}

const toInput = ({
  id,
  name,
  role,
  instructions,
  permissionMode,
  model,
  effort,
  skills
}: AgentProfileView): AgentProfileInput => ({
  id,
  name,
  role,
  instructions,
  permissionMode,
  model,
  effort,
  skills
})

const FIELD = 'h-8 w-full rounded-md border border-content-muted/30 bg-surface px-2 text-sm'

/**
 * Profils d'agents (T001) : rôle, mode de permissions, modèle, effort et skills consultables de chaque agent d'un
 * pipeline. Créés ici, dans la page Skills ; le moteur d'enchaînement les lira ensuite.
 */
export function AgentProfilesPanel({
  view,
  onClose,
  onAssistant
}: {
  readonly view: SkillsView
  readonly onClose: () => void
  /** La conversation avec Claude s'ouvre ou se ferme à côté de la fiche (la page élargit le panneau). */
  readonly onAssistant?: (open: boolean) => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const nameId = useId()
  const [draft, setDraft] = useState<AgentProfileInput | null>(null)
  // Création accompagnée (L1o D15) : la conversation avec Claude, les champs qu'il a remplis (✦) et pourquoi.
  const [assistant, setAssistant] = useState<{ readonly profileId?: string } | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const [byClaude, setByClaude] = useState<ReadonlySet<keyof AgentProfileInput>>(new Set())
  const [why, setWhy] = useState<string | null>(null)
  useEffect(() => onAssistant?.(assistant !== null), [assistant, onAssistant])
  useEffect(() => {
    if (chatId === null) return undefined
    return window.api.on('agents:proposal', (payload) => {
      const proposal = payload as AgentProfileProposal
      if (proposal.neuronId !== chatId) return
      setDraft((current) => ({ ...(current ?? BLANK), ...proposal.fields }))
      setByClaude((marks) => new Set([...marks, ...(Object.keys(proposal.fields) as (keyof AgentProfileInput)[])]))
      if (proposal.why !== null) setWhy(proposal.why)
    })
  }, [chatId])
  const startAssistant = (profile?: AgentProfileView): void => {
    setDraft(profile === undefined ? { ...BLANK } : toInput(profile))
    setByClaude(new Set())
    setWhy(null)
    setChatId(null)
    setAssistant(profile === undefined ? {} : { profileId: profile.id })
  }
  const closeForm = (): void => {
    setDraft(null)
    setAssistant(null)
    setChatId(null)
    setByClaude(new Set())
    setWhy(null)
  }
  /** Marque ✦ d'un champ rempli par Claude, retirée dès que mentalyas le touche. */
  const mark = (field: keyof AgentProfileInput): React.JSX.Element | null =>
    byClaude.has(field) ? (
      <span className="ml-1 text-accent" title="Proposé par Claude">
        ✦<span className="sr-only"> proposé par Claude</span>
      </span>
    ) : null
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const query = useQuery({ queryKey: ['agentProfiles'], queryFn: () => call<AgentProfileView[]>('agents:list', {}) })
  const profiles = query.data ?? []
  const skillName = (id: string): string => view.skills.find((skill) => skill.id === id)?.name ?? id

  const refresh = (): Promise<void> => client.invalidateQueries({ queryKey: ['agentProfiles'] })
  const patch = (changes: Partial<AgentProfileInput>): void => {
    setDraft((current) => (current === null ? current : { ...current, ...changes }))
    setByClaude((marks) => {
      const touched = Object.keys(changes)
      return touched.some((key) => marks.has(key as keyof AgentProfileInput))
        ? new Set([...marks].filter((key) => !touched.includes(key)))
        : marks
    })
  }
  const toggleSkill = (id: string): void => {
    if (draft === null) return
    patch({ skills: draft.skills.includes(id) ? draft.skills.filter((skill) => skill !== id) : [...draft.skills, id] })
  }

  const save = async (): Promise<void> => {
    if (draft === null || busy) return
    setBusy(true)
    setError('')
    try {
      await call<AgentProfileView>('agents:save', draft)
      showToast(`Profil « ${draft.name.trim()} » enregistré.`)
      closeForm()
      await refresh()
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'Le profil n’a pas pu être enregistré.')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (profile: AgentProfileView): Promise<void> => {
    try {
      await call('agents:remove', { id: profile.id, confirm: true })
      showToast(`Profil « ${profile.name} » supprimé.`)
      await refresh()
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'Le profil n’a pas pu être supprimé.')
    }
  }

  const ownSkills = view.skills.filter((skill) => skill.family !== 'plugin')

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Profils d’agents">
      <header className="flex items-center gap-2 border-b border-content-muted/20 px-4 py-2">
        <h2 className="flex-1 text-sm font-semibold">Profils d’agents</h2>
        <Button variant="primary" onClick={() => startAssistant()}>
          ✦ Créer avec Claude
        </Button>
        <Button onClick={() => setDraft({ ...BLANK })}>Nouveau profil</Button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les profils d’agents"
          className="h-8 w-8 rounded-md hover:bg-surface-raised"
        >
          ✕
        </button>
      </header>
      <div className={assistant === null ? 'contents' : 'grid min-h-0 flex-1 grid-cols-2'}>
        {assistant === null ? null : (
          <div className="min-h-0 border-r border-content-muted/20">
            <ProfileConversation
              {...(assistant.profileId === undefined ? {} : { profileId: assistant.profileId })}
              onOpen={setChatId}
              onClose={closeForm}
            />
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-sm">
          {error === '' ? null : <p role="alert">{error}</p>}
          {why === null || draft === null ? null : (
            <p className="rounded-md bg-surface-raised p-2 text-content-muted">
              <span className="text-accent" aria-hidden="true">
                ✦{' '}
              </span>
              {why}
            </p>
          )}
          {draft === null ? (
            profiles.length === 0 ? (
              <p className="text-content-muted">
                Aucun profil. Un profil décrit un agent d’un pipeline : son rôle, ce qu’il a le droit de faire, son
                modèle, son effort et les skills qu’il peut consulter.
              </p>
            ) : (
              <ul className="space-y-2">
                {profiles.map((profile) => (
                  <li key={profile.id} className="rounded-md border border-content-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <strong className="flex-1">{profile.name}</strong>
                      <Button onClick={() => setDraft(toInput(profile))}>Modifier</Button>
                      <Button onClick={() => startAssistant(profile)}>✦ Avec Claude</Button>
                      <Button variant="danger" onClick={() => void remove(profile)}>
                        Supprimer
                      </Button>
                    </div>
                    <p className="mt-1 text-content-muted">
                      {AGENT_ROLE_LABELS[profile.role]} · {MODEL_LABELS[profile.model] ?? profile.model} · effort{' '}
                      {AGENT_EFFORT_LABELS[profile.effort].toLowerCase()} ·{' '}
                      {AGENT_PERMISSION_LABELS[profile.permissionMode]}
                    </p>
                    <p className="mt-1 text-content-muted">
                      {profile.skills.length === 0
                        ? 'Aucun skill consultable.'
                        : `Skills : ${profile.skills.map(skillName).join(', ')}`}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <label className="block space-y-1" htmlFor={nameId}>
                <span>
                  Nom
                  {mark('name')}
                </span>
                <input
                  id={nameId}
                  className={FIELD}
                  value={draft.name}
                  maxLength={60}
                  required
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span>
                  Rôle
                  {mark('role')}
                </span>
                <select
                  className={FIELD}
                  value={draft.role}
                  onChange={(event) => patch({ role: event.target.value as AgentProfileInput['role'] })}
                >
                  {AGENT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {AGENT_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span>
                  Consignes
                  {mark('instructions')}
                </span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-content-muted/30 bg-surface p-2 text-sm"
                  value={draft.instructions}
                  maxLength={4000}
                  onChange={(event) => patch({ instructions: event.target.value })}
                />
              </label>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(144px,1fr))] gap-3">
                <label className="block space-y-1">
                  <span>
                    Permissions
                    {mark('permissionMode')}
                  </span>
                  <select
                    className={FIELD}
                    value={draft.permissionMode}
                    onChange={(event) =>
                      patch({ permissionMode: event.target.value as AgentProfileInput['permissionMode'] })
                    }
                  >
                    {PERMISSION_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {AGENT_PERMISSION_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span>
                    Modèle
                    {mark('model')}
                  </span>
                  <select
                    className={FIELD}
                    value={draft.model}
                    onChange={(event) => patch({ model: event.target.value })}
                  >
                    {CLAUDE_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {MODEL_LABELS[model] ?? model}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span>
                    Effort
                    {mark('effort')}
                  </span>
                  <select
                    className={FIELD}
                    value={draft.effort}
                    onChange={(event) => patch({ effort: event.target.value as AgentProfileInput['effort'] })}
                  >
                    {AGENT_EFFORTS.map((effort) => (
                      <option key={effort} value={effort}>
                        {AGENT_EFFORT_LABELS[effort]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="space-y-1">
                <legend>
                  Skills consultables
                  {mark('skills')}
                </legend>
                {ownSkills.length === 0 ? (
                  <p className="text-content-muted">Aucun skill personnel ou de projet.</p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-auto rounded-md border border-content-muted/30 p-2">
                    {ownSkills.map((skill) => (
                      <li key={skill.id}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.skills.includes(skill.id)}
                            onChange={() => toggleSkill(skill.id)}
                          />
                          {skill.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={busy || draft.name.trim() === ''}>
                  Enregistrer
                </Button>
                <Button onClick={closeForm}>Annuler</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/** Conversation « Créer avec Claude » (L1o D15) : neuve à chaque création, reprise pour retoucher un profil. */
function ProfileConversation({
  profileId,
  onOpen,
  onClose
}: {
  readonly profileId?: string
  readonly onOpen: (neuronId: string) => void
  readonly onClose: () => void
}): React.JSX.Element {
  // Une création démarre une conversation neuve : jamais servie depuis le cache.
  const [nonce] = useState(() => Math.random())
  const query = useQuery({
    queryKey: ['agentProfileConversation', profileId ?? nonce],
    queryFn: () => call<{ neuronId: string }>('agents:conversation', profileId === undefined ? {} : { profileId }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false
  })
  const opened = query.data?.neuronId
  useEffect(() => {
    if (opened !== undefined) onOpen(opened)
  }, [opened, onOpen])
  if (query.isError) {
    return (
      <p role="alert" className="p-4 text-sm">
        {query.error instanceof IpcFailure ? query.error.message : 'La conversation n’a pas pu s’ouvrir.'}
      </p>
    )
  }
  if (opened === undefined) return <p className="p-4 text-sm text-content-muted">Ouverture…</p>
  return <ChatPanel key={opened} neuronId={opened} onClose={onClose} />
}
