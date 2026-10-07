import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { SkillDetailView, SkillsView } from '@shared/ipc/skills'
import { FAMILY_LABELS } from '@shared/skills/model'
import { Markdown } from '../chat/Markdown'
import { call, IpcFailure } from '../lib/ipc'
import { FAMILY_ICONS } from './SkillNodes'

type Tab = 'fiche' | 'source' | 'fichiers'

const TABS: readonly (readonly [Tab, string])[] = [
  ['fiche', 'Fiche'],
  ['source', 'SKILL.md'],
  ['fichiers', 'Fichiers']
]

const kib = (size: number): string => (size < 1024 ? `${size} o` : `${(size / 1024).toFixed(1).replace('.', ',')} Ko`)

/**
 * Volet d'un skill (spec 020 US1-4) : fiche (au lot A : description, origine, repères, liens écrits), texte source
 * rendu sans HTML, liste des fichiers. Lecture seule.
 */
export function SkillPanel({
  skillId,
  view,
  onSelect,
  onClose
}: {
  readonly skillId: string
  readonly view: SkillsView
  readonly onSelect: (skillId: string) => void
  readonly onClose: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('fiche')
  const query = useQuery({
    queryKey: ['skill', skillId],
    queryFn: () => call<SkillDetailView>('skills:get', { skillId })
  })
  const names = new Map(view.skills.map((skill) => [skill.id, skill.name]))
  const calls = view.links.filter((link) => link.from === skillId)
  const calledBy = view.links.filter((link) => link.to === skillId)
  const detail = query.data

  return (
    <section aria-label="Fiche du skill" className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-content-muted/20 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{detail?.skill.name ?? names.get(skillId) ?? skillId}</h2>
          {detail === undefined ? null : (
            <p className="text-xs text-content-muted">
              <span aria-hidden="true">{FAMILY_ICONS[detail.skill.family]}</span> {FAMILY_LABELS[detail.skill.family]} ·{' '}
              {detail.skill.origin}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="h-8 w-8 rounded-md hover:bg-surface-raised"
        >
          ✕
        </button>
      </header>
      {query.isError ? (
        <p role="alert" className="p-4 text-sm">
          {query.error instanceof IpcFailure ? query.error.message : 'Le skill n’a pas pu être lu.'}
        </p>
      ) : detail === undefined ? (
        <p className="p-4 text-sm text-content-muted">Lecture du skill…</p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Contenu du skill"
            className="flex gap-1 border-b border-content-muted/20 px-4"
          >
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`h-10 px-3 text-sm ${tab === id ? 'border-b-2 border-accent font-semibold' : 'text-content-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            aria-label={TABS.find(([id]) => id === tab)?.[1]}
            className="min-h-0 flex-1 overflow-auto p-4 text-sm"
            tabIndex={0}
          >
            {tab === 'fiche' ? (
              <div className="space-y-4">
                <p>{detail.skill.description === '' ? 'Pas de description.' : detail.skill.description}</p>
                {detail.skill.damaged ? (
                  <p role="note" className="rounded-md border border-amber-600/50 p-2 text-xs">
                    Skill abîmé : en-tête absent ou invalide, nom de dossier non conforme ou fichier trop gros. Il reste
                    lisible mais ne pourra pas être modifié depuis l’app.
                  </p>
                ) : null}
                {detail.skill.hasScripts ? (
                  <p role="note" className="rounded-md border border-amber-600/50 p-2 text-xs">
                    ⚠ Ce skill contient des scripts (voir l’onglet Fichiers). L’app ne les exécute jamais.
                  </p>
                ) : null}
                {detail.skill.sameNameAs.length > 0 ? (
                  <p className="text-xs text-content-muted">
                    Même nom qu’un autre skill : {detail.skill.sameNameAs.map((id) => id.split(':')[0]).join(', ')}.
                  </p>
                ) : null}
                <LinkList title="Appelle" ids={calls.map((link) => link.to)} names={names} onSelect={onSelect} />
                <LinkList
                  title="Appelé par"
                  ids={calledBy.map((link) => link.from)}
                  names={names}
                  onSelect={onSelect}
                />
              </div>
            ) : tab === 'source' ? (
              <Markdown text={detail.markdown} />
            ) : (
              <ul className="space-y-1">
                {detail.files.map((file) => (
                  <li key={file.path} className="flex justify-between gap-2 font-mono text-xs">
                    <span className="truncate">
                      {file.executable ? <span title="Fichier exécutable">⚠ </span> : null}
                      {file.path}
                    </span>
                    <span className="shrink-0 text-content-muted">{kib(file.size)}</span>
                  </li>
                ))}
                {detail.filesTruncated ? <li className="text-content-muted">… liste tronquée</li> : null}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function LinkList({
  title,
  ids,
  names,
  onSelect
}: {
  readonly title: string
  readonly ids: readonly string[]
  readonly names: ReadonlyMap<string, string>
  readonly onSelect: (skillId: string) => void
}): React.JSX.Element {
  return (
    <div>
      <h3 className="text-xs font-semibold text-content-muted">{title}</h3>
      {ids.length === 0 ? (
        <p className="text-xs text-content-muted">Aucun.</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1">
          {ids.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="h-8 rounded-full bg-surface-raised px-3 text-xs hover:ring-1 hover:ring-accent"
              >
                {names.get(id) ?? id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
