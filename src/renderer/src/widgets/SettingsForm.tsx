import { useId } from 'react'
import type { SettingField, SettingValue, SettingValues } from '@shared/widgets/settings'

const FIELD = 'w-full rounded-md border border-content-muted/30 bg-surface px-2 py-1 text-xs'

/** Un réglage : libellé, contrôle selon son type, aide. Les textes viennent du widget : affichés comme du texte. */
function Field({
  field,
  value,
  onChange
}: {
  readonly field: SettingField
  readonly value: SettingValue | undefined
  readonly onChange: (value: SettingValue) => void
}) {
  const id = useId()
  const help = field.help === undefined ? undefined : `${id}-aide`
  const label = (
    <label htmlFor={id} className="text-xs font-medium">
      {field.label}
    </label>
  )
  const control = (() => {
    switch (field.type) {
      case 'text':
        return (
          <input
            id={id}
            type="text"
            value={typeof value === 'string' ? value : ''}
            aria-describedby={help}
            onChange={(event) => onChange(event.target.value)}
            className={FIELD}
          />
        )
      case 'textarea':
        return (
          <textarea
            id={id}
            rows={3}
            value={typeof value === 'string' ? value : ''}
            aria-describedby={help}
            onChange={(event) => onChange(event.target.value)}
            className={`${FIELD} resize-y`}
          />
        )
      case 'select':
        return (
          <select
            id={id}
            value={typeof value === 'string' ? value : ''}
            aria-describedby={help}
            onChange={(event) => onChange(event.target.value)}
            className={FIELD}
          >
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      case 'toggle':
        return (
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            aria-describedby={help}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        )
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="color"
              value={typeof value === 'string' ? value : '#000000'}
              aria-describedby={help}
              onChange={(event) => onChange(event.target.value)}
              className="h-7 w-10 rounded border border-content-muted/30 bg-surface"
            />
            <span className="font-mono text-xs text-content-muted">{typeof value === 'string' ? value : ''}</span>
          </div>
        )
      case 'range':
        return (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={typeof value === 'number' ? value : field.min}
              aria-describedby={help}
              onChange={(event) => onChange(Number(event.target.value))}
              className="min-w-0 flex-1 accent-accent"
            />
            <output htmlFor={id} className="w-10 text-right font-mono text-xs">
              {typeof value === 'number' ? value : ''}
            </output>
          </div>
        )
    }
  })()
  return (
    <div className={field.type === 'toggle' ? 'flex flex-row-reverse items-center justify-end gap-2' : 'space-y-1'}>
      {label}
      {control}
      {help === undefined ? null : (
        <p id={help} className="basis-full text-xs text-content-muted">
          {field.help}
        </p>
      )}
    </div>
  )
}

/**
 * Panneau de réglages d'un widget (spec 026 D7), dessiné par l'application à partir de ce que le widget déclare :
 * réglages regroupés dans l'ordre de la déclaration, « Réinitialiser » pour revenir aux valeurs par défaut.
 */
export function SettingsForm({
  fields,
  values,
  onChange,
  onReset
}: {
  readonly fields: readonly SettingField[]
  readonly values: SettingValues
  readonly onChange: (key: string, value: SettingValue) => void
  readonly onReset: () => void
}): React.JSX.Element {
  const groups: { readonly name: string | null; readonly fields: SettingField[] }[] = []
  for (const field of fields) {
    const name = field.group ?? null
    const last = groups.at(-1)
    if (last !== undefined && last.name === name) last.fields.push(field)
    else groups.push({ name, fields: [field] })
  }
  return (
    <div className="space-y-3 p-3">
      {groups.map((group, index) => (
        <fieldset key={`${group.name ?? ''}-${index}`} className="space-y-2">
          {group.name === null ? null : (
            <legend className="mb-1 text-xs font-semibold tracking-wide text-content-muted uppercase">
              {group.name}
            </legend>
          )}
          {group.fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(value) => onChange(field.key, value)}
            />
          ))}
        </fieldset>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="h-7 rounded-md border border-content-muted/30 px-2 text-xs hover:border-accent"
      >
        Réinitialiser
      </button>
    </div>
  )
}
