import { randomUUID } from 'node:crypto'
import type { ToolResult } from '@shared/mcp/protocol'
import type { StructureDessinerInput } from '@shared/mcp/tools'
import type { McpCaller } from '../../domain/mcp/caller'
import { McpToolError } from '../../domain/mcp/errors'
import { resolveStructure } from '../../domain/structure/resolve'
import { AppError } from '../../domain/errors'
import { ARCHITECTURES, layerOf, type ArchitectureKind } from '@shared/structure/architecture'
import type { StructureArchitectureView } from '@shared/ipc/canvas'
import type { ChangeEntry } from '../../infrastructure/db/repositories/changeLog'
import type { ElementRepository, ElementRow } from '../../infrastructure/db/repositories/ElementRepository'
import type { MapLinkRepository } from '../../infrastructure/db/repositories/MapLinkRepository'

export interface StructureDeps {
  readonly elements: Pick<
    ElementRepository,
    | 'list'
    | 'insert'
    | 'update'
    | 'archive'
    | 'setCollapsed'
    | 'log'
    | 'transaction'
    | 'architectures'
    | 'setArchitecture'
    | 'setLayer'
  >
  readonly links: Pick<MapLinkRepository, 'insert' | 'between' | 'touching' | 'softDelete'>
  /** Genesis (racine visible) d'un neurone : lui-même pour une racine, son genesis pour un élément ; `undefined` sinon. */
  readonly genesisOf: (neuronId: string) => string | undefined
  readonly genesisTitle: (genesisId: string) => string | undefined
  /** La carte change : la fenêtre la rafraîchit et propose « Annuler ». */
  readonly emit: (event: { readonly batchId: string; readonly summary: string; readonly count: number }) => void
}

const snapshot = (
  row: Pick<
    ElementRow,
    'title' | 'content' | 'type' | 'status' | 'paths' | 'parentId' | 'depth' | 'rank' | 'layer' | 'layerSource'
  >
) => ({
  title: row.title,
  content: row.content,
  type: row.type,
  status: row.status,
  paths: JSON.stringify(row.paths),
  parentId: row.parentId,
  depth: row.depth,
  rank: row.rank,
  layer: row.layer,
  layerSource: row.layerSource
})

/** Instantané d'architecture (D20) pour l'Historique ; `null` : aucune. */
const architectureSnapshot = (value: Omit<StructureArchitectureView, 'genesisId'> | null) =>
  value === null
    ? { architecture: null, reason: null, source: null }
    : {
        architecture: value.kind,
        reason: value.reason,
        source: value.source
      }

/**
 * Carte de structure d'un projet (spec 009) : Claude dessine et met à jour, par clé stable, les éléments typés d'un
 * genesis et leurs liens typés. Tout ou rien ; une opération d'Historique « par Claude » ; une conversation n'agit que
 * sur son propre projet.
 */
export class StructureService {
  constructor(private readonly deps: StructureDeps) {}

