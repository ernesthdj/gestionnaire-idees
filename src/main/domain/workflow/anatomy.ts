import type { FileExtraction } from '../../../analysis-worker/extract'
import type { WorkflowAnatomyView, WorkflowBlockView, WorkflowCallView } from '@shared/ipc/workflow'

/** Bornes de l'anatomie d'un fichier (spec 023 R10) : au-delà, le schéma est coupé et le dit. */
export const ANATOMY_LIMITS = { blocks: 500, imports: 200, calls: 2000 } as const

/** Receveurs qui désignent l'objet courant : `this.f()`, `$this->f()`, `self::f()`, `static::f()`. */
const SELF = new Set(['this', '$this', 'self', 'static'])
/** Constructeurs : appelés par `new`, jamais par leur nom. */
const CONSTRUCTORS = new Set(['constructor', '__construct'])

type Extraction = Pick<FileExtraction, 'symbols' | 'imports' | 'calls'>

/**
 * Anatomie d'un fichier (spec 023 D14, R12), tirée de son extraction tree-sitter : ses blocs, ses imports regroupés par
 * source, ses appels internes reconnus **par le nom** (appel direct, sur l'objet courant, ou `new` d'une classe du
 * fichier ; plusieurs blocs du même nom : un lien vers chacun, marqué ambigu), et les blocs peut-être inutilisés.
 * Pure : aucune lecture, aucun calcul de types.
 */
export function fileAnatomy(extraction: Extraction): WorkflowAnatomyView {
  const kept = extraction.symbols.filter((symbol) => symbol.kind !== 'namespace')
  const symbols = kept.slice(0, ANATOMY_LIMITS.blocks)
  const known = new Set(symbols.map((symbol) => symbol.key))
  const byName = new Map<string, typeof symbols>()
  for (const symbol of symbols) byName.set(symbol.name, [...(byName.get(symbol.name) ?? []), symbol])

  // Appels internes : seuls ceux qui partent d'un bloc gardé et visent un bloc du fichier.
  const calls = new Map<string, WorkflowCallView>()
  for (const call of extraction.calls) {
    if (call.from === null || !known.has(call.from)) continue
    if (!call.isNew && call.receiver !== null && !SELF.has(call.receiver)) continue
    const named = byName.get(call.callee) ?? []
    const callable = named.filter((symbol) => symbol.kind === 'function' || symbol.kind === 'method')
    const classes = named.filter((symbol) => symbol.kind === 'class')
    // `new X()` vise une classe ; sinon une fonction ou méthode, ou à défaut une classe (composant React de classe).
    const targets = call.isNew ? classes : callable.length > 0 ? callable : classes
    for (const target of targets) {
      const key = `${call.from}>${target.key}`
      if (!calls.has(key)) {
        calls.set(key, { from: call.from, to: target.key, line: call.line, ambiguous: targets.length > 1 })
      }
    }
  }

  // Un nom sert s'il est appelé (ou sert de receveur, `Stores.Resolve`) ailleurs que dans son propre bloc ;
  // l'appel par le nom seul est volontairement large : « peut-être inutilisé » doit éviter les fausses alertes.
  const usedBy = new Map<string, Set<number | null>>()
  const use = (name: string, from: number | null): void => {
    usedBy.set(name, (usedBy.get(name) ?? new Set()).add(from))
  }
  for (const call of extraction.calls) {
    use(call.callee, call.from)
    if (call.receiver !== null && /^[A-Za-z_$][\w$]*$/.test(call.receiver)) use(call.receiver, call.from)
  }
  const calledByOthers = (symbol: (typeof symbols)[number]): boolean =>
    [...(usedBy.get(symbol.name) ?? [])].some((from) => from !== symbol.key)

  const byKey = new Map(symbols.map((symbol) => [symbol.key, symbol] as const))
  // Exemptés sans être « utilisés » : un type (interface et ses membres), un constructeur (`new`, ou nom de sa classe en
  // C#), une fonction locale à une fonction (souvent passée en valeur, `onSelect={choisir}` ; inutilisée, le
  // compilateur ou le linter la signale déjà).
  const exempt = (symbol: (typeof symbols)[number]): boolean => {
    const owner = symbol.parent === null ? undefined : byKey.get(symbol.parent)
    return (
      symbol.kind === 'interface' ||
      owner?.kind === 'interface' ||
      owner?.kind === 'function' ||
      owner?.kind === 'method' ||
      CONSTRUCTORS.has(symbol.name) ||
      owner?.name === symbol.name
    )
  }
  const used = new Set(symbols.filter((symbol) => symbol.exported || calledByOthers(symbol)).map((s) => s.key))
  // Une classe dont un membre sert est utile ; les enfants suivent leur parent, d'où le parcours à rebours.
  for (const symbol of [...symbols].reverse()) {
    if (used.has(symbol.key) && symbol.parent !== null) used.add(symbol.parent)
  }
  const useful = new Set(symbols.filter((symbol) => used.has(symbol.key) || exempt(symbol)).map((s) => s.key))

  const blocks: WorkflowBlockView[] = symbols.map((symbol) => ({
    id: symbol.key,
    parent: symbol.parent !== null && known.has(symbol.parent) ? symbol.parent : null,
    kind: symbol.kind,
    name: symbol.name,
    startLine: symbol.startLine,
    endLine: Math.max(symbol.startLine, symbol.endLine),
    complexity: symbol.complexity,
    exported: symbol.exported,
    maybeUnused: !useful.has(symbol.key),
    doc: symbol.doc
  }))

  const sources = new Map<string, { source: string; names: number; line: number }>()
  for (const entry of extraction.imports) {
    const current = sources.get(entry.source)
    sources.set(entry.source, {
      source: entry.source,
      names: (current?.names ?? 0) + entry.names.length,
      line: Math.min(current?.line ?? entry.line, entry.line)
    })
  }
  const imports = [...sources.values()].sort((a, b) => a.line - b.line)
  const allCalls = [...calls.values()]

  return {
    blocks,
    imports: imports.slice(0, ANATOMY_LIMITS.imports),
    calls: allCalls.slice(0, ANATOMY_LIMITS.calls),
    truncated:
      kept.length > ANATOMY_LIMITS.blocks ||
      imports.length > ANATOMY_LIMITS.imports ||
      allCalls.length > ANATOMY_LIMITS.calls
  }
}
