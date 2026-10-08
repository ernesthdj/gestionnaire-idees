import type { ProposalDecision, ProposalStatus } from '@shared/ipc/analyste'

/**
 * Transitions d'une proposition sur une décision de mentalyas (spec 019 T025, data-model « Transitions », D10) :
 * fonction pure. Les états de la mise à jour (`coding`, `to_fix`, `ready`, `kept`, `discarded`, `reverted`) ne
 * s'atteignent pas par une décision de tri : ils viennent de l'US4. `null` = transition refusée.
 */
const DECISIONS: Readonly<Record<ProposalDecision, Partial<Record<ProposalStatus, ProposalStatus>>>> = {
  accept: { new: 'accepted', postponed: 'accepted' },
  refuse: { new: 'refused', postponed: 'refused' },
  postpone: { new: 'postponed' },
  resume: { postponed: 'new', refused: 'new' },
  applied: { new: 'applied', postponed: 'applied', accepted: 'applied' }
}

export function nextStatus(status: ProposalStatus, decision: ProposalDecision): ProposalStatus | null {
  return DECISIONS[decision][status] ?? null
}
