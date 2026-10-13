import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MermaidDiagram } from './MermaidDiagram'

/**
 * Markdown des réponses de Claude (spec 008) : titres, gras, listes, cases à cocher, tableaux, code, liens. Sûr :
 * aucun HTML brut n'est interprété (`skipHtml`), les URL dangereuses sont neutralisées (filtre par défaut de
 * react-markdown), les liens s'ouvrent hors de l'app (seuls les liens https passent : `guardNavigation`), les images
 * ne sont jamais chargées (texte alternatif seulement). Les encadrés GitHub (`> [!NOTE]`, `> [!IMPORTANT]`…) sont mis
 * en forme, les blocs ```mermaid dessinés (`MermaidDiagram`).
 */

/** Nœud de l'arbre Markdown (mdast), réduit à ce que lit `remarkCallouts`. */
interface MdNode {
  readonly type: string
  value?: string
  readonly children?: MdNode[]
  data?: { hProperties?: Record<string, string> }
}

const CALLOUTS = {
  note: { label: 'Note', icon: 'ℹ', tone: 'border-accent text-accent' },
  tip: { label: 'Astuce', icon: '💡', tone: 'border-pro text-pro' },
  important: { label: 'Important', icon: '❗', tone: 'border-seed text-seed' },
  warning: { label: 'Attention', icon: '⚠', tone: 'border-idea text-idea' },
  caution: { label: 'Prudence', icon: '⛔', tone: 'border-con text-con' }
} as const
type CalloutKind = keyof typeof CALLOUTS
const CALLOUT_MARK = /^\[!(note|tip|important|warning|caution)\][ \t]*\n?/i

const isCalloutKind = (value: string | undefined): value is CalloutKind =>
  value !== undefined && Object.hasOwn(CALLOUTS, value)

/** Repère `[!TYPE]` en tête d'une citation : la marque est retirée, le type passe au rendu (`data-callout`). */
function remarkCallouts() {
  const visit = (node: MdNode): void => {
    if (node.type === 'blockquote') {
      const first = node.children?.[0]?.type === 'paragraph' ? node.children[0].children?.[0] : undefined
      const match = first?.type === 'text' ? CALLOUT_MARK.exec(first.value ?? '') : null
      if (first !== undefined && match !== null) {
        first.value = (first.value ?? '').slice(match[0].length)
        node.data = { ...node.data, hProperties: { 'data-callout': (match[1] ?? '').toLowerCase() } }
      }
    }
    node.children?.forEach(visit)
  }
  return (tree: MdNode): void => visit(tree)
}

/** Élément HTML (hast) reçu par un composant, réduit à ce que lit `mermaidSource`. */
interface HtmlNode {
  readonly type: string
  readonly tagName?: string
  readonly value?: string
  readonly properties?: { readonly className?: unknown }
  readonly children?: readonly HtmlNode[]
}

/** Source d'un bloc ```mermaid (`<pre><code class="language-mermaid">`) ; `null` pour tout autre bloc. */
function mermaidSource(pre: HtmlNode | undefined): string | null {
  const code = pre?.children?.find((child) => child.type === 'element')
  const classes = code?.properties?.className
  if (code?.tagName !== 'code' || !Array.isArray(classes) || !classes.includes('language-mermaid')) return null
  return (code.children ?? [])
    .map((child) => child.value ?? '')
    .join('')
    .replace(/\n$/, '')
}

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
  blockquote: ({ children, ...props }) => {
    const kind = (props as { readonly 'data-callout'?: string })['data-callout']
    if (!isCalloutKind(kind)) {
      return (
        <blockquote className="my-2 border-l-2 border-content-muted/40 pl-3 text-content-muted">{children}</blockquote>
      )
    }
    const callout = CALLOUTS[kind]
    return (
      <blockquote className={`my-2 rounded-r-md border-l-4 bg-surface-raised py-1 pl-3 ${callout.tone}`}>
        <p className="mt-1 text-xs font-semibold">
          <span aria-hidden="true">{callout.icon} </span>
          {callout.label}
        </p>
        <div className="text-content">{children}</div>
      </blockquote>
    )
  },
  code: Code,
  pre: ({ children, node }) => {
    const diagram = mermaidSource(node)
    return diagram === null ? (
      <pre className="my-2 overflow-x-auto rounded-md bg-surface p-3 text-xs">{children}</pre>
    ) : (
      <MermaidDiagram source={diagram} />
    )
  },
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

/** Lien inerte (fichier du projet lu dans l'app, spec 023 FR-003) : souligné, adresse au survol, rien ne s'ouvre. */
const INERT_LINK: NonNullable<Components['a']> = ({ children, href }) => (
  <span className="text-accent underline decoration-dotted" title={href}>
    {children}
  </span>
)

export function Markdown({
  text,
  inlineCode,
  inertLinks = false,
  link
}: {
  readonly text: string
  /** Rendu propre d'un code en ligne (ex. un chemin cité qui devient un lien) ; `null` : rendu par défaut. */
  readonly inlineCode?: (code: string) => React.ReactNode | null
  /** Liens affichés sans être actifs (texte d'un fichier du projet, pas une réponse de Claude). */
  readonly inertLinks?: boolean
  /** Rendu propre des liens (textes venus de GitHub, spec 021 US6) ; prime sur `inertLinks`. */
  readonly link?: NonNullable<Components['a']>
}): React.JSX.Element {
  let components: Components =
    link !== undefined ? { ...COMPONENTS, a: link } : inertLinks ? { ...COMPONENTS, a: INERT_LINK } : COMPONENTS
  if (inlineCode !== undefined) {
    components = {
      ...components,
      code: ({ children, className }) =>
        (className === undefined && typeof children === 'string' ? inlineCode(children) : null) ?? (
          <Code className={className}>{children}</Code>
        )
    }
  }
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts]} skipHtml components={components}>
      {text}
    </ReactMarkdown>
  )
}
