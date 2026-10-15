import { useEffect, useState } from 'react'

/** Emplacement de la barre fine où la carte place la barre des vues de son projet (spec 033 D10). */
export const TOPBAR_SLOT_ID = 'topbar-structure-slot'

/** L'emplacement, une fois la barre fine montée ; `null` avant (ou hors de la page Idées). */
export function useTopbarSlot(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById(TOPBAR_SLOT_ID)), [])
  return slot
}
