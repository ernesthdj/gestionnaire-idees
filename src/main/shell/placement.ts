export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const CAPTURE_SIZE = { width: 560, height: 176 } as const

/**
 * Position de la fenêtre de capture dans la zone de travail de l'écran actif : centrée horizontalement, au premier
 * tiers de la hauteur (là où le regard se pose), sans jamais déborder de l'écran.
 */
export function captureBounds(workArea: Rect, size: { width: number; height: number } = CAPTURE_SIZE): Rect {
  const width = Math.min(size.width, workArea.width)
  const height = Math.min(size.height, workArea.height)
  const x = workArea.x + Math.round((workArea.width - width) / 2)
  const y = workArea.y + Math.min(Math.round(workArea.height / 3 - height / 2), workArea.height - height)
  return { x, y: Math.max(workArea.y, y), width, height }
}
