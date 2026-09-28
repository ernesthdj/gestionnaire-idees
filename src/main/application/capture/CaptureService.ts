import type { RootView } from '@shared/ipc/neurons'
import type { CreateNeuronInput } from '../neurons/NeuronService'

export interface CaptureDeps {
  readonly neurons: { create(input: CreateNeuronInput): Promise<RootView> }
  readonly drafts: { draft(): string; saveDraft(text: string): void }
  /** Ouvre la fenêtre principale en plongée dans ce neurone (`Ctrl+Entrée`). */
  readonly openDive: (rootId: string) => void
}

/**
 * Capture rapide (spec 003 US1) : le neurone est créé tout de suite, sans attendre l'IA (la catégorisation locale
 * se fait en arrière-plan dans `NeuronService`) ; le brouillon survit à une fermeture par `Échap`.
 */
export class CaptureService {
  constructor(private readonly deps: CaptureDeps) {}

  getDraft(): { text: string } {
    return { text: this.deps.drafts.draft() }
  }

  saveDraft(text: string): void {
    this.deps.drafts.saveDraft(text)
  }

  async submit(input: { text: string; diveNow: boolean }): Promise<{ rootId: string }> {
    const root = await this.deps.neurons.create({ text: input.text })
    this.deps.drafts.saveDraft('')
    if (input.diveNow) this.deps.openDive(root.id)
    return { rootId: root.id }
  }
}
