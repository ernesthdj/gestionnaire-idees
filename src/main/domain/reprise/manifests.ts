import type { ResolveConfig } from './resolve'

/** Manifestes lus pour l'analyse (spec 017 R3) : petits fichiers de configuration, jamais des fichiers sensibles. */
export const MANIFEST_NAMES = /(^|\/)(package\.json|composer\.json|tsconfig(\.\w+)?\.json|[^/]+\.csproj)$/i

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // `tsconfig.json` accepte commentaires et virgules finales : on les retire, sans toucher aux chaînes simples.
    try {
      return JSON.parse(
        text
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/,(\s*[}\]])/g, '$1')
      )
    } catch {
      return undefined
    }
  }
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

/** Alias `paths` du `tsconfig.json` racine, rapportés à la racine du projet (via `baseUrl`). */
export function tsPathsOf(tsconfig: string | undefined): ResolveConfig['tsPaths'] {
  if (tsconfig === undefined) return []
  const options = record(record(parseJson(tsconfig))['compilerOptions'])
  const baseUrl =
    typeof options['baseUrl'] === 'string' ? options['baseUrl'].replace(/^\.\/?/, '').replace(/\/$/, '') : ''
  return Object.entries(record(options['paths'])).flatMap(([pattern, targets]) =>
    Array.isArray(targets)
      ? [
          {
            pattern,
            targets: targets
              .filter((target): target is string => typeof target === 'string')
              .map((target) => (baseUrl === '' ? target : `${baseUrl}/${target}`).replace(/^\.\//, ''))
          }
        ]
      : []
  )
}

/** Correspondances PSR-4 du `composer.json` racine : `App\` → `app`. */
export function psr4Of(composer: string | undefined): ResolveConfig['psr4'] {
  if (composer === undefined) return []
  const mapping = record(record(record(parseJson(composer))['autoload'])['psr-4'])
  return Object.entries(mapping).flatMap(([prefix, dir]) =>
    typeof dir === 'string' ? [{ prefix, dir: dir.replace(/^\.\//, '').replace(/\/$/, '') }] : []
  )
}
