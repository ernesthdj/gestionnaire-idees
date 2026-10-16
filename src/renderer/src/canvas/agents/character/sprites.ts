import type { Tier } from './random'

/**
 * Calques des personnages d'agents en 32 × 32 (T008, L1o D13), repris de la planche `docs/design/agents/`. Chaque
 * calque dessine sur une grille ; la créature 3D en est extrudée en voxels. Les couleurs sont celles des sprites, pas
 * des jetons du thème : ce sont des dessins.
 */

export interface Paint {
  px(x: number, y: number, c: string | undefined): void
  rect(x: number, y: number, w: number, h: number, c: string | undefined): void
  box(x: number, y: number, w: number, h: number, fill: string, line: string): void
  disc(cx: number, cy: number, r: number, c: string | undefined): void
}

/** Où la silhouette a ses yeux, le haut de sa tête et sa main : les autres calques s'y accrochent. */
export interface Anchors {
  readonly eyes: readonly [readonly [number, number], readonly [number, number]]
  readonly top: number
  readonly hand: readonly [number, number]
  readonly skin: string
}

export interface Variant {
  readonly name: string
  readonly tier: Tier
  readonly w: number
  readonly draw: (p: Paint, A: Anchors, r: () => number, f: number) => void
}

export interface BaseVariant {
  readonly name: string
  readonly tier: Tier
  readonly w: number
  readonly A: Anchors
  readonly draw: (p: Paint, r: () => number, f: number) => void
}

export type UniverseKey = 'robots' | 'sf' | 'fantasy' | 'wtf'
export type MetierRole = 'po' | 'backend' | 'frontend' | 'qa'

export interface Universe {
  readonly key: UniverseKey
  readonly name: string
  readonly w: number
  readonly tier: Tier
  readonly base: readonly BaseVariant[]
  readonly yeux: readonly Variant[]
  readonly coiffe: readonly Variant[]
  readonly objet: readonly Variant[]
}

/** Pinceau d'une grille `G × G`, chaque case dessinée en `s` pixels, décalée de `dx`, `dy`. */
export function painter(ctx: CanvasRenderingContext2D, s: number, dx = 0, dy = 0, G = 32): Paint {
  const px = (x: number, y: number, c: string | undefined): void => {
    const gx = Math.round(x + dx)
    const gy = Math.round(y + dy)
    if (gx < 0 || gy < 0 || gx > G - 1 || gy > G - 1 || c === undefined) return
    ctx.fillStyle = c
    ctx.fillRect(gx * s, gy * s, s, s)
  }
  const rect = (x: number, y: number, w: number, h: number, c: string | undefined): void => {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px(x + i, y + j, c)
  }
  const box = (x: number, y: number, w: number, h: number, fill: string, line: string): void => {
    rect(x, y, w, h, line)
    rect(x + 1, y + 1, w - 2, h - 2, fill)
  }
  const disc = (cx: number, cy: number, r: number, c: string | undefined): void => {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, c)
  }
  return { px, rect, box, disc }
}

const V = (name: string, tier: Tier, w: number, draw: Variant['draw']): Variant => ({ name, tier, w, draw })
const B = (name: string, tier: Tier, w: number, A: Anchors, draw: BaseVariant['draw']): BaseVariant => ({
  name,
  tier,
  w,
  A,
  draw
})
const eyes = (A: Anchors, fn: (x: number, y: number, i: number) => void): void =>
  A.eyes.forEach(([x, y], i) => fn(x, y, i))
/** Points isolés d'une même couleur. */
const dots = (p: Paint, pts: readonly (readonly [number, number])[], c: string): void =>
  pts.forEach(([x, y]) => p.px(x, y, c))
const mid = (A: Anchors): number => Math.round((A.eyes[0][0] + A.eyes[1][0]) / 2 + 1)

function boite(p: Paint, fill: string, line: string, body: string): void {
  p.box(10, 7, 12, 9, fill, line)
  p.rect(13, 14, 6, 1, line)
  p.px(11, 8, line)
  p.px(20, 8, line)
  p.rect(15, 16, 2, 2, line)
  p.box(9, 18, 14, 10, body, line)
  p.rect(12, 20, 8, 4, line)
  p.px(13, 21, '#3ee8a8')
  p.px(15, 21, '#f2b630')
  p.px(17, 21, '#e5484d')
  p.rect(6, 19, 3, 7, line)
  p.rect(23, 19, 3, 7, line)
  p.rect(11, 28, 3, 3, line)
  p.rect(18, 28, 3, 3, line)
}

