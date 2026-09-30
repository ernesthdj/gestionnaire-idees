import { useId } from 'react'
import type { ToolProposal } from '@shared/ai/neurons'
import type { IdeaPart } from '@shared/ipc/widgetIo'

const PART_NAMES: Readonly<Record<IdeaPart, string>> = {
  identity: 'titre et état',
  original: 'texte d’origine',
  answers: 'questions et réponses',
  tree: 'sous-neurones',
  document: 'document'
}

function reads(tool: ToolProposal): string {
  const parts =
    tool.parts.length === 0 ? 'ne lit rien de l’idée' : `lit : ${tool.parts.map((part) => PART_NAMES[part]).join(', ')}`
  return tool.producesResult ? `${parts} · produit un résultat` : parts
}

/**
 * Outils proposés par Claude avec la synthèse (spec 006 US1) : décochés par défaut. Chaque outil coché sera
 * fabriqué à l'éclosion, branché sur l'idée — une génération Claude par outil.
 */
export function ToolChoices({
  tools,
  chosen,
  disabled,
  onToggle
}: {
  readonly tools: readonly ToolProposal[]
  /** Positions des outils cochés dans `tools`. */
  readonly chosen: readonly number[]
  readonly disabled: boolean
  readonly onToggle: (index: number) => void
}): React.JSX.Element {
  const titleId = useId()
  const count = chosen.length
  return (
    <section aria-labelledby={titleId} className="space-y-2 rounded-lg border border-accent/40 p-3">
      <h3 id={titleId} className="text-xs font-semibold text-accent">
        Outils proposés
      </h3>
      <p className="text-xs text-content-muted">
        Coche ceux que tu veux : Claude les fabriquera à l’éclosion, branchés sur l’idée. Tu relis chaque outil avant
        qu’il lise quoi que ce soit.
      </p>
      <ul className="space-y-2">
        {tools.map((tool, index) => (
          <li key={`${index}-${tool.title}`}>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={chosen.includes(index)}
                disabled={disabled}
                onChange={() => onToggle(index)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block font-semibold">{tool.title}</span>
                <span className="block">{tool.description}</span>
                <span className="block text-xs text-content-muted">{reads(tool)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="text-xs text-content-muted">
        {count === 0
          ? 'Aucun outil coché : aucune génération.'
          : `${count} outil${count > 1 ? 's' : ''} coché${count > 1 ? 's' : ''} : ${count} génération${count > 1 ? 's' : ''} Claude à la confirmation.`}
      </p>
    </section>
  )
}
