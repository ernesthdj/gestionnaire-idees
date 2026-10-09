import { useEffect, useId, useRef, useState } from 'react'
import type { CodeLang, Confidentiality, ImportPreviewView } from '@shared/ipc/reprise'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const LANG_NAMES: Readonly<Record<CodeLang, string>> = {
  ts: 'TypeScript',
  tsx: 'TypeScript (TSX)',
  js: 'JavaScript',
  cs: 'C#',
  php: 'PHP',
  other: 'Autres'
}

/** Niveaux de confidentialité d'un projet repris (spec 017 FR-005), aussi proposés au clone par lien (spec 021 US3). */
export const CHOICES: readonly { readonly level: Confidentiality; readonly title: string; readonly detail: string }[] =
  [
    {
      level: 'claude',
      title: 'Claude autorisé',
      detail: 'Analyse complète : Claude peut lire le code, rédiger le guide et en discuter avec toi.'
    },
    {
      level: 'local',
      title: 'Local uniquement',
      detail: 'Rien de ce projet ne sort de ta machine : le modèle local fait le travail d’IA (ou il n’est pas fait).'
    }
  ]

interface ImportWizardProps {
  readonly onClose: () => void
  /** Genesis « projet repris » créé. */
  readonly onImported: (genesisId: string) => void
}

/**
 * Assistant « Reprendre un projet existant » (spec 017 US1, L4d E2) : source → aperçu → confidentialité. Le dossier
 * est choisi au sélecteur natif du main ; rien n'est créé avant « Importer », qui reste indisponible tant qu'aucun
 * niveau de confidentialité n'est choisi.
 */
export function ImportWizard({ onClose, onImported }: ImportWizardProps): React.JSX.Element {
  const ids = { title: useId(), confidentiality: useId() }
  const [preview, setPreview] = useState<ImportPreviewView | null>(null)
  const [level, setLevel] = useState<Confidentiality | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])

  const choose = async (): Promise<void> => {
    setBusy(true)
    setProblem(null)
    try {
      const result = await call<ImportPreviewView | null>('reprise:previewFolder')
      if (result !== null) {
        setPreview(result)
        setLevel(null)
      }
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Le dossier n’a pas pu être lu.')
    } finally {
      setBusy(false)
    }
  }

  const importProject = async (): Promise<void> => {
    if (preview === null || level === null) return
    setBusy(true)
    setProblem(null)
    try {
      const { genesisId } = await call<{ readonly genesisId: string }>('reprise:create', {
        previewId: preview.previewId,
        confidentiality: level
      })
      onImported(genesisId)
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Le projet n’a pas pu être importé.')
    } finally {
      setBusy(false)
    }
  }

  const blocked = preview !== null && (preview.tooLarge || preview.alreadyLinked !== null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-4 text-content shadow-xl"
      >
        <header>
          <h2 id={ids.title} className="text-base font-semibold">
            Reprendre un projet existant
          </h2>
          <p className="mt-1 text-xs text-content-muted">
            L’app lit le code du projet sans jamais l’exécuter ni le modifier : ni installation, ni compilation, ni
            script.
          </p>
        </header>

        <section aria-label="Source" className="flex flex-wrap items-center gap-2">
          <Button ref={first} onClick={() => void choose()} disabled={busy}>
            {preview === null ? 'Choisir le dossier du projet…' : 'Choisir un autre dossier…'}
          </Button>
        </section>

        {preview === null ? null : (
          <section
            aria-label="Aperçu du projet"
            className="flex flex-col gap-2 rounded-lg bg-surface-raised p-3 text-sm"
          >
            <h3 className="font-semibold">« {preview.name} »</h3>
            <p>
              {preview.languages.length === 0
                ? 'Aucun langage reconnu (TypeScript, JavaScript, C#, PHP) : seule l’arborescence sera visible.'
                : preview.languages.map((entry) => `${LANG_NAMES[entry.lang]} (${entry.files})`).join(' · ')}
            </p>
            <ul className="list-disc pl-5 text-xs">
              <li>{preview.files} fichiers retenus</li>
              <li>{preview.ignored} fichiers ignorés (dépendances, compilation, binaires, .gitignore)</li>
              <li>
                {preview.sensitive === 0
                  ? 'Aucun fichier sensible'
                  : `${preview.sensitive} fichier${preview.sensitive > 1 ? 's' : ''} sensible${preview.sensitive > 1 ? 's' : ''} (secrets, clés) ignoré${preview.sensitive > 1 ? 's' : ''} : jamais lu${preview.sensitive > 1 ? 's' : ''}`}
              </li>
              <li>{preview.git ? 'Dépôt git' : 'Pas un dépôt git (l’historique ne sera pas utilisé)'}</li>
            </ul>
            {preview.tooLarge ? (
              <p role="alert" className="text-con">
                Projet trop grand (plus de 20 000 fichiers retenus) : choisis un sous-dossier.
              </p>
            ) : null}
            {preview.alreadyLinked === null ? null : (
              <p role="alert" className="text-con">
                Ce dossier est déjà lié à un neurone de la carte : ouvre-le plutôt que d’en créer un second.
              </p>
            )}
          </section>
        )}

        {preview === null || blocked ? null : (
          <fieldset className="flex flex-col gap-2" aria-describedby={ids.confidentiality}>
            <legend className="text-sm font-semibold">Confidentialité de ce projet</legend>
            <p id={ids.confidentiality} className="text-xs text-content-muted">
              À choisir maintenant (modifiable ensuite depuis son badge). Pense aux règles de ton employeur.
            </p>
            {CHOICES.map((choice) => (
              <label
                key={choice.level}
                className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-surface-raised"
              >
                <input
                  type="radio"
                  name="confidentiality"
                  value={choice.level}
                  checked={level === choice.level}
                  onChange={() => setLevel(choice.level)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{choice.title}</span>
                  <span className="block text-xs text-content-muted">{choice.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {problem === null ? null : (
          <p role="alert" className="text-sm text-con">
            {problem}
          </p>
        )}

        <footer className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={() => void importProject()}
            disabled={busy || preview === null || blocked || level === null}
          >
            Importer
          </Button>
        </footer>
      </div>
    </div>
  )
}