const ROBOTS: Universe = {
  key: 'robots',
  name: 'Robots',
  w: 30,
  tier: 'commun',
  base: [
    B(
      'Robot boîte',
      'commun',
      35,
      {
        eyes: [
          [12, 10],
          [18, 10]
        ],
        top: 7,
        hand: [26, 24],
        skin: '#a9b2c3'
      },
      (p) => boite(p, '#a9b2c3', '#5b6478', '#8f99ac')
    ),
    B(
      'Robot dôme',
      'commun',
      30,
      {
        eyes: [
          [13, 10],
          [17, 10]
        ],
        top: 5,
        hand: [24, 21],
        skin: '#cfe9f2'
      },
      (p) => {
        p.box(10, 17, 12, 10, '#3fb6a8', '#24766d')
        p.rect(10, 20, 12, 1, '#24766d')
        p.disc(16, 11, 6, '#24766d')
        p.disc(16, 11, 5, '#cfe9f2')
        p.px(13, 8, '#ffffff')
        p.px(14, 7, '#ffffff')
        p.rect(10, 16, 12, 1, '#24766d')
        p.rect(7, 18, 3, 2, '#24766d')
        p.rect(22, 18, 3, 2, '#24766d')
        p.rect(12, 27, 9, 1, '#24766d')
        p.disc(12, 29, 2, '#1f2430')
        p.disc(20, 29, 2, '#1f2430')
        p.px(12, 29, '#9aa3b5')
        p.px(20, 29, '#9aa3b5')
      }
    ),
    B(
      'Robot à chenilles',
      'peu',
      20,
      {
        eyes: [
          [13, 8],
          [17, 8]
        ],
        top: 6,
        hand: [27, 13],
        skin: '#f2b630'
      },
      (p) => {
        p.box(11, 6, 10, 7, '#f2b630', '#9a6a10')
        p.box(8, 13, 16, 11, '#f2b630', '#9a6a10')
        p.rect(9, 17, 14, 2, '#1f2430')
        for (let x = 9; x < 23; x += 3) p.px(x, 17, '#f2b630')
        p.rect(24, 15, 4, 2, '#9a6a10')
        p.rect(27, 12, 2, 4, '#9a6a10')
        p.box(5, 24, 22, 6, '#2a2f3a', '#1f2430')
        for (let x = 8; x < 26; x += 4) p.disc(x, 27, 1, '#5b6478')
      }
    ),
    B(
      'Mécha',
      'epique',
      10,
      {
        eyes: [
          [13, 10],
          [17, 10]
        ],
        top: 6,
        hand: [27, 21],
        skin: '#1f2430'
      },
      (p) => {
        p.box(4, 14, 24, 6, '#5560a8', '#2f3570')
        p.box(12, 6, 8, 8, '#7b85cf', '#2f3570')
        p.rect(13, 10, 6, 2, '#1f2430')
        p.box(10, 20, 12, 7, '#5560a8', '#2f3570')
        p.disc(16, 23, 1, '#36d1f2')
        p.rect(4, 20, 4, 6, '#2f3570')
        p.rect(24, 20, 4, 6, '#2f3570')
        p.box(10, 27, 4, 4, '#2f3570', '#1f2430')
        p.box(18, 27, 4, 4, '#2f3570', '#1f2430')
        p.px(6, 16, '#e5484d')
        p.px(25, 16, '#e5484d')
      }
    ),
    B(
      'Robot doré',
      'legend',
      5,
      {
        eyes: [
          [12, 10],
          [18, 10]
        ],
        top: 7,
        hand: [26, 24],
        skin: '#f2c14e'
      },
      (p, r, f) => {
        boite(p, '#f2c14e', '#9a6a10', '#e8b23a')
        const x = 9 + (f % 14)
        p.rect(x, 18, 1, 10, '#fff4c2')
      }
    )
  ],
  yeux: [
    V('LED bleues', 'commun', 40, (p, A) =>
      eyes(A, (x, y) => {
        p.rect(x, y, 2, 2, '#36d1f2')
        p.px(x, y, '#bff6ff')
      })
    ),
    V('LED rouges', 'commun', 30, (p, A) => eyes(A, (x, y) => p.rect(x, y, 2, 2, '#e5484d'))),
    V('Visière cyclope', 'rare', 18, (p, A) => {
      const [a, b] = A.eyes
      p.rect(a[0] - 1, a[1], b[0] - a[0] + 4, 2, '#ff3b30')
      p.px(a[0], a[1], '#ffb3ad')
    }),
    V('Yeux spirale', 'epique', 9, (p, A) =>
      eyes(A, (x, y) => {
        p.rect(x - 1, y - 1, 3, 3, '#ffffff')
        p.px(x, y, '#1f2430')
        p.px(x + 1, y - 1, '#1f2430')
        p.px(x - 1, y + 1, '#1f2430')
      })
    ),
    V('Yeux arc-en-ciel', 'legend', 3, (p, A, r, f) => {
      const c = ['#ff3b30', '#ff9a1a', '#ffd23f', '#3ee8a8', '#36d1f2', '#9b6bff']
      eyes(A, (x, y, i) => p.rect(x, y, 2, 2, c[(f + i * 2) % 6]))
    })
  ],
  coiffe: [
    V('Rien', 'commun', 35, () => {}),
    V('Antenne', 'commun', 25, (p, A) => {
      p.rect(16, A.top - 4, 1, 4, '#5b6478')
      p.px(16, A.top - 5, '#e5484d')
    }),
    V('Double antenne', 'peu', 18, (p, A) => {
      for (const x of [12, 20]) {
        p.rect(x, A.top - 3, 1, 3, '#5b6478')
        p.px(x, A.top - 4, '#3ee8a8')
      }
    }),
    V('Hélice', 'rare', 12, (p, A, r, f) => {
      p.rect(16, A.top - 2, 1, 2, '#5b6478')
      if (f % 2) p.rect(12, A.top - 3, 9, 1, '#e5484d')
      else p.rect(15, A.top - 3, 3, 1, '#e5484d')
    }),
    V('Gyrophare', 'epique', 7, (p, A, r, f) => {
      p.rect(14, A.top - 3, 4, 3, f % 2 ? '#e5484d' : '#ff9a9a')
      p.rect(13, A.top - 1, 6, 1, '#5b6478')
    }),
    V('Couronne de circuits', 'legend', 3, (p, A) => {
      p.rect(11, A.top - 2, 11, 2, '#3ee8a8')
      for (const x of [11, 16, 21]) p.rect(x, A.top - 4, 1, 2, '#3ee8a8')
      p.px(16, A.top - 1, '#ffd23f')
    })
  ],
  objet: [
    V('Rien', 'commun', 40, () => {}),
    V('Clé à molette', 'commun', 25, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 6, 2, 7, '#9aa3b5')
      p.rect(x - 1, y - 8, 4, 2, '#9aa3b5')
    }),
    V('Batterie', 'peu', 18, (p, A) => {
      const [x, y] = A.hand
      p.box(x - 1, y - 5, 4, 6, '#3ee8a8', '#1f2430')
      p.rect(x, y - 6, 2, 1, '#1f2430')
    }),
    V('Fer à souder', 'rare', 10, (p, A, r, f) => {
      const [x, y] = A.hand
      p.rect(x, y - 6, 2, 6, '#e5484d')
      p.px(x, y - 7, '#9aa3b5')
      if (f % 2) p.px(x + 1, y - 9, '#c9d2e3')
    }),
    V('Mini-drone', 'epique', 5, (p, A, r, f) => {
      const [x, y] = A.hand
      const h = f % 4 < 2 ? 0 : 1
      p.rect(x - 1, y - 12 + h, 5, 2, '#5b6478')
      p.rect(x - 2, y - 13 + h, 2, 1, '#9aa3b5')
      p.rect(x + 3, y - 13 + h, 2, 1, '#9aa3b5')
      p.px(x + 1, y - 10 + h, '#36d1f2')
    }),
    V('Canon plasma', 'legend', 2, (p, A, r, f) => {
      const [x, y] = A.hand
      p.rect(x - 2, y - 3, 5, 3, '#5560a8')
      p.rect(x + 3, y - 2, 2, 1, '#2f3570')
      p.px(x + 5, y - 2, f % 2 ? '#7ef0ff' : '#ffffff')
    })
  ]
}

