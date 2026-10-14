import type {
  CodeCategory,
  CodeEdgeKind,
  CodeLayer,
  ExplorerNodeView,
  LinkProvenance,
  MapCallSentence
} from '@shared/ipc/reprise'

/** Une information n'est jamais portée par la seule couleur (spec 017 FR-024) : icône et libellé toujours. */
export const CATEGORY_LABELS: Readonly<
  Record<CodeCategory, { readonly icon: string; readonly text: string; readonly tone: string }>
> = {
  orchestration: { icon: '⇄', text: 'Orchestration', tone: 'border-action text-action' },
  domain: { icon: '◆', text: 'Métier', tone: 'border-accent text-accent' },
  infrastructure: { icon: '⛁', text: 'Infrastructure', tone: 'border-pro text-pro' },
  plumbing: { icon: '⚙', text: 'Plomberie', tone: 'border-content-muted text-content-muted' }
}

export const KIND_LABELS: Readonly<Record<ExplorerNodeView['kind'], { readonly icon: string; readonly text: string }>> =
  {
    module: { icon: '▣', text: 'module' },
    folder: { icon: '▤', text: 'dossier' },
    file: { icon: '▢', text: 'fichier' },
    namespace: { icon: '⌗', text: 'espace de noms' },
    class: { icon: '◇', text: 'classe' },
    interface: { icon: '◈', text: 'interface' },
    function: { icon: 'ƒ', text: 'fonction' },
    method: { icon: 'ƒ', text: 'méthode' }
  }

/** Trait d'un lien selon sa fiabilité : plein = sûr, tirets = déduit, pointillés = incertain. */
export const PROVENANCE_LABELS: Readonly<
  Record<LinkProvenance, { readonly text: string; readonly mark: string; readonly dash: string | undefined }>
> = {
  syntax: { text: 'sûr', mark: '━', dash: undefined },
  user: { text: 'corrigé par toi', mark: '━', dash: undefined },
  deduced: { text: 'déduit', mark: '╍', dash: '6 4' },
  uncertain: { text: 'incertain', mark: '┄', dash: '2 4' }
}

/** Niveaux de la carte de l'explorateur (D16 : le code est dans le volet, plus sur la carte). */
export const LEVEL_NAMES = ['Modules', 'Dossiers'] as const

/**
 * Couches de la carte en boîtes (spec 031 D2), nommées pour un lecteur ; chacune a sa couleur du thème, toujours
 * doublée de son nom (jamais la couleur seule).
 */
export const LAYER_LABELS: Readonly<
  Record<
    CodeLayer,
    {
      readonly text: string
      readonly hint: string
      readonly border: string
      readonly color: string
      readonly css: string
    }
  >
> = {
  start: {
    text: 'Démarrage',
    hint: 'ce qui lance tout',
    border: 'border-l-seed',
    color: 'text-seed',
    css: '--color-seed'
  },
  entry: {
    text: 'Entrée',
    hint: 'ce que le site ou l’écran appelle',
    border: 'border-l-action',
    color: 'text-action',
    css: '--color-action'
  },
  rules: {
    text: 'Règles',
    hint: 'ce que fait l’application',
    border: 'border-l-accent',
    color: 'text-accent',
    css: '--color-accent'
  },
  data: {
    text: 'Données et outils',
    hint: 'base, fichiers, journaux',
    border: 'border-l-pro',
    color: 'text-pro',
    css: '--color-pro'
  }
}

const VERBS: Readonly<Record<CodeEdgeKind, string>> = {
  call: 'appelle',
  injects: 'injecte',
  implements: 'implémente',
  import: 'importe',
  route: 'sert la route'
}

/** Un appel en mots (spec 031 D7) : « OrdersController.Post appelle OrderService.Place », et pourquoi s'il est deviné. */
export function sentenceText(sentence: MapCallSentence): string {
  const base = `${sentence.from} ${VERBS[sentence.kind]} ${sentence.to}`
  if (sentence.provenance === 'uncertain') {
    return sentence.alternatives > 1
      ? `${base} (deviné : ${sentence.alternatives} cibles possibles)`
      : `${base} (deviné)`
  }
  return sentence.provenance === 'deduced' ? `${base} (déduit)` : base
}
