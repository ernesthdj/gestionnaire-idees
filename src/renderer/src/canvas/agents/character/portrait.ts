import { rng } from './random'
import { painter } from './sprites'
import type { AgentCharacter } from './mint'

/** Taille de la grille des sprites. */
export const GRID = 32

/**
 * Dessine les calques d'un personnage sur une grille 32 × 32 (`s` pixels par case) : silhouette, yeux, coiffe, objet.
 * Sert à extruder la créature 3D et d'image de repli quand la 3D n'est pas disponible.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, character: AgentCharacter, s = 1, dx = 0, dy = 0): void {
  for (const slot of LAYERS) drawLayer(ctx, character, slot, s, dx, dy)
}

export type LayerSlot = 'base' | 'yeux' | 'coiffe' | 'objet'
export const LAYERS: readonly LayerSlot[] = ['base', 'yeux', 'coiffe', 'objet']

const LAYER_SALT: Readonly<Record<Exclude<LayerSlot, 'base'>, number>> = { yeux: 2, coiffe: 3, objet: 4 }

/** Un seul calque (la 3D donne à chacun sa profondeur). */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  character: AgentCharacter,
  slot: LayerSlot,
  s = 1,
  dx = 0,
  dy = 0
): void {
  const p = painter(ctx, s, dx, dy, GRID)
  if (slot === 'base') character.base.draw(p, rng(character.seed + 31), 0)
  else character[slot].draw(p, character.base.A, rng(character.seed + LAYER_SALT[slot] * 7919), 0)
}
