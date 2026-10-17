/**
 * Spec de lot (L1o D25, docs/TACHES-AGENTS.md T021) : un PO connecté à un lot (ou à un fichier de tâches) cadre toutes
 * ses tâches, choisit une équipe pour le lot et dit, tâche par tâche, quels agents interviennent et qui attend qui
 * (l'aiguillage). Il conseille aussi un rythme ; mentalyas décide. Les agents sont nommés par le nom de leur profil,
 * comme dans les lignes `RECOMMANDÉ:` et `SUGGÉRÉ:`.
 */

/** Une tâche du lot, telle que le PO la voit. */
export interface LotTask {
  /** `T002`, ou vide si la case n'a pas d'identifiant. */
  readonly id: string
  /** Clé de la tâche dans son fichier (`parseTaskFile`). */
  readonly key: string
  readonly text: string
  readonly done: boolean
}

/** Qui attend qui dans une tâche : `agent` part du résultat de `after`. */
export interface LotWait {
  readonly agent: string
  readonly after: string
}

/** Aiguillage d'une tâche : les profils qui interviennent, et leurs attentes. */
export interface LotStep {
  /** Repère de la tâche : son identifiant (`T002`) ou son rang (`#3`). */
  readonly task: string
  readonly agents: readonly string[]
  readonly waits: readonly LotWait[]
  /**
   * Repères des tâches dont celle-ci a besoin du résultat (L1o D28) ; vide : elle part avec les autres. Absent d'un
   * plan enregistré avant D28 (lu comme vide).
   */
  readonly after?: readonly string[]
}

/** `une-a-une` : accord de fusion après chaque tâche ; `tout` : un accord pour le lot entier. */
export type LotRhythm = 'une-a-une' | 'tout'

export interface LotPlan {
  readonly steps: readonly LotStep[]
  /** Conseil du PO ; `null` s'il n'en a pas donné. */
  readonly rhythm: { readonly mode: LotRhythm; readonly reason: string } | null
}

export const MAX_LOT_STEPS = 60

/** Repère d'une tâche du lot dans la spec : son identifiant, sinon son rang (`#1` pour la première). */
export const lotLabel = (task: Pick<LotTask, 'id'>, index: number): string =>
  task.id === '' ? `#${index + 1}` : task.id

const STEP_LINE = /^(?:[-*]\s*)?AIGUILLAGE\s*:\s*(.+)$/i
const RHYTHM_LINE = /^(?:[-*]\s*)?RYTHME\s*:\s*(.+?)(?:\s+[—–-]\s+(.+))?$/i
const WAIT = /^(.+?)\s+attend\s+(.+)$/i
const AFTER_WORD = /^apr[eè]s\s*:?\s*/i
const NOTHING = new Set(['rien', 'aucune', 'aucun', '-', '—'])

const names = (text: string): string[] =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')

const rhythmOf = (text: string): LotRhythm | null => {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (plain.includes('tout') || plain.includes('chaine') || plain.includes('enchain')) return 'tout'
  if (plain.includes('une')) return 'une-a-une'
  return null
}

/**
 * Lit les lignes `AIGUILLAGE:` et `RYTHME:` d'une spec de lot. Une ligne mal formée est ignorée, jamais une erreur ;
 * une attente qui nomme un agent absent de sa tâche aussi. Une tâche aiguillée deux fois garde sa première ligne. Pur.
 */
export function parseLotPlan(spec: string): LotPlan {
  const steps: LotStep[] = []
  let rhythm: LotPlan['rhythm'] = null
  for (const raw of spec.split('\n')) {
    const line = raw.trim()
    const step = STEP_LINE.exec(line)
    if (step !== null) {
      const [task = '', who = '', waiting = '', needs = ''] = (step[1] as string).split('|').map((part) => part.trim())
      const agents = [...new Set(names(who))]
      if (task === '' || agents.length === 0 || steps.some((entry) => entry.task === task)) continue
      const known = new Set(agents)
      const waits = names(waiting)
        .map((entry) => WAIT.exec(entry))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => ({ agent: (match[1] as string).trim(), after: (match[2] as string).trim() }))
        .filter((wait) => known.has(wait.agent) && known.has(wait.after) && wait.agent !== wait.after)
      // « après T002, T003 » (L1o D28) : les tâches absentes du plan sont écartées par `routeLot`, qui les signale.
      const after = [
        ...new Set(names(needs.replace(AFTER_WORD, '')).filter((entry) => !NOTHING.has(entry.toLowerCase())))
      ].filter((entry) => entry !== task)
      if (steps.length < MAX_LOT_STEPS) steps.push({ task, agents, waits, after })
      continue
    }
    const advice = RHYTHM_LINE.exec(line)
    if (advice !== null && rhythm === null) {
      const mode = rhythmOf(advice[1] as string)
      if (mode !== null) rhythm = { mode, reason: (advice[2] ?? '').trim() }
    }
  }
  return { steps, rhythm }
}

