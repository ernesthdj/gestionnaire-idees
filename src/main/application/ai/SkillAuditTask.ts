import { SkillAuditOut } from '@shared/skills/audit'
import type { AIError, Result } from '../../domain/ai/types'
import type { AIGateway, AIResult } from './AIGateway'

/** Bornes de l'entrée d'audit (`L3-skills-importer.md` §3). */
export const AUDIT_INPUT_LIMITS = { skillChars: 60_000, scripts: 5, scriptLines: 200 } as const

export interface AuditInput {
  readonly skillMd: string
  readonly files: readonly { readonly path: string; readonly size: number; readonly executable: boolean }[]
  readonly scripts: readonly { readonly path: string; readonly content: string }[]
}

/** Neutralise une balise fermante de l'entrée : le texte du skill ne peut pas « sortir » de son bloc. */
const guard = (text: string): string => text.replace(/<\s*\/\s*(skill|fichiers|scripts)\s*>/giu, '<\\/$1>')

/** Entrée balisée de la tâche : SKILL.md, liste des fichiers, extraits des scripts, tous comme données. */
export function auditInput(input: AuditInput): string {
  const scripts = input.scripts.slice(0, AUDIT_INPUT_LIMITS.scripts).map((script) => {
    const lines = script.content.split(/\r?\n/).slice(0, AUDIT_INPUT_LIMITS.scriptLines).join('\n')
    return `--- ${guard(script.path)} ---\n${guard(lines)}`
  })
  return [
    '<skill>',
    guard(input.skillMd.slice(0, AUDIT_INPUT_LIMITS.skillChars)),
    '</skill>',
    '<fichiers>',
    ...input.files.map((file) => `${guard(file.path)} (${file.size} o${file.executable ? ', exécutable' : ''})`),
    '</fichiers>',
    '<scripts>',
    ...(scripts.length === 0 ? ['(aucun)'] : scripts),
    '</scripts>'
  ].join('\n')
}

/**
 * Tâche `skill_audit` par la passerelle (spec 020 US4, constitution III) : Claude **sans outil**, consigne figée
 * (`SkillAuditFrame`), skill balisé comme donnée, sortie au schéma fermé. Jamais mise en file.
 */
export function runSkillAudit(
  gateway: Pick<AIGateway, 'run'>,
  input: AuditInput,
  requestId: string,
  signal?: AbortSignal
): Promise<Result<AIResult<SkillAuditOut>, AIError>> {
  return gateway.run({
    kind: 'skill_audit',
    input: auditInput(input),
    schema: SkillAuditOut,
    requestId,
    noQueue: true,
    ...(signal === undefined ? {} : { signal })
  })
}