  draw(input: StructureDessinerInput, caller: McpCaller): ToolResult {
    const genesisId = this.target(input.projet, caller)
    const current = this.deps.elements.list(genesisId)
    const byKey = new Map(current.map((row) => [row.key, row] as const))
    const byId = new Map(current.map((row) => [row.id, row] as const))
    const existingParents = new Map(
      current.map(
        (row) => [row.key, row.parentId === genesisId ? null : (byId.get(row.parentId)?.key ?? null)] as const
      )
    )
    const existingArchitecture = this.deps.elements.architectures([genesisId])[0] ?? null
    // Architecture effective (D20) : celle de mentalyas prime, sinon celle du lot, sinon celle déjà enregistrée.
    const effective =
      existingArchitecture?.source === 'user'
        ? existingArchitecture.kind
        : (input.architecture?.type ?? existingArchitecture?.kind ?? null)
    const resolved = resolveStructure(input, existingParents, effective)
    if (!resolved.ok) throw new McpToolError(resolved.problem.code, resolved.problem.message)

    const batchId = randomUUID()
    const entries: ChangeEntry[] = []
    const ids = new Map<string, string>(current.map((row) => [row.key, row.id]))
    for (const element of resolved.elements) if (!ids.has(element.key)) ids.set(element.key, randomUUID())
    const parentKeys = new Map(existingParents)
    for (const element of resolved.elements) parentKeys.set(element.key, element.parentKey)
    const depthOf = (key: string): number => {
      let depth = 1
      let parent = parentKeys.get(key) ?? null
      while (parent !== null && depth < 50) {
        depth++
        parent = parentKeys.get(parent) ?? null
      }
      return depth
    }
    let created = 0
    let updated = 0
    let removed = 0
    let linked = 0
    let architectureSet = false
    const { elements, links } = this.deps

    elements.transaction(() => {
      for (const element of resolved.elements) {
        const id = ids.get(element.key) as string
        const parentId = element.parentKey === null ? genesisId : (ids.get(element.parentKey) as string)
        const before = byKey.get(element.key)
        // La couche corrigée par mentalyas prime sur celle de Claude (D20).
        const keepUser = before?.layerSource === 'user'
        const fields = {
          parentId,
          depth: depthOf(element.key),
          type: element.type,
          title: element.title,
          content: element.summary ?? before?.content ?? null,
          status: element.status ?? before?.status ?? null,
          paths: element.paths ?? before?.paths ?? [],
          rank: element.order ?? before?.rank ?? null,
          layer: keepUser ? (before?.layer ?? null) : (element.layer ?? before?.layer ?? null),
          layerSource: keepUser
            ? ('user' as const)
            : element.layer !== null
              ? ('claude' as const)
              : (before?.layerSource ?? null)
        }
        if (before === undefined) {
          elements.insert({ id, genesisId, key: element.key, ...fields })
          created++
          entries.push({ kind: 'mcp_write', entity: 'element', entityId: id, before: null, after: snapshot(fields) })
        } else {
          elements.update(id, fields)
          updated++
          entries.push({
            kind: 'mcp_write',
            entity: 'element',
            entityId: id,
            before: snapshot(before),
            after: snapshot(fields)
          })
        }
      }
      if (input.retirer_absents === true) {
        const kept = new Set(resolved.elements.map((element) => element.key))
        for (const row of current) {
          if (kept.has(row.key)) continue
          elements.archive(row.id)
          removed++
          entries.push({ kind: 'mcp_write', entity: 'element', entityId: row.id, before: snapshot(row), after: null })
          for (const link of links.touching(row.id)) {
            links.softDelete(link.id)
            entries.push({
              kind: 'mcp_write',
              entity: 'map_link',
              entityId: link.id,
              before: { label: link.label },
              after: null
            })
          }
        }
      }
      if (input.architecture !== undefined && existingArchitecture?.source !== 'user') {
        const next = {
          kind: input.architecture.type,
          reason: input.architecture.justification,
          source: 'claude' as const
        }
        this.deps.elements.setArchitecture(genesisId, next)
        architectureSet = true
        entries.push({
          kind: 'mcp_write',
          entity: 'structure_architecture',
          entityId: genesisId,
          before: architectureSnapshot(existingArchitecture),
          after: architectureSnapshot(next)
        })
      }
      for (const link of resolved.links) {
        const from = { kind: 'element' as const, id: ids.get(link.fromKey) as string }
        const to = { kind: 'element' as const, id: ids.get(link.toKey) as string }
        if (links.between(from, to) !== undefined) continue
        const createdLink = links.insert({ from, to, label: link.label, origin: 'claude', relation: link.relation })
        linked++
        entries.push({
          kind: 'mcp_write',
          entity: 'map_link',
          entityId: createdLink.id,
          before: null,
          after: { label: link.label }
        })
      }
      elements.log(batchId, entries, 'claude')
    })

    const parts = [
      created === 0 ? null : `${created} créé${created > 1 ? 's' : ''}`,
      updated === 0 ? null : `${updated} mis à jour`,
      removed === 0 ? null : `${removed} retiré${removed > 1 ? 's' : ''}`,
      linked === 0 ? null : `${linked} lien${linked > 1 ? 's' : ''}`,
      architectureSet && input.architecture !== undefined
        ? `architecture ${ARCHITECTURES[input.architecture.type].label}`
        : null
    ].filter((part) => part !== null)
    const userArchitecture =
      input.architecture !== undefined && existingArchitecture?.source === 'user'
        ? ` L'architecture choisie par mentalyas (${ARCHITECTURES[existingArchitecture.kind].label}) est gardée.`
        : ''
    const summary = `Claude : carte de structure — ${parts.join(', ')}`
    this.deps.emit({ batchId, summary, count: entries.length })
    return {
      text: `Carte de structure de « ${this.deps.genesisTitle(genesisId) ?? 'projet'} » : ${parts.join(', ')} (annulable par mentalyas).${userArchitecture}`,
      data: { lot: batchId, crees: created, mis_a_jour: updated, retires: removed, liens: linked }
    }
  }

