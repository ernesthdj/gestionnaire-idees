/**
 * Modules d'un projet repris (spec 017 R3) : les grandes parties montrées au niveau 1 de l'explorateur. Paquets npm
 * (espaces de travail), projets .NET (`.csproj`) s'il y en a plusieurs ; sinon les dossiers de premier niveau du code
 * (`src/`, `app/` de Laravel, ou la racine). Fonction pure : la lecture des manifestes est faite par l'appelant.
 */

export interface DetectedModule {
  /** Clé stable : `npm:@app/core`, `csproj:App.Core`, `dir:src/core`, `dir:` (racine). */
  readonly key: string
  readonly name: string
  /** Dossier du module, relatif, `''` pour la racine. */
  readonly rootPath: string
  readonly kind: 'package' | 'csproj' | 'folder'
}

export interface Manifest {
  readonly path: string
  readonly content: string
}

/** Manifestes de tests ou de fixtures : des exemples, jamais des parties du projet. */
const TEST_DIR = /(^|\/)(tests?|__tests__|fixtures?|__fixtures__)\//

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

function packageName(content: string, fallback: string): string {
  try {
    const value: unknown = JSON.parse(content)
    if (typeof value === 'object' && value !== null) {
      const name = (value as Record<string, unknown>)['name']
      if (typeof name === 'string' && name.trim() !== '') return name.trim().slice(0, 200)
    }
  } catch {
    // Manifeste illisible : le nom du dossier fait l'affaire.
  }
  return fallback
}

/** Base des modules par dossier : `src/` ou `app/` (Laravel) s'ils existent, sinon la racine. */
function folderBase(paths: readonly string[], manifests: readonly Manifest[]): string {
  const hasComposer = manifests.some((manifest) => manifest.path === 'composer.json')
  if (hasComposer && paths.some((path) => path.startsWith('app/'))) return 'app'
  if (paths.some((path) => path.startsWith('src/'))) return 'src'
  return ''
}

export function detectModules(
  paths: readonly string[],
  manifests: readonly Manifest[]
): { readonly modules: readonly DetectedModule[]; readonly moduleOf: (path: string) => string } {
  const realManifests = manifests.filter((manifest) => !TEST_DIR.test(manifest.path))
  const packages = realManifests
    .filter((manifest) => /(^|\/)package\.json$/.test(manifest.path) && manifest.path !== 'package.json')
    .map((manifest): DetectedModule => {
      const rootPath = dirOf(manifest.path)
      const name = packageName(manifest.content, rootPath.split('/').at(-1) ?? rootPath)
      return { key: `npm:${name}`, name, rootPath, kind: 'package' }
    })
  const projects = realManifests
    .filter((manifest) => manifest.path.toLowerCase().endsWith('.csproj'))
    .map((manifest): DetectedModule => {
      const name = (manifest.path.split('/').at(-1) ?? manifest.path).replace(/\.csproj$/i, '')
      return { key: `csproj:${name}`, name, rootPath: dirOf(manifest.path), kind: 'csproj' }
    })
  let modules: DetectedModule[] = [...packages, ...projects]
  if (modules.length < 2) {
    const base = folderBase(paths, manifests)
    const prefix = base === '' ? '' : `${base}/`
    const firstLevel = new Set<string>()
    let looseFiles = false
    for (const path of paths) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      if (rest.includes('/')) firstLevel.add(rest.slice(0, rest.indexOf('/')))
      else looseFiles = true
    }
    modules = [...firstLevel].sort().map((dir) => ({
      key: `dir:${prefix}${dir}`,
      name: dir,
      rootPath: `${prefix}${dir}`,
      kind: 'folder' as const
    }))
    if (looseFiles || base !== '') {
      modules.push({
        key: `dir:${base}`,
        name: base === '' ? '(racine)' : `${base} (racine)`,
        rootPath: base,
        kind: 'folder'
      })
    }
  }
  // Fichiers hors de tout module : un module « racine » les accueille.
  const byDepth = [...modules].sort((a, b) => b.rootPath.length - a.rootPath.length)
  const within = (module: DetectedModule, path: string): boolean =>
    module.rootPath === '' || path === module.rootPath || path.startsWith(`${module.rootPath}/`)
  if (
    paths.some((path) => !byDepth.some((module) => within(module, path))) &&
    !modules.some((module) => module.rootPath === '')
  ) {
    modules.push({ key: 'dir:', name: '(racine)', rootPath: '', kind: 'folder' })
    byDepth.push(modules.at(-1) as DetectedModule)
  }
  return {
    modules,
    moduleOf: (path) => byDepth.find((module) => within(module, path))?.key ?? 'dir:'
  }
}
