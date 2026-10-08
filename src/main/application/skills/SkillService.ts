import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { SkillDraftDiffView, SkillDraftView } from '@shared/ipc/skills'
import { parseSkillMarkdown } from '@shared/skills/frontMatter'
import { familyOf, persoId, projetId } from '@shared/skills/model'
import { AppError } from '../../domain/errors'
import { diffFiles, draftFiles, type DraftFile } from '../../domain/skills/draftFiles'
import { isExecutablePath, isSkillName, safeRelativePath } from '../../domain/skills/paths'
import type { SkillDraftRow, SkillRepository } from '../../infrastructure/db/repositories/SkillRepository'
import type { SkillStore } from '../../infrastructure/skills/SkillStore'
import type { EntityHandler } from '../history/HistoryService'
import type { LinkedProject, SkillInventory } from './SkillInventory'

/** Brouillon déposé par Claude (outil `skill_brouillon`) ou créé par l'app (duplication, import). */
export interface DraftInput {
  readonly skill: string
  readonly famille: 'perso' | 'projet'
  readonly projet?: string | undefined
  readonly description: string
  readonly contenu: string
  readonly annexes?: readonly { readonly chemin: string; readonly contenu: string }[] | undefined
}

export interface SkillServiceDeps {
  readonly repository: SkillRepository
  readonly store: SkillStore
  readonly inventory: Pick<SkillInventory, 'list' | 'get' | 'invalidate' | 'dirOf'>
  readonly home: string
  readonly projects: () => readonly LinkedProject[]
  /** L'arbre a changé (installation, retour, suppression, brouillon) : le renderer relit. */
  readonly onChanged: () => void
  /** Dossier de travail vide des conversations Skills (`<profil>/skills-workspace`). */
  readonly workspace?: string
  readonly now?: () => number
  readonly newId?: () => string
}

const MAX_ANNEXES = 20
const MAX_ANNEX_CHARS = 100_000

/**
 * Faire évoluer ses skills (spec 020 US3, constitution 4.5.0) : Claude ne dépose que des **brouillons** (base de
 * l'app, rien sur le disque) ; mentalyas installe (version remplacée sauvegardée, écriture atomique, conflit disque
 * détecté), revient à la version précédente ou supprime (dossier sauvegardé). Chaque geste est un lot `skills`
 * annulable ; les skills de plugins sont en lecture seule.
 */
export class SkillService {
  constructor(private readonly deps: SkillServiceDeps) {}

  // --- Conversations ------------------------------------------------------------------------------------------

  /** Conversation « Skills » générale, ou celle d'un skill (créée au premier appel, neurone caché). */
  conversation(skillId?: string): { neuronId: string } {
    const key = skillId ?? '*'
    if (skillId !== undefined) this.deps.inventory.get(skillId)
    const existing = this.deps.repository.skillChat(key)
    if (existing !== undefined) return { neuronId: existing }
    const workspace = this.deps.workspace
    if (workspace === undefined) throw new AppError('VALIDATION', 'Dossier de travail des skills indisponible')
    mkdirSync(workspace, { recursive: true })
    const id = this.newId()
    const title = skillId === undefined ? 'Skills' : `Skill ${skillId.split(':').at(-1) ?? skillId}`
    this.deps.repository.insertSkillChat({ id, title, key, dir: workspace })
    return { neuronId: id }
  }

  // --- Brouillons -----------------------------------------------------------------------------------------------

  drafts(skillId?: string): SkillDraftView[] {
    return this.deps.repository
      .openDrafts()
      .map((row) => this.draftView(row))
      .filter((view) => skillId === undefined || view.skillId === skillId)
  }

