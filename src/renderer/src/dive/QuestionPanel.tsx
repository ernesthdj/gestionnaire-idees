import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../components/atoms/Button'
import type { DiveModel } from './diveModel'
import { MAX_AI_DEPTH } from './diveModel'
import { DocumentBody, useIdeaDocument } from '../hatched/HatchedPanel'
import { AiThinking } from './AiThinking'
import { Gauge } from './Gauge'
import type { FusionActions } from '../fusion/useFusion'
import type { DiveActions } from './useDive'

interface QuestionPanelProps {
  readonly model: DiveModel
  readonly actions: DiveActions
  readonly fusion: FusionActions
  readonly selectedExtensionId: string | null
  readonly onSelectExtension: (extensionId: string) => void
}

/**
 * Panneau latéral de la plongée (FR-014, FR-016) : jauge, question sélectionnée (réponses rapides, texte libre,
 * « Je ne sais pas »), autres questions, « Plus de questions », « Ajouter ma branche », modification du neurone.
 */
export function QuestionPanel({
  model,
  actions,
  fusion,
  selectedExtensionId,
  onSelectExtension
}: QuestionPanelProps): React.JSX.Element {
  const ids = { free: useId(), freeHint: useId(), branch: useId(), edit: useId(), warn: useId(), question: useId() }
  const freeField = useRef<HTMLTextAreaElement>(null)
  /** « Répondre » sans texte : on explique quoi faire plutôt que de griser le bouton (retour de test). */
  const [emptyHint, setEmptyHint] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [branch, setBranch] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const selected = model.extensions.find((extension) => extension.id === selectedExtensionId) ?? model.extensions[0]
  const others = model.extensions.filter((extension) => extension.id !== selected?.id)
  const focus = model.focus
  const disabled = actions.thinking
  const ideaDocument = useIdeaDocument(model.root.id).data ?? null

  // Changer de neurone ciblé referme les formulaires ouverts.
  useEffect(() => {
    setBranch(null)
    setEditing(null)
    setConfirmDelete(false)
    setFreeText('')
  }, [focus.id])

  // Choisir une autre question vide le champ ; un simple rafraîchissement de la liste, jamais.
  useEffect(() => {
    setFreeText('')
    setEmptyHint(false)
  }, [selectedExtensionId])

  const submitFree = (): void => {
    if (disabled) return
    if (freeText.trim() === '') {
      setEmptyHint(true)
      freeField.current?.focus()
      return
    }
    void reply({ text: freeText.trim() })
  }

  const reply = async (answer: Parameters<DiveActions['answer']>[2]): Promise<void> => {
    if (selected === undefined) return
    if (await actions.answer(selected.id, selected.dimension, answer)) setFreeText('')
  }

  return (
    <aside aria-label="Questions de l’IA" className="flex h-full flex-col gap-4 overflow-auto p-4 text-sm">
      <Gauge gauge={model.gauge} />

      {ideaDocument === null ? null : (
        <details className="rounded-lg bg-surface-raised p-3">
          <summary className="cursor-pointer text-xs font-semibold select-none">
            Document de l’idée (cycle précédent)
          </summary>
          <article className="mt-3 space-y-4">
            <DocumentBody document={ideaDocument} />
          </article>
        </details>
      )}

      <LockSection model={model} fusion={fusion} />

      <AiThinking thinking={actions.thinking} searching={actions.searching} worker={actions.worker} />

      {actions.message === null ? null : (
        <div
          role={actions.message.tone === 'error' ? 'alert' : 'status'}
          className="flex items-start justify-between gap-2 rounded-md bg-surface-raised p-2 text-xs"
        >
          <span>{actions.message.text}</span>
          <button type="button" aria-label="Fermer le message" onClick={actions.dismissMessage} className="px-1">
            ×
          </button>
        </div>
      )}

      <section aria-labelledby={ids.question} className="space-y-3 rounded-lg bg-surface-raised p-4">
        {selected === undefined ? (
          <p id={ids.question} className="text-content-muted">
            Pas de question en attente pour ce neurone.
          </p>
        ) : (
          <>
            <h2 id={ids.question} className="text-base font-semibold">
              {selected.question}
            </h2>
            {selected.outsideNature ? (
              <p className="text-xs text-content-muted">Cette question sort un peu de la nature de l’idée.</p>
            ) : null}
            {selected.quickReplies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selected.quickReplies.map((choice) => (
                  <Button key={choice} disabled={disabled} onClick={() => void reply({ choice })}>
                    {choice}
                  </Button>
                ))}
              </div>
            ) : null}
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                submitFree()
              }}
            >
              <label htmlFor={ids.free} className="sr-only">
                Ta réponse
              </label>
              {/* Zone large qui grandit avec le texte puis défile (Entrée envoie, Maj+Entrée va à la ligne). */}
              <textarea
                ref={freeField}
                id={ids.free}
                value={freeText}
                aria-describedby={emptyHint ? ids.freeHint : undefined}
                maxLength={1000}
                rows={3}
                // Figé pendant que l'IA travaille : la question affichée va être remplacée, le texte serait perdu.
                readOnly={disabled}
                onChange={(event) => {
                  setFreeText(event.target.value)
                  setEmptyHint(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submitFree()
                  }
                }}
                placeholder={
                  disabled
                    ? 'L’IA réfléchit… tu pourras répondre dans un instant.'
                    : 'Ta réponse… (Maj+Entrée pour aller à la ligne)'
                }
                className="field-sizing-content max-h-40 min-h-20 w-full resize-none overflow-y-auto rounded-md bg-surface px-2 py-2 leading-5 read-only:cursor-wait read-only:opacity-60"
              />
              <div className="flex items-center justify-end gap-2">
                {emptyHint ? (
                  <p id={ids.freeHint} role="status" className="mr-auto text-xs text-content-muted">
                    Écris ta réponse ou choisis une réponse rapide ci-dessus.
                  </p>
                ) : null}
                <Button type="submit" variant="primary" disabled={disabled}>
                  Répondre
                </Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              <Button disabled={disabled} onClick={() => void reply({ unknown: true })}>
                Je ne sais pas
              </Button>
              <Button disabled={disabled} onClick={() => void actions.dismiss(selected.id)}>
                Écarter la question
              </Button>
            </div>
          </>
        )}
      </section>

      {others.length > 0 ? (
        <section aria-label="Autres questions" className="space-y-2">
          <h3 className="text-xs font-semibold text-content-muted">Autres questions</h3>
          <ul className="space-y-1">
            {others.map((extension) => (
              <li key={extension.id}>
                <button
                  type="button"
                  onClick={() => onSelectExtension(extension.id)}
                  className="w-full rounded-md px-2 py-1 text-left hover:bg-surface-raised"
                >
                  {extension.question}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled || focus.depth >= MAX_AI_DEPTH}
          title={focus.depth >= MAX_AI_DEPTH ? 'Branche trop profonde : crée plutôt une idée distincte' : undefined}
          onClick={() => void actions.more(focus.id)}
        >
          Plus de questions
        </Button>
        <Button onClick={() => setBranch(branch === null ? '' : null)}>Ajouter ma branche</Button>
      </div>

      {branch === null ? null : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (branch.trim() === '') return
            void actions.addBranch(focus.id, branch.trim()).then((ok) => ok && setBranch(null))
          }}
        >
          <label htmlFor={ids.branch} className="sr-only">
            Titre de ta branche
          </label>
          <input
            id={ids.branch}
            autoFocus
            value={branch}
            maxLength={120}
            onChange={(event) => setBranch(event.target.value)}
            placeholder="Ta branche…"
            className="h-8 min-w-0 flex-1 rounded-md bg-surface-raised px-2"
          />
          <Button type="submit" variant="primary" disabled={branch.trim() === ''}>
            Ajouter
          </Button>
        </form>
      )}

      {focus.kind === 'root' ? null : (
        <section aria-label="Ce neurone" className="mt-auto space-y-2 border-t border-content-muted/20 pt-4">
          {editing === null ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing(focus.title)}>Modifier</Button>
              {confirmDelete ? (
                <Button
                  variant="danger"
                  onClick={() => void actions.deleteBranch(focus.id)}
                  aria-describedby={ids.warn}
                >
                  Confirmer la suppression
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => (focus.descendants > 0 ? setConfirmDelete(true) : void actions.deleteBranch(focus.id))}
                >
                  Supprimer
                </Button>
              )}
              {confirmDelete ? (
                <p id={ids.warn} className="w-full text-xs">
                  Ses {focus.descendants} sous-neurone{focus.descendants > 1 ? 's' : ''} seront supprimés aussi.
                </p>
              ) : null}
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (editing.trim() === '') return
                void actions.editBranch(focus.id, editing.trim()).then((ok) => ok && setEditing(null))
              }}
            >
              <label htmlFor={ids.edit} className="sr-only">
                Nouveau titre
              </label>
              <input
                id={ids.edit}
                autoFocus
                value={editing}
                maxLength={120}
                onChange={(event) => setEditing(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md bg-surface-raised px-2"
              />
              <Button type="submit" variant="primary">
                Enregistrer
              </Button>
              <Button onClick={() => setEditing(null)}>Annuler</Button>
            </form>
          )}
        </section>
      )}
    </aside>
  )
}

