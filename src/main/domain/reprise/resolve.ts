import type { FileExtraction, RawSymbol } from '../../../analysis-worker/extract'

/**
 * Résolution des liens d'un projet repris (spec 017 R3) : chaque appel, import, implémentation, route et injection
 * vers sa cible dans le projet, avec une fiabilité honnête — `syntax` quand le code la donne sans ambiguïté,
 * `uncertain` sinon (un candidat proposé, ou aucun quand ils sont plusieurs). Un appel sans aucun candidat dans le
 * projet (bibliothèque, framework) n'est pas retenu. Fonction pure.
 */

export type EdgeKind = 'import' | 'call' | 'implements' | 'route' | 'injects'
export type EntryKind = 'http_route' | 'main' | 'cli' | 'event' | 'job'

export interface ResolveFile {
  readonly path: string
  readonly lang: 'ts' | 'tsx' | 'js' | 'cs' | 'php'
  readonly extraction: FileExtraction
  /** Identifiant global de chaque symbole, par rang (`RawSymbol.key`). */
  readonly symbolIds: readonly string[]
  /** Symbole « fichier » : porte les appels de premier niveau et les imports. */
  readonly fileSymbolId: string
}

export interface ResolveConfig {
  /** `paths` du `tsconfig.json`, déjà rapportés à la racine : `@core/*` → `src/core/*`. */
  readonly tsPaths: readonly { readonly pattern: string; readonly targets: readonly string[] }[]
  /** PSR-4 du `composer.json` : `App\` → `app/`. */
  readonly psr4: readonly { readonly prefix: string; readonly dir: string }[]
}

export interface ResolvedEdge {
  readonly fromSymbolId: string
  readonly toSymbolId: string | null
  readonly rawTarget: string
  readonly kind: EdgeKind
  readonly provenance: 'syntax' | 'uncertain'
  readonly reason: string | null
  readonly count: number
  /** Cibles possibles d'un lien incertain (levée d'ambiguïté, US6). */
  readonly candidates: readonly string[]
}

export interface ResolvedEntry {
  readonly symbolId: string
  readonly kind: EntryKind
  readonly label: string
}

interface Indexed {
  readonly id: string
  readonly file: ResolveFile
  readonly raw: RawSymbol
}

const TS_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js']
const HTTP_ATTRIBUTES = /^Http(Get|Post|Put|Patch|Delete)$/
const RECEIVER_SELF = /^(this|\$this|base|self|static|parent)$/

