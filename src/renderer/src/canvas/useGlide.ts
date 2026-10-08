import { useEffect, useRef, useState } from 'react'

/** Durée d'un glissement vers une nouvelle place (spec 022 D4). */
export const GLIDE_MS = 700

/**
 * Glissements (spec 022 D4) : quand `signature` (la disposition) change, renvoie `on` pendant {@link GLIDE_MS} ms —
 * la surface le pose sur `data-glide` et les nœuds React Flow glissent vers leur nouvelle place (`living.css`) au
 * lieu de sauter. Rien au premier affichage ni en animations réduites (`off`).
 */
export function useGlide(signature: string, reduced: boolean): 'on' | 'off' {
  const [gliding, setGliding] = useState(false)
  const previous = useRef(signature)
  // Lu au moment du changement : basculer le réglage ne relance ni n'interrompt un glissement.
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  useEffect(() => {
    if (previous.current === signature) return
    previous.current = signature
    if (reducedRef.current) {
      setGliding(false)
      return
    }
    setGliding(true)
    const timer = setTimeout(() => setGliding(false), GLIDE_MS)
    return () => clearTimeout(timer)
  }, [signature])
  return gliding && !reduced ? 'on' : 'off'
}