/**
 * Verrouiller (FR-017) : actif dès « suffisant » ; avant, le moteur refuse (sans appel à l'IA) et l'on affiche
 * les manques avec « Verrouiller quand même » (résultat possiblement non optimal).
 */
function LockSection({
  model,
  fusion
}: {
  readonly model: DiveModel
  readonly fusion: FusionActions
}): React.JSX.Element {
  const ready = model.gauge !== null && model.gauge.level !== 'insufficient'
  const working = fusion.state.kind === 'working'
  if (fusion.state.kind === 'insufficient') {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-content-muted/40 p-3 text-xs">
        <p className="font-semibold">Le contexte est encore insuffisant : le résultat risque de ne pas être optimal.</p>
        {fusion.state.missing.length > 0 ? <p>Il manque : {fusion.state.missing.join(', ')}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void fusion.lock(true)}>
            Verrouiller quand même
          </Button>
          <Button onClick={fusion.cancelWarning}>Continuer à répondre</Button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <Button
        variant={ready ? 'primary' : 'secondary'}
        className="w-full"
        disabled={working}
        onClick={() => void fusion.lock()}
        title={model.root.title}
      >
        {/* Toujours l'idée entière qui éclôt, même quand un sous-neurone est ciblé (retour de test). */}
        <span className="block truncate">Verrouiller « {model.root.title} » 🔒</span>
      </Button>
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-content-muted">
        {working
          ? fusion.state.label
          : ready
            ? `Le contexte suffit : tu peux faire éclore « ${model.root.title} ».`
            : ''}
      </p>
      {fusion.error === null ? null : (
        <p role="alert" className="text-xs">
          {fusion.error}
        </p>
      )}
    </div>
  )
}
