import { useQuery } from '@tanstack/react-query'
import { useId, useMemo } from 'react'
import type { ExplorerMapView, ExplorerNodeDetailView, MapFileView } from '@shared/ipc/reprise'
import { call } from '../../lib/ipc'
import { LAYER_LABELS, PROVENANCE_LABELS, sentenceText } from '../labels'
import { Links } from '../NodePanel'
import { fileSheet, moduleSheet, type SheetLink } from './sheet'

/** Voisins d'une fiche, en mots : « Domain · 3 appels », puis les appels eux-mêmes. */
function Neighbours({
  title,
  links,
  onGo
}: {
  readonly title: string
  readonly links: readonly SheetLink[]
  readonly onGo: (key: string) => void
}): React.JSX.Element {
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-semibold text-content-muted">{title}</h3>
      {links.length === 0 ? (
        <p className="text-xs text-content-muted">rien dans le projet</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1.5">
          {links.map((link) => (
            <li key={link.key} className="text-xs">
              <button type="button" className="font-semibold underline" onClick={() => onGo(link.key)}>
                {link.title}
              </button>{' '}
              <span className="text-content-muted">
                · {link.count} appel{link.count > 1 ? 's' : ''}
                {link.provenance === 'syntax' ? '' : ` · ${PROVENANCE_LABELS[link.provenance].text}`}
              </span>
              <ul className="pl-3 text-content-muted">
                {link.sentences.map((sentence, index) => (
                  <li key={index}>{sentenceText(sentence)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Fiche d'un module (spec 031 D8) : son rôle (et l'image du guide), les modules qu'il utilise et ceux qui l'utilisent,
 * en mots, puis son contenu ; un clic sur un fichier ouvre son code.
 */
export function ModuleSheet({
  genesisId,
  map,
  moduleKey,
  onModule,
  onFile,
  onEnter
}: {
  readonly genesisId: string
  readonly map: ExplorerMapView
  readonly moduleKey: string
  readonly onModule: (key: string) => void
  readonly onFile: (file: MapFileView) => void
  /** Entrer dans le module ; absent : pas de carte (vue liste). */
  readonly onEnter: ((key: string) => void) | undefined
}): React.JSX.Element | null {
  const titleId = useId()
  const module = map.modules.find((entry) => entry.key === moduleKey)
  const sheet = useMemo(() => moduleSheet(map, moduleKey), [map, moduleKey])
  const files = useMemo(() => map.files.filter((file) => file.moduleKey === moduleKey), [map, moduleKey])
  // L'image du module, si le guide de reprise l'a écrite (spec 017 US4).
  const detail = useQuery({
    queryKey: ['explorer', genesisId, 'node', moduleKey],
    queryFn: () => call<ExplorerNodeDetailView>('explorer:node', { genesisId, nodeKey: moduleKey })
  })
  if (module === undefined) return null
  const layer = LAYER_LABELS[module.layer]
  const analogy = detail.data?.analogy ?? null
  // Liens précisés (spec 017 US6) : ceux qui portent une raison (déduits par Claude, ou restés incertains), cible et
  // raison en clair ; un clic ouvre le fichier de la cible.
  const explained = [...(detail.data?.callees ?? []), ...(detail.data?.callers ?? [])].filter(
    (link) => link.reason !== null
  )
  return (
    <section aria-labelledby={titleId} className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 text-sm">
      <header>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${layer.color}`}>{layer.text}</p>
        <h2 id={titleId} className="truncate text-base font-semibold" title={module.title}>
          {module.title}
        </h2>
        <p className="text-xs text-content-muted">
          {module.files} fichier{module.files > 1 ? 's' : ''} · {module.lines} lignes
          {module.plumbing ? ' · plomberie' : ''}
        </p>
      </header>
      {module.role === null && analogy === null ? null : (
        <section aria-label="À quoi il sert" className="rounded-lg bg-surface-raised p-3">
          {analogy === null ? null : <p className="italic">« {analogy} »</p>}
          {module.role === null ? null : <p className={analogy === null ? '' : 'mt-1'}>{module.role}</p>}
        </section>
      )}
      <Neighbours title="Utilise" links={sheet.uses} onGo={onModule} />
      <Neighbours title="Utilisé par" links={sheet.usedBy} onGo={onModule} />
      {explained.length === 0 ? null : (
        <Links
          title="Liens précisés"
          links={explained}
          onGo={(link) => {
            const file = map.files.find((entry) => entry.path === link.path)
            if (file !== undefined) onFile(file)
          }}
        />
      )}
      <section aria-label="Contenu">
        <h3 className="text-xs font-semibold text-content-muted">Contenu</h3>
        <ul className="mt-1 flex flex-col gap-0.5">
          {files.map((file) => (
            <li key={file.key}>
              <button
                type="button"
                onClick={() => onFile(file)}
                className="w-full rounded px-2 py-0.5 text-left text-xs hover:bg-surface-raised"
              >
                <span className="font-semibold">{file.title}</span>
                {file.folder === '' ? null : <span className="text-content-muted"> · {file.folder}</span>}
                {file.role === null ? null : <span className="block text-content-muted">{file.role}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {onEnter === undefined ? null : (
        <div>
          <button type="button" className="text-xs underline" onClick={() => onEnter(moduleKey)}>
            Entrer dans le module
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * Fiche d'un fichier (spec 031 D8), au-dessus de son code : son rôle, ses fonctions (un clic place le code dessus), ce
 * qu'il appelle et qui l'appelle, en mots.
 */
export function FileSheet({
  map,
  path,
  onFile,
  onFunction,
  whole = false
}: {
  readonly map: ExplorerMapView
  readonly path: string
  readonly onFile: (file: MapFileView) => void
  readonly onFunction: (name: string) => void
  /** Seule dans le panneau (onglet « Élément ») plutôt qu'au-dessus du code : toute la hauteur. */
  readonly whole?: boolean
}): React.JSX.Element | null {
  const file = map.files.find((entry) => entry.path === path)
  const sheet = useMemo(() => (file === undefined ? null : fileSheet(map, file.key)), [map, file])
  if (file === undefined || sheet === null) return null
  const module = map.modules.find((entry) => entry.key === file.moduleKey)
  const go = (key: string): void => {
    const target = map.files.find((entry) => entry.key === key)
    if (target !== undefined) onFile(target)
  }
  return (
    <details
      open
      className={`shrink-0 overflow-y-auto px-3 py-2 text-xs ${
        whole ? 'max-h-full' : 'max-h-[45%] border-b border-content-muted/20'
      }`}
    >
      <summary className="cursor-pointer font-semibold">
        Fiche de {file.title}
        {module === undefined ? '' : ` · ${module.title}`}
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {file.role === null ? null : <p className="text-sm">{file.role}</p>}
        {file.functions.length === 0 ? null : (
          <section aria-label="Fonctions">
            <h3 className="font-semibold text-content-muted">Fonctions</h3>
            <p className="mt-1 flex flex-wrap gap-1">
              {file.functions.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`${name} : voir dans le code`}
                  onClick={() => onFunction(name)}
                  className="rounded border border-content-muted/40 px-1.5 font-mono hover:bg-surface-raised"
                >
                  {name}
                </button>
              ))}
            </p>
          </section>
        )}
        <Neighbours title="Ce qu’il appelle" links={sheet.uses} onGo={go} />
        <Neighbours title="Qui l’appelle" links={sheet.usedBy} onGo={go} />
      </div>
    </details>
  )
}
