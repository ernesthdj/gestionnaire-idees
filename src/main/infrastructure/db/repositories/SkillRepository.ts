import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { neurons } from '../schemaNeurons'
import { skillDrafts, skillVersions } from '../schemaSkills'
import { writeChanges, type ChangeEntry } from './changeLog'

export type SkillDraftRow = typeof skillDrafts.$inferSelect
export type NewSkillDraft = typeof skillDrafts.$inferInsert
export type SkillVersionRow = typeof skillVersions.$inferSelect

/** Versions gardées par skill (FR-019) : au-delà, les plus anciennes sont retirées. */
export const VERSIONS_KEPT = 10

/**
 * Brouillons et versions de skills (spec 020 US3, data-model). Un seul brouillon ouvert par
 * `(famille, projet, nom)` ; les versions référencent des dossiers de sauvegarde du profil, par empreinte.
 */
export class SkillRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude'): void {
    writeChanges(this.db, batchId, entries, actor)
  }

  draft(id: string): SkillDraftRow | undefined {
    return this.db.select().from(skillDrafts).where(eq(skillDrafts.id, id)).get()
  }

  /** Brouillon ouvert d'un skill (famille, projet, nom). */
  openDraft(family: 'perso' | 'projet', genesisId: string | null, name: string): SkillDraftRow | undefined {
    return this.db
      .select()
      .from(skillDrafts)
      .where(
        and(
          eq(skillDrafts.status, 'open'),
          eq(skillDrafts.family, family),
          eq(skillDrafts.name, name),
          genesisId === null ? isNull(skillDrafts.projectGenesisId) : eq(skillDrafts.projectGenesisId, genesisId)
        )
      )
      .get()
  }

  openDrafts(): SkillDraftRow[] {
    return this.db
      .select()
      .from(skillDrafts)
      .where(eq(skillDrafts.status, 'open'))
      .orderBy(desc(skillDrafts.updatedAt))
      .all()
  }

  insertDraft(row: NewSkillDraft): void {
    this.db.insert(skillDrafts).values(row).run()
  }

  /** Remplace les champs d'un brouillon (restauration par l'Historique comprise). */
  updateDraft(id: string, patch: Partial<Omit<NewSkillDraft, 'id'>>): void {
    this.db.update(skillDrafts).set(patch).where(eq(skillDrafts.id, id)).run()
  }

  deleteDraft(id: string): void {
    this.db.delete(skillDrafts).where(eq(skillDrafts.id, id)).run()
  }

  /** Versions d'un skill, de la plus récente à la plus ancienne. */
  versions(skillId: string): SkillVersionRow[] {
    return this.db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skillId, skillId))
      .orderBy(desc(skillVersions.createdAt), desc(skillVersions.id))
      .all()
  }

  insertVersion(row: SkillVersionRow): void {
    this.db.insert(skillVersions).values(row).run()
  }

  /**
   * Garde les `VERSIONS_KEPT` versions les plus récentes ; renvoie les dossiers qui ne sont plus référencés (à
   * supprimer du disque par l'appelant).
   */
  prune(skillId: string): string[] {
    const all = this.db
      .select()
      .from(skillVersions)
      .where(eq(skillVersions.skillId, skillId))
      .orderBy(asc(skillVersions.createdAt), asc(skillVersions.id))
      .all()
    const old = all.slice(0, Math.max(0, all.length - VERSIONS_KEPT))
    if (old.length === 0) return []
    this.db
      .delete(skillVersions)
      .where(
        inArray(
          skillVersions.id,
          old.map((row) => row.id)
        )
      )
      .run()
    const kept = new Set(all.slice(old.length).map((row) => row.folder))
    return [...new Set(old.map((row) => row.folder))].filter((folder) => !kept.has(folder))
  }

  /** Une version de cette empreinte existe-t-elle encore pour ce skill ? */
  hasVersion(skillId: string, hash: string): SkillVersionRow | undefined {
    return this.db
      .select()
      .from(skillVersions)
      .where(and(eq(skillVersions.skillId, skillId), eq(skillVersions.contentHash, hash)))
      .orderBy(desc(skillVersions.createdAt))
      .get()
  }

  /** Dernière version différente de l'état actuel (« Revenir »). */
  previousVersion(skillId: string, currentHash: string | null): SkillVersionRow | undefined {
    return this.db
      .select()
      .from(skillVersions)
      .where(
        and(
          eq(skillVersions.skillId, skillId),
          ...(currentHash === null ? [] : [ne(skillVersions.contentHash, currentHash)])
        )
      )
      .orderBy(desc(skillVersions.createdAt), desc(skillVersions.id))
      .get()
  }

  /** Conversation Skills : la générale (`clé = '*'`) ou celle d'un skill (`clé = identifiant`). */
  skillChat(key: string): string | undefined {
    return this.db
      .select({ id: neurons.id })
      .from(neurons)
      .where(and(eq(neurons.kind, 'skills_chat'), eq(neurons.elementKey, key)))
      .get()?.id
  }

  /** Crée le neurone caché d'une conversation Skills, dans le dossier de travail dédié. */
  insertSkillChat(input: {
    readonly id: string
    readonly title: string
    readonly key: string
    readonly dir: string
  }): void {
    this.db
      .insert(neurons)
      .values({
        id: input.id,
        rootId: input.id,
        kind: 'skills_chat',
        title: input.title,
        origin: 'user',
        hidden: true,
        elementKey: input.key,
        projectDir: input.dir
      })
      .run()
  }
}
