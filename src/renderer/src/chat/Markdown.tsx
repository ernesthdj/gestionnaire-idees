import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Markdown des réponses de Claude (spec 008) : titres, gras, listes, cases à cocher, tableaux, code, liens. Sûr :
 * aucun HTML brut n'est interprété (`skipHtml`), les URL dangereuses sont neutralisées (filtre par défaut de
 * react-markdown), les liens s'ouvrent hors de l'app (seuls les liens https passent : `guardNavigation`), les images
 * ne sont jamais chargées (texte alternatif seulement).
 */
function Code({
  children,
  className
}: {
  readonly children?: React.ReactNode
  readonly className?: string | undefined
}): React.JSX.Element {
  return className === undefined ? (
    <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ) : (
    <code className="font-mono text-xs">{children}</code>
  )
}

const COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold">{children}</h4>,
  p: ({ children }) => <p className="my-1.5">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={`my-1.5 pl-5 ${className?.includes('contains-task-list') === true ? 'list-none pl-1' : 'list-disc'}`}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={checked === true}
      disabled
      readOnly
      aria-label={checked === true ? 'Fait' : 'À faire'}
      className="mr-1.5 align-middle"
    />
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-content-muted/40 pl-3 text-content-muted">{children}</blockquote>
  ),
  code: Code,
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-md bg-surface p-3 text-xs">{children}</pre>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent underline">
      {children}
    </a>
  ),
  img: ({ alt }) => <span className="text-content-muted">[image : {alt ?? 'sans description'}]</span>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-content-muted/30 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-content-muted/30 px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="my-3 border-content-muted/30" />
}

export function Markdown({
  text,
  inlineCode
}: {
  readonly text: string
  /** Rendu propre d'un code en ligne (ex. un chemin cité qui devient un lien) ; `null` : rendu par défaut. */
  readonly inlineCode?: (code: string) => React.ReactNode | null
}): React.JSX.Element {
  const components: Components =
    inlineCode === undefined
      ? COMPONENTS
      : {
          ...COMPONENTS,
          code: ({ children, className }) =>
            (className === undefined && typeof children === 'string' ? inlineCode(children) : null) ?? (
              <Code className={className}>{children}</Code>
            )
        }
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
      {text}
    </ReactMarkdown>
  )
}
