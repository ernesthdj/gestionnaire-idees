import { useEffect, useId, useState } from 'react'
import { Button } from '../components/atoms/Button'
import { IpcFailure } from '../lib/ipc'
import type { Replay, ReplayMark } from './useReplay'

/** Glyphe texte (U+FE0E) : sans lui, Windows dessine ▶ en emoji. */
const glyph = (symbols: string): string => [...symbols].map((symbol) => `${symbol}︎`).join('')
const dateText = (iso: string): string => new Date(iso).toLocaleDateString('fr-BE', { dateStyle: 'medium' })

/** Pastille d'auteur : couleur ET initiales (jamais la couleur seule). */
export function AuthorChip({ mark }: { readonly mark: ReplayMark | null }): React.JSX.Element {
  return mark === null ? (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-content-muted text-[10px] text-content-muted"
    >
      —
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ background: mark.author.color }}
    >
      {mark.author.initials}
    </span>
  )
}

/**
 * Barre de la rediffusion (spec 021 US5 lot 2, L4g E6) en bas de l'explorateur : ◀◀ ▶ ▶▶ et le curseur des commits,
 * la date et la position, la légende des auteurs, le mode « principal » / « dernier », le poids (« par lignes » ou
 * « par commits » avec « Tout télécharger » pour un clone partiel), les parts du nœud choisi, « Quitter » ou `Échap`.
 */
export function ReplayBar({
  replay,
  selected,
  selectedTitle,
  onQuit
}: {
  readonly replay: Replay
  /** Marque du nœud choisi (parts d'auteurs) ; `undefined` : aucun nœud choisi. */
  readonly selected: ReplayMark | null | undefined
  readonly selectedTitle: string | null
  readonly onQuit: () => void
}): React.JSX.Element {
  const ids = { cursor: useId(), mode: useId() }
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onQuit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onQuit])
  const { steps, commit, at } = replay
  const total = steps?.commits.length ?? 0
  const error = replay.error
  return (
    <section
      aria-label="Rediffusion"
      className="flex flex-col gap-2 border-t border-content-muted/20 px-4 py-2 text-xs"
    >
      {steps === undefined ? (
        <p className="text-content-muted">{error === null ? 'Lecture de l’historique…' : ''}</p>
      ) : total === 0 ? (
        <p className="text-content-muted">Aucun commit à rejouer.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button aria-label="Premier commit" onClick={() => replay.seek(0)}>
              {glyph('◀◀')}
            </Button>
            {replay.playing ? (
              <Button aria-label="Pause" onClick={replay.pause}>
                {glyph('⏸')}
              </Button>
            ) : (
              <Button aria-label="Lire" onClick={replay.play}>
                {glyph('▶')}
              </Button>
            )}
            <Button aria-label="Dernier commit" onClick={() => replay.seek(total - 1)}>
              {glyph('▶▶')}
            </Button>
            <label htmlFor={ids.cursor} className="sr-only">
              Commit rejoué
            </label>
            <input
              id={ids.cursor}
              type="range"
              min={0}
              max={total - 1}
              value={at}
              aria-valuetext={commit === null ? '' : `${dateText(commit.date)}, commit ${at + 1} sur ${total}`}
              onChange={(event) => replay.seek(Number(event.target.value))}
              className="min-w-40 flex-1"
            />
            <span className="tabular-nums" aria-live="polite">
              {commit === null ? '' : dateText(commit.date)} · {at + 1}/{total}
              {steps.more ? ' (derniers commits)' : ''}
            </span>
            <Button onClick={onQuit}>Quitter la rediffusion</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ul aria-label="Légende des auteurs" className="flex flex-wrap gap-2">
              {steps.authors.map((author) => (
                <li key={author.key} className="flex items-center gap-1">
                  <AuthorChip mark={{ author, shares: [] }} />
                  {author.name}
                </li>
              ))}
              <li className="flex items-center gap-1 text-content-muted">
                <AuthorChip mark={null} /> jamais touché
              </li>
            </ul>
            <fieldset className="flex items-center gap-2">
              <legend className="sr-only">Auteur montré</legend>
              {(['main', 'last'] as const).map((value) => (
                <label key={value} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={ids.mode}
                    checked={replay.mode === value}
                    onChange={() => replay.setMode(value)}
                  />
                  {value === 'main' ? 'principal' : 'dernier'}
                </label>
              ))}
            </fieldset>
            <span className="text-content-muted">{steps.weight === 'lines' ? 'par lignes' : 'par commits'}</span>
            {steps.weight === 'commits' ? (
              confirming ? (
                <span className="flex items-center gap-1">
                  Télécharger tout l’historique (peut être long) ?
                  <Button
                    disabled={replay.fetchAll.isPending}
                    onClick={() => replay.fetchAll.mutate(undefined, { onSettled: () => setConfirming(false) })}
                  >
                    {replay.fetchAll.isPending ? 'Téléchargement…' : 'Confirmer'}
                  </Button>
                  <Button onClick={() => setConfirming(false)}>Non</Button>
                </span>
              ) : (
                <Button onClick={() => setConfirming(true)}>Tout télécharger</Button>
              )
            ) : null}
          </div>
          {selected === undefined || selectedTitle === null ? null : (
            <p aria-label="Parts des auteurs">
              <span className="font-semibold">{selectedTitle}</span> :{' '}
              {selected === null || selected.shares.length === 0
                ? 'jamais touché jusqu’ici'
                : selected.shares.map((share) => `${share.author.initials} ${share.percent} %`).join(' · ')}
            </p>
          )}
        </>
      )}
      {error === null ? null : (
        <p role="alert" className="text-con">
          {error instanceof IpcFailure ? error.message : 'La rediffusion a échoué.'}
        </p>
      )}
    </section>
  )
}
