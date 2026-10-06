import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import powershell from 'highlight.js/lib/languages/powershell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

// Ensemble fermé, aligné sur `VIEWER_LANGUAGES` (spec 013 R10) : le cœur seul, sans détection automatique.
const LANGUAGES = { bash, cpp, csharp, css, javascript, json, markdown, php, powershell, sql, typescript, xml, yaml }
for (const [name, language] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, language)

/** Au-delà, pas de coloration : le texte brut s'affiche aussitôt. */
const HIGHLIGHT_MAX_CHARS = 200_000

/** Arbre de coloration : du texte, ou un segment `hljs-…` et ses enfants. Rendu en éléments React, jamais en HTML. */
export type HighlightNode = string | { readonly className: string; readonly children: readonly HighlightNode[] }

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" }
const TOKEN = /<span class="((?:hljs|language)-[\w-]+(?: [\w-]+)*)">|<\/span>|&(amp|lt|gt|quot|#x27|#39);|[^<&]+/gy

/**
 * Lit la sortie de `highlight.js` selon une grammaire fermée — `<span class="hljs-…">`, `</span>`, texte et
 * entités d'échappement — et rend `null` à la moindre autre forme : aucun HTML n'est jamais injecté dans la page.
 */
export function parseHighlight(html: string): HighlightNode[] | null {
  const root: HighlightNode[] = []
  const stack: { className: string; children: HighlightNode[] }[] = []
  const push = (node: HighlightNode): void => {
    const siblings = stack.at(-1)?.children ?? root
    const last = siblings.at(-1)
    // Texte contigu (entités décodées comprises) : un seul morceau.
    if (typeof node === 'string' && typeof last === 'string') siblings[siblings.length - 1] = last + node
    else siblings.push(node)
  }
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < html.length) {
    const start = TOKEN.lastIndex
    const match = TOKEN.exec(html)
    if (match === null || match.index !== start) return null
    const [token, className, entity] = match
    if (className !== undefined) stack.push({ className, children: [] })
    else if (token === '</span>') {
      const closed = stack.pop()
      if (closed === undefined) return null
      push(closed)
    } else push(entity === undefined ? token : (ENTITIES[entity] ?? ''))
  }
  return stack.length === 0 ? root : null
}

/**
 * Découpe un arbre coloré en lignes : un segment qui court sur plusieurs lignes (commentaire, chaîne) est répété
 * sur chacune avec sa classe, pour colorer les lignes d'une différence une à une.
 */
export function splitHighlightLines(nodes: readonly HighlightNode[]): HighlightNode[][] {
  const lines: HighlightNode[][] = [[]]
  const walk = (list: readonly HighlightNode[], wrap: (node: HighlightNode) => HighlightNode): void => {
    for (const node of list) {
      if (typeof node === 'string') {
        node
          .replace(/\r\n/g, '\n')
          .split('\n')
          .forEach((part, index) => {
            if (index > 0) lines.push([])
            if (part !== '') lines.at(-1)?.push(wrap(part))
          })
      } else {
        walk(node.children, (child) => wrap({ className: node.className, children: [child] }))
      }
    }
  }
  walk(nodes, (node) => node)
  return lines
}

/** Arbre coloré d'un code source, ou `null` (langage inconnu, texte trop long, sortie inattendue) : texte brut. */
export function highlight(code: string, language: string | null): HighlightNode[] | null {
  if (language === null || code.length > HIGHLIGHT_MAX_CHARS || hljs.getLanguage(language) === undefined) return null
  return parseHighlight(hljs.highlight(code, { language, ignoreIllegals: true }).value)
}
