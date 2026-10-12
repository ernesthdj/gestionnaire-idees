import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { paintArt, paintedArt } from './folderArt'
import {
  BACK_PATH,
  FOLDER_HEADROOM,
  FOLDER_NODE_SIZE,
  FOLDER_SCALE,
  FOLDER_SCENE,
  FRONT_PATH,
  FRONT_HEIGHT,
  FRONT_TOP,
  fanSlot
} from './folderGeometry'
import './folder.css'

/** Une feuille de l'éventail : un fichier du dossier. */
export interface GlassFolderFile {
  readonly key: string
  readonly name: string
  /** Seconde ligne : sorte et source (« MD · par Claude »). */
  readonly meta: string
  /** Ajouté ou modifié par Claude depuis la dernière ouverture. */
  readonly unseen: boolean
}

export interface GlassFolderProps {
  /** Titre du nœud qui porte le dossier. */
  readonly title: string
  readonly count: number
  /** Les plus récents, documents d'abord (4 au plus). */
  readonly files: readonly GlassFolderFile[]
  /** Couleur du nœud : teinte de l'encre du panneau arrière. */
  readonly color: string
  /** Graine de l'illustration (identifiant du nœud). */
  readonly seed: number
  readonly unseen: boolean
  readonly onOpenFile: (index: number) => void
  readonly onOpenChange?: (open: boolean) => void
}

/** Illustration peinte une fois, partagée par la file de peinture (folderArt) ; rien hors écran. */
function FolderArt({ color, seed }: { readonly color: string; readonly seed: number }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  // Déjà peinte (dossier redessiné au zoom ou au déplacement) : visible tout de suite, sans fondu.
  const [ready, setReady] = useState(
    () => paintedArt(color, seed, FOLDER_SCENE.width, FOLDER_SCENE.height) !== undefined
  )
  useLayoutEffect(() => {
    const element = canvas.current
    const done = paintedArt(color, seed, FOLDER_SCENE.width, FOLDER_SCENE.height)
    if (element === null || done === undefined) return
    element.getContext('2d')?.putImageData(done, 0, 0)
  }, [color, seed])
  useEffect(() => {
    const element = canvas.current
    if (element === null || paintedArt(color, seed, FOLDER_SCENE.width, FOLDER_SCENE.height) !== undefined) return
    let live = true
    const start = (): void => {
      void paintArt(color, seed, FOLDER_SCENE.width, FOLDER_SCENE.height).then((image) => {
        if (!live || image === null) return
        element.getContext('2d')?.putImageData(image, 0, 0)
        setReady(true)
      })
    }
    if (typeof IntersectionObserver === 'undefined') {
      start()
      return () => {
        live = false
      }
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      start()
    })
    observer.observe(element)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [color, seed])
  return (
    <canvas
      ref={canvas}
      className="folder-art"
      width={FOLDER_SCENE.width}
      height={FOLDER_SCENE.height}
      data-ready={ready || undefined}
      aria-hidden="true"
    />
  )
}

/**
 * Dossier de verre (spec 028 D3, D5 ; réécriture inspirée de « Glass Folder Cards », research R5) : trois couches —
 * panneau arrière illustré, feuilles des fichiers, verre dépoli avant. Fermé au repos, il s'entrouvre au survol ou au
 * focus ; un clic, Entrée ou Espace l'ouvre en éventail ; Échap ou un clic ailleurs le referme et rend le focus. Les
 * états sont des variables CSS (aucun rendu React pendant les mouvements) ; animations réduites respectées.
 */
