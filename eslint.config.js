import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'out/**',
      'tests/fixtures/reprise/**',
      'dist/**',
      'release/**',
      'node_modules/**',
      'graphify-out/**',
      '.specify/**',
      '.claude/**',
      '.kilo/**',
      '.analyste/**',
      'docs/**',
      'scripts/**/*.cjs'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    // Racine explicite : un worktree git imbriqué (outil tiers) contient son propre tsconfig.
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-console': 'error'
    }
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'off' }
  }
)
