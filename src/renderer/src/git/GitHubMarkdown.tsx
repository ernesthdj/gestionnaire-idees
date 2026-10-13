import { useState } from 'react'
import { isGitHubLink } from '@shared/git/github'
import { Markdown } from '../chat/Markdown'
import { call } from '../lib/ipc'

/** Ouvre une page github.com dans le navigateur (le main revérifie l'adresse). */
export function openGitHub(url: string): void {
  if (isGitHubLink(url)) void call('git:openExternal', { url }).catch(() => undefined)
}

/**
 * Lien d'un texte venu de GitHub (spec 021 US6-6) : seul `https://github.com/…` s'ouvre ; toute autre adresse reste du
 * texte, copiable (jamais cliquable : hameçonnage).
 */
function GitHubLink({
  children,
  href
}: {
  readonly children?: React.ReactNode
  readonly href?: string | undefined
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  if (href !== undefined && isGitHubLink(href)) {
    return (
      <button type="button" className="text-accent underline" title={href} onClick={() => openGitHub(href)}>
        {children}
      </button>
    )
  }
  return (
    <span>
      <span className="underline decoration-dotted" title={href}>
        {children}
      </span>{' '}
      {href === undefined ? null : (
        <button
          type="button"
          className="text-xs text-content-muted underline"
          aria-label={`Copier l’adresse ${href}`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(href)
              .then(() => setCopied(true))
              .catch(() => undefined)
          }}
        >
          {copied ? 'copiée' : 'copier'}
        </button>
      )}
    </span>
  )
}

/**
 * Texte venu de GitHub (description de PR ou d'issue, spec 021 T046) : une DONNÉE non fiable, rendue en Markdown sans
 * HTML (`skipHtml`), images jamais chargées (texte alternatif), liens github.com seuls ouvrables.
 */
export function GitHubMarkdown({ text }: { readonly text: string }): React.JSX.Element {
  return text.trim() === '' ? (
    <p className="text-xs text-content-muted">Pas de description.</p>
  ) : (
    <div className="text-sm">
      <Markdown text={text} link={GitHubLink} />
    </div>
  )
}