const SF: Universe = {
  key: 'sf',
  name: 'Science-fiction',
  w: 30,
  tier: 'commun',
  base: [
    B(
      'Alien gris',
      'commun',
      35,
      {
        eyes: [
          [11, 11],
          [18, 11]
        ],
        top: 4,
        hand: [22, 24],
        skin: '#a7b8a0'
      },
      (p) => {
        p.disc(16, 11, 7, '#6f8467')
        p.disc(16, 11, 6, '#a7b8a0')
        p.rect(14, 17, 4, 2, '#a7b8a0')
        p.px(15, 16, '#6f8467')
        p.px(16, 16, '#6f8467')
        p.rect(13, 20, 6, 8, '#8fa088')
        p.rect(11, 21, 2, 6, '#8fa088')
        p.rect(19, 21, 2, 6, '#8fa088')
        p.rect(13, 28, 2, 3, '#6f8467')
        p.rect(17, 28, 2, 3, '#6f8467')
      }
    ),
    B(
      'Pieuvre spatiale',
      'commun',
      30,
      {
        eyes: [
          [12, 11],
          [18, 11]
        ],
        top: 5,
        hand: [25, 21],
        skin: '#c46bd6'
      },
      (p) => {
        p.disc(16, 12, 7, '#8e3fa3')
        p.disc(16, 12, 6, '#c46bd6')
        p.px(12, 8, '#e3a3f0')
        p.px(19, 9, '#e3a3f0')
        p.px(14, 15, '#e3a3f0')
        ;[9, 12, 16, 19, 22].forEach((x, i) => {
          for (let y = 18; y < 30; y++) p.rect(x + ((y + i) % 4 < 2 ? 0 : 1), y, 2, 1, '#c46bd6')
        })
      }
    ),
    B(
      'Astronaute alien',
      'peu',
      20,
      {
        eyes: [
          [13, 11],
          [18, 11]
        ],
        top: 4,
        hand: [25, 24],
        skin: '#7ed957'
      },
      (p) => {
        p.box(9, 18, 14, 11, '#eef1f6', '#9aa3b5')
        p.rect(13, 21, 6, 3, '#9aa3b5')
        p.px(14, 22, '#e5484d')
        p.px(16, 22, '#36d1f2')
        p.rect(10, 29, 4, 2, '#5b6478')
        p.rect(18, 29, 4, 2, '#5b6478')
        p.rect(6, 19, 3, 7, '#eef1f6')
        p.rect(23, 19, 3, 7, '#eef1f6')
        p.disc(16, 11, 7, '#9aa3b5')
        p.disc(16, 11, 6, '#123047')
        p.disc(16, 12, 4, '#7ed957')
        p.px(12, 8, '#ffffff')
        p.px(13, 7, '#ffffff')
      }
    ),
    B(
      'Cerveau en bocal',
      'epique',
      10,
      {
        eyes: [
          [13, 20],
          [18, 20]
        ],
        top: 6,
        hand: [25, 22],
        skin: '#3a4152'
      },
      (p) => {
        p.box(10, 7, 12, 13, '#0f2a3a', '#9cc9e0')
        p.rect(9, 6, 14, 2, '#5b6478')
        p.disc(16, 13, 4, '#f08fb0')
        dots(
          p,
          [
            [14, 12],
            [15, 13],
            [17, 11],
            [18, 13],
            [16, 15]
          ],
          '#c45a80'
        )
        p.px(12, 16, '#bfe6ff')
        p.px(20, 10, '#bfe6ff')
        p.box(9, 19, 14, 4, '#5b6478', '#3a4152')
        p.rect(10, 23, 2, 6, '#3a4152')
        p.rect(20, 23, 2, 6, '#3a4152')
        p.rect(8, 29, 4, 2, '#3a4152')
        p.rect(20, 29, 4, 2, '#3a4152')
      }
    ),
    B(
      'Entité de cristal',
      'legend',
      5,
      {
        eyes: [
          [13, 13],
          [18, 13]
        ],
        top: 3,
        hand: [25, 20],
        skin: '#7ef0ff'
      },
      (p, r, f) => {
        for (let y = 3; y < 27; y++) {
          const w = Math.round(y < 14 ? (y - 3) * 0.65 : (26 - y) * 0.65)
          p.rect(16 - w, y, w, 1, '#7ef0ff')
          p.rect(16, y, w, 1, '#b388ff')
        }
        const d = f % 4
        p.px(6, 10 + d, '#b388ff')
        p.px(26, 16 - d, '#7ef0ff')
        p.px(8, 22 - d, '#7ef0ff')
      }
    )
  ],
  yeux: [
    V('Grands yeux noirs', 'commun', 45, (p, A) =>
      eyes(A, (x, y) => {
        p.rect(x - 1, y, 3, 2, '#0d0d1a')
        p.px(x, y, '#ffffff')
      })
    ),
    V('Trois yeux', 'peu', 30, (p, A) => {
      eyes(A, (x, y) => p.rect(x, y, 2, 2, '#0d0d1a'))
      p.rect(mid(A) - 1, A.eyes[0][1] - 3, 2, 2, '#0d0d1a')
    }),
    V('Œil unique géant', 'rare', 18, (p, A) => {
      const m = mid(A),
        y = A.eyes[0][1] + 1
      p.disc(m, y, 2, '#ffffff')
      p.px(m, y, '#0d0d1a')
      p.px(m - 1, y - 1, '#ffffff')
    }),
    V('Yeux galaxie', 'legend', 7, (p, A, r, f) =>
      eyes(A, (x, y) => {
        p.rect(x, y, 2, 2, '#2b1a66')
        p.px(x + (f % 2), y + ((f >> 1) % 2), '#ffffff')
      })
    )
  ],
  coiffe: [
    V('Rien', 'commun', 40, () => {}),
    V('Antennes à boules', 'commun', 30, (p, A) => {
      for (const x of [12, 20]) {
        p.rect(x, A.top - 3, 1, 3, '#5b6478')
        p.disc(x, A.top - 4, 1, '#ffd23f')
      }
    }),
    V('Halo d’énergie', 'rare', 18, (p, A, r, f) => {
      p.rect(11, A.top - 2, 11, 1, f % 2 ? '#7ef0ff' : '#c4fbff')
      p.px(10, A.top - 1, '#7ef0ff')
      p.px(22, A.top - 1, '#7ef0ff')
    }),
    V('Implant crânien', 'epique', 8, (p, A) => {
      p.rect(18, A.top, 4, 2, '#9aa3b5')
      p.px(19, A.top, '#e5484d')
      p.px(21, A.top + 1, '#36d1f2')
    }),
    V('Couronne d’orbites', 'legend', 4, (p, A, r, f) => {
      p.rect(10, A.top - 2, 13, 1, '#5b6478')
      const x = 10 + (f % 13)
      p.disc(x, A.top - 2, 1, '#ffd23f')
      p.px(22 - (f % 13), A.top - 2, '#36d1f2')
    })
  ],
  objet: [
    V('Rien', 'commun', 40, () => {}),
    V('Pistolet laser', 'commun', 25, (p, A) => {
      const [x, y] = A.hand
      p.rect(x - 1, y - 3, 5, 2, '#9aa3b5')
      p.rect(x - 1, y - 1, 2, 2, '#5b6478')
      p.px(x + 4, y - 3, '#e5484d')
    }),
    V('Soucoupe miniature', 'rare', 18, (p, A, r, f) => {
      const [x, y] = A.hand
      const h = f % 4 < 2 ? 0 : 1
      p.rect(x - 2, y - 10 + h, 6, 1, '#9aa3b5')
      p.rect(x - 1, y - 11 + h, 4, 1, '#bfe6ff')
      p.px(x, y - 9 + h, '#7ed957')
    }),
    V('Cube holographique', 'epique', 12, (p, A, r, f) => {
      const [x, y] = A.hand
      p.box(x - 1, y - 6, 4, 4, f % 2 ? 'rgba(126,240,255,0.5)' : 'rgba(179,136,255,0.5)', '#7ef0ff')
    }),
    V('Trou noir de poche', 'legend', 5, (p, A, r, f) => {
      const [x, y] = A.hand
      p.disc(x + 1, y - 5, 2, '#000000')
      p.px(x + 1 + ((f % 3) - 1) * 3, y - 5, '#b388ff')
      p.px(x + 1, y - 5 + ((f % 3) - 1) * 3, '#ff9a1a')
    })
  ]
}

