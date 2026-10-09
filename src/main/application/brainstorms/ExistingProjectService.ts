import { randomUUID } from 'node:crypto'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import type { ExistingPreview } from '@shared/ipc/brainstorms'
import { AppError } from '../../domain/errors'
import { existingFolderProblem, type FolderRules } from '../../domain/brainstorms/paths'
import type { BrainstormRepository } from '../../infrastructure/db/repositories/BrainstormRepository'
import { saveExternalRef } from '../../infrastructure/hub/ExternalRefs'
import { createVault, ensureIgnored, gitBranchOf, readVault, vaultWrites } from '../../infrastructure/hub/ProjectVault'
import { freeSlug } from './BrainstormService'

export interface ExistingProjectDeps {
  readonly repository: BrainstormRepository
  /** Sélecteur de dossier natif du main ; `undefined` si annulé. */
  readonly pickFolder: (title: string) => Promise<string | undefined>
  readonly rules: () => FolderRules
  readonly createGenesis: (title: string, content: string | null, brainstormId: string) => string
  readonly attach: (neuronId: string, dir: string) => void
  readonly now?: () => Date
}

/** Un dossier choisi reste valable 10 minutes : l'adoption ne reçoit que son identifiant. */
const PICK_TTL_MS = 10 * 60 * 1000

/**
 * Projet en chantier (spec 024 US4, D9, R7) : un dossier existant, ailleurs que dans le coffre, devient un brainstorm
 * SANS être déplacé. L'app y pose son vault `.brainstormer/` (métadonnées, ignoré par git) après un aperçu des
 * écritures, et le note comme référence externe du coffre. Aucune commande git n'est lancée ici ; un projet déplacé se
 * « relie » grâce à son vault.
 */
export class ExistingProjectService {
  private readonly picks = new Map<string, { readonly dir: string; readonly at: number }>()

  constructor(private readonly deps: ExistingProjectDeps) {}

  /** Ouvre le sélecteur, puis montre ce que l'app ferait ; `null` si mentalyas annule. */
  async pick(): Promise<ExistingPreview | null> {
    const picked = await this.deps.pickFolder('Choisir le dossier du projet en chantier')
    if (picked === undefined) return null
    const dir = this.resolve(picked)
    const pickId = randomUUID()
    this.prune()
    this.picks.set(pickId, { dir, at: Date.now() })
    return this.preview(pickId, dir)
  }

  /** Pose le vault (s'il manque) et ouvre la voie au brainstorm ; renvoie son identifiant. */
  adopt(input: {
    readonly pickId: string
    readonly name: string
    readonly description: string
    readonly role: 'owner' | 'none'
  }): { readonly id: string } {
    const pick = this.picks.get(input.pickId)
    if (pick === undefined || Date.now() - pick.at > PICK_TTL_MS) {
      throw new AppError('NOT_FOUND', 'Ce choix de dossier a expiré : choisis le dossier de nouveau.')
    }
    const preview = this.preview(input.pickId, pick.dir)
    if (preview.problem !== null) throw new AppError('FOLDER_REFUSED', preview.problem)
    const { repository } = this.deps
    const vault = readVault(pick.dir)
    if (vault.state === 'ok') {
      const known = repository.get(vault.data.brainstormId)
      if (known !== undefined) {
        // Projet déjà adopté (peut-être déplacé) : on le relie à ce dossier, sans rien réécrire.
        if (known.folderPath !== pick.dir) repository.setFolder(known.id, pick.dir)
        this.picks.delete(input.pickId)
        return { id: known.id }
      }
    }
    if (repository.byFolder(pick.dir) !== undefined) {
      throw new AppError('CONFLICT', 'Ce dossier est déjà un brainstorm de l’app.')
    }
    const name = input.name.trim()
    const id = vault.state === 'ok' ? vault.data.brainstormId : randomUUID()
    const gitRole = vault.state === 'ok' ? vault.data.gitRole : input.role
    const created = repository.transaction(() => {
      const row = repository.insert(
        {
          name,
          slug: freeSlug(basename(pick.dir), (slug) => repository.bySlug(slug) !== undefined),
          description: input.description.trim(),
          type: null,
          location: 'external',
          origin: 'existing',
          folderPath: pick.dir,
          gitRole,
          github: false
        },
        id
      )
      const genesisId = this.deps.createGenesis(name, input.description.trim() || null, row.id)
      return { row, genesisId }
    })
    // Écritures dans le projet, montrées dans l'aperçu : le vault (s'il manque) et la ligne du `.gitignore`.
    if (vault.state === 'none') {
      createVault(pick.dir, {
        version: 1,
        brainstormId: created.row.id,
        name,
        gitRole,
        workBranch: null,
        createdAt: this.now()
      })
    } else ensureIgnored(pick.dir)
    this.deps.attach(created.genesisId, pick.dir)
    const root = this.deps.rules().projectsRoot
    if (root !== null) saveExternalRef(root, { slug: created.row.slug, name, path: pick.dir })
    this.picks.delete(input.pickId)
    return { id: created.row.id }
  }

  /** « Relier » un projet déplacé : le dossier choisi doit porter le vault de ce brainstorm. */
  async relink(id: string): Promise<{ readonly ok: boolean }> {
    const row = this.deps.repository.get(id)
    if (row === undefined || row.location !== 'external')
      throw new AppError('NOT_FOUND', 'Ce brainstorm n’existe plus.')
    const picked = await this.deps.pickFolder(`Où se trouve maintenant « ${row.name} » ?`)
    if (picked === undefined) return { ok: false }
    const dir = this.resolve(picked)
    const problem = existingFolderProblem(dir, this.deps.rules())
    if (problem !== null) throw new AppError('FOLDER_REFUSED', problem)
    const vault = readVault(dir)
    if (vault.state !== 'ok' || vault.data.brainstormId !== id) {
      throw new AppError(
        'VAULT_MISMATCH',
        `Ce dossier n’est pas « ${row.name} » : son dossier .brainstormer ne correspond pas.`
      )
    }
    this.deps.repository.setFolder(id, dir)
    const root = this.deps.rules().projectsRoot
    if (root !== null) saveExternalRef(root, { slug: row.slug, name: row.name, path: dir })
    return { ok: true }
  }

  private preview(pickId: string, dir: string): ExistingPreview {
    const vault = readVault(dir)
    const vaultKind =
      vault.state === 'ok'
        ? this.deps.repository.get(vault.data.brainstormId) === undefined
          ? 'foreign'
          : 'known'
        : vault.state
    const git = gitBranchOf(dir)
    const problem =
      existingFolderProblem(dir, this.deps.rules()) ??
      (vault.state === 'damaged'
        ? 'Ce projet a un dossier .brainstormer illisible : l’app ne l’écrase pas. Vérifie-le ou retire-le.'
        : null)
    return {
      pickId,
      folder: dir,
      suggestedName: vault.state === 'ok' ? vault.data.name : basename(dir),
      writes: problem === null && vaultKind !== 'known' ? vaultWrites(dir) : [],
      vault: vaultKind,
      isRepo: git.isRepo,
      branch: git.branch,
      problem
    }
  }

  private resolve(picked: string): string {
    let dir: string
    try {
      dir = realpathSync.native(picked)
    } catch {
      throw new AppError('FOLDER_MISSING', 'Ce dossier est introuvable.')
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory())
      throw new AppError('FOLDER_MISSING', 'Ce dossier est introuvable.')
    return dir
  }

  private prune(): void {
    const now = Date.now()
    for (const [key, value] of this.picks) if (now - value.at > PICK_TTL_MS) this.picks.delete(key)
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
