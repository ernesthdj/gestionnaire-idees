import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SkillCardsView, SkillDetailView, SkillDraftView, SkillsView, SkillUsageView } from '@shared/ipc/skills'
import { FAMILY_LABELS } from '@shared/skills/model'
import { useUiStore } from '../app/uiStore'
import { ChatPanel } from '../chat/ChatPanel'
import { Markdown } from '../chat/Markdown'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { DraftPanel } from './DraftPanel'
import { SkillCardSheet } from './SkillCardSheet'
import { FAMILY_ICONS } from './SkillNodes'

type Tab = 'fiche' | 'conversation' | 'brouillon' | 'source' | 'fichiers'

const kib = (size: number): string => (size < 1024 ? `${size} o` : `${(size / 1024).toFixed(1).replace('.', ',')} Ko`)

/**
 * Volet d'un skill (spec 020 US1, US3) : fiche, conversation avec Claude (brouillons seulement), brouillon prêt et ses
 * différences, texte source rendu sans HTML, fichiers ; gestes de mentalyas : Revenir, Supprimer, Dupliquer.
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
  const drafts = useQuery({
    queryKey: ['skillDrafts', skillId],
    queryFn: () => call<SkillDraftView[]>('skills:drafts', { skillId })
  })
  const cards = useQuery({ queryKey: ['skillCards'], queryFn: () => call<SkillCardsView>('skills:cards', {}) })
  const usage = useQuery({
    queryKey: ['skillUsage'],
    queryFn: () => call<Record<string, SkillUsageView>>('skills:usage', {})
  })
  const draft = drafts.data?.[0]
  const names = new Map(view.skills.map((skill) => [skill.id, skill.name]))
  const calls = view.links.filter((link) => link.from === skillId)
  const calledBy = view.links.filter((link) => link.to === skillId)
  const detail = query.data
  const tabs: readonly (readonly [Tab, string])[] = [
    ['fiche', 'Fiche'],
    ['conversation', 'Conversation'],
    ...(draft === undefined ? [] : [['brouillon', 'Brouillon prêt'] as const]),
    ['source', 'SKILL.md'],
    ['fichiers', 'Fichiers']
  ]

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
            className="flex flex-wrap gap-1 border-b border-content-muted/20 px-4"
          >
            {tabs.map(([id, label]) => (
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
          {tab === 'conversation' ? (
            <div role="tabpanel" aria-label="Conversation" className="min-h-0 flex-1">
              <SkillConversation skillId={skillId} onClose={() => setTab('fiche')} />
            </div>
          ) : (
            <div
              role="tabpanel"
              aria-label={tabs.find(([id]) => id === tab)?.[1]}
              className="min-h-0 flex-1 overflow-auto text-sm"
              tabIndex={0}
            >
              {tab === 'fiche' ? (
                <div className="space-y-4 p-4">
                  {draft === undefined ? null : (
                    <button
                      type="button"
                      onClick={() => setTab('brouillon')}
                      className="w-full rounded-md border border-accent p-2 text-left text-xs hover:bg-surface-raised"
                    >
                      Brouillon prêt {draft.origin === 'claude' ? '(par Claude)' : ''} : voir les différences et
                      installer
                    </button>
                  )}
                  <p>{detail.skill.description === '' ? 'Pas de description.' : detail.skill.description}</p>
                  {detail.skill.damaged ? (
                    <p role="note" className="rounded-md border border-amber-600/50 p-2 text-xs">
                      Skill abîmé : en-tête absent ou invalide, nom de dossier non conforme ou fichier trop gros. Il
                      reste lisible ; demande à Claude d’en déposer une version corrigée.
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
                  <SkillCardSheet
                    skillId={skillId}
                    view={view}
                    cards={cards.data}
                    usage={usage.data?.[skillId]}
                    onSelect={onSelect}
                  />
                  <LinkList title="Appelle" ids={calls.map((link) => link.to)} names={names} onSelect={onSelect} />
                  <LinkList
                    title="Appelé par"
                    ids={calledBy.map((link) => link.from)}
                    names={names}
                    onSelect={onSelect}
                  />
                  <SkillActions detail={detail} onRemoved={onClose} onDuplicated={() => setTab('fiche')} />
                </div>
              ) : tab === 'brouillon' && draft !== undefined ? (
                <DraftPanel key={draft.id} draftId={draft.id} onDone={() => setTab('fiche')} />
              ) : tab === 'source' ? (
                <div className="p-4">
                  <Markdown text={detail.markdown} />
                </div>
              ) : (
                <ul className="space-y-1 p-4">
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
          )}
        </>
      )}
    </section>
  )
}

/** Conversation d'un skill (ou la générale) : neurone caché créé à la première ouverture. */
export function SkillConversation({
  skillId,
  onClose
}: {
  readonly skillId?: string
  readonly onClose: () => void
}): React.JSX.Element {
  const query = useQuery({
    queryKey: ['skillConversation', skillId ?? '*'],
    queryFn: () => call<{ neuronId: string }>('skills:conversation', skillId === undefined ? {} : { skillId })
  })
  if (query.isError) {
    return (
      <p role="alert" className="p-4 text-sm">
        {query.error instanceof IpcFailure ? query.error.message : 'La conversation n’a pas pu s’ouvrir.'}
      </p>
    )
  }
  if (query.data === undefined) return <p className="p-4 text-sm text-content-muted">Ouverture…</p>
  return <ChatPanel key={query.data.neuronId} neuronId={query.data.neuronId} onClose={onClose} />
}

