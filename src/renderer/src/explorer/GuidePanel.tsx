import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState } from 'react'
import type { DocumentContentView } from '@shared/ipc/documents'
import type { RepriseProjectView } from '@shared/ipc/reprise'
import { documentKey } from '../canvas/nodes/DocumentNode'
import { Markdown } from '../chat/Markdown'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

interface Located {
  readonly source: string
  readonly key: string
  readonly parentKey: string
}

/** Codes en ligne du guide (chemins, modules, symboles cités), sans doublon, bornés comme `explorer:locate`. */
function inlineCodes(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(/`([^`\n]{1,300})`/g)) {
    if (found.size >= 100) break
    found.add(match[1] ?? '')
  }
  return [...found]
}

/**
 * Guide de reprise dans l'explorateur (spec 017 US4) : le document du genesis, lu par le main ; chaque nom cité qui
 * existe dans le projet devient un lien qui ouvre l'explorateur dessus. « Régénérer » ajoute une version au document
 * (la précédente reste dans son historique).
 */
export function GuidePanel({
  genesisId,
  guide,
  analyzed,
  onLocate
}: {
  readonly genesisId: string
  readonly guide: RepriseProjectView['guide']
  readonly analyzed: boolean
  readonly onLocate: (parentKey: string, key: string) => void
}): React.JSX.Element {
  const client = useQueryClient()
  const titleId = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const [asked, setAsked] = useState(false)
  const documentId = guide.documentId
  const content = useQuery({
    queryKey: documentKey(documentId ?? ''),
    enabled: documentId !== null,
    queryFn: () => call<DocumentContentView>('document:get', { id: documentId })
  })
  const text = content.data?.content ?? ''
  const codes = useMemo(() => inlineCodes(text), [text])
  const located = useQuery({
    queryKey: ['explorer', genesisId, 'locate', codes],
    enabled: codes.length > 0,
    queryFn: () => call<{ readonly results: readonly Located[] }>('explorer:locate', { genesisId, sources: codes })
  })
  const targets = useMemo(
    () => new Map((located.data?.results ?? []).map((entry) => [entry.source, entry] as const)),
    [located.data]
  )

  // Une nouvelle version (régénération, rédaction après l'analyse) arrive par `reprise:changed`.
  useEffect(
    () =>
      window.api.on('reprise:changed', () => {
        if (documentId !== null) void client.invalidateQueries({ queryKey: documentKey(documentId) })
      }),
    [client, documentId]
  )

  const write = async (): Promise<void> => {
    setProblem(null)
    setAsked(true)
    try {
      await call('reprise:guide', { genesisId })
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Le guide n’a pas pu être rédigé.')
    } finally {
      setAsked(false)
      void client.invalidateQueries({ queryKey: ['reprise', genesisId] })
    }
  }

  const running = guide.running || asked
  return (
    <section aria-labelledby={titleId} className="flex h-full min-h-0 flex-col text-sm">
      <header className="flex items-center gap-2 border-b border-content-muted/20 px-4 py-2">
        <h2 id={titleId} className="text-base font-semibold">
          Guide de reprise
        </h2>
        <div className="ml-auto">
          {running ? (
            <p role="status" className="text-xs">
              Rédaction en cours… (quelques minutes)
            </p>
          ) : (
            <Button onClick={() => void write()} disabled={!analyzed}>
              {documentId === null ? 'Rédiger le guide' : 'Régénérer'}
            </Button>
          )}
        </div>
      </header>
      {problem === null ? null : (
        <p role="alert" className="mx-4 mt-2 text-xs text-con">
          {problem}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 leading-relaxed" tabIndex={0}>
        {documentId === null ? (
          <p className="text-content-muted">
            {analyzed
              ? 'Pas encore de guide : il explique le projet à un dev junior, avec une analogie par partie et les fichiers à lire en premier.'
              : 'Le guide est rédigé après la première analyse du projet.'}
          </p>
        ) : content.data === undefined ? (
          <p className="text-content-muted">{content.isError ? 'Le guide n’a pas pu être lu.' : 'Lecture…'}</p>
        ) : (
          <>
            <Markdown
              text={content.data.content}
              inlineCode={(code) => {
                const target = targets.get(code)
                return target === undefined ? null : (
                  <button
                    type="button"
                    className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em] text-accent underline"
                    aria-label={`Voir ${code} dans l’explorateur`}
                    onClick={() => onLocate(target.parentKey, target.key)}
                  >
                    {code}
                  </button>
                )
              }}
            />
            <p className="mt-4 text-xs text-content-muted">
              Régénérer garde la version précédente dans l’historique du document (carte des idées).
            </p>
          </>
        )}
      </div>
    </section>
  )
}
