import { create } from 'zustand'

/**
 * Agent en visio (L1o D13) : un clic sur sa chambre ouvre le volet de chat à côté de lui et le fait passer en visio ;
 * un seul à la fois. La clé est l'identifiant du nœud de l'agent sur la carte.
 */
interface VisioState {
  readonly key: string | null
  readonly since: number
  /** L'agent répond : sa tête bouge et sa réponse passe en sous-titres. */
  readonly talking: boolean
  readonly subtitle: string
  open(key: string): void
  close(): void
  speak(talking: boolean, subtitle: string): void
}

export const useVisio = create<VisioState>((set) => ({
  key: null,
  since: 0,
  talking: false,
  subtitle: '',
  open: (key) => set({ key, since: Date.now(), talking: false, subtitle: '' }),
  close: () => set({ key: null, talking: false, subtitle: '' }),
  speak: (talking, subtitle) => set({ talking, subtitle })
}))

/** Sous-titre : la fin de ce que l'agent dit, sans Markdown, coupée au début d'un mot. */
export function subtitleOf(text: string, max = 120): string {
  const plain = text
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/[#*_`>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const tail = plain.slice(-max)
  const space = tail.indexOf(' ')
  return `…${space === -1 ? tail : tail.slice(space + 1)}`
}
