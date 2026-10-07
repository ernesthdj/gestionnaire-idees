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
export const EXPLORER_LIMITS = {
  nodes: 150,
  edges: 400,
  callers: 50,
  excerptLines: 200,
  search: 30,
  filesPerNode: 300,
  fileLines: 20_000
} as const

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
  /** Guide de reprise (spec 017 US4) : document du genesis (`null` : pas encore rédigé), rédaction en cours. */
  readonly guide: { readonly documentId: string | null; readonly running: boolean }
}

export interface ExplorerFiltersView {
  readonly categories: readonly CodeCategory[]
  readonly langs: readonly CodeLang[]
  readonly hideUncertain: boolean
}

/** Carte de l'explorateur (D16) : 1 = modules, 2 = dossiers d'un module ou d'un dossier. */
export type ExplorerLevel = 1 | 2

/** Fichier de code direct d'un dossier (onglet « Fichiers » de son nœud, D16). */
export interface ExplorerFileEntryView {
  /** `f:<chemin>`. */
  readonly key: string
  readonly path: string
  readonly title: string
  readonly lang: CodeLang | null
  readonly category: CodeCategory
}

export interface ExplorerNodeView {
  /** `m:<module>`, `d:<dossier>`, `r:<parent>` (fichiers posés à la racine du parent ouvert) ; ailleurs `f:`, `s:`. */
  readonly key: string
  readonly level: ExplorerLevel
  readonly kind: 'module' | 'folder' | 'file' | 'namespace' | 'class' | 'interface' | 'function' | 'method'
  readonly title: string
  readonly category: CodeCategory
  readonly lang: CodeLang | null
  /** Éléments montrés en zoomant dedans (0 : rien à ouvrir, ses fichiers sont dans l'onglet). */
  readonly childCount: number
  /** Fichiers directs (filtres appliqués) ; vide pour un module. */
  readonly files: readonly ExplorerFileEntryView[]
  /** Fichiers directs masqués par les filtres ou au-delà de la limite. */
  readonly hiddenFiles: number
  /** Sous-dossiers (onglet « Sous-dossiers »). */
  readonly folders: readonly { readonly key: string; readonly title: string }[]
  readonly x: number | null
  readonly y: number | null
}

/** Où se trouve un élément sur la carte (D16) : le niveau à ouvrir, le nœud qui le montre, son fichier éventuel. */
export interface ExplorerPlaceView {
  readonly parentKey: string
  readonly nodeKey: string
  readonly path: string | null
  readonly symbolId: string | null
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
  /** Fichier de l'élément lié (pour l'ouvrir dans le volet, D16) ; `null` : inconnu. */
  readonly path: string | null
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

/** Lien d'un bloc de code vers un autre (D16) : l'autre bloc, et la ligne approchée de l'appel dans ce fichier. */
export interface CodeBlockLinkView {
  readonly symbolId: string
  readonly title: string
  readonly path: string
  /** Première ligne de l'autre bloc (pour l'ouvrir au bon endroit). */
  readonly line: number
  readonly kind: 'import' | 'call' | 'implements' | 'route' | 'injects'
  readonly provenance: LinkProvenance
  readonly count: number
  /** Ligne de ce fichier où le nom appelé apparaît dans le bloc (approchée) ; `null` : pas trouvée. */
  readonly at: number | null
}

/** Bloc d'un fichier (classe, fonction, méthode, ou code de premier niveau) avec ses appelants et appelés. */
export interface CodeBlockView {
  readonly symbolId: string
  readonly kind: ExplorerNodeView['kind']
  readonly name: string
  readonly startLine: number
  readonly endLine: number
  readonly category: CodeCategory
  /** La catégorie vient-elle des règles ou d'une correction de mentalyas (FR-018) ? */
  readonly corrected: boolean
  readonly callers: readonly CodeBlockLinkView[]
  readonly callees: readonly CodeBlockLinkView[]
  /** Appels sans cible dans le projet (bibliothèques, framework). */
  readonly external: number
}

/** Fichier complet dans le volet de l'explorateur (D16, FR-037) : texte en lecture seule, jamais interprété. */
export interface FileCodeView {
  readonly path: string
  readonly lang: CodeLang
  readonly lines: readonly string[]
  /** Plus de lignes que la limite : seules les premières sont montrées. */
  readonly truncated: boolean
  readonly blocks: readonly CodeBlockView[]
  /** Fichier non analysé : sa raison. */
  readonly error: string | null
  /** Où le fichier apparaît sur la carte. */
  readonly place: ExplorerPlaceView
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
