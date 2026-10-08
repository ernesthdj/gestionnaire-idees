import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { SkillCardsView, SkillsView, SkillUsageView } from '@shared/ipc/skills'
import { CRITERIA_LABELS, LINK_KIND_LABELS, SEMANTIC_LINK_KINDS, type SemanticLinkKind } from '@shared/skills/card'
import { QUALITY_CRITERIA } from '@shared/skills/model'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const CARD_QUERIES = [['skillCards'], ['history']] as const

/** Étoiles en icônes, toujours suivies du nombre (jamais l'icône seule). */
export function Stars({ value }: { readonly value: number }): React.JSX.Element {
  return (
    <span>
      <span aria-hidden="true">{'★'.repeat(value)}</span>
      <span aria-hidden="true" className="text-content-muted">
        {'☆'.repeat(5 - value)}
      </span>{' '}
      {value}/5
    </span>
  )
}

const dateFr = (at: number): string => new Date(at).toLocaleDateString('fr-FR')

/**
 * Fiche technique d'un skill (spec 020 US2, T018) : résumé, quand l'utiliser ou l'éviter, déclencheurs, entrées et
 * sorties, exemples, grille en 4 barres justifiées ; corrections de mentalyas (étoiles, domaine, liens de sens), chacune
 * annulable depuis le toast ou l'Historique ; « Analyser » / « Réanalyser ».
 */
