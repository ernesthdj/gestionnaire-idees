import type { AgentRole } from '@shared/agents/profile'
import { pick, rarer, rng, seedOf, tierRank, TIERS, type Tier, type Weighted } from './random'
import { METIER, UNIVERSES, type BaseVariant, type MetierRole, type Universe, type Variant } from './sprites'

/**
 * Personnage et chambre d'un agent (T008, L1o D13) : tirés une fois pour toutes de l'identifiant du profil (même
 * profil, même personnage, sur toutes les cartes), la chambre enrichie par le travail livré. Pur, sans dessin.
 */

export interface AgentCharacter {
  readonly seed: number
  readonly universe: Universe
  readonly base: BaseVariant
  readonly yeux: Variant
  readonly coiffe: Variant
  /** L'objet de métier du rôle quand l'univers en a un, sinon un objet tiré. */
  readonly objet: Variant
  readonly rank: Tier
}

const METIER_ROLES: ReadonlySet<string> = new Set<MetierRole>(['po', 'backend', 'frontend', 'qa'])
const isMetierRole = (role: AgentRole | null): role is MetierRole => role !== null && METIER_ROLES.has(role)

export function mintCharacter(profileId: string, role: AgentRole | null): AgentCharacter {
  const seed = seedOf(profileId)
  const r = rng(seed)
  const universe = pick(r, UNIVERSES)
  const base = pick(r, universe.base)
  const yeux = pick(r, universe.yeux)
  const coiffe = pick(r, universe.coiffe)
  const drawn = pick(r, universe.objet)
  const objet = isMetierRole(role) ? METIER[universe.key][role] : drawn
  const rank = [universe, base, yeux, coiffe, objet].reduce<Tier>((best, v) => rarer(best, v.tier), 'commun')
  return { seed, universe, base, yeux, coiffe, objet, rank }
}

// ---------- Chambre ----------

export const ROOM_SLOTS = ['papier', 'sol', 'bureau', 'lit', 'sport', 'deco', 'support', 'schema', 'ambiance'] as const
export type RoomSlot = (typeof ROOM_SLOTS)[number]

interface RoomVariant extends Weighted {
  readonly name: string
}
const RV = (name: string, tier: Tier, w: number): RoomVariant => ({ name, tier, w })

export const ROOM_SLOT_LABELS: Readonly<Record<RoomSlot, string>> = {
  papier: 'Papier peint',
  sol: 'Sol',
  bureau: 'Bureau',
  lit: 'Lit',
  sport: 'Coin sport',
  deco: 'Déco',
  support: 'Plan au mur',
  schema: 'Schéma',
  ambiance: 'Ambiance'
}

