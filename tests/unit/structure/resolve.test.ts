import { describe, expect, it } from 'vitest'
import { resolveStructure } from '../../../src/main/domain/structure/resolve'
import { StructureDessinerInput } from '../../../src/shared/mcp/tools'

const parse = (value: unknown) => StructureDessinerInput.parse(value)

describe('résolution d’une carte de structure', () => {
  it('should_resolve_parents_from_the_batch_and_from_the_existing_map', () => {
    const result = resolveStructure(
      parse({
        elements: [
          { cle: 'module:main', type: 'module', titre: 'main' },
          {
            cle: 'composant:src/main/a.ts',
            type: 'composant',
            titre: 'A',
            parent: 'module:main',
            chemins: ['src/main/a.ts']
          },
          { cle: 'composant:b', type: 'composant', titre: 'B', parent: 'module:renderer' }
        ],
        liens: [{ de: 'composant:src/main/a.ts', vers: 'composant:b', relation: 'appelle' }]
      }),
      new Map([['module:renderer', null]])
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.elements.map((element) => [element.key, element.parentKey])).toEqual([
      ['module:main', null],
      ['composant:src/main/a.ts', 'module:main'],
      ['composant:b', 'module:renderer']
    ])
    expect(result.links).toEqual([
      { fromKey: 'composant:src/main/a.ts', toKey: 'composant:b', relation: 'appelle', label: null }
    ])
  })

  it('should_refuse_an_unknown_parent_a_duplicate_key_and_a_self_link', () => {
    const empty = new Map<string, string | null>()
    expect(
      resolveStructure(parse({ elements: [{ cle: 'a', type: 'module', titre: 'A', parent: 'zz' }] }), empty)
    ).toMatchObject({
      ok: false,
      problem: { code: 'LOT_INVALIDE', message: expect.stringContaining('« zz » inconnue') }
    })
    expect(
      resolveStructure(
        parse({
          elements: [
            { cle: 'a', type: 'module', titre: 'A' },
            { cle: 'a', type: 'module', titre: 'B' }
          ]
        }),
        empty
      )
    ).toMatchObject({ ok: false })
    expect(
      resolveStructure(
        parse({
          elements: [{ cle: 'a', type: 'module', titre: 'A' }],
          liens: [{ de: 'a', vers: 'a', relation: 'appelle' }]
        }),
        empty
      )
    ).toMatchObject({ ok: false })
  })

  it('should_detect_a_cycle_created_with_an_existing_element', () => {
    // b est déjà enfant de a ; le lot rattache a sous b.
    const result = resolveStructure(
      parse({ elements: [{ cle: 'a', type: 'module', titre: 'A', parent: 'b' }] }),
      new Map([
        ['a', null],
        ['b', 'a']
      ])
    )
    expect(result).toMatchObject({ ok: false, problem: { message: expect.stringContaining('cycle') } })
  })

  it('should_refuse_paths_outside_the_project', () => {
    for (const chemin of ['../secret', 'C:/Windows/x', '/etc/passwd', 'src/../../x', '\\\\serveur\\x']) {
      expect(
        StructureDessinerInput.safeParse({ elements: [{ cle: 'a', type: 'composant', titre: 'A', chemins: [chemin] }] })
          .success
      ).toBe(false)
    }
    expect(
      StructureDessinerInput.safeParse({
        elements: [{ cle: 'a', type: 'composant', titre: 'A', chemins: ['src/main/a.ts', 'docs/x.md'] }]
      }).success
    ).toBe(true)
  })

  it('should_refuse_a_batch_over_300_elements', () => {
    const elements = Array.from({ length: 301 }, (_, index) => ({
      cle: `e${index}`,
      type: 'composant',
      titre: `E${index}`
    }))
    expect(resolveStructure(parse({ elements }), new Map())).toMatchObject({
      ok: false,
      problem: { code: 'LOT_TROP_GROS' }
    })
  })
})
