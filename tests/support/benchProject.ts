import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Projet fictif de mesure (spec 017 T036, SC-004 / SC-005) : 5 000 fichiers de code dans les trois langages de
 * l'analyse, qui s'importent et s'appellent comme un vrai projet (paquets npm, projets .NET, PSR-4 et routes
 * Laravel ; contrôleurs, services, dépôts). Généré à la demande dans un dossier temporaire, jamais versionné ;
 * déterministe : mêmes fichiers, mêmes liens à chaque lancement. Aucune donnée réelle.
 */

export interface BenchProjectStats {
  readonly files: number
  readonly ts: number
  readonly cs: number
  readonly php: number
}

const TS_PACKAGES = 10
const TS_FEATURES = 15
const TS_FILES = 20
const CS_PROJECTS = 5
const CS_NAMESPACES = 10
const CS_FILES = 25
const PHP_DIRS = 15
const PHP_FILES = 50

/** Rôles des fichiers : leurs noms suffisent à l'analyse pour les ranger par catégorie. */
const ROLES = ['Controller', 'Service', 'Repository', 'Mapper', 'Policy'] as const

/** Générateur pseudo-aléatoire à graine (mulberry32) : mêmes choix à chaque lancement. */
function seeded(seed: number): (max: number) => number {
  let state = seed
  return (max) => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * max)
  }
}

