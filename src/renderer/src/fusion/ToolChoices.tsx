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

/** Pourquoi aucun outil : le verdict de Claude, sinon ce que l'application sait. */
function noToolReason(note: string, degraded: boolean): string {
  if (degraded) return 'synthèse faite par l’IA locale, les outils ne sont proposés qu’avec Claude.'
  return note === '' ? 'Claude n’a rien proposé pour cette idée.' : note
}

/**
 * Outils suggérés par Claude avec la synthèse (spec 006 US1) : toujours une ligne de verdict — les outils
 * (décochés, chacun coûte une génération s'il est coché) ou pourquoi il n'y en a pas (contexte insuffisant, idée
 * qui n'en appelle pas, IA locale).
 */
export function ToolChoices({
  tools,
  note,
  degraded,
  chosen,
  disabled,
  onToggle
}: {
  readonly tools: readonly ToolProposal[]
  /** Verdict de Claude en une phrase ; vide s'il n'en a pas donné. */
  readonly note: string
  readonly degraded: boolean
  /** Positions des outils cochés dans `tools`. */
  readonly chosen: readonly number[]
  readonly disabled: boolean
  readonly onToggle: (index: number) => void
}): React.JSX.Element {
  const titleId = useId()
  const count = chosen.length
  if (tools.length === 0) {
    return (
      <section aria-labelledby={titleId} className="rounded-lg border border-content-muted/30 p-3 text-xs">
        <p>
          <span id={titleId} className="font-semibold text-accent">
            Outils suggérés
          </span>
          <span> : aucun — {noToolReason(note, degraded)}</span>
        </p>
      </section>
    )
  }
  return (
    <section aria-labelledby={titleId} className="space-y-2 rounded-lg border border-accent/40 p-3">
      <h3 id={titleId} className="text-xs font-semibold text-accent">
        Outils suggérés
      </h3>
      <p className="text-xs text-content-muted">
        {note === '' ? null : <span className="block text-content">{note}</span>}
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