const FANTASY: Universe = {
  key: 'fantasy',
  name: 'Heroic fantasy',
  w: 30,
  tier: 'commun',
  base: [
    B(
      'Slime',
      'commun',
      35,
      {
        eyes: [
          [12, 19],
          [18, 19]
        ],
        top: 13,
        hand: [26, 24],
        skin: '#5fd068'
      },
      (p) => {
        p.disc(16, 22, 8, '#2f9e44')
        p.disc(16, 22, 7, '#5fd068')
        p.rect(8, 29, 17, 2, '#2f9e44')
        p.rect(9, 29, 15, 1, '#5fd068')
        p.px(12, 17, '#b8f5c0')
        p.px(13, 16, '#b8f5c0')
        p.px(12, 18, '#b8f5c0')
      }
    ),
    B(
      'Champignon',
      'commun',
      28,
      {
        eyes: [
          [13, 17],
          [18, 17]
        ],
        top: 3,
        hand: [24, 22],
        skin: '#f3e3c7'
      },
      (p) => {
        for (let y = 2; y <= 13; y++)
          for (let x = 5; x < 28; x++) if ((x - 16) ** 2 + (y - 13) ** 2 * 1.6 <= 100) p.px(x, y, '#d9363e')
        dots(
          p,
          [
            [11, 7],
            [12, 7],
            [19, 6],
            [20, 6],
            [15, 4],
            [16, 4],
            [22, 10],
            [9, 11]
          ],
          '#ffffff'
        )
        p.box(12, 13, 8, 13, '#f3e3c7', '#b89f78')
        p.px(15, 21, '#8a6a45')
        p.px(16, 21, '#8a6a45')
        p.rect(11, 26, 4, 3, '#b89f78')
        p.rect(17, 26, 4, 3, '#b89f78')
      }
    ),
    B(
      'Golem',
      'peu',
      20,
      {
        eyes: [
          [12, 10],
          [18, 10]
        ],
        top: 5,
        hand: [27, 24],
        skin: '#8a8070'
      },
      (p) => {
        p.box(10, 5, 12, 10, '#8a8070', '#5a5248')
        p.box(7, 15, 18, 12, '#9a907e', '#5a5248')
        p.box(3, 16, 4, 10, '#8a8070', '#5a5248')
        p.box(25, 16, 4, 10, '#8a8070', '#5a5248')
        p.box(9, 27, 5, 4, '#5a5248', '#3d3730')
        p.box(18, 27, 5, 4, '#5a5248', '#3d3730')
        dots(
          p,
          [
            [11, 5],
            [12, 5],
            [20, 15],
            [21, 15],
            [8, 22]
          ],
          '#5fd068'
        )
        dots(
          p,
          [
            [15, 19],
            [16, 20],
            [17, 19],
            [16, 21]
          ],
          '#36d1f2'
        )
      }
    ),
    B(
      'Spectre',
      'rare',
      12,
      {
        eyes: [
          [13, 11],
          [18, 11]
        ],
        top: 3,
        hand: [25, 20],
        skin: '#0d0d1a'
      },
      (p, r, f) => {
        p.disc(16, 11, 8, '#3d2a66')
        p.disc(16, 12, 5, '#0d0d1a')
        for (let y = 17; y < 30; y++) {
          const w = 7 + Math.floor((y - 17) / 3)
          p.rect(16 - w, y, 2 * w, 1, '#3d2a66')
        }
        for (let x = 9; x < 24; x += 3) p.px(x, 30 + ((x + f) % 2), '#3d2a66')
      }
    ),
    B(
      'Dragonnet',
      'epique',
      8,
      {
        eyes: [
          [13, 9],
          [18, 9]
        ],
        top: 4,
        hand: [24, 26],
        skin: '#4fb36b'
      },
      (p) => {
        for (let i = 0; i < 7; i++) {
          p.rect(3 + i, 12 + i, 1, 8 - i, '#7b3fa0')
          p.rect(28 - i, 12 + i, 1, 8 - i, '#7b3fa0')
        }
        p.disc(16, 20, 6, '#4fb36b')
        p.disc(16, 22, 3, '#f2d07a')
        p.disc(16, 10, 5, '#4fb36b')
        p.rect(14, 13, 4, 2, '#3d8f55')
        p.px(14, 13, '#1f2430')
        p.px(17, 13, '#1f2430')
        p.px(12, 5, '#f2d07a')
        p.px(11, 4, '#f2d07a')
        p.px(20, 5, '#f2d07a')
        p.px(21, 4, '#f2d07a')
        p.rect(21, 25, 5, 2, '#4fb36b')
        p.px(26, 24, '#4fb36b')
        p.rect(12, 26, 3, 2, '#3d8f55')
        p.rect(17, 26, 3, 2, '#3d8f55')
      }
    ),
    B(
      'Élémentaire de feu',
      'legend',
      3,
      {
        eyes: [
          [13, 14],
          [18, 14]
        ],
        top: 3,
        hand: [25, 22],
        skin: '#ff9a1a'
      },
      (p, r, f) => {
        for (let y = 3; y < 30; y++) {
          const w = (y < 12 ? Math.round((y - 3) * 0.8) : y < 24 ? 7 : 7 - (y - 24)) + ((y + f) % 3 === 0 ? 1 : 0)
          p.rect(16 - w, y, 2 * w, 1, '#ff4d1a')
          if (w > 2) p.rect(18 - w, y, 2 * w - 4, 1, '#ff9a1a')
          if (w > 4) p.rect(20 - w, y, 2 * w - 8, 1, '#ffd23f')
        }
      }
    )
  ],
  yeux: [
    V('Points', 'commun', 45, (p, A) =>
      eyes(A, (x, y) => {
        p.px(x, y + 1, '#1f2430')
        p.px(x + 1, y + 1, '#1f2430')
      })
    ),
    V('Yeux brillants', 'peu', 30, (p, A) =>
      eyes(A, (x, y) => {
        p.rect(x, y, 2, 2, '#ffe48a')
        p.px(x + 1, y, '#ffffff')
      })
    ),
    V('Yeux de flamme', 'rare', 18, (p, A, r, f) =>
      eyes(A, (x, y) => {
        p.px(x, y + 1, '#ff4d1a')
        p.px(x + 1, y + 1, '#ffd23f')
        p.px(x + (f % 2), y, '#ff9a1a')
      })
    ),
    V('Yeux runiques', 'legend', 7, (p, A, r, f) =>
      eyes(A, (x, y) => {
        p.rect(x, y, 2, 2, '#36d1f2')
        if (f % 2) {
          p.px(x, y - 1, '#9cf2ff')
          p.px(x + 1, y + 2, '#9cf2ff')
        }
      })
    )
  ],
  coiffe: [
    V('Rien', 'commun', 30, () => {}),
    V('Chapeau de magicien', 'peu', 25, (p, A) => {
      for (let i = 0; i < 8; i++) p.rect(16 - Math.floor(i / 2), A.top - 8 + i, Math.floor(i / 2) * 2 + 1, 1, '#3b2f9e')
      p.rect(10, A.top, 13, 1, '#3b2f9e')
      p.px(16, A.top - 4, '#ffd23f')
    }),
    V('Casque à cornes', 'peu', 20, (p, A) => {
      p.rect(11, A.top - 1, 10, 2, '#9aa3b5')
      p.px(10, A.top - 2, '#f3e3c7')
      p.px(9, A.top - 3, '#f3e3c7')
      p.px(21, A.top - 2, '#f3e3c7')
      p.px(22, A.top - 3, '#f3e3c7')
    }),
    V('Couronne elfique', 'rare', 15, (p, A) => {
      p.rect(11, A.top - 1, 10, 1, '#c9d2e3')
      for (const x of [12, 16, 20]) p.px(x, A.top - 2, '#c9d2e3')
      p.px(16, A.top - 1, '#3ee8a8')
    }),
    V('Cornes de démon', 'epique', 7, (p, A) => {
      for (const s of [-1, 1]) {
        const x = 16 + s * 5
        p.px(x, A.top - 1, '#8a1c1c')
        p.px(x + s, A.top - 2, '#8a1c1c')
        p.px(x + s, A.top - 3, '#c0392b')
      }
    }),
    V('Auréole maudite', 'legend', 3, (p, A, r, f) => {
      p.rect(12, A.top - 3, 9, 1, f % 2 ? '#9b6bff' : '#5fd068')
      p.px(11, A.top - 2, '#9b6bff')
      p.px(21, A.top - 2, '#9b6bff')
    })
  ],
  objet: [
    V('Rien', 'commun', 40, () => {}),
    V('Potion', 'commun', 25, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 6, 2, 2, '#c9d2e3')
      p.disc(x + 1, y - 2, 2, '#e5484d')
      p.px(x, y - 3, '#ff9a9a')
    }),
    V('Bâton', 'peu', 18, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 12, 1, 15, '#8a5a2b')
      p.disc(x, y - 13, 1, '#36d1f2')
    }),
    V('Épée runique', 'rare', 10, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 12, 1, 10, '#c9d2e3')
      p.rect(x - 2, y - 2, 5, 1, '#8a5a2b')
      p.rect(x, y - 1, 1, 2, '#8a5a2b')
      p.px(x, y - 8, '#36d1f2')
    }),
    V('Grimoire', 'epique', 5, (p, A) => {
      const [x, y] = A.hand
      p.box(x - 2, y - 5, 5, 6, '#5b2a8c', '#2e1648')
      p.px(x, y - 3, '#ffd23f')
    }),
    V('Œuf de dragon', 'legend', 2, (p, A, r, f) => {
      const [x, y] = A.hand
      const w = f % 4 === 0 ? 1 : 0
      p.disc(x + w, y - 3, 2, '#c0392b')
      p.px(x + w - 1, y - 4, '#f2c14e')
      p.px(x + w + 1, y - 2, '#f2c14e')
    })
  ]
}

