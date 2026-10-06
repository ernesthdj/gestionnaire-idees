/** Vues et contrats de la reprise d'un projet existant (spec 017 contracts/interfaces.md). Chemins relatifs. */

export const CONFIDENTIALITY_LEVELS = ['claude', 'local'] as const
export type Confidentiality = (typeof CONFIDENTIALITY_LEVELS)[number]

export const CODE_LANGS = ['ts', 'tsx', 'js', 'cs', 'php', 'other'] as const
export type CodeLang = (typeof CODE_LANGS)[number]

/** Catégorie d'un élément (spec 017 R3) : la plomberie est masquée par défaut dans l'explorateur. */
export const CODE_CATEGORIES = ['domain', 'orchestration', 'infrastructure', 'plumbing'] as const
export type CodeCategory = (typeof CODE_CATEGORIES)[number]

/** Fiabilité d'un lien : sûr (`syntax`), déduit, incertain, corrigé par mentalyas (`user`). */
export const LINK_PROVENANCES = ['syntax', 'deduced', 'uncertain', 'user'] as const
export type LinkProvenance = (typeof LINK_PROVENANCES)[number]

/** Du moins au plus fiable : un lien agrégé prend la fiabilité la plus faible de ses appels (spec 017 US7). */
const PROVENANCE_STRENGTH: Readonly<Record<LinkProvenance, number>> = { uncertain: 0, deduced: 1, syntax: 2, user: 3 }

export const weakestProvenance = (a: LinkProvenance, b: LinkProvenance): LinkProvenance =>
  PROVENANCE_STRENGTH[a] <= PROVENANCE_STRENGTH[b] ? a : b

/** Au plus ce nombre d'éléments affichés à la fois dans l'explorateur (spec 017 FR-022). */
export const EXPLORER_LIMITS = { nodes: 150, edges: 400, callers: 50, excerptLines: 200, search: 30 } as const

/** Aperçu d'un dossier avant l'import : rien n'est créé tant que mentalyas n'a pas choisi la confidentialité. */
export interface ImportPreviewView {
  readonly previewId: string
  /** Nom du dossier (jamais le chemin complet). */
  readonly name: string
  readonly languages: readonly { readonly lang: CodeLang; readonly files: number }[]
  readonly files: number
  readonly ignored: number
  /** Fichiers sensibles (secrets, clés) ignorés : jamais lus. */
  readonly sensitive: number
  readonly git: boolean
  /** Au-delà de la limite de fichiers : choisir un sous-dossier. */
  readonly tooLarge: boolean
  /** Neurone déjà lié à ce dossier ; `null` : aucun. */
  readonly alreadyLinked: string | null
}

export type AnalysisStateView = 'idle' | 'running' | 'failed' | 'interrupted'

export interface AnalysisStatsView {
  readonly files: number
  readonly analyzed: number
  readonly failed: number
  readonly unsupported: number
  readonly symbols: number
  readonly edges: number
  readonly resolvedSyntax: number
  readonly deduced: number
  readonly uncertain: number
  readonly durationMs: number
}

export interface RepriseProjectView {
  readonly genesisId: string
  readonly name: string
  readonly source: 'folder' | 'git'
  readonly confidentiality: Confidentiality
  /** Adresse du dépôt, sans identifiants ; `null` : dossier local. */
  readonly remote: string | null
  /** Le dossier source est introuvable (déplacé, supprimé) : la dernière analyse reste lisible. */
  readonly folderMissing: boolean
  readonly analysis: {
    readonly state: AnalysisStateView
    readonly progress: { readonly done: number; readonly total: number } | null
    readonly stats: AnalysisStatsView | null
    readonly analyzedAt: string | null
  }
}

export interface ExplorerFiltersView {
  readonly categories: readonly CodeCategory[]
  readonly langs: readonly CodeLang[]
  readonly hideUncertain: boolean
}

export type ExplorerLevel = 1 | 2 | 3 | 4

