import { defineConfig } from 'drizzle-kit'

// Sert uniquement à générer les migrations (`npm run db:generate`). Chaque migration générée
// est accompagnée d'un script d'annulation écrit à la main dans `migrations/down/`.
export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/main/infrastructure/db/schema.ts',
    './src/main/infrastructure/db/schemaNeurons.ts',
    './src/main/infrastructure/db/schemaReprise.ts',
    './src/main/infrastructure/db/schemaAnalyste.ts',
    './src/main/infrastructure/db/schemaSkills.ts',
    './src/main/infrastructure/db/schemaGit.ts',
    './src/main/infrastructure/db/schemaBrainstorms.ts'
  ],
  out: './src/main/infrastructure/db/migrations'
})