/** Consigne donnée au PO connecté à un lot : spec par tâche, aiguillage et conseil de rythme (lus par `parseLotPlan`). */
export function lotInstructions(tasks: readonly LotTask[], file?: string): string {
  const open = tasks.map((task, index) => ({ task, label: lotLabel(task, index) })).filter(({ task }) => !task.done)
  return [
    `Ce nœud est un LOT de ${open.length} tâche(s) à faire, dans cet ordre :`,
    ...open.map(({ task, label }) => `- ${label} · ${task.text}`),
    ...(file === undefined
      ? []
      : [
          `Ces tâches vivent dans ${file} : ne crée AUCUN autre fichier de tâches. Les agents cochent leurs cases dans ce fichier (« - [x] »), et la fusion coche celles du lot.`,
          'Pour compléter un brainstorm, écris dans le document d’où vient le lot (voir « À lire d’abord »), pas dans un nouveau dossier.'
        ]),
    '',
    'Rédige la spec du LOT entier (ta réponse EST la spec) : une section « ## <repère> — <titre> » par tâche à faire, avec ses critères d’acceptation (Étant donné / Quand / Alors), ce qui est hors périmètre et sa complexité (basse, moyenne ou haute).',
    'Choisis UNE équipe pour tout le lot (lignes RECOMMANDÉ: et SUGGÉRÉ: ci-dessous) : chaque agent n’intervient que dans les tâches où tu le places.',
    'Pour chaque tâche à faire, une ligne d’aiguillage : « AIGUILLAGE: <repère> | <noms des profils qui interviennent, séparés par des virgules> | <qui attend qui, « A attend B », séparés par des virgules, ou rien> | après <repères des tâches dont celle-ci a besoin du résultat, séparés par des virgules, ou rien> ». Les TÂCHES sans « après » partent EN MÊME TEMPS, chacune avec ses agents et son QA : n’écris « après T002 » que si la tâche a besoin de ce que T002 produit (même fichier, même module, ou une fonction qu’elle appelle). Les agents d’une tâche travaillent EN MÊME TEMPS sauf si tu écris une attente : n’écris « A attend B » que si A a besoin du résultat de B ; deux agents dont les travaux ne se touchent pas (fichiers, modules ou couches distincts) n’attendent personne. Le QA, s’il y en a un, attend tous ceux qui codent.',
    'Puis une ligne de conseil : « RYTHME: une à une — <pourquoi> » si les tâches sont complexes ou risquées (mentalyas relit chaque tâche avant la suivante), ou « RYTHME: tout le lot — <pourquoi> » si elles peuvent s’enchaîner sans relecture entre deux. mentalyas décide.'
  ].join('\n')
}

/** Aiguillage d'une tâche en agents du croquis : identifiants d'agents et liens « attend » (`from` attendu par `to`). */
export interface LotRoute {
  readonly task: string
  readonly agents: readonly string[]
  readonly links: readonly { readonly from: string; readonly to: string }[]
  /** Tâches dont celle-ci dépend (L1o D28) ; absent d'une retouche : celles du plan du PO. */
  readonly after?: readonly string[] | undefined
}

/** Équipe d'un lot, gardée avec son croquis : le plan du PO et les aiguillages retouchés par mentalyas (qui priment). */
export interface SketchLot {
  readonly plan: LotPlan
  readonly overrides: readonly LotRoute[]
}

