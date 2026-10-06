import type * as TreeSitter from '@vscode/tree-sitter-wasm'
import type { Engine, GrammarLang } from './engine'

type Node = TreeSitter.Node

export type RawSymbolKind = 'namespace' | 'class' | 'interface' | 'function' | 'method'

/** Ce que l'analyse retient d'un fichier (spec 017 R3) : jamais le code lui-même, seulement sa structure. */
export interface RawSymbol {
  /** Rang dans le fichier ; `parent` y renvoie. */
  readonly key: number
  readonly parent: number | null
  readonly kind: RawSymbolKind
  readonly name: string
  readonly qualifiedName: string
  readonly startLine: number
  readonly endLine: number
  /** 1 + nombre de branches (complexité cyclomatique approchée). */
  readonly complexity: number
  /** Classes ou interfaces étendues / implémentées (noms tels qu'écrits). */
  readonly bases: readonly string[]
  /** Attributs C# (`ApiController`, `HttpPost`…) ; vide ailleurs. */
  readonly attributes: readonly string[]
  /** Types connus des champs, propriétés et paramètres de constructeur (nom → type), pour résoudre `this.x.f()`. */
  readonly memberTypes: Readonly<Record<string, string>>
}

export interface RawImport {
  /** TS / JS : module importé ; C# : namespace ; PHP : nom qualifié de la classe. */
  readonly source: string
  /** Noms locaux introduits (TS / JS : liés à `imported`) ; PHP : alias ou dernier segment. */
  readonly names: readonly { readonly local: string; readonly imported: string }[]
  readonly line: number
}

export interface RawCall {
  /** Symbole qui contient l'appel ; `null` : niveau du fichier. */
  readonly from: number | null
  /** Nom appelé (dernier segment) : `save`, `Place`, `all`, ou la classe pour `new X()`. */
  readonly callee: string
  /** Ce qui précède : `this.repository`, `_repository`, `$this->service`, `Order`, `store` ; `null` : appel direct. */
  readonly receiver: string | null
  readonly isNew: boolean
  readonly line: number
}

/** Route Laravel `Route::get('/x', [XController::class, 'm'])`. */
export interface RawRoute {
  readonly method: string
  readonly path: string
  readonly controller: string
  readonly action: string
  readonly line: number
}

/** Injection de dépendances C# `AddScoped<IX, X>()` (ou `<X>`). */
export interface RawRegistration {
  readonly service: string
  readonly implementation: string
}

export interface FileExtraction {
  readonly namespace: string | null
  readonly symbols: readonly RawSymbol[]
  readonly imports: readonly RawImport[]
  readonly calls: readonly RawCall[]
  readonly routes: readonly RawRoute[]
  readonly registrations: readonly RawRegistration[]
  /** Instructions de premier niveau (`Program.cs` moderne, script) : point d'entrée « programme principal ». */
  readonly topLevelCode: boolean
}

export type ExtractResult =
  | { readonly ok: true; readonly lines: number; readonly extraction: FileExtraction }
  | { readonly ok: false; readonly lines: number; readonly reason: string }

/** Analyse d'un fichier abandonnée au-delà de ce délai (spec 017 R2). */
export const PARSE_TIMEOUT_MS = 2000

const BRANCHES = new Set([
  'if_statement',
  'for_statement',
  'for_in_statement',
  'foreach_statement',
  'while_statement',
  'do_statement',
  'catch_clause',
  'switch_case',
  'switch_section',
  'case_statement',
  'conditional_expression',
  'ternary_expression',
  'match_conditional_expression'
])