export function GlassFolder({
  title,
  count,
  files,
  color,
  seed,
  unseen,
  onOpenFile,
  onOpenChange
}: GlassFolderProps): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null)
  const hit = useRef<HTMLButtonElement>(null)
  const sheets = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const change = (next: boolean): void => {
    setOpen(next)
    onOpenChange?.(next)
  }
  const changeRef = useRef(change)
  changeRef.current = change

  // Feuilles fermées : hors de la tabulation et du lecteur d'écran.
  useEffect(() => {
    sheets.current?.toggleAttribute('inert', !open)
  }, [open])

  // Échap ou un clic ailleurs referment le dossier ouvert et rendent le focus au dossier.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      changeRef.current(false)
      hit.current?.focus()
    }
    const onDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && root.current?.contains(event.target) === true) return
      changeRef.current(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  // Reflet et légère profondeur qui suivent le pointeur : variables CSS écrites dans une image d'animation.
  useEffect(() => {
    const element = root.current
    if (element === null) return
    let frame = 0
    let px = 0
    let py = 0
    const write = (): void => {
      frame = 0
      element.style.setProperty('--folder-px', px.toFixed(3))
      element.style.setProperty('--folder-py', py.toFixed(3))
    }
    const move = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') return
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      px = ((event.clientX - box.left) / box.width) * 2 - 1
      py = ((event.clientY - box.top) / box.height) * 2 - 1
      if (frame === 0) frame = requestAnimationFrame(write)
    }
    const leave = (): void => {
      px = 0
      py = 0
      if (frame === 0) frame = requestAnimationFrame(write)
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerleave', leave)
    return () => {
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(frame)
    }
  }, [])

  const label = `${count} fichier${count > 1 ? 's' : ''}`
  // La plus récente devant, au plus près du verre.
  const stack = [...files].reverse()
  return (
    <div className="folder-frame" style={{ width: FOLDER_NODE_SIZE.width, height: FOLDER_NODE_SIZE.height }}>
      <div
        ref={root}
        className="folder"
        data-open={open || undefined}
        style={{
          width: FOLDER_SCENE.width,
          height: FOLDER_SCENE.height + FOLDER_HEADROOM,
          transform: `scale(${FOLDER_SCALE})`
        }}
      >
        <div className="folder-stage" style={{ top: FOLDER_HEADROOM }}>
          <div className="folder-tilt">
            <div className="folder-shadow" aria-hidden="true" />
            <div className="folder-back" style={{ clipPath: `path('${BACK_PATH}')` }} aria-hidden="true">
              <FolderArt color={color} seed={seed} />
              <div className="folder-back-sheen" />
            </div>
            <ul ref={sheets} className="folder-sheets" aria-label={`Fichiers du dossier de « ${title} »`}>
              {stack.map((file, position) => {
                const index = files.length - 1 - position
                return (
                  <li key={file.key} className="folder-sheet-slot">
                    <button
                      type="button"
                      className="folder-sheet nodrag"
                      style={
                        {
                          '--folder-slot': fanSlot(position, stack.length),
                          '--folder-depth': stack.length - 1 - position,
                          zIndex: position + 1
                        } as React.CSSProperties
                      }
                      onClick={() => onOpenFile(index)}
                    >
                      <span className="folder-sheet-name">{file.name}</span>
                      <span className="folder-sheet-meta">
                        {file.unseen ? <span className="folder-new">nouveau</span> : null}
                        {file.meta}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div
              className="folder-front"
              style={{ top: FRONT_TOP, height: FRONT_HEIGHT, clipPath: `path('${FRONT_PATH}')` }}
            >
              <div className="folder-tint" aria-hidden="true" />
              <div className="folder-spec" aria-hidden="true" />
              <button
                ref={hit}
                type="button"
                className="folder-hit"
                aria-expanded={open}
                aria-label={`${open ? 'Fermer' : 'Ouvrir'} le dossier de « ${title} », ${label}${unseen ? ', nouveau' : ''}`}
                onClick={() => change(!open)}
              />
              <div className="folder-label">
                <span className="folder-title" title={title}>
                  {title}
                </span>
                <span className="folder-meta">
                  {unseen ? <span className="folder-dot" aria-hidden="true" /> : null}
                  {label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