/** Gestes de mentalyas sur un skill : Revenir, Supprimer (avec confirmation), Dupliquer (plugin). */
function SkillActions({
  detail,
  onRemoved,
  onDuplicated
}: {
  readonly detail: SkillDetailView
  readonly onRemoved: () => void
  readonly onDuplicated: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [confirming, setConfirming] = useState<'restore' | 'remove' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { skill } = detail
  const writable = skill.family !== 'plugin'

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await action()
      await Promise.all(
        [['skills'], ['skill'], ['skillDrafts'], ['history']].map((queryKey) => client.invalidateQueries({ queryKey }))
      )
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'L’action a échoué.')
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  const restore = (): Promise<void> =>
    run(async () => {
      const { batchId } = await call<{ batchId: string }>('skills:restore', { skillId: skill.id, confirm: true })
      showToast(`« ${skill.name} » revient à sa version précédente.`, {
        batchId,
        undoneText: 'Retour annulé.'
      })
    })
  const remove = (): Promise<void> =>
    run(async () => {
      const { batchId } = await call<{ batchId: string }>('skills:remove', { skillId: skill.id, confirm: true })
      showToast(`Skill « ${skill.name} » supprimé (version gardée).`, {
        batchId,
        undoneText: 'Skill rétabli.'
      })
      onRemoved()
    })
  const duplicate = (): Promise<void> =>
    run(async () => {
      await call('skills:duplicate', { skillId: skill.id })
      showToast(`Brouillon personnel « ${skill.name} » créé : installe-le depuis sa fiche.`)
      onDuplicated()
    })

  return (
    <div className="space-y-2 border-t border-content-muted/20 pt-4">
      <h3 className="text-xs font-semibold text-content-muted">Gestes</h3>
      {confirming === null ? (
        <div className="flex flex-wrap gap-2">
          {writable && detail.versions > 0 ? (
            <Button disabled={busy} onClick={() => setConfirming('restore')}>
              Revenir à la version précédente
            </Button>
          ) : null}
          {skill.family === 'plugin' ? (
            <Button disabled={busy} onClick={() => void duplicate()}>
              Dupliquer en skill personnel
            </Button>
          ) : null}
          {writable ? (
            <Button variant="danger" disabled={busy} onClick={() => setConfirming('remove')}>
              Supprimer…
            </Button>
          ) : (
            <p className="text-xs text-content-muted">Skill de plugin : lecture seule.</p>
          )}
        </div>
      ) : (
        <div role="alert" className="space-y-2 rounded-md border border-red-500/40 p-2 text-xs">
          <p>
            {confirming === 'remove'
              ? `Supprimer « ${skill.name} » ? Claude Code ne le verra plus. Une version est gardée : « Annuler » ou l’Historique le rétablit.`
              : `Rétablir la version précédente de « ${skill.name} » ? La version actuelle est gardée.`}
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" autoFocus onClick={() => setConfirming(null)}>
              Garder
            </Button>
            <Button
              variant={confirming === 'remove' ? 'danger' : 'primary'}
              className="flex-1"
              disabled={busy}
              onClick={() => void (confirming === 'remove' ? remove() : restore())}
            >
              {confirming === 'remove' ? 'Supprimer' : 'Revenir'}
            </Button>
          </div>
        </div>
      )}
      {error === '' ? null : (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
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