const line = (node: Node): number => node.startPosition.row + 1
const unquote = (text: string): string => text.replace(/^['"`]|['"`]$/g, '')
const lastSegment = (text: string): string => text.split(/\\|\.|::|->/).at(-1) ?? text

class Collector {
  readonly symbols: RawSymbol[] = []
  readonly imports: RawImport[] = []
  readonly calls: RawCall[] = []
  readonly routes: RawRoute[] = []
  readonly registrations: RawRegistration[] = []
  namespace: string | null = null
  topLevelCode = false

  addSymbol(
    node: Node,
    parent: number | null,
    kind: RawSymbolKind,
    name: string,
    extra: Partial<Pick<RawSymbol, 'bases' | 'attributes' | 'memberTypes'>> = {}
  ): number {
    const key = this.symbols.length
    const parentSymbol = parent === null ? undefined : this.symbols[parent]
    const prefix = parentSymbol?.qualifiedName ?? this.namespace
    this.symbols.push({
      key,
      parent,
      kind,
      name,
      qualifiedName: prefix === null || prefix === undefined || prefix === '' ? name : `${prefix}.${name}`,
      startLine: line(node),
      endLine: node.endPosition.row + 1,
      complexity: 1 + countBranches(node),
      bases: extra.bases ?? [],
      attributes: extra.attributes ?? [],
      memberTypes: extra.memberTypes ?? {}
    })
    return key
  }

  addCall(from: number | null, callee: string, receiver: string | null, isNew: boolean, node: Node): void {
    if (callee === '') return
    this.calls.push({ from, callee, receiver, isNew, line: line(node) })
  }

  result(): FileExtraction {
    return {
      namespace: this.namespace,
      symbols: this.symbols,
      imports: this.imports,
      calls: this.calls,
      routes: this.routes,
      registrations: this.registrations,
      topLevelCode: this.topLevelCode
    }
  }
}

/** Branches d'un symbole, sans descendre dans les fonctions qu'il contient (elles ont leur propre compte). */
function countBranches(node: Node): number {
  let count = 0
  const visit = (current: Node, root: boolean): void => {
    if (!root && /function|method|class|lambda|arrow/.test(current.type)) return
    if (BRANCHES.has(current.type)) count++
    if (current.type === 'binary_expression') {
      const operator = current.childForFieldName('operator')?.text ?? current.child(1)?.text
      if (operator === '&&' || operator === '||' || operator === '??') count++
    }
    for (const child of current.namedChildren) if (child !== null) visit(child, false)
  }
  visit(node, true)
  return count
}

function children(node: Node): Node[] {
  return node.namedChildren.filter((child): child is Node => child !== null)
}

// ── TypeScript / JavaScript ─────────────────────────────────────────────────────────────────────────────────────

function tsMemberTypes(body: Node | null): Record<string, string> {
  const types: Record<string, string> = {}
  if (body === null) return types
  for (const member of children(body)) {
    if (member.type === 'public_field_definition' || member.type === 'field_definition') {
      const name = member.childForFieldName('name')?.text ?? member.childForFieldName('property')?.text
      const value = member.childForFieldName('value')
      const annotated = member.childForFieldName('type')?.text.replace(/^:\s*/, '')
      const fromNew = value?.type === 'new_expression' ? value.childForFieldName('constructor')?.text : undefined
      const type = fromNew ?? annotated
      if (name !== undefined && type !== undefined) types[name] = lastSegment(type)
    }
    if (member.type === 'method_definition' && member.childForFieldName('name')?.text === 'constructor') {
      for (const parameter of children(member.childForFieldName('parameters') ?? member)) {
        const hasModifier = children(parameter).some((child) => child.type === 'accessibility_modifier')
        const name = parameter.childForFieldName('pattern')?.text
        const type = parameter.childForFieldName('type')?.text.replace(/^:\s*/, '')
        if (hasModifier && name !== undefined && type !== undefined) types[name] = lastSegment(type)
      }
    }
  }
  return types
}

function walkTs(node: Node, parent: number | null, out: Collector): void {
  switch (node.type) {
    case 'import_statement': {
      const source = unquote(node.childForFieldName('source')?.text ?? '')
      const names: { local: string; imported: string }[] = []
      for (const clause of children(node).filter((child) => child.type === 'import_clause')) {
        for (const part of children(clause)) {
          if (part.type === 'identifier') names.push({ local: part.text, imported: 'default' })
          if (part.type === 'namespace_import') {
            const local = children(part).find((child) => child.type === 'identifier')?.text
            if (local !== undefined) names.push({ local, imported: '*' })
          }
          if (part.type === 'named_imports') {
            for (const specifier of children(part).filter((child) => child.type === 'import_specifier')) {
              const imported = specifier.childForFieldName('name')?.text ?? ''
              names.push({ local: specifier.childForFieldName('alias')?.text ?? imported, imported })
            }
          }
        }
      }
      out.imports.push({ source, names, line: line(node) })
      return
    }
    case 'class_declaration':
    case 'abstract_class_declaration':
    case 'interface_declaration': {
      const name = node.childForFieldName('name')?.text ?? ''
      const heritage = children(node).find((child) => /heritage|extends/.test(child.type))
      const bases =
        heritage === undefined
          ? []
          : (heritage.text.match(/[A-Za-z_$][\w$]*/g) ?? []).filter(
              (word) => word !== 'extends' && word !== 'implements'
            )
      const body = node.childForFieldName('body')
      const key = out.addSymbol(node, parent, node.type === 'interface_declaration' ? 'interface' : 'class', name, {
        bases,
        memberTypes: tsMemberTypes(body)
      })
      if (body !== null) for (const child of children(body)) walkTs(child, key, out)
      return
    }
    case 'function_declaration':
    case 'generator_function_declaration':
    case 'method_definition': {
      const name = node.childForFieldName('name')?.text ?? ''
      const key = out.addSymbol(node, parent, node.type === 'method_definition' ? 'method' : 'function', name)
      for (const child of children(node)) walkTs(child, key, out)
      return
    }
    case 'variable_declarator': {
      const value = node.childForFieldName('value')
      const name = node.childForFieldName('name')
      if (
        value !== null &&
        name?.type === 'identifier' &&
        /arrow_function|function_expression|function$/.test(value.type)
      ) {
        const key = out.addSymbol(node, parent, 'function', name.text)
        walkTs(value, key, out)
        return
      }
      // `const { a } = require('./x')` : un import CommonJS.
      if (value?.type === 'call_expression' && value.childForFieldName('function')?.text === 'require') {
        const source = unquote(children(value.childForFieldName('arguments') ?? value)[0]?.text ?? '')
        const names =
          name?.type === 'identifier'
            ? [{ local: name.text, imported: 'default' }]
            : (name?.text.match(/[A-Za-z_$][\w$]*/g) ?? []).map((local) => ({ local, imported: local }))
        out.imports.push({ source, names, line: line(node) })
        return
      }
      break
    }
    case 'call_expression': {
      const fn = node.childForFieldName('function')
      if (fn?.type === 'identifier') out.addCall(parent, fn.text, null, false, node)
      else if (fn?.type === 'member_expression') {
        out.addCall(
          parent,
          fn.childForFieldName('property')?.text ?? '',
          fn.childForFieldName('object')?.text ?? null,
          false,
          node
        )
      }
      break
    }
    case 'new_expression': {
      const constructor = node.childForFieldName('constructor')?.text ?? ''
      out.addCall(parent, lastSegment(constructor), null, true, node)
      break
    }
    default:
  }
  for (const child of children(node)) walkTs(child, parent, out)
}

// ── C# ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function csAttributes(node: Node): string[] {
  return children(node)
    .filter((child) => child.type === 'attribute_list')
    .flatMap((list) => children(list).filter((child) => child.type === 'attribute'))
    .map((attribute) => lastSegment(attribute.childForFieldName('name')?.text ?? ''))
}

function csMemberTypes(body: Node | null): Record<string, string> {
  const types: Record<string, string> = {}
  if (body === null) return types
  for (const member of children(body)) {
    if (member.type === 'field_declaration' || member.type === 'property_declaration') {
      const declaration = children(member).find((child) => child.type === 'variable_declaration')
      const type = (declaration ?? member).childForFieldName('type')?.text
      const names =
        declaration === undefined
          ? [member.childForFieldName('name')?.text]
          : children(declaration)
              .filter((child) => child.type === 'variable_declarator')
              .map((child) => child.childForFieldName('name')?.text ?? children(child)[0]?.text)
      for (const name of names)
        if (name !== undefined && type !== undefined) types[name] = lastSegment(type.replace(/<.*$/, ''))
    }
    if (member.type === 'constructor_declaration') {
      for (const parameter of children(member.childForFieldName('parameters') ?? member)) {
        const name = parameter.childForFieldName('name')?.text
        const type = parameter.childForFieldName('type')?.text
        if (name !== undefined && type !== undefined) types[name] = lastSegment(type)
      }
    }
  }
  return types
}

function walkCs(node: Node, parent: number | null, out: Collector): void {
  switch (node.type) {
    case 'using_directive': {
      const name = children(node).find((child) => /qualified_name|identifier/.test(child.type))?.text
      if (name !== undefined) out.imports.push({ source: name, names: [], line: line(node) })
      return
    }
    case 'file_scoped_namespace_declaration':
    case 'namespace_declaration': {
      out.namespace = node.childForFieldName('name')?.text ?? out.namespace
      break
    }
    case 'global_statement':
      out.topLevelCode = true
      break
    case 'class_declaration':
    case 'record_declaration':
    case 'struct_declaration':
    case 'interface_declaration': {
      const name = node.childForFieldName('name')?.text ?? ''
      const baseList = children(node).find((child) => child.type === 'base_list')
      const body = node.childForFieldName('body')
      const key = out.addSymbol(node, parent, node.type === 'interface_declaration' ? 'interface' : 'class', name, {
        bases:
          baseList === undefined ? [] : children(baseList).map((base) => lastSegment(base.text.replace(/<.*$/, ''))),
        attributes: csAttributes(node),
        memberTypes: csMemberTypes(body)
      })
      if (body !== null) for (const child of children(body)) walkCs(child, key, out)
      return
    }
    case 'method_declaration':
    case 'constructor_declaration':
    case 'local_function_statement': {
      const name = node.childForFieldName('name')?.text ?? ''
      const key = out.addSymbol(node, parent, node.type === 'local_function_statement' ? 'function' : 'method', name, {
        attributes: csAttributes(node)
      })
      for (const child of children(node)) walkCs(child, key, out)
      return
    }
    case 'invocation_expression': {
      const fn = node.childForFieldName('function')
      if (fn?.type === 'member_access_expression') {
        const nameNode = fn.childForFieldName('name')
        const callee = nameNode?.type === 'generic_name' ? (children(nameNode)[0]?.text ?? '') : (nameNode?.text ?? '')
        // Injection de dépendances : AddScoped<IX, X>(), AddTransient<X>()…
        if (/^Add(Scoped|Transient|Singleton)$/.test(callee) && nameNode?.type === 'generic_name') {
          const types = children(children(nameNode).find((child) => child.type === 'type_argument_list') ?? nameNode)
          const service = types[0]?.text
          const implementation = types[1]?.text ?? service
          if (service !== undefined && implementation !== undefined) {
            out.registrations.push({ service: lastSegment(service), implementation: lastSegment(implementation) })
          }
        }
        out.addCall(parent, callee, fn.childForFieldName('expression')?.text ?? null, false, node)
      } else if (fn !== null) out.addCall(parent, lastSegment(fn.text.replace(/<.*$/, '')), null, false, node)
      break
    }
    case 'object_creation_expression': {
      const type = node.childForFieldName('type')?.text ?? ''
      out.addCall(parent, lastSegment(type.replace(/<.*$/, '')), null, true, node)
      break
    }
    default:
  }
  for (const child of children(node)) walkCs(child, parent, out)
}

// ── PHP / Laravel ───────────────────────────────────────────────────────────────────────────────────────────────

function phpMemberTypes(node: Node): Record<string, string> {
  const types: Record<string, string> = {}
  const visit = (current: Node): void => {
    if (current.type === 'property_promotion_parameter' || current.type === 'property_declaration') {
      const type = current.childForFieldName('type')?.text
      const name = (
        current.childForFieldName('name') ??
        children(current).find((child) => /property_element|variable_name/.test(child.type))
      )?.text
      if (type !== undefined && name !== undefined)
        types[name.replace(/^\$/, '')] = lastSegment(type.replace(/^\?/, ''))
    }
    if (!/function_definition|class_declaration/.test(current.type) || current === node) {
      for (const child of children(current)) visit(child)
    }
  }
  visit(node)
  return types
}

function phpRoute(node: Node): RawRoute | null {
  const scope = node.childForFieldName('scope')?.text
  const method = node.childForFieldName('name')?.text ?? ''
  if (scope !== 'Route' || !/^(get|post|put|patch|delete|any|match)$/i.test(method)) return null
  const args = children(node.childForFieldName('arguments') ?? node).map(
    (argument) => children(argument)[0] ?? argument
  )
  const path = args[0]?.type === 'string' || args[0]?.type === 'encapsed_string' ? unquote(args[0].text) : null
  const target = args[1]
  if (path === null || target?.type !== 'array_creation_expression') return null
  const elements = children(target).map((element) => children(element)[0])
  const controller =
    elements[0]?.type === 'class_constant_access_expression' ? children(elements[0])[0]?.text : undefined
  const action = elements[1]?.type === 'string' ? unquote(elements[1].text) : undefined
  return controller === undefined || action === undefined
    ? null
    : { method: method.toUpperCase(), path, controller: lastSegment(controller), action, line: line(node) }
}

function walkPhp(node: Node, parent: number | null, out: Collector): void {
  switch (node.type) {
    case 'namespace_definition':
      out.namespace = (node.childForFieldName('name')?.text ?? '').replace(/\\/g, '.') || out.namespace
      break
    case 'namespace_use_declaration': {
      for (const clause of children(node).filter((child) => child.type === 'namespace_use_clause')) {
        const parts = children(clause)
        const qualified = parts[0]?.text ?? ''
        const alias = parts[1]?.text
        out.imports.push({
          source: qualified.replace(/^\\/, ''),
          names: [{ local: alias ?? lastSegment(qualified), imported: lastSegment(qualified) }],
          line: line(node)
        })
      }
      return
    }
    case 'class_declaration':
    case 'interface_declaration':
    case 'trait_declaration': {
      const name = node.childForFieldName('name')?.text ?? ''
      const bases = children(node)
        .filter((child) => child.type === 'base_clause' || child.type === 'class_interface_clause')
        .flatMap((clause) => children(clause).map((base) => lastSegment(base.text)))
      const body = node.childForFieldName('body')
      const key = out.addSymbol(node, parent, node.type === 'interface_declaration' ? 'interface' : 'class', name, {
        bases,
        memberTypes: phpMemberTypes(node)
      })
      if (body !== null) for (const child of children(body)) walkPhp(child, key, out)
      return
    }
    case 'method_declaration':
    case 'function_definition': {
      const name = node.childForFieldName('name')?.text ?? ''
      const key = out.addSymbol(node, parent, node.type === 'method_declaration' ? 'method' : 'function', name)
      for (const child of children(node)) walkPhp(child, key, out)
      return
    }
    case 'scoped_call_expression': {
      const route = phpRoute(node)
      if (route !== null) out.routes.push(route)
      out.addCall(
        parent,
        node.childForFieldName('name')?.text ?? '',
        node.childForFieldName('scope')?.text ?? null,
        false,
        node
      )
      break
    }
    case 'member_call_expression':
    case 'nullsafe_member_call_expression':
      out.addCall(
        parent,
        node.childForFieldName('name')?.text ?? '',
        node.childForFieldName('object')?.text ?? null,
        false,
        node
      )
      break
    case 'function_call_expression':
      out.addCall(parent, lastSegment(node.childForFieldName('function')?.text ?? ''), null, false, node)
      break
    case 'object_creation_expression': {
      const type = children(node).find((child) => /name|qualified_name/.test(child.type))?.text ?? ''
      out.addCall(parent, lastSegment(type), null, true, node)
      break
    }
    default:
  }
  for (const child of children(node)) walkPhp(child, parent, out)
}

/**
 * Structure d'un fichier (spec 017 R3) : symboles, imports, appels, routes et injections. Le code n'est jamais exécuté
 * ni interprété ; une analyse trop longue est abandonnée, un fichier invalide est signalé sans être extrait.
 */
export function extractFile(engine: Engine, lang: GrammarLang, source: string, now = Date.now): ExtractResult {
  const lines = source.split('\n').length
  engine.parser.setLanguage(engine.languages[lang])
  const started = now()
  let cancelled = false
  const tree = engine.parser.parse(source, null, {
    progressCallback: () => {
      cancelled = now() - started > PARSE_TIMEOUT_MS
      return cancelled
    }
  })
  if (tree === null || cancelled) return { ok: false, lines, reason: 'analyse trop longue (plus de 2 s)' }
  try {
    if (tree.rootNode.hasError) return { ok: false, lines, reason: 'erreur de syntaxe' }
    const out = new Collector()
    const walk = lang === 'cs' ? walkCs : lang === 'php' ? walkPhp : walkTs
    walk(tree.rootNode, null, out)
    return { ok: true, lines, extraction: out.result() }
  } finally {
    tree.delete()
  }
}