  /** Brouillon déposé par Claude : créé ou remplacé, historisé « par Claude », jamais écrit sur le disque. */
  writeDraft(
    input: DraftInput,
    origin: 'claude' | 'duplicate' | 'import' = 'claude',
    importOptions?: { readonly importId: string; readonly scripts: readonly string[]; readonly source: string }
  ): { draftId: string; created: boolean } {
    const genesisId = input.famille === 'projet' ? (input.projet ?? null) : null
    if (!isSkillName(input.skill)) throw new AppError('VALIDATION', 'Nom de skill invalide (minuscules, chiffres, -)')
    if (input.famille === 'projet' && genesisId === null) {
      throw new AppError('VALIDATION', 'Un skill de projet demande l’identifiant du projet lié')
    }
    const dir = this.dirFor(input.famille, genesisId, input.skill)
    // Seul un import peut porter des scripts, autorisés un par un par mentalyas (constitution I).
    const scripts = new Set(origin === 'import' ? (importOptions?.scripts ?? []) : [])
    const annexes = checkAnnexes(input.annexes ?? [], scripts)
    const { repository } = this.deps
    const now = this.now()
    const existing = repository.openDraft(input.famille, genesisId, input.skill)
    const fields = {
      description: input.description.trim(),
      content: input.contenu,
      annexes: JSON.stringify(annexes),
      // Réécrit par Claude (ou dupliqué) : aucun script d'import ne reste autorisé (analyse H2).
      allowedScripts: JSON.stringify([...scripts]),
      origin,
      importId: origin === 'import' ? (importOptions?.importId ?? null) : null,
      source: origin === 'import' ? (importOptions?.source ?? null) : null,
      updatedAt: now
    }
    const batchId = randomUUID()
    const id = existing?.id ?? this.newId()
    repository.transaction(() => {
      if (existing === undefined) {
        repository.insertDraft({
          id,
          family: input.famille,
          projectGenesisId: genesisId,
          name: input.skill,
          baseHash: this.deps.store.hash(dir),
          status: 'open',
          createdAt: now,
          ...fields
        })
      } else {
        repository.updateDraft(id, fields)
      }
      repository.log(
        batchId,
        [
          {
            kind: origin === 'claude' ? 'mcp_write' : 'skills',
            entity: 'skill_draft',
            entityId: id,
            before: existing === undefined ? null : draftSnapshot(existing),
            after: draftSnapshot(repository.draft(id) as SkillDraftRow)
          }
        ],
        origin === 'claude' ? 'claude' : 'user'
      )
    })
    this.deps.onChanged()
    return { draftId: id, created: existing === undefined }
  }

  /** Duplique un skill (plugin compris) en brouillon personnel du même contenu (FR-021). */
  duplicate(skillId: string): { draftId: string } {
    const detail = this.deps.inventory.get(skillId)
    const name = detail.skill.name
    if (!isSkillName(name)) throw new AppError('VALIDATION', 'Ce skill abîmé ne peut pas être dupliqué')
    if (this.deps.store.hash(this.dirFor('perso', null, name)) !== null) {
      throw new AppError('NAME_TAKEN', `Un skill personnel « ${name} » existe déjà`)
    }
    const parsed = parseSkillMarkdown(detail.markdown)
    const source = this.dirOf(skillId, true)
    const files = source === null ? null : this.deps.store.read(source)
    const annexes = [...(files ?? new Map<string, Buffer>()).entries()]
      .filter(([path]) => path !== 'SKILL.md' && !isExecutablePath(path))
      .slice(0, MAX_ANNEXES)
      .map(([chemin, content]) => ({ chemin, contenu: content.toString('utf8').slice(0, MAX_ANNEX_CHARS) }))
    const { draftId } = this.writeDraft(
      {
        skill: name,
        famille: 'perso',
        description: parsed.header?.description ?? (detail.skill.description || name),
        contenu: parsed.body,
        annexes
      },
      'duplicate'
    )
    return { draftId }
  }

  discard(draftId: string): void {
    const draft = this.openDraftOrThrow(draftId)
    this.deps.repository.updateDraft(draft.id, { status: 'discarded', updatedAt: this.now() })
    this.deps.onChanged()
  }

  diff(draftId: string): SkillDraftDiffView {
    const draft = this.openDraftOrThrow(draftId)
    const dir = this.dirFor(draft.family, draft.projectGenesisId, draft.name)
    const installed = this.deps.store.read(dir)
    const text = new Map(
      [...(installed ?? new Map<string, Buffer>()).entries()].map(([path, buffer]) => [path, buffer.toString('utf8')])
    )
    const current = this.deps.store.hash(dir)
    return {
      draft: this.draftView(draft),
      files: diffFiles(this.filesOf(draft), text),
      diskChanged: current !== draft.baseHash
    }
  }

  // --- Installer, revenir, supprimer ------------------------------------------------------------------------------

  install(draftId: string, acceptDiskChange = false): { batchId: string; skillId: string } {
    const draft = this.openDraftOrThrow(draftId)
    const skillId = skillIdOf(draft)
    const dir = this.dirFor(draft.family, draft.projectGenesisId, draft.name)
    const current = this.deps.store.hash(dir)
    if (draft.baseHash === null && current !== null) {
      throw new AppError('NAME_TAKEN', `Un skill « ${draft.name} » existe déjà à cet endroit`)
    }
    if (current !== draft.baseHash && !acceptDiskChange) {
      throw new AppError('DISK_CHANGED', 'Le skill a changé sur le disque depuis ce brouillon : revois les différences')
    }
    const files = this.filesOf(draft)
    const batchId = randomUUID()
    this.change(skillId, dir, batchId, () => this.deps.store.write(dir, files))
    this.deps.repository.updateDraft(draft.id, { status: 'installed', updatedAt: this.now() })
    this.deps.onChanged()
    return { batchId, skillId }
  }

