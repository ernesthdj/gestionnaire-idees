import type { Section } from '@shared/ipc/app'
import { Icon, type IconName } from './Icon'
import { ThemeSwitch } from './ThemeSwitch'
import type { View } from './uiStore'
import { usePopover } from './usePopover'

const ITEM =
  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus'

export interface RailEntry {
  readonly section: Section
  readonly label: string
  readonly icon: IconName
}

/** Choix du thème depuis le rail : les 4 thèmes dans un petit panneau (spec 033 D1). */
function ThemeMenu(): React.JSX.Element {
  const popover = usePopover<HTMLDivElement>()
  return (
    <div ref={popover.ref} className="relative">
      <button
        type="button"
        aria-label="Thème"
        title="Thème"
        aria-expanded={popover.open}
        onClick={popover.toggle}
        className={`${ITEM} text-content-muted hover:bg-surface hover:text-content`}
      >
        <Icon name="theme" />
      </button>
      {popover.open ? (
        <div className="absolute bottom-0 left-full z-40 ml-2 rounded-xl bg-surface p-1.5 shadow-lg">
          <ThemeSwitch />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Rail de 48 px (spec 033 D1, FR-001) : les sections en icônes (nom accessible et infobulle), la section courante
 * marquée ; en bas, le thème et les réglages.
 */
export function Rail({
  entries,
  view,
  onShow
}: {
  readonly entries: readonly RailEntry[]
  readonly view: View
  readonly onShow: (view: View) => void
}): React.JSX.Element {
  return (
    <nav
      aria-label="Navigation principale"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-content-muted/20 bg-surface-raised py-2"
    >
      <span aria-hidden="true" className="app-mark mb-2 h-6 w-6 rounded-lg" />
      <ul className="flex flex-col gap-1">
        {entries.map(({ section, label, icon }) => (
          <li key={section}>
            <button
              type="button"
              aria-label={label}
              title={label}
              aria-current={view === section ? 'page' : undefined}
              onClick={() => onShow(section)}
              className={`${ITEM} ${
                view === section
                  ? 'bg-surface text-accent shadow-sm'
                  : 'text-content-muted hover:bg-surface hover:text-content'
              }`}
            >
              <Icon name={icon} />
            </button>
          </li>
        ))}
      </ul>
      <span className="flex-1" />
      <ThemeMenu />
      <button
        type="button"
        aria-label="Réglages"
        title="Réglages"
        aria-current={view === 'settings' ? 'page' : undefined}
        onClick={() => onShow('settings')}
        className={`${ITEM} ${view === 'settings' ? 'bg-surface text-accent shadow-sm' : 'text-content-muted hover:bg-surface hover:text-content'}`}
      >
        <Icon name="settings" />
      </button>
    </nav>
  )
}