/** Variantes de chaque calque, de la plus commune à la plus rare (planche `dioramas-3d.html`). */
export const ROOM_VARIANTS: Readonly<Record<RoomSlot, readonly RoomVariant[]>> = {
  papier: [
    RV('Motif du thème', 'commun', 40),
    RV('Rayures', 'commun', 25),
    RV('Pois', 'peu', 15),
    RV('Briques', 'rare', 12),
    RV('Ciel étoilé', 'epique', 6),
    RV('Aquarelle arc-en-ciel', 'legend', 2)
  ],
  sol: [
    RV('Parquet', 'commun', 40),
    RV('Carrelage', 'commun', 30),
    RV('Moquette', 'peu', 16),
    RV('Herbe', 'rare', 10),
    RV('Nuages', 'epique', 3),
    RV('Damier doré', 'legend', 1)
  ],
  bureau: [
    RV('Bureau en bois', 'commun', 50),
    RV('Double écran', 'peu', 25),
    RV('Bureau gamer', 'rare', 15),
    RV('Bureau de ministre', 'epique', 8),
    RV('Console de vaisseau', 'legend', 2)
  ],
  lit: [
    RV('Lit simple', 'commun', 50),
    RV('Lit superposé', 'peu', 22),
    RV('Hamac', 'rare', 15),
    RV('Lit à baldaquin', 'epique', 10),
    RV('Lit-nuage', 'legend', 3)
  ],
  sport: [
    RV('Haltères', 'commun', 45),
    RV('Tapis de course', 'peu', 25),
    RV('Punching-ball', 'rare', 17),
    RV('Mini-piscine', 'epique', 10),
    RV('Trampoline', 'legend', 3)
  ],
  deco: [
    RV('Plante', 'commun', 40),
    RV('Bibliothèque', 'commun', 30),
    RV('Aquarium', 'rare', 18),
    RV('Borne d’arcade', 'epique', 9),
    RV('Statue de neurone dorée', 'legend', 3)
  ],
  support: [
    RV('Tableau blanc', 'commun', 40),
    RV('Liège à punaises', 'commun', 28),
    RV('Tableau noir', 'peu', 16),
    RV('Écran mural', 'rare', 10),
    RV('Hologramme', 'epique', 5),
    RV('Parchemin', 'legend', 1)
  ],
  schema: [
    RV('Deux boîtes', 'commun', 35),
    RV('Liste cochée', 'commun', 25),
    RV('Courbe qui monte', 'peu', 16),
    RV('Carte mentale', 'rare', 12),
    RV('Planning en barres', 'rare', 8),
    RV('Constellation de neurones', 'epique', 3),
    RV('Carte au trésor', 'legend', 1)
  ],
  ambiance: [
    RV('Jour', 'commun', 45),
    RV('Soir doré', 'peu', 25),
    RV('Néon', 'rare', 18),
    RV('Bougies', 'epique', 9),
    RV('Aurore', 'legend', 3)
  ]
}

export interface RoomTrait {
  readonly slot: RoomSlot
  readonly name: string
  readonly tier: Tier
}

export interface AgentRoom {
  readonly traits: Readonly<Record<RoomSlot, RoomTrait>>
  readonly rank: Tier
  /** Calques relevés par le travail livré. */
  readonly upgrades: number
}

/** Travail livré nécessaire pour chaque amélioration de la chambre : 1, 3, 6, 10, 15… (un palier de plus à chaque fois). */
export function upgradesFor(delivered: number): number {
  let count = 0
  let needed = 1
  while (delivered >= needed) {
    count++
    needed += count + 1
  }
  return count
}

/**
 * Chambre d'un agent : tirée de sa graine, puis chaque amélioration relève un calque d'un palier de rareté au moins
 * (tiré parmi les variantes plus rares que l'actuelle). Un calque déjà au plus rare n'est plus choisi. Déterministe.
 */
export function mintRoom(seed: number, delivered: number): AgentRoom {
  const r = rng(seed + 1013)
  const traits = {} as Record<RoomSlot, RoomTrait>
  for (const slot of ROOM_SLOTS) {
    const v = pick(r, ROOM_VARIANTS[slot])
    traits[slot] = { slot, name: v.name, tier: v.tier }
  }
  const upgrades = upgradesFor(Math.max(0, Math.floor(delivered)))
  for (let k = 0; k < upgrades; k++) {
    const up = rng(seed + 7919 * (k + 1))
    const open = ROOM_SLOTS.filter((slot) =>
      ROOM_VARIANTS[slot].some((v) => tierRank(v.tier) > tierRank(traits[slot].tier))
    )
    if (open.length === 0) break
    const slot = open[Math.floor(up() * open.length)] as RoomSlot
    const better = ROOM_VARIANTS[slot].filter((v) => tierRank(v.tier) > tierRank(traits[slot].tier))
    const v = pick(up, better)
    traits[slot] = { slot, name: v.name, tier: v.tier }
  }
  const rank = ROOM_SLOTS.reduce<Tier>((best, slot) => rarer(best, traits[slot].tier), TIERS[0])
  return { traits, rank, upgrades }
}
