import { createHash } from 'node:crypto'
import { z } from 'zod'
import { applyDeterministicRules } from '../ai/anonymizationRules'
import type { Result } from '../ai/types'

/** Seuls fichiers reconnus dans le dossier d'import (contracts/ipc-ai.md § Contrat fichier). */
export const CONTEXT_FILES = ['profile.md', 'rules.md', 'examples.json'] as const
export type ContextFile = (typeof CONTEXT_FILES)[number]

export const MAX_CONTEXT_FILE_BYTES = 50 * 1024

const Manifest = z.object({
  schemaVersion: z.literal(1),
  author: z.string().min(1).max(60),
  createdAt: z.string().min(1).max(40),
  files: z.array(z.enum(CONTEXT_FILES)).min(1).max(CONTEXT_FILES.length),
  sha256: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/))
})

export const ImportedExample = z
  .object({
    // Type de tâche libre : un paquet écrit pour une version précédente reste importable ; ses exemples d'une
    // tâche retirée ne sont simplement jamais utilisés.
    taskKind: z.string().regex(/^[a-z_]{1,40}$/),
    polarity: z.enum(['positive', 'negative']),
    input: z.string().min(1).max(2000),
    output: z.unknown(),
    reason: z.string().min(1).max(300).optional()
  })
  .strict()
export type ImportedExample = z.infer<typeof ImportedExample>

const ExamplesFile = z.array(ImportedExample).max(60)

export interface ContextBundle {
  readonly files: readonly ContextFile[]
  readonly profile?: string
  readonly rules?: string
  readonly examples?: readonly ImportedExample[]
}

/** Vrai si le texte contient une donnée que l'anonymisation masquerait (e-mail, téléphone, IBAN, montant, adresse…). */
export function containsPersonalData(text: string): boolean {
  return applyDeterministicRules(text) !== text
}

/**
 * Valide un paquet de contexte déposé par Claude Code : manifeste, fichiers annoncés présents, taille,
 * empreintes SHA-256, absence de données personnelles dans le profil et les règles, format des exemples.
 * Le profil est envoyé tel quel à Claude (non anonymisé) : il ne doit contenir aucune donnée personnelle.
 */
export function validateContextBundle(
  manifestText: string,
  read: (file: ContextFile) => Buffer | null
): Result<ContextBundle, string> {
  let raw: unknown
  try {
    raw = JSON.parse(manifestText)
  } catch {
    return { ok: false, error: 'Manifeste illisible (JSON invalide)' }
  }
  const manifest = Manifest.safeParse(raw)
  if (!manifest.success) return { ok: false, error: 'Manifeste invalide (format ou version non reconnus)' }

  const texts: Partial<Record<ContextFile, string>> = {}
  for (const file of new Set(manifest.data.files)) {
    const content = read(file)
    if (content === null) return { ok: false, error: `Fichier annoncé absent : ${file}` }
    if (content.byteLength > MAX_CONTEXT_FILE_BYTES) return { ok: false, error: `${file} dépasse 50 Ko` }
    const digest = createHash('sha256').update(content).digest('hex')
    if (manifest.data.sha256[file] !== digest) return { ok: false, error: `Empreinte incorrecte : ${file}` }
    texts[file] = content.toString('utf8')
  }

  for (const file of ['profile.md', 'rules.md'] as const) {
    const text = texts[file]
    if (text !== undefined && containsPersonalData(text)) {
      return {
        ok: false,
        error: `Données personnelles détectées dans ${file} (e-mail, téléphone, IBAN, montant ou adresse) : import refusé`
      }
    }
  }

  let examples: readonly ImportedExample[] | undefined
  if (texts['examples.json'] !== undefined) {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(texts['examples.json'])
    } catch {
      return { ok: false, error: "Fichier d'exemples invalide (JSON)" }
    }
    const parsed = ExamplesFile.safeParse(parsedJson)
    if (!parsed.success) return { ok: false, error: "Fichier d'exemples invalide (format)" }
    const leaking = parsed.data.some((example) =>
      containsPersonalData([example.input, example.reason ?? '', JSON.stringify(example.output)].join(' '))
    )
    if (leaking) {
      return { ok: false, error: 'Données personnelles détectées dans examples.json : import refusé' }
    }
    examples = parsed.data
  }

  return {
    ok: true,
    value: {
      files: [...new Set(manifest.data.files)],
      ...(texts['profile.md'] === undefined ? {} : { profile: texts['profile.md'] }),
      ...(texts['rules.md'] === undefined ? {} : { rules: texts['rules.md'] }),
      ...(examples === undefined ? {} : { examples })
    }
  }
}
