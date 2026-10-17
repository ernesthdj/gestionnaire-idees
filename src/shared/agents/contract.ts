/**
 * Contrat de l'Architecte (L2-pipeline-optimal D1, T006) : le « comment » d'une tâche, figé avant que les développeurs
 * partent (décisions, interfaces, schémas, fichiers par agent, risques, matrice critère → vérification). Trois sortes de
 * lignes sont lues par l'app : la zone de chaque développeur, les commandes de vérification (validées par mentalyas,
 * D2) et les questions au PO quand la spec a un trou. Fonctions pures.
 */

export interface ContractZone {
  /** Identifiant de l'agent dans l'assemblage. */
  readonly agent: string
  /** Chemins relatifs au projet. */
  readonly paths: readonly string[]
}

export interface ContractLines {
  readonly zones: readonly ContractZone[]
  /** Commandes de vérification proposées (rien n'est lancé sans l'accord de mentalyas). */
  readonly commands: readonly string[]
  /** Questions au PO : la spec a un trou, le contrat attend sa réponse. */
  readonly questions: readonly string[]
}

export interface PipelineContract extends ContractLines {
  readonly taskId: string
  /** 1 au premier contrat ; chaque réécriture de l'Architecte la monte d'un cran. */
  readonly version: number
  readonly signedAt: number
  readonly content: string
}

export const CONTRACT_OWNER_ROLE = 'architecte' as const

const ZONE_LINE = /^(?:[-*]\s*)?ZONE\s*:\s*([a-z0-9][a-z0-9-]{0,31})\s*\|\s*(.+)$/i
const COMMAND_LINE = /^(?:[-*]\s*)?VERIFICATION\s*:\s*(.+)$/i
const QUESTION_LINE = /^(?:[-*]\s*)?QUESTION_PO\s*:\s*(.+)$/i

/** Plafonds de lecture : un contrat ne dicte pas cent zones ni cent commandes. */
const MAX_LINES = 40
const COMMAND_MAX = 200

const unquote = (text: string): string =>
  text
    .trim()
    .replace(/^`(.+)`$/, '$1')
    .trim()

/** Lit les lignes de l'app dans un contrat ; une ligne mal formée est ignorée, jamais une erreur. */
export function parseContract(text: string): ContractLines {
  const zones: ContractZone[] = []
  const commands: string[] = []
  const questions: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const zone = ZONE_LINE.exec(line)
    if (zone !== null) {
      const agent = (zone[1] as string).toLowerCase()
      const paths = (zone[2] as string)
        .split(',')
        .map(unquote)
        .filter((path) => path !== '')
      if (paths.length > 0 && !zones.some((entry) => entry.agent === agent) && zones.length < MAX_LINES) {
        zones.push({ agent, paths })
      }
      continue
    }
    const command = COMMAND_LINE.exec(line)
    if (command !== null) {
      const value = unquote(command[1] as string)
      if (value !== '' && value.length <= COMMAND_MAX && !commands.includes(value) && commands.length < MAX_LINES) {
        commands.push(value)
      }
      continue
    }
    const question = QUESTION_LINE.exec(line)
    if (question !== null && questions.length < MAX_LINES) {
      const value = (question[1] as string).trim()
      if (value !== '') questions.push(value)
    }
  }
  return { zones, commands, questions }
}

/** Consigne de l'Architecte : ce que son contrat doit contenir, et les lignes que l'app lit. */
export function contractInstructions(agents: readonly { readonly id: string; readonly role: string }[]): string {
  const developers = agents.filter((agent) => agent.role !== 'po' && agent.role !== 'qa' && agent.role !== 'architecte')
  return [
    'Rédige le CONTRAT technique de cette tâche (ta réponse EST le contrat), d’après la spec signée et le code du projet :',
    '- décisions (choix → raison → options écartées) ;',
    '- contrat : signatures, schémas, formats, erreurs ;',
    '- interfaces figées pour le travail en parallèle (ce que chaque développeur peut supposer de l’autre) ;',
    '- fichiers à créer ou modifier, par agent ; risques ; matrice critère d’acceptation → ce que le QA vérifie.',
    'Ne code rien : tu décides le comment, les développeurs le font.',
    '',
    'Lignes lues par l’app, une par ligne, à la fin du contrat :',
    `- « ZONE: <agent> | <chemins relatifs séparés par des virgules> » pour chaque développeur (${
      developers.length === 0 ? 'aucun dans cette équipe' : developers.map((agent) => agent.id).join(', ')
    }) : il ne travaillera que là ;`,
    '- « VERIFICATION: <commande> » pour chaque commande qui vérifie le travail (tests, typecheck, lint), telle qu’on la tape dans le dossier du projet ; mentalyas les validera avant le départ des développeurs ;',
    '- si la spec a un trou qui t’empêche de décider : « QUESTION_PO: <question précise> » (une par ligne), et rien d’autre : le PO amendera la spec, puis tu reprendras.'
  ].join('\n')
}
