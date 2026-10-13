/**
 * Licence d'un dépôt par règles fixes (spec 021 US7, research R16) : le texte d'un fichier `LICENSE` / `COPYING` à la
 * racine est comparé à des phrases caractéristiques ; aucune IA. Permissives → copie permise ; GPL, LGPL, AGPL → copie
 * permise avec avertissement de réciprocité ; sinon « inconnue » → note d'étude seulement. Pur.
 */

export type LicenseVerdict = 'permise' | 'reciprocite' | 'inconnue'

export interface LicenseView {
  readonly spdx: string | null
  readonly verdict: LicenseVerdict
  readonly summary: string
  /** Ligne « Copyright … » du fichier de licence ; `null` si absente. */
  readonly copyright: string | null
}

interface Rule {
  readonly spdx: string
  readonly verdict: Exclude<LicenseVerdict, 'inconnue'>
  /** Toutes les phrases doivent apparaître (texte normalisé : minuscules, espaces simples). */
  readonly phrases: readonly string[]
}

/** Ordre : les plus spécifiques d'abord (AGPL avant GPL, LGPL avant GPL, BSD-3 avant BSD-2). */
const RULES: readonly Rule[] = [
  // La GPL-3.0 cite l'AGPL (section 13) : seule la phrase du préambule de l'AGPL la distingue.
  {
    spdx: 'AGPL-3.0',
    verdict: 'reciprocite',
    phrases: ['gnu affero general public license', 'in the case of network server software']
  },
  { spdx: 'LGPL-3.0', verdict: 'reciprocite', phrases: ['gnu lesser general public license', 'version 3'] },
  { spdx: 'LGPL-2.1', verdict: 'reciprocite', phrases: ['gnu lesser general public license', 'version 2.1'] },
  { spdx: 'GPL-3.0', verdict: 'reciprocite', phrases: ['gnu general public license', 'version 3'] },
  { spdx: 'GPL-2.0', verdict: 'reciprocite', phrases: ['gnu general public license', 'version 2'] },
  { spdx: 'MPL-2.0', verdict: 'permise', phrases: ['mozilla public license', '2.0'] },
  { spdx: 'Apache-2.0', verdict: 'permise', phrases: ['apache license', 'version 2.0'] },
  {
    spdx: 'BSD-3-Clause',
    verdict: 'permise',
    phrases: ['redistribution and use in source and binary forms', 'neither the name of']
  },
  { spdx: 'BSD-2-Clause', verdict: 'permise', phrases: ['redistribution and use in source and binary forms'] },
  {
    spdx: 'MIT',
    verdict: 'permise',
    phrases: ['permission is hereby granted, free of charge', 'the above copyright notice and this permission notice']
  },
  { spdx: 'ISC', verdict: 'permise', phrases: ['permission to use, copy, modify, and/or distribute this software'] },
  {
    spdx: 'Unlicense',
    verdict: 'permise',
    phrases: ['this is free and unencumbered software released into the public domain']
  },
  // Repli : fichier abrégé au seul titre (« MIT License » + copyright), courant dans les petits dépôts.
  { spdx: 'MIT', verdict: 'permise', phrases: ['mit license'] }
]

const SUMMARIES: Readonly<Record<LicenseVerdict, string>> = {
  permise: 'Licence permissive : copie permise, en gardant l’attribution et la licence.',
  reciprocite:
    'Licence à réciprocité : copie permise, mais le code qui l’intègre doit être distribué sous la même licence.',
  inconnue: 'Licence inconnue ou absente : pas de copie du code, seulement une note d’étude.'
}

/** Noms de fichiers de licence reconnus à la racine du dépôt. */
export const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt|rst))?$/i

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ')

export function detectLicense(text: string | null): LicenseView {
  if (text === null || text.trim() === '')
    return { spdx: null, verdict: 'inconnue', summary: SUMMARIES.inconnue, copyright: null }
  const flat = normalize(text)
  const rule = RULES.find((candidate) => candidate.phrases.every((phrase) => flat.includes(phrase)))
  const copyright =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^copyright\b|^\(c\)|^©/i.test(line) && !/\[(year|fullname)]/i.test(line))
      ?.slice(0, 200) ?? null
  return rule === undefined
    ? { spdx: null, verdict: 'inconnue', summary: SUMMARIES.inconnue, copyright }
    : { spdx: rule.spdx, verdict: rule.verdict, summary: SUMMARIES[rule.verdict], copyright }
}