/** Aiguillage effectif d'une tâche : d'après le PO (`byHand` faux) ou retouché, et les profils qui manquent à l'équipe. */
export interface RoutedTask extends LotRoute {
  /** Tâches du plan dont celle-ci dépend (les repères inconnus sont dans `unknownAfter`). */
  readonly after: readonly string[]
  /** Repères « après » qui ne sont pas des tâches du plan : ignorés, à signaler. */
  readonly unknownAfter: readonly string[]
  readonly byHand: boolean
  /** Profils nommés par le PO qu'aucun agent de l'équipe ne porte : à connecter ou à créer (T022). */
  readonly missing: readonly string[]
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Aiguillage de chaque tâche du plan (L1o D25, T023) : les noms de profils du PO deviennent les agents de l'équipe qui
 * portent ces profils (le premier, si deux le partagent) ; une retouche de mentalyas remplace le plan de sa tâche, sans
 * les agents qui ont quitté l'équipe. Pur.
 */
export function routeLot(
  lot: SketchLot,
  team: readonly { readonly id: string; readonly name: string }[]
): RoutedTask[] {
  const ids = new Set(team.map((agent) => agent.id))
  const planned = new Set(lot.plan.steps.map((step) => step.task))
  return lot.plan.steps.map((step) => {
    const override = lot.overrides.find((entry) => entry.task === step.task)
    const needs = (override?.after ?? step.after ?? []).filter((task) => task !== step.task)
    const after = needs.filter((task) => planned.has(task))
    const unknownAfter = needs.filter((task) => !planned.has(task))
    if (override !== undefined) {
      const agents = override.agents.filter((id) => ids.has(id))
      const kept = new Set(agents)
      return {
        task: step.task,
        agents,
        links: override.links.filter((link) => kept.has(link.from) && kept.has(link.to)),
        after,
        unknownAfter,
        byHand: true,
        missing: []
      }
    }
    const idOf = (name: string): string | undefined => team.find((agent) => sameName(agent.name, name))?.id
    const agents = step.agents.map(idOf).filter((id): id is string => id !== undefined)
    const links = step.waits.flatMap((wait) => {
      const from = idOf(wait.after)
      const to = idOf(wait.agent)
      return from === undefined || to === undefined ? [] : [{ from, to }]
    })
    return {
      task: step.task,
      agents: [...new Set(agents)],
      links,
      after,
      unknownAfter,
      byHand: false,
      missing: step.agents.filter((name) => idOf(name) === undefined)
    }
  })
}

/**
 * Étages d'une tâche (L1o D28) : les agents qui partent ensemble, dans l'ordre (« Front ∥ Back → QA »). Un agent est à
 * l'étage qui suit le plus tardif de ceux qu'il attend ; les liens vers un agent absent sont ignorés. Pur.
 */
export function stagesOf(
  agents: readonly string[],
  links: readonly { readonly from: string; readonly to: string }[]
): string[][] {
  const known = new Set(agents)
  return layered(agents, (id) =>
    links.filter((link) => link.to === id && known.has(link.from)).map((link) => link.from)
  ).stages
}

/**
 * Étages de `ids` : chacun à l'étage qui suit le plus tardif de ceux dont il dépend (`needs`). Une dépendance qui
 * referme une boucle est ignorée et rendue dans `cycles` (`to` dépendait de `from`). Pur.
 */
function layered(
  ids: readonly string[],
  needs: (id: string) => readonly string[]
): { stages: string[][]; cycles: { from: string; to: string }[] } {
  const known = new Set(ids)
  const level = new Map<string, number>()
  const cycles: { from: string; to: string }[] = []
  const levelOf = (id: string, visiting: ReadonlySet<string>): number => {
    const found = level.get(id)
    if (found !== undefined) return found
    const next = new Set(visiting).add(id)
    const ups = needs(id).filter((up) => known.has(up))
    for (const up of ups) if (next.has(up)) cycles.push({ from: up, to: id })
    const kept = ups.filter((up) => !next.has(up))
    const value = kept.length === 0 ? 0 : 1 + Math.max(...kept.map((up) => levelOf(up, next)))
    level.set(id, value)
    return value
  }
  const stages: string[][] = []
  for (const id of ids) (stages[levelOf(id, new Set())] ??= []).push(id)
  return { stages: stages.filter((stage) => stage.length > 0), cycles }
}

/**
 * Groupes de tâches d'un lot (L1o D28) : celles d'un même groupe partent ensemble, le groupe suivant après elles
 * (« T001 ∥ T003 → T002 »). Une dépendance qui ferme une boucle est ignorée et rendue dans `cycles`. Pur.
 */
export function lotGroups(routes: readonly Pick<RoutedTask, 'task' | 'after'>[]): {
  readonly groups: string[][]
  readonly cycles: readonly { readonly from: string; readonly to: string }[]
} {
  const { stages, cycles } = layered(
    routes.map((route) => route.task),
    (task) => routes.find((route) => route.task === task)?.after ?? []
  )
  return { groups: stages, cycles }
}
