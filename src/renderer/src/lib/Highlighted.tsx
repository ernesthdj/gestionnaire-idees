import type { HighlightNode } from './highlight'

/** Arbre de coloration rendu en éléments React (jamais en HTML) : visionneuse du livrable, extrait de l'explorateur. */
export function Highlighted({ nodes }: { readonly nodes: readonly HighlightNode[] }): React.JSX.Element {
  return (
    <>
      {nodes.map((node, index) =>
        typeof node === 'string' ? (
          node
        ) : (
          <span key={index} className={node.className}>
            <Highlighted nodes={node.children} />
          </span>
        )
      )}
    </>
  )
}
