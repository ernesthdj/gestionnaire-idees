import { describe, expect, it } from 'vitest'
import { detectModules } from '../../../src/main/domain/reprise/modules'

describe('modules d’un projet repris (spec 017 R3)', () => {
  it('should_use_the_folders_under_src_for_a_single_typescript_package', () => {
    const paths = ['package.json', 'src/main.ts', 'src/api/orderController.ts', 'src/core/orderService.ts']
    const { modules, moduleOf } = detectModules(paths, [{ path: 'package.json', content: '{"name":"ts-app"}' }])
    expect(modules.map((module) => module.key)).toEqual(['dir:src/api', 'dir:src/core', 'dir:src', 'dir:'])
    expect(moduleOf('src/core/orderService.ts')).toBe('dir:src/core')
    expect(moduleOf('src/main.ts')).toBe('dir:src')
    expect(moduleOf('package.json')).toBe('dir:')
  })

  it('should_use_the_folders_under_app_for_laravel', () => {
    const paths = [
      'composer.json',
      'routes/web.php',
      'app/Models/Order.php',
      'app/Http/Controllers/OrderController.php'
    ]
    const { modules, moduleOf } = detectModules(paths, [{ path: 'composer.json', content: '{}' }])
    expect(modules.map((module) => module.name)).toEqual(['Http', 'Models', 'app (racine)', '(racine)'])
    expect(moduleOf('app/Http/Controllers/OrderController.php')).toBe('dir:app/Http')
    expect(moduleOf('routes/web.php')).toBe('dir:')
  })

  it('should_use_first_level_folders_for_a_single_dotnet_project', () => {
    const paths = ['App.csproj', 'Program.cs', 'Domain/OrderService.cs', 'Infrastructure/SqlOrderRepository.cs']
    const { modules, moduleOf } = detectModules(paths, [{ path: 'App.csproj', content: '' }])
    expect(modules.map((module) => module.key)).toEqual(['dir:Domain', 'dir:Infrastructure', 'dir:'])
    expect(moduleOf('Program.cs')).toBe('dir:')
  })

  it('should_use_packages_and_dotnet_projects_when_there_are_several', () => {
    const paths = ['packages/core/src/a.ts', 'packages/ui/src/b.tsx', 'tools/x.ts']
    const { modules, moduleOf } = detectModules(paths, [
      { path: 'packages/core/package.json', content: '{"name":"@app/core"}' },
      { path: 'packages/ui/package.json', content: 'illisible' }
    ])
    expect(modules.map((module) => [module.key, module.kind])).toEqual([
      ['npm:@app/core', 'package'],
      ['npm:ui', 'package'],
      ['dir:', 'folder']
    ])
    expect(moduleOf('packages/core/src/a.ts')).toBe('npm:@app/core')
    expect(moduleOf('tools/x.ts')).toBe('dir:')
  })

  it('should_ignore_manifests_of_tests_and_fixtures_when_detecting_modules', () => {
    const paths = ['package.json', 'src/main/a.ts', 'src/renderer/b.tsx', 'tests/fixtures/ts-app/package.json']
    const { modules } = detectModules(paths, [
      { path: 'package.json', content: '{"name":"app"}' },
      { path: 'tests/fixtures/ts-app/package.json', content: '{"name":"ts-app"}' },
      { path: 'tests/fixtures/cs-app/App.csproj', content: '' },
      { path: 'src/__fixtures__/demo/package.json', content: '{"name":"demo"}' }
    ])
    expect(modules.map((module) => module.key)).toEqual(['dir:src/main', 'dir:src/renderer', 'dir:src', 'dir:'])
  })
})