  read(projet: string | undefined, caller: McpCaller): ToolResult {
    const genesisId = this.target(projet, caller)
    const rows = this.deps.elements.list(genesisId)
    if (rows.length === 0)
      return { text: 'Aucune carte de structure pour ce projet : dessine-la avec structure_dessiner.' }
    const children = new Map<string, ElementRow[]>()
    for (const row of rows) children.set(row.parentId, [...(children.get(row.parentId) ?? []), row])
    const architecture = this.deps.elements.architectures([genesisId])[0]
    const lines: string[] =
      architecture === undefined
        ? []
        : [`Architecture : ${architecture.kind}${architecture.source === 'user' ? ' (choisie par mentalyas)' : ''}`]
    const walk = (parentId: string, level: number): void => {
      for (const row of children.get(parentId) ?? []) {
        const extra = [
          row.status,
          row.layer === null ? null : `couche ${row.layer}${row.layerSource === 'user' ? ' (mentalyas)' : ''}`,
          row.paths.length === 0 ? null : row.paths.join(', ')
        ].filter((part) => part !== null)
        lines.push(
          `${'  '.repeat(level)}- [${row.type}] ${row.key} « ${row.title} »${extra.length === 0 ? '' : ` (${extra.join(' · ')})`}`
        )
        walk(row.id, level + 1)
      }
    }
    walk(genesisId, 0)
    return { text: `Carte de structure (${rows.length} éléments) :\n${lines.join('\n')}` }
  }

  setCollapsed(elementId: string, collapsed: boolean): void {
    this.deps.elements.setCollapsed(elementId, collapsed)
  }

  /** Architecture choisie par mentalyas (D20) : prioritaire sur celle de Claude, annulable ; `aucune` la retire. */
  setArchitecture(genesisId: string, kind: ArchitectureKind): { readonly batchId: string } {
    if (this.deps.genesisTitle(genesisId) === undefined) throw new AppError('NOT_FOUND', 'Projet introuvable')
    const before = this.deps.elements.architectures([genesisId])[0] ?? null
    const next = { kind, reason: null, source: 'user' as const }
    const batchId = randomUUID()
    this.deps.elements.transaction(() => {
      this.deps.elements.setArchitecture(genesisId, next)
      this.deps.elements.log(
        batchId,
        [
          {
            kind: 'structure',
            entity: 'structure_architecture',
            entityId: genesisId,
            before: architectureSnapshot(before),
            after: architectureSnapshot(next)
          }
        ],
        'user'
      )
    })
    const summary = `Architecture : ${ARCHITECTURES[kind].label}`
    this.deps.emit({ batchId, summary, count: 1 })
    return { batchId }
  }

  /** Couche choisie par mentalyas (D20), vérifiée contre l'architecture de la carte ; `null` : non classé. */
  setLayer(elementId: string, layer: string | null): { readonly batchId: string } {
    const row = this.deps.elements.list().find((entry) => entry.id === elementId)
    if (row === undefined) throw new AppError('NOT_FOUND', 'Élément introuvable')
    const architecture = this.deps.elements.architectures([row.genesisId])[0]
    if (layer !== null && (architecture === undefined || layerOf(architecture.kind, layer) === null)) {
      throw new AppError('VALIDATION', 'Cette couche n’appartient pas à l’architecture de la carte')
    }
    const batchId = randomUUID()
    this.deps.elements.transaction(() => {
      this.deps.elements.setLayer(elementId, layer, 'user')
      this.deps.elements.log(
        batchId,
        [
          {
            kind: 'structure',
            entity: 'element_layer',
            entityId: elementId,
            before: { layer: row.layer, layerSource: row.layerSource },
            after: { layer, layerSource: layer === null ? null : 'user' }
          }
        ],
        'user'
      )
    })
    this.deps.emit({ batchId, summary: `Couche de « ${row.title} » changée`, count: 1 })
    return { batchId }
  }

  /** Projet visé : celui donné, sinon celui de la conversation ; jamais un autre projet que celui de la conversation. */
  private target(projet: string | undefined, caller: McpCaller): string {
    const own = caller.neuronId === null ? undefined : this.deps.genesisOf(caller.neuronId)
    const genesisId = projet ?? own
    if (genesisId === undefined) {
      throw new McpToolError('ENTREE_INVALIDE', 'projet requis : cette session n’est pas la conversation d’un neurone.')
    }
    if (this.deps.genesisTitle(genesisId) === undefined) {
      throw new McpToolError('INTROUVABLE', `Projet ${genesisId} introuvable (retiré ou annulé ?)`)
    }
    if (own !== undefined && own !== genesisId) {
      throw new McpToolError('NON_MODIFIABLE', 'Ce projet n’est pas celui de cette conversation.')
    }
    return genesisId
  }
}
