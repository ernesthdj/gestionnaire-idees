import { describe, expect, it } from 'vitest'
import { checkProjectPath, PROJECT_PATH_MAX } from '../../../src/main/domain/finals/projectPath'

describe('chemin d’un fichier écrit par Claude (spec 013 R2)', () => {
  it('should_accept_a_relative_path_and_normalise_backslashes_when_it_stays_in_the_project', () => {
    expect(checkProjectPath('src\\pages\\Contact.tsx')).toEqual({
      ok: true,
      path: 'src/pages/Contact.tsx',
      key: 'src/pages/contact.tsx'
    })
  })

  it.each([
    '../hors.txt',
    'src/../../hors.txt',
    'src/./a.ts',
    './a.ts',
    'src//a.ts',
    'src/',
    '/etc/passwd',
    '\\\\serveur\\partage\\a.txt',
    'C:\\Windows\\system32\\a.txt',
    'c:a.txt',
    'a.txt:flux',
    'src/a<b>.ts',
    'nul',
    'src/CON.ts',
    'com1.txt',
    'dossier./a.ts',
    'a.ts ',
    '',
    'a'.repeat(PROJECT_PATH_MAX + 1),
    'a\u0000.ts'
  ])('should_refuse_the_hostile_path_%j', (path) => {
    expect(checkProjectPath(path).ok).toBe(false)
  })

  it.each([
    '.git/config',
    'sous/.GIT/hooks/pre-commit',
    'node_modules/x/index.js',
    'vendor/autoload.php',
    '.claude/settings.json',
    '.git'
  ])('should_refuse_a_protected_folder_%j', (path) => {
    expect(checkProjectPath(path)).toMatchObject({ ok: false, reason: expect.stringContaining('protégé') })
  })

  it.each(['.env', '.ENV.local', 'config/.env.production', 'cle.pem', 'certs/site.key', 'id_rsa', '.npmrc', 'a.pfx'])(
    'should_refuse_a_secret_file_%j',
    (path) => {
      expect(checkProjectPath(path)).toMatchObject({ ok: false, reason: expect.stringContaining('secrets') })
    }
  )

  it.each(['.env.example', 'config/.env.sample', '.gitignore', '.github/workflows/ci.yml'])(
    'should_accept_the_harmless_file_%j',
    (path) => {
      expect(checkProjectPath(path).ok).toBe(true)
    }
  )

  it.each(['outil.exe', 'lancer.bat', 'script.ps1', 'photo.JPG', 'base.sqlite', 'archive.zip', 'raccourci.lnk'])(
    'should_refuse_a_binary_or_executable_file_%j',
    (path) => {
      expect(checkProjectPath(path)).toMatchObject({ ok: false, reason: expect.stringContaining('texte') })
    }
  )
})
