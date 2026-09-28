import { budgetState, monthKey } from '../../domain/ai/cost'
import type { TaskKind } from '../../domain/ai/types'
import type { BudgetGuard as BudgetGuardPort } from './ports'

export interface BudgetSettings {
  readonly capCents: number
  readonly alertRatio: number
  /** Mois (`YYYY-MM`) débloqué manuellement au-delà du plafond, ou `null`. */
  readonly unlockedMonth: string | null
  readonly usdEurRate: number
}

export interface BudgetGuardDependencies {
  /** Somme des coûts Claude journalisés depuis le début du mois local (millicentimes). */
  readonly spentMillicentsThisMonth: () => Promise<number>
  readonly settings: () => Promise<BudgetSettings>
  /** Majorant du coût d'un appel de ce type avant envoi (millicentimes). */
  readonly estimateMillicents: (kind: TaskKind, usdEurRate: number) => number
  readonly now: () => Date
  /** Appelé une seule fois par mois, au franchissement du seuil d'alerte (montant en centimes). */
  readonly onAlert: (spentCents: number, capCents: number) => void
}

const MILLICENTS_PER_CENT = 1000

/** Plafond mensuel de l'IA externe (spec 001 US3) : vérifie avant l'appel, alerte après. */
export class BudgetGuard implements BudgetGuardPort {
  private alertedMonth: string | null = null

  constructor(private readonly deps: BudgetGuardDependencies) {}

  async check(kind: TaskKind): Promise<{ readonly allowed: boolean }> {
    const settings = await this.deps.settings()
    const month = monthKey(this.deps.now())
    if (settings.unlockedMonth === month) return { allowed: true }
    const spent = await this.deps.spentMillicentsThisMonth()
    const estimate = this.deps.estimateMillicents(kind, settings.usdEurRate)
    return { allowed: spent + estimate <= settings.capCents * MILLICENTS_PER_CENT }
  }

  /** Appelé après journalisation de l'appel : le total du mois l'inclut déjà. */
  async record(): Promise<void> {
    const settings = await this.deps.settings()
    const month = monthKey(this.deps.now())
    const spent = await this.deps.spentMillicentsThisMonth()
    const cap = settings.capCents * MILLICENTS_PER_CENT
    const state = budgetState(spent, cap, settings.alertRatio, settings.unlockedMonth === month)
    if (state !== 'normal' && this.alertedMonth !== month) {
      this.alertedMonth = month
      this.deps.onAlert(Math.ceil(spent / MILLICENTS_PER_CENT), settings.capCents)
    }
  }
}
