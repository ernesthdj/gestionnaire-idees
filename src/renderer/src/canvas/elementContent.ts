import type { ElementContentView } from '@shared/ipc/canvas'

/** Phrase du libellé accessible et du badge : ce que contient l'élément (spec 017 D18) ; vide sans fichier couvert. */
export function contentLabel(content: ElementContentView | null | undefined): string {
  if (content === null || content === undefined) return ''
  if (content.kind === 'doc') return 'contient de la documentation'
  return content.doc > 0
    ? `contient du code et ${content.doc} fichier${content.doc > 1 ? 's' : ''} de documentation`
    : 'contient du code'
}