const WTF: Universe = {
  key: 'wtf',
  name: 'WTF décalé',
  w: 10,
  tier: 'rare',
  base: [
    B(
      'Grille-pain',
      'commun',
      28,
      {
        eyes: [
          [11, 19],
          [18, 19]
        ],
        top: 9,
        hand: [27, 21],
        skin: '#c9cfdb'
      },
      (p) => {
        p.box(11, 9, 4, 7, '#d9a35a', '#8a5a2b')
        p.box(17, 10, 4, 6, '#d9a35a', '#8a5a2b')
        p.box(7, 14, 18, 12, '#c9cfdb', '#7d879a')
        p.rect(10, 14, 6, 1, '#3a4152')
        p.rect(16, 14, 6, 1, '#3a4152')
        p.rect(9, 16, 1, 6, '#eef1f6')
        p.rect(25, 17, 2, 4, '#3a4152')
        p.rect(14, 23, 4, 1, '#7d879a')
        p.rect(9, 26, 2, 4, '#3a4152')
        p.rect(21, 26, 2, 4, '#3a4152')
        p.rect(8, 30, 4, 1, '#3a4152')
        p.rect(20, 30, 4, 1, '#3a4152')
      }
    ),
    B(
      'Canard en plastique',
      'commun',
      26,
      {
        eyes: [
          [13, 9],
          [18, 9]
        ],
        top: 4,
        hand: [26, 24],
        skin: '#ffd84a'
      },
      (p) => {
        p.disc(16, 23, 8, '#f2c12e')
        p.disc(16, 23, 7, '#ffd84a')
        p.disc(16, 10, 6, '#ffd84a')
        p.rect(14, 13, 4, 2, '#ff8c1a')
        p.px(13, 14, '#ff8c1a')
        p.px(18, 14, '#ff8c1a')
        p.rect(10, 21, 4, 4, '#f2c12e')
        p.px(12, 7, '#fff6c2')
      }
    ),
    B(
      'Plante en pot',
      'commun',
      22,
      {
        eyes: [
          [13, 24],
          [18, 24]
        ],
        top: 4,
        hand: [25, 22],
        skin: '#c8663b'
      },
      (p) => {
        p.box(10, 21, 12, 9, '#c8663b', '#8a4325')
        p.rect(9, 20, 14, 2, '#d97a4f')
        p.rect(10, 20, 12, 1, '#5a3b26')
        p.rect(15, 8, 2, 12, '#3d8f55')
        p.rect(9, 11, 6, 3, '#5fd068')
        p.rect(17, 8, 6, 3, '#5fd068')
        p.rect(10, 15, 5, 2, '#4fb36b')
        p.rect(17, 13, 5, 2, '#4fb36b')
        p.disc(16, 5, 1, '#ff7ab5')
        p.px(16, 5, '#ffd23f')
      }
    ),
    B(
      'Chaussette',
      'peu',
      12,
      {
        eyes: [
          [13, 9],
          [18, 9]
        ],
        top: 4,
        hand: [26, 22],
        skin: '#f4f6fb'
      },
      (p) => {
        p.rect(9, 3, 14, 20, '#9aa3b5')
        p.rect(9, 21, 18, 8, '#9aa3b5')
        p.rect(10, 4, 12, 18, '#f4f6fb')
        p.rect(10, 22, 16, 6, '#f4f6fb')
        p.rect(10, 5, 12, 2, '#e5484d')
        p.rect(10, 14, 12, 2, '#3b7ff0')
        p.rect(10, 18, 12, 1, '#e5484d')
        p.rect(10, 24, 4, 4, '#e5484d')
        p.rect(23, 22, 3, 6, '#3b7ff0')
      }
    ),
    B(
      'Brique de lait',
      'rare',
      7,
      {
        eyes: [
          [13, 14],
          [18, 14]
        ],
        top: 3,
        hand: [25, 21],
        skin: '#ffffff'
      },
      (p) => {
        for (let i = 0; i < 4; i++) p.rect(10 + i, 3 + i, 12 - 2 * i, 1, '#e8eef8')
        p.box(9, 7, 14, 21, '#ffffff', '#9aa3b5')
        p.rect(9, 19, 14, 5, '#3b7ff0')
        dots(
          p,
          [
            [11, 9],
            [12, 9],
            [20, 11],
            [21, 11],
            [11, 25]
          ],
          '#1f2430'
        )
        p.rect(11, 28, 2, 3, '#5b6478')
        p.rect(19, 28, 2, 3, '#5b6478')
      }
    ),
    B(
      'Banane',
      'epique',
      4,
      {
        eyes: [
          [14, 13],
          [18, 12]
        ],
        top: 4,
        hand: [24, 21],
        skin: '#ffe04a'
      },
      (p) => {
        for (let y = 4; y < 29; y++) {
          const c = 13 + Math.round(6 * Math.sin(((y - 4) / 24) * Math.PI))
          const w = y < 8 || y > 25 ? 1 : 3
          p.rect(c - w, y, 2 * w, 1, '#ffe04a')
          p.px(c - w, y, '#c9a227')
        }
        p.px(13, 4, '#5a3b26')
        p.px(13, 28, '#5a3b26')
      }
    ),
    B(
      'Part de pizza',
      'legend',
      1,
      {
        eyes: [
          [14, 11],
          [18, 11]
        ],
        top: 5,
        hand: [25, 19],
        skin: '#f2c14e'
      },
      (p, r, f) => {
        const d = f % 8 < 4 ? 0 : -1
        for (let y = 5; y < 28; y++) {
          const w = Math.round((27 - y) * 0.45)
          p.rect(16 - w, y + d, 2 * w, 1, '#f2c14e')
        }
        p.rect(6, 5 + d, 21, 3, '#c9842a')
        p.disc(13, 15 + d, 1, '#c0392b')
        p.disc(19, 14 + d, 1, '#c0392b')
        p.disc(16, 20 + d, 1, '#c0392b')
      }
    )
  ],
  yeux: [
    V('Yeux mobiles', 'commun', 45, (p, A, r, f) =>
      eyes(A, (x, y, i) => {
        p.rect(x - 1, y - 1, 3, 3, '#ffffff')
        const step = (f + i) % 4
        const ox = step === 1 || step === 2 ? 2 : 0
        const oy = step >= 2 ? 2 : 0
        p.px(x - 1 + ox, y - 1 + oy, '#1f2430')
      })
    ),
    V('Lunettes de soleil', 'peu', 25, (p, A) => {
      const [a, b] = A.eyes
      p.rect(a[0] - 1, a[1], b[0] - a[0] + 4, 2, '#1f2430')
      p.px(a[0], a[1], '#5b6478')
    }),
    V('Monocle', 'rare', 15, (p, A) => {
      eyes(A, (x, y) => p.px(x, y + 1, '#1f2430'))
      const [x, y] = A.eyes[1]
      p.rect(x - 1, y - 1, 4, 1, '#f2c14e')
      p.rect(x - 1, y + 2, 4, 1, '#f2c14e')
      p.px(x - 1, y, '#f2c14e')
      p.px(x - 1, y + 1, '#f2c14e')
      p.px(x + 2, y, '#f2c14e')
      p.px(x + 2, y + 1, '#f2c14e')
      p.rect(x + 2, y + 3, 1, 4, '#f2c14e')
    }),
    V('Yeux cœur', 'epique', 10, (p, A) =>
      eyes(A, (x, y) => {
        p.px(x - 1, y, '#e5484d')
        p.px(x + 1, y, '#e5484d')
        p.rect(x - 1, y + 1, 3, 1, '#e5484d')
        p.px(x, y + 2, '#e5484d')
      })
    ),
    V('Bandeau « censuré »', 'legend', 5, (p, A) => {
      const [a, b] = A.eyes
      p.rect(a[0] - 2, a[1], b[0] - a[0] + 6, 2, '#000000')
      p.px(a[0] + 1, a[1], '#ffffff')
      p.px(b[0], a[1] + 1, '#ffffff')
    })
  ],
  coiffe: [
    V('Rien', 'commun', 30, () => {}),
    V('Chapeau de fête', 'commun', 25, (p, A) => {
      for (let i = 0; i < 6; i++)
        p.rect(16 - Math.floor(i / 2), A.top - 6 + i, Math.floor(i / 2) * 2 + 1, 1, i % 2 ? '#ff7ab5' : '#36d1f2')
      p.px(16, A.top - 7, '#ffd23f')
    }),
    V('Casquette à hélice', 'peu', 20, (p, A, r, f) => {
      p.rect(12, A.top - 1, 9, 2, '#e5484d')
      p.rect(16, A.top - 2, 1, 1, '#5b6478')
      if (f % 2) p.rect(13, A.top - 3, 7, 1, '#ffd23f')
      else p.rect(15, A.top - 3, 3, 1, '#3b7ff0')
    }),
    V('Perruque disco', 'rare', 13, (p, A) => {
      const c = ['#ff2fb0', '#ffd23f', '#2fe6ff', '#7ed957']
      for (let i = 0; i < 4; i++) p.rect(10 + i * 3, A.top - 3, 3, 3, c[i])
    }),
    V('Cône de signalisation', 'epique', 9, (p, A) => {
      for (let i = 0; i < 6; i++)
        p.rect(16 - Math.floor(i / 2), A.top - 6 + i, Math.floor(i / 2) * 2 + 1, 1, i === 3 ? '#ffffff' : '#ff8c1a')
      p.rect(12, A.top, 9, 1, '#ff8c1a')
    }),
    V('Petit canard', 'legend', 3, (p, A) => {
      p.disc(16, A.top - 3, 2, '#ffd84a')
      p.px(18, A.top - 3, '#ff8c1a')
      p.px(16, A.top - 4, '#1f2430')
    })
  ],
  objet: [
    V('Rien', 'commun', 40, () => {}),
    V('Baguette de pain', 'commun', 25, (p, A) => {
      const [x, y] = A.hand
      for (let i = 0; i < 10; i++) p.px(x - 2 + Math.floor(i / 2), y - i, '#d9a35a')
      p.px(x, y - 4, '#8a5a2b')
    }),
    V('Ballon rouge', 'peu', 18, (p, A, r, f) => {
      const [x, y] = A.hand
      const h = f % 6 < 3 ? 0 : 1
      p.rect(x, y - 8, 1, 8, '#5b6478')
      p.disc(x, y - 11 + h, 2, '#e5484d')
      p.px(x - 1, y - 12 + h, '#ff9a9a')
    }),
    V('Trompette', 'rare', 10, (p, A) => {
      const [x, y] = A.hand
      p.rect(x - 3, y - 3, 6, 1, '#f2c14e')
      p.rect(x + 3, y - 5, 2, 5, '#f2c14e')
      p.px(x - 1, y - 4, '#f2c14e')
    }),
    V('Pancarte « 404 »', 'epique', 5, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 8, 1, 8, '#8a5a2b')
      p.box(x - 3, y - 12, 8, 5, '#ffffff', '#1f2430')
      p.px(x - 1, y - 10, '#e5484d')
      p.px(x + 1, y - 10, '#e5484d')
      p.px(x + 3, y - 10, '#e5484d')
    }),
    V('Poisson rouge en sac', 'legend', 2, (p, A, r, f) => {
      const [x, y] = A.hand
      p.disc(x, y - 4, 3, 'rgba(160,215,255,0.6)')
      p.rect(x - 1, y - 8, 2, 1, '#e5484d')
      p.px(x - 1 + (f % 2), y - 4, '#ff8c1a')
      p.px(x + (f % 2), y - 4, '#ff8c1a')
    })
  ]
}

