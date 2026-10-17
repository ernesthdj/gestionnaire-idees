import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { AgentProfileView, AgentSkillsProposal } from '@shared/agents/profile'
import type { SkillDraftView, SkillsView } from '@shared/ipc/skills'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'

/**
 * Skills d'un agent peaufinés en visio (L1o D16) : ses propositions d'ajout ou de retrait (Accepter / Refuser, rien
 * ne change sans le clic de mentalyas) et les brouillons de skills déposés pendant l'appel (Voir et installer).
 */

export interface VisioSkills {
  readonly proposals: readonly AgentSkillsProposal[]
  readonly drafts: readonly SkillDraftView[]
  readonly nameOf: (skillId: string) => string
  readonly accept: (proposal: AgentSkillsProposal) => Promise<void>
  readonly refuse: (proposal: AgentSkillsProposal) => void
}

/** Nouvelle liste de skills du profil une fois la proposition acceptée. Pur. */
export function applySkills(current: readonly string[], proposal: AgentSkillsProposal): string[] {
  const kept = current.filter((skill) => !proposal.remove.includes(skill))
  return [...kept, ...proposal.add.filter((skill) => !kept.includes(skill))]
}

export function useSkillsOfVisio(
  chatId: string | null,
  profile: AgentProfileView | undefined,
  since: number
): VisioSkills {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [proposals, setProposals] = useState<readonly AgentSkillsProposal[]>([])
  useEffect(() => {
    if (chatId === null) return undefined
    return window.api.on('agents:skillsProposal', (payload) => {
      const proposal = payload as AgentSkillsProposal
      if (proposal.neuronId === chatId) setProposals((list) => [...list, proposal])
    })
  }, [chatId])
  const skills = useQuery({ queryKey: ['skills', 'visio'], queryFn: () => call<SkillsView>('skills:list') })
  const drafts = useQuery({
    queryKey: ['skillDrafts', 'visio'],
    queryFn: () => call<SkillDraftView[]>('skills:drafts', {})
  })
  const names = new Map((skills.data?.skills ?? []).map((skill) => [skill.id, skill.name]))
  const drop = (proposal: AgentSkillsProposal): void =>
    setProposals((list) => list.filter((entry) => entry !== proposal))
  return {
    proposals,
    // Les brouillons de Claude déposés pendant cet appel, ou ceux des skills de l'agent.
    drafts: (drafts.data ?? []).filter(
      (draft) =>
        draft.origin === 'claude' && (draft.updatedAt >= since || profile?.skills.includes(draft.skillId) === true)
    ),
    nameOf: (skillId) => names.get(skillId) ?? skillId,
    accept: async (proposal) => {
      if (profile === undefined) return
      try {
        await call('agents:save', {
          id: profile.id,
          name: profile.name,
          role: profile.role,
          instructions: profile.instructions,
          permissionMode: profile.permissionMode,
          model: profile.model,
          effort: profile.effort,
          skills: applySkills(profile.skills, proposal)
        })
        drop(proposal)
        showToast(`Skills de « ${profile.name} » mis à jour.`)
        await client.invalidateQueries({ queryKey: ['agentProfiles'] })
      } catch (failure) {
        showToast(failure instanceof IpcFailure ? failure.message : 'Les skills n’ont pas pu être changés.')
      }
    },
    refuse: drop
  }
}

/** Cartes des propositions et des brouillons, entre l'en-tête du volet et la conversation. */
export function SkillsCards({
  skills,
  onOpenDraft
}: {
  readonly skills: VisioSkills
  readonly onOpenDraft: (draftId: string) => void
}): React.JSX.Element | null {
  const { proposals, drafts, nameOf } = skills
  if (proposals.length === 0 && drafts.length === 0) return null
  return (
    <ul
      className="max-h-40 shrink-0 space-y-2 overflow-y-auto border-b border-content-muted/20 px-4 py-3 text-sm"
      aria-label="Skills proposés en visio"
    >
      {proposals.map((proposal, index) => (
        <li key={`p-${index}`} className="rounded-md border border-accent/40 bg-surface-raised p-2">
          <p>
            <span className="text-accent" aria-hidden="true">
              ✦{' '}
            </span>
            {proposal.add.length === 0 ? null : <>Ajouter {proposal.add.map(nameOf).join(', ')}</>}
            {proposal.add.length > 0 && proposal.remove.length > 0 ? ' · ' : null}
            {proposal.remove.length === 0 ? null : <>Retirer {proposal.remove.map(nameOf).join(', ')}</>}
          </p>
          <p className="text-xs text-content-muted">{proposal.why}</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="card-button card-button-primary"
              onClick={() => void skills.accept(proposal)}
            >
              Accepter
            </button>
            <button type="button" className="card-button card-button-ghost" onClick={() => skills.refuse(proposal)}>
              Refuser
            </button>
          </div>
        </li>
      ))}
      {drafts.map((draft) => (
        <li key={draft.id} className="flex items-center gap-2 rounded-md border border-content-muted/30 p-2">
          <span className="min-w-0 flex-1 truncate">
            Brouillon de <strong>{draft.name}</strong>
            {draft.isNew ? ' (nouveau skill)' : ''}
          </span>
          <button type="button" className="card-button card-button-ghost" onClick={() => onOpenDraft(draft.id)}>
            Voir et installer
          </button>
        </li>
      ))}
    </ul>
  )
}
