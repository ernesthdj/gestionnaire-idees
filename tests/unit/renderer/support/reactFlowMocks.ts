/**
 * Simulations nécessaires à React Flow dans jsdom (documentation React Flow, « Testing ») : jsdom ne calcule ni
 * tailles ni transformations. Les éléments prennent la taille de leur style, sinon 1 px.
 */
class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    const element = target as HTMLElement
    const contentRect = { width: element.offsetWidth, height: element.offsetHeight, x: 0, y: 0, top: 0, left: 0 }
    this.callback([{ target, contentRect } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  unobserve(): void {}
  disconnect(): void {}
}

class DOMMatrixReadOnlyMock {
  readonly m22: number
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1]
    this.m22 = scale === undefined ? 1 : Number(scale)
  }
}

/** Conteneurs de React Flow (toile, rendu, volet) : taille de la fenêtre simulée ; les nœuds gardent la leur. */
function isFlowContainer(element: HTMLElement): boolean {
  return [...element.classList].some(
    (name) =>
      name.startsWith('react-flow') && !name.startsWith('react-flow__node') && !name.startsWith('react-flow__edge')
  )
}

export function installReactFlowMocks(size = { width: 1280, height: 800 }): void {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return isFlowContainer(this) ? size.height : Number.parseFloat(this.style.height) || 1
      }
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return isFlowContainer(this) ? size.width : Number.parseFloat(this.style.width) || 1
      }
    }
  })
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
}