  /** « Revenir à la version précédente » (FR-020) : la dernière version sauvegardée différente de l'état actuel. */
  restore(skillId: string): { batchId: string } {
    const dir = this.writableDir(skillId)
    const previous = this.deps.repository.previousVersion(skillId, this.deps.store.hash(dir))
    if (previous === undefined || !this.deps.store.hasVersionFolder(previous.folder)) {
      throw new AppError('NO_VERSION', 'Aucune version précédente à rétablir')
    }
    const batchId = randomUUID()
    this.change(skillId, dir, batchId, () => this.deps.store.restore(dir, previous.folder))
    this.deps.onChanged()
    return { batchId }
  }

  /** Supprime un skill personnel ou de projet (D10, FR-030) : dossier sauvegardé puis retiré, annulable. */
  remove(skillId: string): { batchId: string } {
    const dir = this.writableDir(skillId)
    if (this.deps.store.hash(dir) === null) throw new AppError('NOT_FOUND', 'Skill introuvable')
    const batchId = randomUUID()
    this.change(skillId, dir, batchId, () => this.deps.store.remove(dir))
    this.deps.onChanged()
    return { batchId }
  }

  /** Versions sauvegardées d'un skill (« Revenir » possible s'il y en a une différente de l'état actuel). */
  versionsOf(skillId: string): number {
    return this.deps.repository.versions(skillId).length
  }

  /** Restauration par l'Historique : fichiers d'un skill et brouillons. */
  historyHandlers(): Readonly<Record<string, EntityHandler>> {
    const { repository, store } = this.deps
    return {
      skill_files: {
        snapshot: (skillId) => {
          const dir = this.dirOf(skillId, false)
          const hash = dir === null ? null : store.hash(dir)
          return hash === null ? null : { hash }
        },
        apply: (skillId, target) => {
          const dir = this.dirOf(skillId, false)
          if (dir === null) throw new AppError('READ_ONLY_FAMILY', 'Ce skill ne peut pas être modifié')
          this.saveVersion(skillId, dir, randomUUID())
          if (target === null) store.remove(dir)
          else {
            const version =
              typeof target['hash'] === 'string' ? repository.hasVersion(skillId, target['hash']) : undefined
            if (version === undefined || !store.hasVersionFolder(version.folder)) {
              throw new AppError('NO_VERSION', 'La version à rétablir n’existe plus')
            }
            store.restore(dir, version.folder)
          }
          this.afterWrite(skillId)
        }
      },
      skill_draft: {
        snapshot: (draftId) => {
          const draft = repository.draft(draftId)
          return draft === undefined ? null : draftSnapshot(draft)
        },
        apply: (draftId, target) => {
          if (target === null) repository.deleteDraft(draftId)
          else repository.updateDraft(draftId, target as Partial<SkillDraftRow>)
          this.deps.onChanged()
        }
      }
    }
  }

  // --- Interne ---------------------------------------------------------------------------------------------------

  /** Un changement de fichiers : version avant, écriture, version après, lot annulable. */
  private change(skillId: string, dir: string, batchId: string, write: () => void): void {
    const { repository } = this.deps
    const before = this.saveVersion(skillId, dir, batchId)
    write()
    const after = this.saveVersion(skillId, dir, batchId)
    repository.log(
      batchId,
      [
        {
          kind: 'skills',
          entity: 'skill_files',
          entityId: skillId,
          before: before === null ? null : { hash: before },
          after: after === null ? null : { hash: after }
        }
      ],
      'user'
    )
    this.afterWrite(skillId)
  }

  private saveVersion(skillId: string, dir: string, batchId: string): string | null {
    const saved = this.deps.store.saveVersion(skillId, dir)
    if (saved === null) return null
    const { repository } = this.deps
    repository.insertVersion({
      id: this.newId(),
      skillId,
      folder: saved.folder,
      contentHash: saved.hash,
      batchId,
      createdAt: this.now()
    })
    return saved.hash
  }

  private afterWrite(skillId: string): void {
    for (const folder of this.deps.repository.prune(skillId)) this.deps.store.deleteVersionFolder(folder)
    this.deps.inventory.invalidate()
  }

  private filesOf(draft: SkillDraftRow): DraftFile[] {
    const annexes = (JSON.parse(draft.annexes) as { path: string; content: string }[]).map((file) => ({
      path: file.path,
      content: file.content
    }))
    const allowed = new Set(JSON.parse(draft.allowedScripts) as string[])
    for (const file of annexes) {
      if (isExecutablePath(file.path) && !allowed.has(file.path)) {
        throw new AppError('VALIDATION', `Fichier exécutable refusé : ${file.path}`)
      }
    }
    return draftFiles({ name: draft.name, description: draft.description, content: draft.content, annexes })
  }

