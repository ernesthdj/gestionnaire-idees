import { describe, expect, it } from 'vitest'
import { attributionHeader, canAttribute, studyNote } from '../../../src/main/domain/git/attribution'
import { detectLicense } from '../../../src/main/domain/git/license'

const MIT = `MIT License

Copyright (c) 2026 Auteur Fictif

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction...

The above copyright notice and this permission notice shall be included in all copies or substantial portions.`

describe('licence par règles fixes (spec 021 T052)', () => {
  it('should_recognise_permissive_and_reciprocal_licenses_and_keep_the_copyright', () => {
    expect(detectLicense(MIT)).toMatchObject({
      spdx: 'MIT',
      verdict: 'permise',
      copyright: 'Copyright (c) 2026 Auteur Fictif'
    })
    expect(detectLicense('Apache License\nVersion 2.0, January 2004')).toMatchObject({
      spdx: 'Apache-2.0',
      verdict: 'permise'
    })
    expect(detectLicense('GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007')).toMatchObject({
      spdx: 'GPL-3.0',
      verdict: 'reciprocite'
    })
    // La GPL-3.0 cite l'AGPL (section 13) : elle reste la GPL.
    expect(
      detectLicense('GNU GENERAL PUBLIC LICENSE Version 3\n13. Use with the GNU Affero General Public License.')
    ).toMatchObject({ spdx: 'GPL-3.0' })
    expect(
      detectLicense('GNU AFFERO GENERAL PUBLIC LICENSE Version 3 ... in the case of network server software.')
    ).toMatchObject({ spdx: 'AGPL-3.0' })
    expect(detectLicense('GNU LESSER GENERAL PUBLIC LICENSE\nVersion 2.1, February 1999')).toMatchObject({
      spdx: 'LGPL-2.1'
    })
  })

  it('should_answer_unknown_for_no_license_or_an_unrecognised_text', () => {
    expect(detectLicense(null)).toMatchObject({ spdx: null, verdict: 'inconnue' })
    expect(detectLicense('Tous droits réservés.')).toMatchObject({ spdx: null, verdict: 'inconnue' })
    expect(detectLicense('Copyright (c) [year] [fullname]').copyright).toBeNull()
  })
})

describe('en-tête d’attribution et note d’étude (spec 021 T052)', () => {
  const info = {
    origin: 'compte/projet',
    path: 'src/a.ts',
    commit: 'a'.repeat(40),
    lines: { from: 3, to: 9 },
    license: detectLicense(MIT),
    date: '2026-10-13T10:00:00.000Z'
  }

  it('should_write_the_header_in_the_comment_syntax_of_the_file', () => {
    const ts = attributionHeader('a.ts', info)
    expect(ts).toContain('// Extrait de compte/projet — src/a.ts, lignes 3 à 9')
    expect(ts).toContain('// Commit aaaaaaaaaaaa, copié le 2026-10-13')
    expect(ts).toContain('// Licence : MIT')
    expect(ts).toContain('// Copyright (c) 2026 Auteur Fictif')
    expect(attributionHeader('a.py', info)).toMatch(/^# Extrait/)
    expect(attributionHeader('a.css', info)).toMatch(/^\/\*\n {2}Extrait/)
    // Une fin de commentaire cachée dans une donnée ne referme pas l'en-tête.
    expect(attributionHeader('a.css', { ...info, origin: 'x */ alert(1) /*' })).not.toContain('x */')
    expect(canAttribute('logo.png')).toBe(false)
    expect(() => attributionHeader('logo.png', info)).toThrow()
  })

  it('should_never_put_the_code_in_a_study_note', () => {
    const note = studyNote({ ...info, license: detectLicense(null) })
    expect(note).toContain('# Note d’étude — a.ts')
    expect(note).toContain('Licence : inconnue')
    expect(note).toContain('le code n’est pas copié')
  })
})