function normalize(path: string): string {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const lastSegment = (text: string): string => text.split(/\\|\.|::|->/).at(-1) ?? text

export function resolveGraph(
  files: readonly ResolveFile[],
  config: ResolveConfig
): { readonly edges: readonly ResolvedEdge[]; readonly entries: readonly ResolvedEntry[] } {
  const all: Indexed[] = files.flatMap((file) =>
    file.extraction.symbols.map((raw) => ({ id: file.symbolIds[raw.key] ?? '', file, raw }))
  )
  const byPath = new Map(files.map((file) => [file.path, file] as const))
  const byName = new Map<string, Indexed[]>()
  for (const symbol of all) byName.set(symbol.raw.name, [...(byName.get(symbol.raw.name) ?? []), symbol])
  const types = (name: string): Indexed[] =>
    (byName.get(name) ?? []).filter((symbol) => symbol.raw.kind === 'class' || symbol.raw.kind === 'interface')
  const childrenOf = (type: Indexed): Indexed[] =>
    type.file.extraction.symbols
      .filter((raw) => raw.parent === type.raw.key)
      .map((raw) => ({ id: type.file.symbolIds[raw.key] ?? '', file: type.file, raw }))
  const implementationsOf = (type: Indexed): Indexed[] =>
    all.filter((symbol) => symbol.raw.kind === 'class' && symbol.raw.bases.includes(type.raw.name))
  const registered = new Map<string, string>()
  for (const file of files)
    for (const entry of file.extraction.registrations) registered.set(entry.service, entry.implementation)

  // ── Fichiers et types visibles depuis un fichier ──
  const tsFile = (from: ResolveFile, source: string): ResolveFile | undefined => {
    const bases: string[] = []
    if (source.startsWith('.')) bases.push(normalize(`${dirOf(from.path)}/${source}`))
    for (const alias of config.tsPaths) {
      const star = alias.pattern.indexOf('*')
      const head = star < 0 ? alias.pattern : alias.pattern.slice(0, star)
      const tail = star < 0 ? '' : alias.pattern.slice(star + 1)
      if (star < 0 ? source !== alias.pattern : !(source.startsWith(head) && source.endsWith(tail))) continue
      const middle = star < 0 ? '' : source.slice(head.length, source.length - tail.length)
      for (const target of alias.targets) bases.push(normalize(target.replace('*', middle)))
    }
    for (const base of bases) {
      for (const extension of TS_EXTENSIONS) {
        const found = byPath.get(`${base}${extension}`)
        if (found !== undefined) return found
      }
    }
    return undefined
  }
  const phpFile = (qualified: string): ResolveFile | undefined => {
    for (const { prefix, dir } of config.psr4) {
      if (!qualified.startsWith(prefix)) continue
      const relative = qualified.slice(prefix.length).replace(/\\/g, '/')
      const found = byPath.get(normalize(`${dir}/${relative}.php`))
      if (found !== undefined) return found
    }
    return undefined
  }
  const topLevel = (file: ResolveFile, name: string): Indexed | undefined => {
    const raw = file.extraction.symbols.find((symbol) => symbol.parent === null && symbol.name === name)
    return raw === undefined ? undefined : { id: file.symbolIds[raw.key] ?? '', file, raw }
  }

  /** Symbole désigné par un nom dans un fichier (import, même fichier, même namespace, `using`). */
  const resolveName = (file: ResolveFile, name: string): { readonly found: Indexed[]; readonly sure: boolean } => {
    const simple = lastSegment(name)
    for (const entry of file.extraction.imports) {
      const binding = entry.names.find((candidate) => candidate.local === simple)
      if (binding === undefined) continue
      const target = file.lang === 'php' ? phpFile(entry.source) : tsFile(file, entry.source)
      if (target === undefined) return { found: [], sure: false }
      const imported = binding.imported === 'default' || binding.imported === '*' ? simple : binding.imported
      const symbol =
        topLevel(target, imported) ?? (target.extraction.symbols.length > 0 ? topLevel(target, simple) : undefined)
      return symbol === undefined ? { found: [], sure: false } : { found: [symbol], sure: true }
    }
    const local = topLevel(file, simple)
    if (local !== undefined) return { found: [local], sure: true }
    const named = byName.get(simple) ?? []
    if (file.lang === 'cs' || file.lang === 'php') {
      const visible = new Set([
        file.extraction.namespace,
        ...file.extraction.imports.map((entry) => entry.source.replace(/\\/g, '.'))
      ])
      const scoped = named.filter(
        (symbol) => symbol.raw.parent === null && visible.has(symbol.file.extraction.namespace)
      )
      if (scoped.length === 1) return { found: scoped, sure: true }
      if (scoped.length > 1) return { found: scoped, sure: false }
    }
    const tops = named.filter((symbol) => symbol.raw.parent === null)
    return { found: tops, sure: false }
  }

  /** Méthode `name` d'un type ou de ses bases ; `undefined` si le type ne la déclare pas. */
  const methodOf = (type: Indexed, name: string, depth = 0): Indexed | undefined => {
    const own = childrenOf(type).find((member) => member.raw.name === name)
    if (own !== undefined || depth > 5) return own
    for (const base of type.raw.bases) {
      for (const parent of types(base)) {
        const found = methodOf(parent, name, depth + 1)
        if (found !== undefined) return found
      }
    }
    return undefined
  }

  /** Cible d'un appel `name` sur une valeur de type `typeName` vu depuis `file`. */
  const onType = (file: ResolveFile, typeName: string, name: string): { found: Indexed[]; sure: boolean } | null => {
    const resolved = resolveName(file, typeName)
    const type = resolved.found.find((symbol) => symbol.raw.kind === 'class' || symbol.raw.kind === 'interface')
    if (type === undefined) return null
    if (type.raw.kind === 'interface') {
      const injected = registered.get(type.raw.name)
      const implementations = implementationsOf(type).filter(
        (implementation) => injected === undefined || implementation.raw.name === injected
      )
      const targets = implementations
        .map((implementation) => methodOf(implementation, name))
        .filter((target) => target !== undefined)
      if (targets.length === 1) return { found: targets, sure: resolved.sure }
      if (targets.length > 1) return { found: targets, sure: false }
      const declared = methodOf(type, name)
      return declared === undefined ? null : { found: [declared], sure: resolved.sure }
    }
    // Méthode du projet, sinon la classe elle-même (méthode héritée d'un framework : Eloquent `all`, `create`…).
    const method = methodOf(type, name)
    return { found: [method ?? type], sure: resolved.sure }
  }

  const edges = new Map<string, ResolvedEdge>()
  const add = (edge: Omit<ResolvedEdge, 'count'>): void => {
    if (edge.toSymbolId === edge.fromSymbolId) return
    const key = `${edge.fromSymbolId}|${edge.toSymbolId ?? edge.rawTarget}|${edge.kind}`
    const existing = edges.get(key)
    edges.set(key, existing === undefined ? { ...edge, count: 1 } : { ...existing, count: existing.count + 1 })
  }
  const link = (
    from: string,
    rawTarget: string,
    kind: EdgeKind,
    result: { found: Indexed[]; sure: boolean } | null
  ): void => {
    if (result === null || result.found.length === 0) return
    if (result.found.length === 1) {
      add({
        fromSymbolId: from,
        toSymbolId: result.found[0]?.id ?? null,
        rawTarget,
        kind,
        provenance: result.sure ? 'syntax' : 'uncertain',
        reason: result.sure ? null : 'seule cible de ce nom dans le projet, déduite par le nom',
        candidates: result.sure ? [] : result.found.map((symbol) => symbol.id)
      })
      return
    }
    add({
      fromSymbolId: from,
      toSymbolId: null,
      rawTarget,
      kind,
      provenance: 'uncertain',
      reason: `${result.found.length} cibles possibles`,
      candidates: result.found.map((symbol) => symbol.id)
    })
  }

  const entries: ResolvedEntry[] = []
  for (const file of files) {
    const { extraction } = file
    const idOf = (key: number | null): string =>
      key === null ? file.fileSymbolId : (file.symbolIds[key] ?? file.fileSymbolId)
    const classOf = (key: number | null): Indexed | undefined => {
      let current = key === null ? undefined : extraction.symbols[key]
      while (current !== undefined && current.kind !== 'class')
        current = current.parent === null ? undefined : extraction.symbols[current.parent]
      return current === undefined ? undefined : { id: file.symbolIds[current.key] ?? '', file, raw: current }
    }

    // Imports résolus dans le projet (TS / JS, PHP).
    for (const entry of extraction.imports) {
      for (const binding of entry.names) {
        const result = resolveName(file, binding.local)
        if (result.sure) link(file.fileSymbolId, entry.source, 'import', result)
      }
    }
    // Classes qui étendent ou implémentent une classe du projet.
    for (const symbol of extraction.symbols) {
      for (const base of symbol.bases)
        link(
          idOf(symbol.key),
          base,
          'implements',
          (() => {
            const result = resolveName(file, base)
            const found = result.found.filter(
              (candidate) => candidate.raw.kind === 'class' || candidate.raw.kind === 'interface'
            )
            return found.length === 0 ? null : { found, sure: result.sure }
          })()
        )
    }
    // Appels.
    for (const call of extraction.calls) {
      const from = idOf(call.from)
      const rawTarget = call.receiver === null ? call.callee : `${call.receiver}.${call.callee}`
      if (call.isNew) {
        const result = resolveName(file, call.callee)
        link(from, rawTarget, 'call', {
          found: result.found.filter((symbol) => symbol.raw.kind === 'class'),
          sure: result.sure
        })
        continue
      }
      const owner = classOf(call.from)
      if (call.receiver === null || RECEIVER_SELF.test(call.receiver)) {
        const own = owner === undefined ? undefined : methodOf(owner, call.callee)
        if (own !== undefined) {
          link(from, rawTarget, 'call', { found: [own], sure: true })
          continue
        }
        if (call.receiver === null) {
          const result = resolveName(file, call.callee)
          link(from, rawTarget, 'call', {
            found: result.found.filter((symbol) => symbol.raw.kind === 'function' || symbol.raw.kind === 'class'),
            sure: result.sure
          })
        }
        continue
      }
      // `this.repository`, `$this->service`, `_repository` : champ typé de la classe.
      const member = call.receiver.replace(/^(this\.|\$this->)/, '').replace(/^\$/, '')
      const memberType = owner?.raw.memberTypes[member]
      if (memberType !== undefined) {
        link(from, rawTarget, 'call', onType(file, memberType, call.callee))
        continue
      }
      // `Order::all`, `Stores.Resolve` : appel statique sur un type du projet.
      if (/^[A-Z][\w\\]*$/.test(call.receiver)) {
        const result = onType(file, call.receiver, call.callee)
        if (result !== null) {
          link(from, rawTarget, 'call', result)
          continue
        }
      }
      // Variable de type inconnu : déduction par le nom de la méthode seulement (jamais sûre).
      const named = (byName.get(call.callee) ?? []).filter((symbol) => symbol.raw.kind === 'method')
      if (named.length > 0) link(from, rawTarget, 'call', { found: named, sure: false })
    }
    // Routes Laravel → méthode de contrôleur (point d'entrée HTTP).
    for (const route of extraction.routes) {
      const result = onType(file, route.controller, route.action)
      link(file.fileSymbolId, `${route.method} ${route.path}`, 'route', result)
      const target = result?.found[0]
      if (target !== undefined && target.raw.kind === 'method') {
        entries.push({ symbolId: target.id, kind: 'http_route', label: `${route.method} ${route.path}` })
      }
    }
    // Injections C# : le programme relie l'interface à son implémentation.
    for (const registration of extraction.registrations) {
      link(
        file.fileSymbolId,
        registration.implementation,
        'injects',
        (() => {
          const result = resolveName(file, registration.implementation)
          const found = result.found.filter((symbol) => symbol.raw.kind === 'class')
          return found.length === 0 ? null : { found, sure: result.sure }
        })()
      )
    }
    // Points d'entrée : programme principal, actions de contrôleur C#.
    if (extraction.topLevelCode || /(^|\/)(main|index|server|program)\.(ts|js|mjs|cjs|cs)$/i.test(file.path)) {
      entries.push({ symbolId: file.fileSymbolId, kind: 'main', label: file.path.split('/').at(-1) ?? file.path })
    }
    for (const symbol of extraction.symbols) {
      const verb = symbol.attributes.find((attribute) => HTTP_ATTRIBUTES.test(attribute))
      if (verb !== undefined) {
        const owner = symbol.parent === null ? undefined : extraction.symbols[symbol.parent]
        entries.push({
          symbolId: idOf(symbol.key),
          kind: 'http_route',
          label:
            `${verb.replace('Http', '').toUpperCase()} ${owner?.name.replace(/Controller$/, '').toLowerCase() ?? ''}`.trim()
        })
      }
      if (symbol.kind === 'method' && symbol.name === 'Main')
        entries.push({ symbolId: idOf(symbol.key), kind: 'main', label: 'Main' })
    }
  }
  const unique = new Map(entries.map((entry) => [entry.symbolId, entry] as const))
  return { edges: [...edges.values()], entries: [...unique.values()] }
}