export interface ExplorerNodeView {
  /** `m:<module>`, `d:<dossier>`, `f:<fichier>`, `s:<symbole>`. */
  readonly key: string
  readonly level: ExplorerLevel
  readonly kind: 'module' | 'folder' | 'file' | 'namespace' | 'class' | 'interface' | 'function' | 'method'
  readonly title: string
  readonly category: CodeCategory
  readonly lang: CodeLang | null
  readonly childCount: number
  readonly x: number | null
  readonly y: number | null
}

export interface ExplorerEdgeView {
  readonly from: string
  readonly to: string
  readonly count: number
  /** La plus faible des liens regroupés. */
  readonly provenance: LinkProvenance
}

export interface ExplorerView {
  readonly level: ExplorerLevel
  readonly breadcrumb: readonly { readonly key: string; readonly title: string }[]
  readonly nodes: readonly ExplorerNodeView[]
  readonly edges: readonly ExplorerEdgeView[]
  /** Éléments en trop regroupés (« + 42 fichiers »). */
  readonly grouped: readonly { readonly key: string; readonly title: string; readonly count: number }[]
  readonly hidden: { readonly plumbingCalls: number; readonly nodes: number }
  readonly confidentiality: Confidentiality
  readonly folderMissing: boolean
}

export interface ExplorerLinkView {
  readonly key: string
  readonly title: string
  readonly provenance: LinkProvenance
  readonly reason: string | null
}

export interface ExplorerNodeDetailView {
  readonly key: string
  /** Nœud qui le contient (ouvrir ce parent montre l'élément) ; `''` : la racine. */
  readonly parentKey: string
  readonly kind: ExplorerNodeView['kind']
  readonly title: string
  readonly path: string | null
  readonly category: CodeCategory
  readonly categorySource: 'rules' | 'claude' | 'ollama' | 'user'
  readonly lang: CodeLang | null
  readonly lines: number | null
  /** Rôle et analogie (modules, produits avec le guide) ; `null` : pas encore produits. */
  readonly summary: string | null
  readonly analogy: string | null
  readonly callers: readonly ExplorerLinkView[]
  readonly callees: readonly ExplorerLinkView[]
  /** Fichier non analysé : sa raison. */
  readonly error: string | null
}

export interface CodeExcerptView {
  readonly path: string
  readonly startLine: number
  readonly lines: readonly string[]
  readonly lang: CodeLang
}

/** Événements du main. */
export interface AnalysisProgressEvent {
  readonly genesisId: string
  readonly phase: 'files' | 'parse' | 'resolve' | 'write'
  readonly done: number
  readonly total: number
}
export interface AnalysisDoneEvent {
  readonly genesisId: string
  readonly stats: AnalysisStatsView
}
export interface CloneProgressEvent {
  readonly cloneId: string
  readonly phase: string
  readonly percent: number
}
export type CloneFailureCode = 'AUTH_FAILED' | 'NOT_FOUND' | 'NETWORK' | 'CANCELLED' | 'TIMEOUT' | 'FAILED'

/** Fichiers d'un élément de carte de structure (spec 017 US7, FR-032). */
export interface ElementFilesView {
  readonly elementId: string
  readonly title: string
  /** Chemins donnés à l'élément (fichiers ou dossiers). */
  readonly paths: readonly string[]
  readonly files: readonly { readonly path: string; readonly lang: CodeLang; readonly lines: number | null }[]
  /** Plus de 200 fichiers : la liste est tronquée. */
  readonly truncated: boolean
  /** Projet repris analysé : symboles et appelants disponibles. */
  readonly analyzed: boolean
}

export interface ElementFileView {
  readonly path: string
  readonly lang: CodeLang
  readonly lines: readonly string[]
  readonly symbols: readonly {
    readonly id: string
    readonly name: string
    readonly kind: 'namespace' | 'class' | 'interface' | 'function' | 'method'
    readonly startLine: number
    readonly endLine: number
    /** Nombre d'appels venant d'autres fichiers. */
    readonly callers: number
  }[]
}
