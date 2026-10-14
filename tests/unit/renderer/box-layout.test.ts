import { describe, expect, it } from 'vitest'
import type { ExplorerMapView, MapFileView, MapModuleView } from '../../../src/shared/ipc/reprise'
import { BIG_MODULE, BOX, boxLayout, shownBoxes, shownKeys } from '../../../src/renderer/src/explorer/boxes/boxLayout'

const mod = (key: string, column: number, extra: Partial<MapModuleView> = {}): MapModuleView => ({
  key,
  title: key.slice(6),
  layer: 'rules',
  plumbing: false,
  role: null,
  column,
  files: 1,
  lines: 10,
  ...extra
})
const file = (moduleKey: string, name: string, extra: Partial<MapFileView> = {}): MapFileView => ({
  key: `f:${moduleKey.slice(6)}/${name}`,
  path: `${moduleKey.slice(6)}/${name}`,
  moduleKey,
  title: name,
  folder: '',
  lang: 'cs',
  lines: 10,
  role: null,
  functions: [],
  depth: 0,
  external: false,
  plumbing: false,
  ...extra
})
const MAP: ExplorerMapView = {
  modules: [
    mod('m:dir:Api', 0, { layer: 'entry' }),
    mod('m:dir:Core', 1),
    mod('m:dir:Data', 2, { layer: 'data' }),
    mod('m:dir:Log', 2, { layer: 'data', plumbing: true }),
    mod('m:dir:Big', 1)
  ],
  files: [
    file('m:dir:Api', 'Orders.cs'),
    file('m:dir:Core', 'Service.cs'),
    file('m:dir:Core', 'Stores.cs'),
    file('m:dir:Data', 'Repo.cs'),
    file('m:dir:Data', 'repo.ts', { lang: 'ts' }),
    file('m:dir:Log', 'Audit.cs', { plumbing: true }),
    ...Array.from({ length: BIG_MODULE + 1 }, (_, i) => file('m:dir:Big', `F${i}.cs`))
  ],
  calls: [],
  truncated: false,
  confidentiality: 'claude',
  folderMissing: false
}

describe('carte en boîtes, placement (spec 031 lot 2)', () => {
  it('should_hide_the_plumbing_and_the_other_languages_and_drop_a_module_left_empty', () => {
    const shown = shownBoxes(MAP, true, null)
    expect(shown.modules.map((m) => m.key)).not.toContain('m:dir:Log')
    const csOnly = shownBoxes(MAP, false, 'ts')
    expect(csOnly.modules.map((m) => m.key)).toEqual(['m:dir:Data'])
    expect(csOnly.filesOf.get('m:dir:Data')?.map((f) => f.title)).toEqual(['repo.ts'])
  })

  it('should_place_columns_left_to_right_and_stack_a_column_from_the_entry_layer_to_the_data_layer', () => {
    const layout = boxLayout(shownBoxes(MAP, false, null), new Set())
    const at = (key: string) => layout.modules.get(key)
    expect(at('m:dir:Api')?.x).toBeLessThan(at('m:dir:Core')?.x ?? 0)
    expect(at('m:dir:Core')?.x).toBeLessThan(at('m:dir:Data')?.x ?? 0)
    // Même colonne : ordre alphabétique à couche égale ; la plomberie (couche « données ») sous Data.
    expect(at('m:dir:Big')?.y).toBeLessThan(at('m:dir:Core')?.y ?? 0)
    expect(at('m:dir:Data')?.y).toBeLessThan(at('m:dir:Log')?.y ?? 0)
  })

  it('should_grow_an_open_small_module_with_its_files_and_push_the_box_below', () => {
    const shown = shownBoxes(MAP, false, null)
    const closed = boxLayout(shown, new Set())
    const open = boxLayout(shown, new Set(['m:dir:Big', 'm:dir:Core']))
    const core = open.modules.get('m:dir:Core')
    expect(core).toMatchObject({
      width: BOX.openWidth,
      height: BOX.header + 2 * (BOX.fileHeight + BOX.fileGap) + BOX.padding
    })
    expect(open.files.get('f:Core/Stores.cs')).toMatchObject({
      x: BOX.padding,
      y: BOX.header + BOX.fileHeight + BOX.fileGap
    })
    // Un gros module ouvert montre une liste (pas de boîtes de fichiers) et repousse le module de dessous.
    expect([...open.files.keys()].some((key) => key.startsWith('f:Big/'))).toBe(false)
    expect(open.modules.get('m:dir:Core')?.y).toBeGreaterThan(closed.modules.get('m:dir:Core')?.y ?? 0)
    expect(shownKeys(shown, new Set(['m:dir:Core', 'm:dir:Big']))).toEqual(
      expect.arrayContaining(['m:dir:Core', 'f:Core/Service.cs', 'f:Core/Stores.cs', 'm:dir:Big'])
    )
    expect(shownKeys(shown, new Set(['m:dir:Big']))).not.toContain('f:Big/F0.cs')
  })
})