export const METIER: Readonly<Record<UniverseKey, Readonly<Record<MetierRole, Variant>>>> = {
  robots: {
    po: V('Tablette de specs', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.box(x - 2, y - 7, 6, 8, '#2a3040', '#9aa3b5')
      p.rect(x - 1, y - 5, 4, 1, '#3ee8a8')
      p.rect(x - 1, y - 3, 3, 1, '#3ee8a8')
    }),
    backend: V('Clavier mécanique', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.rect(x - 5, y - 2, 9, 3, '#3a4152')
      for (let i = 0; i < 4; i++) p.px(x - 4 + i * 2, y - 1, '#c9cfdb')
    }),
    frontend: V('Stylet laser', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.rect(x, y - 7, 1, 7, '#c9d2e3')
      p.px(x, y - 8, f % 2 ? '#ff2fb0' : '#2fe6ff')
    }),
    qa: V('Loupe-scanner', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.disc(x + 1, y - 6, 2, '#5b6478')
      p.disc(x + 1, y - 6, 1, '#36d1f2')
      p.rect(x, y - 3, 1, 3, '#5b6478')
      if (f % 2) p.px(x + 1, y - 6, '#ffffff')
    })
  },
  sf: {
    po: V('Holo-carnet', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.box(x - 2, y - 7, 6, 7, 'rgba(126,240,255,0.35)', '#7ef0ff')
      p.rect(x - 1, y - 5, 4, 1, '#7ef0ff')
    }),
    backend: V('Interface neurale', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.rect(x - 1, y - 2, 3, 2, '#9aa3b5')
      for (let i = 0; i < 5; i++) p.px(x + 2 + i, y - 2 - (i % 2), (i + f) % 3 === 0 ? '#7ef0ff' : '#b388ff')
    }),
    frontend: V('Pinceau holographique', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.rect(x, y - 6, 1, 6, '#9aa3b5')
      p.rect(x - 1, y - 9, 3, 3, f % 2 ? '#ff7ac0' : '#7ef0ff')
    }),
    qa: V('Scanner portable', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.box(x - 1, y - 6, 4, 6, '#3a4152', '#9aa3b5')
      p.rect(x - 4, y - 7 + (f % 3), 3, 1, '#ff3b30')
    })
  },
  fantasy: {
    po: V('Parchemin', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.rect(x - 2, y - 7, 5, 7, '#f3e3c7')
      p.rect(x - 3, y - 8, 7, 1, '#b89f78')
      p.rect(x - 3, y, 7, 1, '#b89f78')
      p.rect(x - 1, y - 5, 3, 1, '#8a6a45')
    }),
    backend: V('Marteau de forge', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 8, 1, 9, '#8a5a2b')
      p.box(x - 2, y - 11, 5, 3, '#9aa3b5', '#5b6478')
    }),
    frontend: V('Plume enchantée', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      for (let i = 0; i < 7; i++) p.px(x + Math.floor(i / 3), y - i, '#ffffff')
      p.px(x + 2, y - 7, f % 2 ? '#ffd23f' : '#36d1f2')
    }),
    qa: V('Loupe runique', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.disc(x + 1, y - 6, 2, '#b89f78')
      p.disc(x + 1, y - 6, 1, f % 2 ? '#36d1f2' : '#9cf2ff')
      p.rect(x, y - 3, 1, 3, '#8a5a2b')
    })
  },
  wtf: {
    po: V('Post-it géant', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.rect(x - 2, y - 7, 6, 6, '#ffe04a')
      p.rect(x - 1, y - 5, 3, 1, '#3b7ff0')
      p.rect(x - 1, y - 3, 4, 1, '#3b7ff0')
    }),
    backend: V('Fouet de cuisine', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 3, 1, 4, '#8a5a2b')
      p.disc(x, y - 7, 2, '#c9d2e3')
      p.px(x, y - 7, '#9aa3b5')
    }),
    frontend: V('Rouleau de peinture', 'commun', 1, (p, A) => {
      const [x, y] = A.hand
      p.rect(x, y - 5, 1, 6, '#5b6478')
      p.rect(x - 3, y - 8, 7, 3, '#ff7ab5')
    }),
    qa: V('Tapette à mouches (pour les bugs)', 'commun', 1, (p, A, r, f) => {
      const [x, y] = A.hand
      p.rect(x, y - 6, 1, 7, '#3d8f55')
      p.box(x - 2, y - 11, 5, 5, '#7ed957', '#3d8f55')
      if (f % 2) p.px(x + 4, y - 12, '#1f2430')
    })
  }
}

export const UNIVERSES: readonly Universe[] = [ROBOTS, SF, FANTASY, WTF]
