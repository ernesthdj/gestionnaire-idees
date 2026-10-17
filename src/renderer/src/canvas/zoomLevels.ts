import { useStore } from '@xyflow/react'

/**
 * Vue lointaine (demande de mentalyas, 2026-10-17) : sous ce zoom, les textes ne se lisent plus et tout devient
 * visible à la fois ; la carte coupe ce qui ne se voit plus (animations, halos, ombres), les chambres d'agents gardent
 * leur dernière image et les widgets dorment en tuile (leur cadre n'est plus monté).
 */
export const FAR_ZOOM = 0.4

/** Vrai sous le seuil ; ne redessine le composant qu'au franchissement, pas à chaque cran de zoom. */
export function useFarZoom(): boolean {
  return useStore((state) => state.transform[2] < FAR_ZOOM)
}
