import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { LibrarySkillView } from '@shared/ipc/skills'
import { useUiStore } from '../app/uiStore'
import { ContextMenu, type MenuItem } from '../canvas/ToolMenu'
import { call, IpcFailure } from '../lib/ipc'

/**
 * Ce qu'un clic droit sur un nœud de l'arbre peut installer : un brouillon (skill nouveau ou modifié) ou un skill de la
 * bibliothèque. Les autres nœuds n'ont pas de menu.
 */
export type InstallTarget =
  | { readonly kind: 'draft'; readonly draftId: string; readonly name: string }
  | { readonly kind: 'library'; readonly skill: LibrarySkillView }

type Action = 'install' | 'open'

/** Entrées du menu d'un nœud installable. Un skill « dangereux » ne s'installe que depuis sa fiche. Pur. */
export function installMenuItems(target: InstallTarget): MenuItem<Action>[] {
  const open: MenuItem<Action> = {
    tool: 'open',
    icon: '›',
    label: target.kind === 'draft' ? 'Voir les différences' : 'Ouvrir la fiche',
    hint: 'Relire avant d’installer'
  }
  if (target.kind === 'library' && target.skill.verdict === 'dangereux') {
    return [{ ...open, hint: 'Skill jugé dangereux : à déverrouiller dans sa fiche' }]
  }
  const scripts = target.kind === 'library' && target.skill.files.some((file) => file.executable)
  const replaces = target.kind === 'library' && target.skill.installed
  return [
    {
      tool: 'install',
      icon: '↓',
      label: 'Installer',
      hint: [
        target.kind === 'library' && !target.skill.auditedByClaude ? 'Audit de Claude d’abord' : 'Tout de suite',
        scripts ? 'sans ses scripts' : '',
        replaces ? 'remplace ta version (gardée)' : '',
        'annulable'
      ]
        .filter((part) => part !== '')
        .join(' · ')
    },
    open
  ]
}

const QUERIES = [
  ['skills'],
  ['skill'],
  ['skillDrafts'],
  ['skillDraftDiff'],
  ['skillLibrary'],
  ['librarySkill'],
  ['history']
]

/**
 * Menu du clic droit sur un nœud installable : « Installer » sans passer par le volet (un skill de la bibliothèque est
 * d'abord audité et mis en brouillon, sans ses scripts), ou l'ouvrir pour relire. Un skill modifié sur le disque depuis
 * son brouillon n'est jamais remplacé d'ici : son volet s'ouvre sur les différences.
 */
export function SkillNodeMenu({
  at,
  target,
  onOpen,
  onInstalled,
  onClose
}: {
  readonly at: { readonly x: number; readonly y: number }
  readonly target: InstallTarget
  /** Ouvre le volet du nœud, ou celui d'un brouillon (`draftId`). */
  readonly onOpen: (draftId?: string) => void
  readonly onInstalled: (skillId: string) => void
  readonly onClose: () => void
}): React.JSX.Element | null {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [busy, setBusy] = useState(false)
  const refresh = (): Promise<unknown> => Promise.all(QUERIES.map((queryKey) => client.invalidateQueries({ queryKey })))

  const install = async (): Promise<void> => {
    setBusy(true)
    const name = target.kind === 'draft' ? target.name : target.skill.name
    let draftId = target.kind === 'draft' ? target.draftId : undefined
    try {
      if (target.kind === 'library') {
        showToast(target.skill.auditedByClaude ? `Préparation de « ${name} »…` : `Audit de « ${name} » par Claude…`)
        draftId = (
          await call<{ draftId: string }>('skills:libraryInstall', {
            candidateId: target.skill.candidateId,
            scripts: [],
            seen: target.skill.verdict
          })
        ).draftId
      }
      const result = await call<{ batchId: string; skillId: string }>('skills:install', { draftId, confirm: true })
      showToast(`Skill « ${name} » installé.`, {
        batchId: result.batchId,
        undoneText: 'Installation annulée : la version précédente est rétablie.'
      })
      await refresh()
      onInstalled(result.skillId)
    } catch (failure) {
      showToast(failure instanceof IpcFailure ? failure.message : 'L’installation a échoué.')
      await refresh()
      // Verdict changé par l'audit, skill modifié sur le disque… : le volet montre pourquoi.
      onOpen(draftId)
    } finally {
      setBusy(false)
      onClose()
    }
  }

  if (busy) return null
  return (
    <ContextMenu
      at={at}
      label="Installer le skill"
      items={installMenuItems(target)}
      onClose={onClose}
      onPick={(action) => {
        if (action === 'open') {
          onOpen()
          onClose()
        } else void install()
      }}
    />
  )
}
