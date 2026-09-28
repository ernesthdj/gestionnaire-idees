/**
 * Banc d'essai du modèle local (spec 001 research R5, tâche T027).
 * Usage : npx tsx scripts/bench-local-model.ts <modele1> [modele2 …]
 * Prérequis : Ollama lancé sur 127.0.0.1:11434 et modèles téléchargés (`ollama pull <modele>`).
 * Données : uniquement les cas FICTIFS de tests/fixtures/bench/categoriser.json.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { assembleContext } from '../src/main/application/ai/ContextAssembler'
import { OllamaProvider } from '../src/main/infrastructure/ai/OllamaProvider'
import { CategoryOut } from '../src/shared/ai/schemas'

const Cases = z.array(z.object({ input: z.string(), expected: CategoryOut }))

async function benchModel(model: string, cases: z.infer<typeof Cases>): Promise<string> {
  const provider = new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434', model: () => model })
  const status = await provider.isAvailable()
  if (!status.up) return `${model} : indisponible (${status.reason ?? 'raison inconnue'})`

  let valid = 0
  let exactCategory = 0
  let exactNature = 0
  const durations: number[] = []
  for (const testCase of cases) {
    const { system, user } = assembleContext({ kind: 'categoriser', input: testCase.input, context: undefined })
    const started = performance.now()
    const result = await provider.complete({ system, user, schema: CategoryOut, maxTokens: 256 })
    durations.push(performance.now() - started)
    if (result.parsed === null) continue
    valid += 1
    if (result.parsed.categorySlug === testCase.expected.categorySlug) exactCategory += 1
    if (result.parsed.nature === testCase.expected.nature) exactNature += 1
  }
  durations.sort((a, b) => a - b)
  const p90 = durations[Math.floor(durations.length * 0.9)] ?? 0
  const pct = (n: number): string => `${Math.round((100 * n) / cases.length)} %`
  return `${model} : valides ${pct(valid)} · catégorie ${pct(exactCategory)} · nature ${pct(exactNature)} · p90 ${Math.round(p90)} ms`
}

async function main(): Promise<void> {
  const models = process.argv.slice(2)
  if (models.length === 0) throw new Error('Indique au moins un modèle : npx tsx scripts/bench-local-model.ts <modele>')
  const cases = Cases.parse(JSON.parse(readFileSync(resolve('tests/fixtures/bench/categoriser.json'), 'utf8')))
  for (const model of models) process.stdout.write(`${await benchModel(model, cases)}\n`)
}

void main()