export function SkillCardSheet({
  skillId,
  view,
  cards,
  usage,
  onSelect
}: {
  readonly skillId: string
  readonly view: SkillsView
  readonly cards: SkillCardsView | undefined
  readonly usage: SkillUsageView | undefined
  readonly onSelect: (skillId: string) => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const ids = { domain: useId(), target: useId(), kind: useId() }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState('')
  const [kind, setKind] = useState<SemanticLinkKind>('complete')
  const entry = cards?.cards[skillId]
  const names = new Map(view.skills.map((skill) => [skill.id, skill.name]))
  const links = (cards?.links ?? []).filter((link) => link.from === skillId || link.to === skillId)
  const domain = cards?.domains.find((candidate) => candidate.id === entry?.domainId)

  const act = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await action()
      await Promise.all(CARD_QUERIES.map((queryKey) => client.invalidateQueries({ queryKey })))
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'L’action a échoué.')
    } finally {
      setBusy(false)
    }
  }
  const undoable = async (
    channel: 'skills:link' | 'skills:unlink' | 'skills:setStars' | 'skills:setDomain',
    payload: unknown,
    text: string
  ): Promise<void> => {
    const { batchId } = await call<{ batchId: string }>(channel, payload)
    showToast(text, { batchId, undoneText: 'Correction annulée.' })
  }
  const analyze = (): Promise<void> =>
    act(async () => {
      await call('skills:analyze', { skillIds: [skillId] })
      showToast('Analyse lancée : la fiche arrive dans un instant.')
    })

  return (
    <div className="space-y-4">
      <p className="text-xs text-content-muted">
        Usage :{' '}
        {usage === undefined
          ? 'aucun appel sur 30 jours'
          : `${usage.calls30d} appel${usage.calls30d > 1 ? 's' : ''} sur 30 jours, dernier le ${dateFr(usage.lastAt)}`}
      </p>
      {entry === undefined ? (
        <div className="space-y-2 rounded-md border border-content-muted/30 p-3 text-xs">
          <p>Pas encore de fiche technique : Claude la rédige à partir du SKILL.md (sans aucun outil).</p>
          <Button disabled={busy} onClick={() => void analyze()}>
            Analyser ce skill
          </Button>
        </div>
      ) : (
        <>
          {entry.stale ? (
            <p role="note" className="rounded-md border border-amber-600/50 p-2 text-xs">
              Le skill a changé depuis cette fiche : réanalyse-le pour la mettre à jour.
            </p>
          ) : null}
          <p>{entry.card.resume}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-content-muted">Note</dt>
            <dd>
              <Stars value={entry.stars} />
              {entry.starsUser === null ? ' (grille de Claude)' : ` (ta note ; Claude : ${entry.starsClaude}/5)`}
            </dd>
            <dt className="text-content-muted">Domaine</dt>
            <dd>
              {domain?.label ?? '—'}
              {domain?.pending ? ' (proposé par Claude)' : ''}
            </dd>
            <dt className="text-content-muted">Analysé</dt>
            <dd>
              le {dateFr(entry.analyzedAt)} · {entry.model}
            </dd>
          </dl>
          <CardList title="Quand l’utiliser" items={entry.card.quand} />
          <CardList title="Quand l’éviter" items={entry.card.eviter} />
          <CardList title="Déclencheurs" items={entry.card.declencheurs} mono />
          {entry.card.entrees_sorties === '' ? null : (
            <section>
              <h3 className="text-xs font-semibold text-content-muted">Entrées et sorties</h3>
              <p className="text-xs">{entry.card.entrees_sorties}</p>
            </section>
          )}
          <CardList title="Exemples" items={entry.card.exemples} />
          <section aria-label="Grille de qualité" className="space-y-2">
            <h3 className="text-xs font-semibold text-content-muted">Grille de qualité (0 à 5)</h3>
            {QUALITY_CRITERIA.map((criterion) => (
              <div key={criterion} className="text-xs">
                <div className="flex justify-between">
                  <span>{CRITERIA_LABELS[criterion]}</span>
                  <span>{entry.card.grille[criterion]}/5</span>
                </div>
                <div
                  role="meter"
                  aria-label={CRITERIA_LABELS[criterion]}
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={entry.card.grille[criterion]}
                  className="mt-1 h-2 rounded-full bg-surface-raised"
                >
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${(entry.card.grille[criterion] / 5) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-content-muted">{entry.card.justification[criterion]}</p>
              </div>
            ))}
          </section>
        </>
      )}

      <section aria-label="Liens de sens" className="space-y-2">
        <h3 className="text-xs font-semibold text-content-muted">Liens de sens</h3>
        {links.length === 0 ? <p className="text-xs text-content-muted">Aucun.</p> : null}
        <ul className="space-y-1 text-xs">
          {links.map((link) => {
            const other = link.from === skillId ? link.to : link.from
            const label =
              link.from === skillId ? LINK_KIND_LABELS[link.kind] : `${LINK_KIND_LABELS[link.kind]} (depuis)`
            return (
              <li key={link.id} className="flex items-center justify-between gap-2">
                <span>
                  {label}{' '}
                  <button type="button" className="underline" onClick={() => onSelect(other)}>
                    {names.get(other) ?? other}
                  </button>
                  {link.origin === 'claude' ? ' · par Claude' : ''}
                  {link.reason === null ? '' : ` — ${link.reason}`}
                </span>
                <button
                  type="button"
                  aria-label={`Retirer le lien vers ${names.get(other) ?? other}`}
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      undoable('skills:unlink', { linkId: link.id }, 'Lien retiré (Claude ne le reproposera pas).')
                    )
                  }
                  className="h-8 w-8 rounded-md hover:bg-surface-raised"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2 text-xs"
          onSubmit={(event) => {
            event.preventDefault()
            if (target === '') return
            void act(() => undoable('skills:link', { from: skillId, to: target, kind }, 'Lien ajouté.'))
          }}
        >
          <label htmlFor={ids.kind} className="sr-only">
            Sorte de lien
          </label>
          <select
            id={ids.kind}
            value={kind}
            onChange={(event) => setKind(event.target.value as SemanticLinkKind)}
            className="h-8 rounded-md border border-content-muted/30 bg-surface px-1"
          >
            {SEMANTIC_LINK_KINDS.map((option) => (
              <option key={option} value={option}>
                {LINK_KIND_LABELS[option]}
              </option>
            ))}
          </select>
          <label htmlFor={ids.target} className="sr-only">
            Skill lié
          </label>
          <select
            id={ids.target}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="h-8 max-w-48 rounded-md border border-content-muted/30 bg-surface px-1"
          >
            <option value="">Choisir un skill…</option>
            {view.skills
              .filter((skill) => skill.id !== skillId)
              .map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
          </select>
          <Button type="submit" disabled={busy || target === ''}>
            Ajouter le lien
          </Button>
        </form>
      </section>

      {entry === undefined ? null : (
        <section aria-label="Corrections" className="space-y-2 border-t border-content-muted/20 pt-4 text-xs">
          <h3 className="font-semibold text-content-muted">Corriger</h3>
          <fieldset className="flex flex-wrap items-center gap-1">
            <legend className="mb-1">Ta note (prime sur celle de Claude)</legend>
            {[1, 2, 3, 4, 5].map((stars) => (
              <button
                key={stars}
                type="button"
                aria-pressed={entry.starsUser === stars}
                disabled={busy}
                onClick={() => void act(() => undoable('skills:setStars', { skillId, stars }, `Note : ${stars}/5.`))}
                className={`h-8 min-w-8 rounded-md border px-2 ${
                  entry.starsUser === stars ? 'border-accent font-semibold' : 'border-content-muted/30'
                }`}
              >
                {stars} ★
              </button>
            ))}
            {entry.starsUser === null ? null : (
              <button
                type="button"
                disabled={busy}
                className="h-8 px-2 underline"
                onClick={() =>
                  void act(() =>
                    undoable('skills:setStars', { skillId, stars: null }, 'Note rendue à la grille de Claude.')
                  )
                }
              >
                Rendre la main à Claude
              </button>
            )}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={ids.domain}>Domaine</label>
            <select
              id={ids.domain}
              value={entry.domainId ?? ''}
              disabled={busy}
              onChange={(event) =>
                void act(() =>
                  undoable('skills:setDomain', { skillId, domainId: event.target.value }, 'Domaine corrigé.')
                )
              }
              className="h-8 rounded-md border border-content-muted/30 bg-surface px-1"
            >
              {(cards?.domains ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.pending ? ' (proposé)' : ''}
                </option>
              ))}
            </select>
            {domain?.pending ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await call('skills:acceptDomain', { domainId: domain.id })
                  })
                }
              >
                Valider ce domaine
              </Button>
            ) : null}
          </div>
          <Button disabled={busy} onClick={() => void analyze()}>
            Réanalyser
          </Button>
        </section>
      )}
      {error === '' ? null : (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function CardList({
  title,
  items,
  mono = false
}: {
  readonly title: string
  readonly items: readonly string[]
  readonly mono?: boolean
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <section>
      <h3 className="text-xs font-semibold text-content-muted">{title}</h3>
      <ul className={`list-disc pl-5 text-xs ${mono ? 'font-mono' : ''}`}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
