import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { PermissionRule } from '../../../domain/conversation/permissions'
import type { AppDatabase } from '../client'
import { permissionLog, permissionRules, trustedProjects } from '../schemaNeurons'

export interface StoredRule extends PermissionRule {
  readonly id: string
  readonly projectKey: string
  readonly createdAt: string
}

export type PermissionDecision = 'allow' | 'always' | 'deny' | 'expired' | 'rule'

/** Règles « Toujours », dépôts de confiance et journal des décisions (spec 014 R3, US6, FR-014). */
export class PermissionRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Règles actives d'un projet, ou de tous les projets. */
  rules(projectKey?: string): StoredRule[] {
    const conditions = [isNull(permissionRules.deletedAt)]
    if (projectKey !== undefined) conditions.push(eq(permissionRules.projectKey, projectKey))
    return this.db
      .select({
        id: permissionRules.id,
        projectKey: permissionRules.projectKey,
        tool: permissionRules.tool,
        pattern: permissionRules.pattern,
        createdAt: permissionRules.createdAt
      })
      .from(permissionRules)
      .where(and(...conditions))
      .orderBy(asc(permissionRules.createdAt))
      .all()
  }

  /** Ajoute une règle, sauf si une règle identique existe déjà pour ce projet. */
  addRule(projectKey: string, rule: PermissionRule): void {
    const same = this.rules(projectKey).some((entry) => entry.tool === rule.tool && entry.pattern === rule.pattern)
    if (same) return
    this.db
      .insert(permissionRules)
      .values({ id: randomUUID(), projectKey, tool: rule.tool, pattern: rule.pattern })
      .run()
  }

  /** Révoque une règle ; `false` si elle n'existe pas (ou plus). */
  removeRule(id: string): boolean {
    const result = this.db
      .update(permissionRules)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(permissionRules.id, id), isNull(permissionRules.deletedAt)))
      .run()
    return result.changes > 0
  }

  isTrusted(projectKey: string): boolean {
    return this.db.select().from(trustedProjects).where(eq(trustedProjects.projectKey, projectKey)).get() !== undefined
  }

  setTrusted(projectKey: string, trusted: boolean): void {
    if (!trusted) {
      this.db.delete(trustedProjects).where(eq(trustedProjects.projectKey, projectKey)).run()
      return
    }
    this.db.insert(trustedProjects).values({ projectKey }).onConflictDoNothing().run()
  }

  /** Décision tracée : outil et décision seulement, jamais l'entrée de l'outil ni la commande. */
  log(neuronId: string, tool: string, decision: PermissionDecision): void {
    this.db.insert(permissionLog).values({ neuronId, tool, decision }).run()
  }
}
