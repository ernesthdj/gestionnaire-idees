import { useId, useState } from 'react'
import type { ActionPlanOut, ReflectionSummaryOut } from '@shared/ai/neurons'
import type { ConfirmView, SynthesisPatch } from '@shared/ipc/neurons'
import { Button } from '../components/atoms/Button'
import { formatEuros } from '../pages/settings/ai/format'
import type { FusionActions } from './useFusion'

type PlanNode = ActionPlanOut['nodes'][number]

/** « 249,90 » → 24990 centimes ; vide → `null` (effacer) ; invalide → `undefined`. */
export function parseAmount(input: string): number | null | undefined {
  const trimmed = input.trim().replace(/\s|€/g, '')
  if (trimmed === '') return null
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(trimmed)) return undefined
  return Math.round(Number(trimmed.replace(',', '.')) * 100)
}

const centsToInput = (cents: number | undefined): string =>
  cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')

const NODE_ICONS = { task: '☐', condition: '◆', opportunity: '✦' } as const
const NODE_LABELS = { task: 'Tâche', condition: 'Condition', opportunity: 'Opportunité' } as const

interface EditorProps {
  readonly busy: boolean
  readonly onSave: (patch: SynthesisPatch) => Promise<boolean>
}

function PlanItem({
  node,
  plan,
  ...editor
}: { readonly node: PlanNode; readonly plan: ActionPlanOut } & EditorProps): React.JSX.Element {
  const ids = { title: useId(), amount: useId(), date: useId() }
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(node.title)
  const [amount, setAmount] = useState(centsToInput(node.amountCents))
  const [date, setDate] = useState(node.dueDate ?? '')
  const [invalid, setInvalid] = useState(false)
  const children = plan.nodes.filter((child) => child.parentRef === node.ref)
  const after = plan.dependencies
    .filter((dependency) => dependency.toRef === node.ref)
    .map((dependency) => {
      const from = plan.nodes.find((entry) => entry.ref === dependency.fromRef)?.title ?? dependency.fromRef
      return dependency.kind === 'on_trigger' ? `quand : ${dependency.triggerLabel ?? from}` : `après « ${from} »`
    })

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const cents = parseAmount(amount)
    if (cents === undefined || title.trim() === '') {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const ok = await editor.onSave({
      ref: node.ref,
      title: title.trim(),
      amountCents: cents,
      dueDate: date === '' ? null : date
    })
    if (ok) setEditing(false)
  }

  return (
    <li className="space-y-1">
      {editing ? (
        <form onSubmit={(event) => void save(event)} className="space-y-2 rounded-md bg-surface p-2">
          <label htmlFor={ids.title} className="block text-xs text-content-muted">
            Titre
          </label>
          <input
            id={ids.title}
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            className="h-8 w-full rounded-md bg-surface-raised px-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={ids.amount} className="block text-xs text-content-muted">
                Montant (€)
              </label>
              <input
                id={ids.amount}
                inputMode="decimal"
                value={amount}
                aria-invalid={invalid}
                onChange={(event) => setAmount(event.target.value)}
                className="h-8 w-full rounded-md bg-surface-raised px-2"
              />
            </div>
            <div>
              <label htmlFor={ids.date} className="block text-xs text-content-muted">
                Date
              </label>
              <input
                id={ids.date}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-8 w-full rounded-md bg-surface-raised px-2"
              />
            </div>
          </div>
          {invalid ? (
            <p role="alert" className="text-xs">
              Titre obligatoire ; montant en euros, ex. 249,90.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={editor.busy}>
              Enregistrer
            </Button>
            <Button onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p>
            <span aria-hidden="true" className="mr-1">
              {NODE_ICONS[node.type]}
            </span>
            <span className="sr-only">{NODE_LABELS[node.type]} : </span>
            {node.branchLabel === undefined ? null : <span className="font-semibold">{node.branchLabel} → </span>}
            {node.title}
            {node.question === undefined ? null : <span className="text-content-muted"> ({node.question})</span>}
            {node.amountCents === undefined ? null : (
              <span className="ml-1 text-content-muted">· {formatEuros(node.amountCents)}</span>
            )}
            {node.dueDate === undefined ? null : <span className="ml-1 text-content-muted">· {node.dueDate}</span>}
            {node.investigation === true ? <span className="ml-1 text-xs">· à trouver</span> : null}
            {after.length > 0 ? <span className="block text-xs text-content-muted">{after.join(' · ')}</span> : null}
          </p>
          <Button className="shrink-0" onClick={() => setEditing(true)} aria-label={`Modifier : ${node.title}`}>
            Modifier
          </Button>
        </div>
      )}
      {children.length > 0 ? (
        <ul className="ml-4 space-y-1 border-l border-content-muted/30 pl-3">
          {children.map((child) => (
            <PlanItem key={child.ref} node={child} plan={plan} {...editor} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function PointItem({
  refId,
  text,
  ...editor
}: { readonly refId: string; readonly text: string } & EditorProps): React.JSX.Element {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text)
  if (editing) {
    return (
      <li>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (value.trim() === '') return
            void editor.onSave({ ref: refId, text: value.trim() }).then((ok) => ok && setEditing(false))
          }}
        >
          <label htmlFor={id} className="sr-only">
            Texte du point
          </label>
          <input
            id={id}
            value={value}
            maxLength={300}
            onChange={(event) => setValue(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md bg-surface px-2"
          />
          <Button type="submit" variant="primary" disabled={editor.busy}>
            Enregistrer
          </Button>
        </form>
      </li>
    )
  }
  return (
    <li className="flex items-start justify-between gap-2">
      <p>{text}</p>
      <Button className="shrink-0" onClick={() => setEditing(true)} aria-label={`Modifier : ${text}`}>
        Modifier
      </Button>
    </li>
  )
}

const SECTIONS = [
  ['keyPoints', 'Points clés'],
  ['decisions', 'Décisions'],
  ['pros', 'Pour'],
  ['cons', 'Contre'],
  ['openQuestions', 'Questions ouvertes']
] as const

function ReflectionContent({
  summary,
  ...editor
}: { readonly summary: ReflectionSummaryOut } & EditorProps): React.JSX.Element {
  return (
    <>
      {SECTIONS.map(([section, label]) =>
        summary[section].length === 0 ? null : (
          <section key={section} aria-label={label} className="space-y-1">
            <h3 className="text-xs font-semibold text-content-muted">{label}</h3>
            <ul className="space-y-1">
              {summary[section].map((point, index) => (
                <PointItem key={`${section}.${index}`} refId={`${section}.${index}`} text={point.text} {...editor} />
              ))}
            </ul>
          </section>
        )
      )}
    </>
  )
}

/**
 * Aperçu de synthèse (FR-018) : plan d'action ou synthèse de réflexion, corrigeable élément par élément,
 * Réviser (consigne) / Refuser / Confirmer. Un aperçu périmé n'est pas confirmable.
 */
export function SynthesisPreview({
  fusion,
  onConfirmed
}: {
  readonly fusion: FusionActions
  readonly onConfirmed: (confirmed: ConfirmView) => void
}): React.JSX.Element | null {
  const ids = { title: useId(), instruction: useId() }
  const [instruction, setInstruction] = useState<string | null>(null)
  const synthesis = fusion.synthesis
  if (synthesis === null) return null
  const busy = fusion.state.kind === 'working'
  const editor: EditorProps = { busy, onSave: (patch) => fusion.edit(patch) }

  return (
    <section aria-labelledby={ids.title} className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
      <h2 id={ids.title} className="text-base font-semibold">
        {synthesis.type === 'action_plan' ? 'Aperçu du plan d’action' : 'Aperçu de la synthèse'}
      </h2>
      <p className="text-xs text-content-muted">Rien n’est appliqué avant « Confirmer ». Corrige ce qui ne va pas.</p>
      {synthesis.forced ? (
        <p role="note" className="rounded-md bg-surface-raised p-2 text-xs">
          Verrouillé avant que le contexte soit suffisant : le résultat risque de ne pas être optimal.
        </p>
      ) : null}
      {synthesis.degraded ? (
        <p role="note" className="rounded-md bg-surface-raised p-2 text-xs">
          Produit par l’IA locale (Claude indisponible) : qualité moindre, relis-le bien.
        </p>
      ) : null}
      {fusion.stale ? (
        <div role="alert" className="space-y-2 rounded-md bg-surface-raised p-2 text-xs">
          <p>L’idée a changé depuis cet aperçu : il ne peut plus être confirmé.</p>
          <Button disabled={busy} onClick={() => void fusion.lock()}>
            Régénérer l’aperçu
          </Button>
        </div>
      ) : null}
      {fusion.error === null ? null : (
        <p role="alert" className="text-xs">
          {fusion.error}
        </p>
      )}

      <div className="space-y-3 rounded-lg bg-surface-raised p-4">
        {synthesis.type === 'action_plan' ? (
          <>
            <ul className="space-y-2">
              {synthesis.plan.nodes
                .filter((node) => node.parentRef === undefined)
                .map((node) => (
                  <PlanItem key={node.ref} node={node} plan={synthesis.plan} {...editor} />
                ))}
            </ul>
            {synthesis.plan.gaps.length > 0 ? (
              <section aria-label="À trouver" className="space-y-1">
                <h3 className="text-xs font-semibold text-content-muted">À trouver</h3>
                <ul className="list-disc pl-5">
                  {synthesis.plan.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <ReflectionContent summary={synthesis.summary} {...editor} />
        )}
      </div>

      {instruction === null ? null : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (instruction.trim() === '') return
            void fusion.revise(instruction.trim()).then(() => setInstruction(null))
          }}
        >
          <label htmlFor={ids.instruction} className="block text-xs text-content-muted">
            Consigne pour la révision
          </label>
          <textarea
            id={ids.instruction}
            autoFocus
            rows={2}
            maxLength={500}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Ex. : sépare l’achat et l’installation"
            className="w-full resize-none rounded-md bg-surface-raised p-2"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={busy || instruction.trim() === ''}>
              Envoyer
            </Button>
            <Button onClick={() => setInstruction(null)}>Annuler</Button>
          </div>
        </form>
      )}

      <p role="status" aria-live="polite" className="min-h-4 text-xs text-content-muted">
        {fusion.state.kind === 'working' ? fusion.state.label : ''}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button disabled={busy || fusion.stale} onClick={() => setInstruction('')}>
          Réviser
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void fusion.reject()}>
          Refuser
        </Button>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={busy || fusion.stale}
          onClick={() => {
            void fusion.confirm().then((confirmed) => {
              if (confirmed !== null) onConfirmed(confirmed)
            })
          }}
        >
          Confirmer
        </Button>
      </div>
    </section>
  )
}
