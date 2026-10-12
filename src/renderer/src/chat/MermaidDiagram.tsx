import { useEffect, useId, useState } from 'react'

/** Thème sombre de l'app (sombre, carbone…) : lu sur le fond réel (`--color-surface`), quel que soit le nom du thème. */
function prefersDark(): boolean {
  const surface = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(
    getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
  )
  if (surface === null) return false
  const [red, green, blue] = surface.slice(1).map((hex) => parseInt(hex, 16))
  return 0.299 * (red ?? 255) + 0.587 * (green ?? 255) + 0.114 * (blue ?? 255) < 128
}

/** Dimensions naturelles du schéma (viewBox) : l'image garde sa taille, réduite à la largeur disponible. */
function sizeOf(svg: string): { readonly width: number; readonly height: number } | null {
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg)
  const width = Number(box?.[1])
  const height = Number(box?.[2])
  return width > 0 && height > 0 ? { width: Math.ceil(width), height: Math.ceil(height) } : null
}

/**
 * SVG de Mermaid en XML bien formé : ses étiquettes HTML (`<br>` non fermé…) sont valides dans la page, pas dans une
 * image, qui ne se décoderait pas. Lu dans un document HTML inerte (rien n'y est exécuté ni chargé), puis resérialisé.
 */
function toXml(svg: string): string {
  const root = new DOMParser().parseFromString(svg, 'text/html').querySelector('svg')
  if (root === null) throw new Error('Mermaid n’a pas produit de SVG.')
  return new XMLSerializer().serializeToString(root)
}

/** Vrai si le thème affiché est sombre ; suit les changements (`data-theme`, préférence du système). */
function useDarkTheme(): boolean {
  const [dark, setDark] = useState(prefersDark)
  useEffect(() => {
    const update = (): void => setDark(prefersDark())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    media?.addEventListener('change', update)
    return () => {
      observer.disconnect()
      media?.removeEventListener('change', update)
    }
  }, [])
  return dark
}

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly src: string; readonly width?: number; readonly height?: number }
  | { readonly kind: 'error' }

/**
 * Schéma Mermaid d'un bloc ```mermaid. Mermaid n'est chargé qu'au premier schéma, en mode `strict` (étiquettes
 * assainies, aucun clic ni script). Le SVG est affiché en **image** (`<img>` en `data:`, permis par la CSP) : même un
 * fichier piégé ne peut rien exécuter dans l'app. Syntaxe invalide : le code source reste affiché.
 */
export function MermaidDiagram({ source }: { readonly source: string }): React.JSX.Element {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [state, setState] = useState<State>({ kind: 'loading' })
  const dark = useDarkTheme()
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' })
        const { svg } = await mermaid.render(id, source)
        if (!alive) return
        const size = sizeOf(svg)
        setState({
          kind: 'ready',
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toXml(svg))}`,
          ...(size ?? {})
        })
      } catch {
        // Mermaid laisse parfois son brouillon d'erreur dans la page.
        document.getElementById(`d${id}`)?.remove()
        if (alive) setState({ kind: 'error' })
      }
    })()
    return () => {
      alive = false
    }
  }, [id, source, dark])

  if (state.kind === 'ready') {
    return (
      <figure className="my-2 overflow-x-auto rounded-md bg-surface p-3">
        <img
          src={state.src}
          alt="Schéma Mermaid"
          width={state.width}
          height={state.height}
          className="h-auto max-w-full"
        />
      </figure>
    )
  }
  return (
    <figure className="my-2">
      {state.kind === 'error' ? (
        <figcaption className="mb-1 text-xs text-content-muted">
          Schéma Mermaid illisible : code source affiché.
        </figcaption>
      ) : (
        <figcaption className="mb-1 text-xs text-content-muted">Dessin du schéma…</figcaption>
      )}
      <pre className="overflow-x-auto rounded-md bg-surface p-3 text-xs">
        <code className="font-mono text-xs">{source}</code>
      </pre>
    </figure>
  )
}
