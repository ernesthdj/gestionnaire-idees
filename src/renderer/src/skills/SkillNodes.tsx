import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { SkillView } from '@shared/ipc/skills'
import { FAMILY_LABELS, type SkillFamily } from '@shared/skills/model'

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
