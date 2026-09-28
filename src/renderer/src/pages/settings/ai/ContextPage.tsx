import { useCallback, useEffect, useState } from 'react'
import type { ContextListView, PendingImportView, TextDiffView } from '@shared/ipc/context'
import { Button } from '../../../components/atoms/Button'
import { Section } from '../../../components/molecules/Section'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
}

/** Avant / après côte à côte (split 50/50 : les deux versions ont le même poids). */
function DiffBlock({ title, diff }: { readonly title: string; readonly diff: TextDiffView }): React.JSX.Element {
  if (!diff.changed) return <p className="text-sm text-content-muted">{title} : inchangé.</p>
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {(['before', 'after'] as const).map((side) => (
          <figure key={side} className="space-y-1">
            <figcaption className="text-xs text-content-muted">{side === 'before' ? 'Actuel' : 'Proposé'}</figcaption>
            <pre className="max-h-64 overflow-auto rounded-md bg-surface p-2 text-xs whitespace-pre-wrap">
              {diff[side] === '' ? '(vide)' : diff[side]}
            </pre>
          </figure>
        ))}
      </div>
    </div>
  )
}

/** Écran Réglages › Contexte IA (spec 001 US5) : ce que l'agent « sait » de l'utilisateur, sous son contrôle. */
export function ContextPage(): React.JSX.Element {
  const [list, setList] = useState<ContextListView | null>(null)
  const [pending, setPending] = useState<readonly PendingImportView[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    const [listResult, pendingResult] = await Promise.all([
      window.api.invoke<ContextListView>('context:list'),
      window.api.invoke<PendingImportView[]>('context:pending')
    ])
    if (listResult.success) setList(listResult.data)
    if (pendingResult.success) setPending(pendingResult.data)
  }, [])

  useEffect(() => {
    void refresh()
    return window.api.on('context:newImport', () => {
      setMessage('Nouveau contexte disponible : vérifie l’aperçu avant de l’appliquer.')
      void refresh()
    })
  }, [refresh])

  const act = async (channel: 'context:apply' | 'context:reject' | 'context:rollback', id: string, done: string) => {
    setBusy(true)
    try {
      const result = await window.api.invoke(channel, { id })
      setMessage(result.success ? done : result.error.message)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (list === null)
    return (
      <p role="status" className="p-8 text-content-muted">
        Chargement du contexte…
      </p>
    )

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Réglages › Contexte IA</h1>
        <p className="text-sm text-content-muted">
          Profil, règles et exemples qui cadrent ton agent. Ils sont envoyés tels quels à Claude : ils ne doivent
          contenir aucune donnée personnelle (l&apos;import est refusé sinon).
        </p>
      </header>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {message}
      </p>

      {pending.map((item) => (
        <Section
          key={item.id}
          title="Nouveau contexte à valider"
          description={`Reçu le ${formatDate(item.detectedAt)} — fichiers : ${item.diff.files.join(', ')}`}
        >
          <DiffBlock title="Profil" diff={item.diff.profile} />
          <DiffBlock title="Règles" diff={item.diff.rules} />
          <p className="text-sm">
            Exemples : {item.diff.examples.before} → {item.diff.examples.after}
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void act('context:apply', item.id, 'Nouveau contexte appliqué.')}
            >
              Appliquer
            </Button>
            <Button disabled={busy} onClick={() => void act('context:reject', item.id, 'Contexte refusé.')}>
              Refuser
            </Button>
          </div>
        </Section>
      ))}

      <Section
        title={`Contexte actif — version ${list.active?.version ?? '—'}`}
        description={list.active === null ? undefined : `Appliqué le ${formatDate(list.active.appliedAt)}`}
      >
        <pre className="max-h-72 overflow-auto rounded-md bg-surface p-2 text-xs whitespace-pre-wrap">
          {list.active === null || list.active.profile === '' ? 'Aucun profil pour l’instant.' : list.active.profile}
        </pre>
        <p className="text-xs text-content-muted">
          Dossier d&apos;import (déposé par Claude Code) : <code>{list.inboxPath}</code>
        </p>
      </Section>

      <Section title="Historique des versions">
        <ul className="space-y-2">
          {list.versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                Version {version.version} · {version.source === 'seed' ? 'initiale (vide)' : 'importée'} ·{' '}
                {formatDate(version.appliedAt)}
                {version.isActive ? ' · active' : ''}
              </span>
              {version.isActive ? null : (
                <Button
                  disabled={busy}
                  onClick={() => void act('context:rollback', version.id, `Version ${version.version} restaurée.`)}
                >
                  Restaurer
                </Button>
              )}
            </li>
          ))}
        </ul>
        {list.imports.some((entry) => entry.status === 'invalid') ? (
          <details className="text-sm">
            <summary className="cursor-pointer">Imports refusés automatiquement</summary>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {list.imports
                .filter((entry) => entry.status === 'invalid')
                .map((entry) => (
                  <li key={entry.id}>
                    {formatDate(entry.detectedAt)} — {entry.error}
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </Section>
    </main>
  )
}