  private openDraftOrThrow(draftId: string): SkillDraftRow {
    const draft = this.deps.repository.draft(draftId)
    if (draft === undefined || draft.status !== 'open') throw new AppError('NOT_FOUND', 'Brouillon introuvable')
    return draft
  }

  private draftView(row: SkillDraftRow): SkillDraftView {
    const dir = this.dirOrNull(row.family, row.projectGenesisId, row.name)
    return {
      id: row.id,
      skillId: skillIdOf(row),
      family: row.family,
      name: row.name,
      description: row.description,
      origin: row.origin,
      isNew: dir === null || this.deps.store.hash(dir) === null,
      fileCount: 1 + (JSON.parse(row.annexes) as unknown[]).length,
      updatedAt: row.updatedAt
    }
  }

  /** Dossier d'un skill modifiable (perso, ou projet d'un genesis lié) ; sinon `READ_ONLY_FAMILY`. */
  private writableDir(skillId: string): string {
    const dir = this.dirOf(skillId, false)
    if (dir === null) throw new AppError('READ_ONLY_FAMILY', 'Les skills de plugins sont en lecture seule')
    return dir
  }

  /** Dossier d'un identifiant de skill ; `allowPlugin` pour la lecture d'un skill de plugin (duplication). */
  private dirOf(skillId: string, allowPlugin: boolean): string | null {
    const family = familyOf(skillId)
    if (family === 'perso') return this.dirOrNull('perso', null, skillId.slice('perso:'.length))
    if (family === 'projet') {
      const [, genesisId, name] = skillId.split(':')
      return genesisId === undefined || name === undefined ? null : this.dirOrNull('projet', genesisId, name)
    }
    // Lecture seulement : le dossier vient de l'inventaire (racine vérifiée), jamais d'un chemin donné.
    if (family === 'plugin' && allowPlugin) return this.deps.inventory.dirOf(skillId)
    return null
  }

  private dirOrNull(family: 'perso' | 'projet', genesisId: string | null, name: string): string | null {
    if (!isSkillName(name)) return null
    if (family === 'perso') return join(this.deps.home, '.claude', 'skills', name)
    const project = this.deps.projects().find((candidate) => candidate.genesisId === genesisId)
    return project === undefined ? null : join(project.dir, '.claude', 'skills', name)
  }

  private dirFor(family: 'perso' | 'projet', genesisId: string | null, name: string): string {
    const dir = this.dirOrNull(family, genesisId, name)
    if (dir === null) throw new AppError('VALIDATION', 'Projet lié introuvable ou nom de skill invalide')
    return dir
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private newId(): string {
    return (this.deps.newId ?? randomUUID)()
  }
}

/** Identifiant du skill visé par un brouillon. */
export function skillIdOf(draft: Pick<SkillDraftRow, 'family' | 'projectGenesisId' | 'name'>): string {
  return draft.family === 'perso' ? persoId(draft.name) : projetId(draft.projectGenesisId ?? '', draft.name)
}

/** État d'un brouillon dans l'Historique (tous ses champs modifiables, pour le rétablir exactement). */
function draftSnapshot(draft: SkillDraftRow): Record<string, unknown> {
  return {
    name: draft.name,
    description: draft.description,
    content: draft.content,
    annexes: draft.annexes,
    allowedScripts: draft.allowedScripts,
    origin: draft.origin,
    status: draft.status,
    updatedAt: draft.updatedAt
  }
}

/** Annexes d'un brouillon de Claude : chemins sûrs, jamais exécutables, bornées (FR-018). */
function checkAnnexes(
  annexes: readonly { readonly chemin: string; readonly contenu: string }[],
  allowedScripts: ReadonlySet<string> = new Set()
): DraftFile[] {
  if (annexes.length > MAX_ANNEXES) throw new AppError('VALIDATION', `${MAX_ANNEXES} fichiers annexes au plus`)
  const seen = new Set<string>()
  return annexes.map((annex) => {
    const path = safeRelativePath(annex.chemin)
    if (path === null || path === 'SKILL.md') throw new AppError('VALIDATION', `Chemin refusé : ${annex.chemin}`)
    if (isExecutablePath(path) && !allowedScripts.has(path)) {
      throw new AppError('VALIDATION', `Fichier exécutable refusé : ${path}`)
    }
    if (seen.has(path)) throw new AppError('VALIDATION', `Fichier en double : ${path}`)
    if (annex.contenu.length > MAX_ANNEX_CHARS) throw new AppError('VALIDATION', `Fichier trop long : ${path}`)
    seen.add(path)
    return { path, content: annex.contenu }
  })
}
