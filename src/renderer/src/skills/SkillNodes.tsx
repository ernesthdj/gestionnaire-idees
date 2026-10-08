import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { LibrarySkillView, LibraryVerdict, SkillView } from '@shared/ipc/skills'
import { FAMILY_LABELS, type SkillFamily } from '@shared/skills/model'

/** Verdict d'audit : icône + libellé, jamais la couleur seule (spec 020 FR-031). */
export const VERDICTS: Readonly<Record<LibraryVerdict, { icon: string; label: string; tone: string }>> = {
  sur: { icon: '✓', label: 'sûr', tone: 'border-emerald-600/60' },
  a_revoir: { icon: '!', label: 'à revoir', tone: 'border-amber-600/70' },
  dangereux: { icon: '✕', label: 'dangereux', tone: 'border-red-600' }
}

/** Icône de la bibliothèque (dépôts importés, D12). */
export const LIBRARY_ICON = '⇩'

/** Icône de chaque famille : toujours accompagnée de son libellé (jamais la couleur ni l'icône seules). */
export const FAMILY_ICONS: Readonly<Record<SkillFamily, string>> = { perso: '◆', projet: '▣', plugin: '⬡' }

const FAMILY_TONES: Readonly<Record<SkillFamily, string>> = {
  perso: 'border-accent',
  projet: 'border-emerald-600 dark:border-emerald-400',
  plugin: 'border-content-muted'
}

export type SkillNodeData = { readonly skill: SkillView; readonly selected: boolean }
export type SkillNodeType = Node<SkillNodeData, 'skill'>
export type TrunkNodeType = Node<{ readonly count: number }, 'trunk'>
export type BranchNodeType = Node<{ readonly label: string; readonly count: number }, 'branch'>
export type ClusterNodeType = Node<{ readonly count: number; readonly onToggle: () => void }, 'cluster'>
export type GhostNodeType = Node<
  { readonly name: string; readonly description: string; readonly selected: boolean },
  'ghost'
>
export type RepoNodeType = Node<
  { readonly label: string; readonly count: number; readonly open: boolean; readonly selected: boolean },
  'repo'
>
export type AvailableNodeType = Node<{ readonly skill: LibrarySkillView; readonly selected: boolean }, 'available'>

function Handles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="neuron-handle" />
    </>
  )
}

/** Nœud d'un skill (spec 020 US1) : nom, famille (icône + libellé), repères ⚠ scripts et « abîmé ». */
export function SkillNode({ data }: NodeProps<SkillNodeType>): React.JSX.Element {
  const { skill } = data
  return (
    <div
      className={`flex h-[104px] w-[208px] flex-col justify-between rounded-xl border-2 bg-surface-raised px-3 py-2 text-xs shadow-sm ${
        FAMILY_TONES[skill.family]
      } ${data.selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''} ${
        skill.damaged ? 'border-dashed opacity-80' : ''
      }`}
    >
      <Handles />
      <p className="truncate text-sm font-semibold text-content" title={skill.name}>
        {skill.name}
      </p>
      <p className="line-clamp-2 text-content-muted">{skill.description === '' ? '—' : skill.description}</p>
      <p className="flex items-center justify-between gap-2">
        <span>
          <span aria-hidden="true">{FAMILY_ICONS[skill.family]}</span> {FAMILY_LABELS[skill.family]}
        </span>
        <span className="flex gap-1">
          {skill.hasScripts ? <span title="Contient des scripts">⚠ scripts</span> : null}
          {skill.damaged ? <span title="En-tête absent ou invalide">abîmé</span> : null}
        </span>
      </p>
    </div>
  )
}

/** Tronc « Toi » au centre de l'arbre. */
export function TrunkNode({ data }: NodeProps<TrunkNodeType>): React.JSX.Element {
  return (
    <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-accent bg-surface-raised text-center shadow-md">
      <Handle type="source" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <span className="text-sm font-semibold">Toi</span>
      <span className="text-[10px] text-content-muted">{data.count} skills</span>
    </div>
  )
}

/** Étiquette d'une branche (famille au lot A). */
export function BranchNode({ data }: NodeProps<BranchNodeType>): React.JSX.Element {
  return (
    <div className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-content-muted shadow-sm">
      <Handle type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      {data.label} · {data.count}
    </div>
  )
}

/** Grappe repliée des skills de plugins (US1-3) : un clic la déplie. */
export function ClusterNode({ data }: NodeProps<ClusterNodeType>): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={data.onToggle}
      className="nodrag flex h-[104px] w-[208px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-content-muted bg-surface-raised text-xs"
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <span className="text-sm font-semibold">
        <span aria-hidden="true">{FAMILY_ICONS.plugin}</span> {data.count} skills de plugins
      </span>
      <span className="text-content-muted">Déplier</span>
    </button>
  )
}

/** Brouillon d'un nouveau skill (FR-023) : nœud fantôme jusqu'à son installation. */
export function GhostNode({ data }: NodeProps<GhostNodeType>): React.JSX.Element {
  return (
    <div
      className={`flex h-[104px] w-[208px] flex-col justify-between rounded-xl border-2 border-dashed border-accent bg-surface px-3 py-2 text-xs opacity-90 ${
        data.selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
      }`}
    >
      <Handles />
      <p className="truncate text-sm font-semibold text-content" title={data.name}>
        {data.name}
      </p>
      <p className="line-clamp-2 text-content-muted">{data.description}</p>
      <p className="font-semibold text-accent">Brouillon · à installer</p>
    </div>
  )
}

/** Dépôt de la bibliothèque (D12) : grappe de ses skills disponibles, dépliée au clic. */
export function RepoNode({ data }: NodeProps<RepoNodeType>): React.JSX.Element {
  return (
    <div
      className={`flex h-[104px] w-[208px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-content-muted bg-surface-raised px-3 text-xs ${
        data.selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
      }`}
    >
      <Handles />
      <span className="max-w-full truncate text-sm font-semibold" title={data.label}>
        <span aria-hidden="true">{LIBRARY_ICON}</span> {data.label}
      </span>
      <span className="text-content-muted">
        {data.count} skill{data.count > 1 ? 's' : ''} disponible{data.count > 1 ? 's' : ''} ·{' '}
        {data.open ? 'déplié' : 'Déplier'}
      </span>
    </div>
  )
}

/** Skill disponible dans la bibliothèque (FR-031) : estompé, verdict (icône + libellé), « installé » le cas échéant. */
export function AvailableNode({ data }: NodeProps<AvailableNodeType>): React.JSX.Element {
  const { skill } = data
  const verdict = VERDICTS[skill.verdict]
  return (
    <div
      className={`flex h-[104px] w-[208px] flex-col justify-between rounded-xl border-2 border-dashed bg-surface px-3 py-2 text-xs ${
        verdict.tone
      } ${data.selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'opacity-90'}`}
    >
      <Handles />
      <p className="truncate text-sm font-semibold text-content" title={skill.name}>
        {skill.name}
      </p>
      <p className="line-clamp-2 text-content-muted">{skill.description === '' ? '—' : skill.description}</p>
      <p className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          <span aria-hidden="true">{verdict.icon}</span> {verdict.label}
          {skill.auditedByClaude ? '' : ' (règles)'}
        </span>
        <span className="text-content-muted">{skill.installed ? 'installé' : 'disponible'}</span>
      </p>
    </div>
  )
}
