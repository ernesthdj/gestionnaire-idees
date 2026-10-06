import type { CodeCategory, ExplorerNodeView, LinkProvenance } from '@shared/ipc/reprise'

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

/** Niveaux de l'explorateur (L4d E4 : indicateur de zoom). */
export const LEVEL_NAMES = ['Modules', 'Dossiers', 'Fichiers', 'Code'] as const