function write(root: string, path: string, content: string): void {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

/** Nom de classe : le rôle en suffixe (`F3x12Controller`), comme dans un vrai projet. */
const named = (group: number, file: number, role = ROLES[file % ROLES.length]): string => `F${group}x${file}${role}`
const tsName = (feature: number, file: number): string => named(feature, file)

function typescript(root: string, pick: (max: number) => number): number {
  let count = 0
  write(root, 'package.json', JSON.stringify({ name: 'bench', private: true, workspaces: ['packages/*'] }, null, 2))
  for (let pkg = 0; pkg < TS_PACKAGES; pkg += 1) {
    write(root, `packages/pkg${pkg}/package.json`, JSON.stringify({ name: `@bench/pkg${pkg}`, main: 'src/index.ts' }))
    for (let feature = 0; feature < TS_FEATURES; feature += 1) {
      for (let file = 0; file < TS_FILES; file += 1) {
        const name = tsName(feature, file)
        // Deux voisins de la même fonctionnalité, un d'une autre : des liens sûrs, internes et entre dossiers.
        const near = [(file + 1) % TS_FILES, (file + 7) % TS_FILES].map((other) => tsName(feature, other))
        const farFeature = (feature + 1 + pick(TS_FEATURES - 1)) % TS_FEATURES
        const far = tsName(farFeature, pick(TS_FILES))
        const lines = [
          ...near.map((other) => `import { ${other} } from './${other}'`),
          `import { ${far} } from '../feature${farFeature}/${far}'`,
          '',
          `/** ${name} : fichier généré pour la mesure de l'analyse. */`,
          `export class ${name} {`,
          `  private readonly items: string[] = []`,
          ''
        ]
        for (let method = 0; method < 4; method += 1) {
          const callee = method === 3 ? far : (near[method % near.length] ?? far)
          lines.push(
            `  step${method}(input: string): string {`,
            `    const value = new ${callee}().step${(method + 1) % 4}(input)`,
            `    this.items.push(value)`,
            `    return value.trim()`,
            `  }`,
            ''
          )
        }
        lines.push(`  count(): number {`, `    return this.items.length`, `  }`, `}`, '')
        write(root, `packages/pkg${pkg}/src/feature${feature}/${name}.ts`, lines.join('\n'))
        count += 1
      }
    }
  }
  return count
}

function csharp(root: string, pick: (max: number) => number): number {
  let count = 0
  const registrations: string[] = []
  for (let project = 0; project < CS_PROJECTS; project += 1) {
    write(
      root,
      `dotnet/Bench${project}/Bench${project}.csproj`,
      '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>\n</Project>\n'
    )
    for (let space = 0; space < CS_NAMESPACES; space += 1) {
      for (let file = 0; file < CS_FILES; file += 1) {
        const name = named(space, file)
        const other = named(space, (file + 1) % CS_FILES)
        const farSpace = (space + 1 + pick(CS_NAMESPACES - 1)) % CS_NAMESPACES
        const farFile = pick(CS_FILES)
        const far = named(farSpace, farFile)
        const lines = [
          'using System;',
          `using Bench${project}.Space${farSpace};`,
          '',
          `namespace Bench${project}.Space${space}`,
          '{',
          `    public interface I${name}`,
          '    {',
          '        string Run(string input);',
          '    }',
          '',
          `    public class ${name} : I${name}`,
          '    {',
          `        private readonly I${other} _next;`,
          `        private readonly I${far} _far;`,
          '',
          `        public ${name}(I${other} next, I${far} far)`,
          '        {',
          '            _next = next;',
          '            _far = far;',
          '        }',
          '',
          '        public string Run(string input)',
          '        {',
          '            var value = _next.Run(input);',
          '            return _far.Run(value).Trim();',
          '        }',
          '    }',
          '}',
          ''
        ]
        write(root, `dotnet/Bench${project}/Space${space}/${name}.cs`, lines.join('\n'))
        registrations.push(
          `builder.Services.AddScoped<Bench${project}.Space${space}.I${name}, Bench${project}.Space${space}.${name}>();`
        )
        count += 1
      }
    }
  }
  write(
    root,
    'dotnet/Bench0/Program.cs',
    [
      'var builder = WebApplication.CreateBuilder(args);',
      ...registrations.slice(0, 400),
      'var app = builder.Build();',
      'app.Run();',
      ''
    ].join('\n')
  )
  return count + 1
}

function php(root: string, pick: (max: number) => number): number {
  let count = 0
  write(root, 'php/composer.json', JSON.stringify({ autoload: { 'psr-4': { 'App\\': 'app/' } } }, null, 2))
  const routes: string[] = ['<?php', '', 'use Illuminate\\Support\\Facades\\Route;', '']
  for (let dir = 0; dir < PHP_DIRS; dir += 1) {
    for (let file = 0; file < PHP_FILES; file += 1) {
      const name = named(dir, file)
      const other = named(dir, (file + 1) % PHP_FILES)
      const farDir = (dir + 1 + pick(PHP_DIRS - 1)) % PHP_DIRS
      const far = named(farDir, pick(PHP_FILES))
      const lines = [
        '<?php',
        '',
        `namespace App\\Dir${dir};`,
        '',
        `use App\\Dir${farDir}\\${far};`,
        '',
        `class ${name}`,
        '{',
        `    public function __construct(private ${other} $next, private ${far} $far)`,
        '    {',
        '    }',
        '',
        '    public function handle(string $input): string',
        '    {',
        '        $value = $this->next->handle($input);',
        '        return trim($this->far->handle($value));',
        '    }',
        '}',
        ''
      ]
      write(root, `php/app/Dir${dir}/${name}.php`, lines.join('\n'))
      if (file % ROLES.length === 0) {
        routes.push(`Route::get('/dir${dir}/${file}', [App\\Dir${dir}\\${name}::class, 'handle']);`)
      }
      count += 1
    }
  }
  write(root, 'php/routes/web.php', `${routes.join('\n')}\n`)
  return count + 1
}

/** Écrit le projet de mesure dans `root` (dossier vide) ; 5 000 fichiers de code au total. */
export function writeBenchProject(root: string): BenchProjectStats {
  const pick = seeded(17)
  const ts = typescript(root, pick)
  const cs = csharp(root, pick)
  const phpCount = php(root, pick)
  return { files: ts + cs + phpCount, ts, cs, php: phpCount }
}
