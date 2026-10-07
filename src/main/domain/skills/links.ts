import type { SkillLinkView } from '@shared/ipc/skills'

/**
 * Liens écrits entre skills (spec 020 L3-skills-voir §3) : A « appelle » B quand le texte de A contient la commande
 * `/<nom de B>` (précédée d'un début de ligne, d'un espace, d'une ponctuation ouvrante ou d'un accent grave, suivie
 * d'une frontière) ou la mention « skill <nom de B> » (mot entier, avec ou sans accents graves, insensible à la casse).
 * Exclus : un lien vers soi ou vers un skill du même nom, un nom de moins de 3 caractères, une occurrence dans une URL.
 * Fonction pure : recalculée à chaque inventaire.
 */

export interface LinkSource {
  readonly id: string
  readonly name: string
  readonly text: string
}

const MIN_NAME = 3
const URL = /\bhttps?:\/\/\S+/gi

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Remplace les URL par des espaces de même longueur : les colonnes restent justes, rien n'y est trouvé. */
const withoutUrls = (line: string): string => line.replace(URL, (url) => ' '.repeat(url.length))

function patternFor(name: string): RegExp {
  const n = escape(name)
  return new RegExp(`(?:(?:^|[\\s(\\["'\`])/${n}(?![\\w-])|\\bskill\\s+\`?${n}\`?(?![\\w-]))`, 'i')
}

export function writtenLinks(skills: readonly LinkSource[]): SkillLinkView[] {
  const targets = skills
    .filter((skill) => skill.name.length >= MIN_NAME)
    .map((skill) => ({ ...skill, pattern: patternFor(skill.name) }))
  const links: SkillLinkView[] = []
  for (const source of skills) {
    const lines = source.text.split(/\r?\n/).map(withoutUrls)
    for (const target of targets) {
      if (target.id === source.id || target.name === source.name) continue
      const index = lines.findIndex((line) => target.pattern.test(line))
      if (index !== -1) links.push({ from: source.id, to: target.id, kind: 'appelle', line: index + 1 })
    }
  }
  return links.sort((a, b) => (a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1))
}
