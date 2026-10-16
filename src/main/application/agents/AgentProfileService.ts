import { randomUUID } from 'node:crypto'
import type { AgentProfileInput, AgentProfileView } from '@shared/agents/profile'
import { AppError } from '../../domain/errors'
import type {
  AgentProfileRepository,
  AgentProfileRow
} from '../../infrastructure/db/repositories/AgentProfileRepository'

export interface AgentProfileServiceDeps {
  readonly repository: AgentProfileRepository
  /** Identifiants des skills connus de l'inventaire (un profil ne peut consulter que ceux-là). */
  readonly skillIds: () => ReadonlySet<string>
  readonly now?: () => number
}

const toView = (row: AgentProfileRow): AgentProfileView => ({
  id: row.id,
  name: row.name,
  role: row.role,
  instructions: row.instructions,
  permissionMode: row.permissionMode,
  model: row.model,
  effort: row.effort,
  skills: JSON.parse(row.skills) as string[],
  updatedAt: row.updatedAt,
  delivered: row.delivered
})

/** Profils d'agents (T001) : créés et modifiés depuis la page Skills ; lus plus tard par le moteur d'enchaînement. */
export class AgentProfileService {
  private readonly now: () => number

  constructor(private readonly deps: AgentProfileServiceDeps) {
    this.now = deps.now ?? Date.now
  }

  list(): AgentProfileView[] {
    return this.deps.repository.list().map(toView)
  }

  save(input: AgentProfileInput): AgentProfileView {
    const { repository } = this.deps
    const name = input.name.trim()
    const same = repository.byName(name)
    if (same !== undefined && same.id !== input.id) {
      throw new AppError('CONFLICT', `Un profil d’agent s’appelle déjà « ${name} ».`)
    }
    const known = this.deps.skillIds()
    const unknown = input.skills.filter((skill) => !known.has(skill))
    if (unknown.length > 0) throw new AppError('VALIDATION', 'Un skill choisi n’existe plus.')
    const fields = {
      name,
      role: input.role,
      instructions: input.instructions.trim(),
      permissionMode: input.permissionMode,
      model: input.model,
      effort: input.effort,
      skills: JSON.stringify([...new Set(input.skills)]),
      updatedAt: this.now()
    }
    if (input.id !== undefined && input.isNew !== true) {
      if (repository.get(input.id) === undefined) throw new AppError('NOT_FOUND', 'Ce profil n’existe plus.')
      repository.update(input.id, fields)
      return toView(repository.get(input.id) as AgentProfileRow)
    }
    // Création : l'identifiant choisi à l'aperçu (L1o D21) donne le personnage montré avant le clic, sinon un neuf.
    if (input.id !== undefined && repository.get(input.id) !== undefined) {
      throw new AppError('CONFLICT', 'Ce profil existe déjà.')
    }
    const id = input.id ?? randomUUID()
    repository.insert({ id, createdAt: fields.updatedAt, ...fields })
    return toView(repository.get(id) as AgentProfileRow)
  }

  remove(id: string): void {
    if (this.deps.repository.get(id) === undefined) throw new AppError('NOT_FOUND', 'Ce profil n’existe plus.')
    this.deps.repository.delete(id)
  }
}
