/**
 * Icône provisoire de la zone de notification, dessinée en mémoire (un neurone : anneau + noyau) pour ne dépendre
 * d'aucun fichier image ; elle sera remplacée par la direction visuelle de mentalyas (T047).
 * Renvoie des pixels BGRA (format attendu par `nativeImage.createFromBitmap`).
 */
export function drawNeuronIcon(size: number, color: { r: number; g: number; b: number }): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const outer = size / 2 - 0.5
  const ringWidth = size / 8
  const core = size / 5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center)
      const inRing = distance <= outer && distance >= outer - ringWidth
      if (!inRing && distance > core) continue
      const offset = (y * size + x) * 4
      pixels[offset] = color.b
      pixels[offset + 1] = color.g
      pixels[offset + 2] = color.r
      pixels[offset + 3] = 255
    }
  }
  return pixels
}
