/*
 * Bilan de consommation de l'IA (tâche T069) — outil de développement, LECTURE SEULE.
 * Ouvre la base chiffrée d'un profil comme le fait l'app (clé protégée par Windows via safeStorage) et affiche
 * les appels à l'IA regroupés par type de tâche, moteur et modèle, par jour, et les appels les plus chers.
 *
 * Usage : npx electron scripts/ai-usage.cjs            (profil principal)
 *         npx electron scripts/ai-usage.cjs --demo     (profil démo)
 * Aucune donnée n'est modifiée, aucune migration n'est appliquée ; aucun contenu d'idée n'est affiché.
 */
const { app, safeStorage } = require('electron')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
// Alias npm de better-sqlite3-multiple-ciphers (SQLite chiffré), compilé pour Electron.
const Database = require('better-sqlite3')

const demo = process.argv.includes('--demo')
const profile = join(app.getPath('appData'), demo ? 'gestionnaire-idees-demo' : 'gestionnaire-idees')
// safeStorage (Windows) utilise la clé du profil (« Local State ») : il faut pointer sur ce profil avant « ready ».
app.setPath('userData', profile)

/** Millicentimes d'euro → euros lisibles. */
const euros = (millicents) => `${(millicents / 100000).toFixed(3)} €`

function report() {
  const keyFile = join(profile, 'secrets', 'db.bin')
  const dbFile = join(profile, 'gestionnaire-idees.db')
  if (!existsSync(keyFile) || !existsSync(dbFile)) {
    console.log(`Profil ${profile} : pas de base.`)
    return
  }
  const key = safeStorage.decryptString(readFileSync(keyFile))
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Clé de base inattendue')
  const db = new Database(dbFile, { readonly: true })
  try {
    db.pragma("cipher='sqlcipher'")
    db.pragma(`key="x'${key}'"`)

    const total = db
      .prepare(
        `SELECT count(*) AS calls, sum(cost_millicents) AS cost, min(created_at) AS first, max(created_at) AS last
         FROM ai_calls`
      )
      .get()
    console.log(`\n=== Profil ${demo ? 'DÉMO' : 'PRINCIPAL'} — ${total.calls} appels, ${euros(total.cost ?? 0)}`)
    console.log(`    du ${total.first} au ${total.last}`)

    console.log('\n--- Par type de tâche, moteur et modèle (du plus cher au moins cher)')
    console.table(
      db
        .prepare(
          `SELECT kind, engine, model, count(*) AS appels,
                  sum(status = 'ok') AS ok, sum(status <> 'ok') AS echecs,
                  sum(input_tokens) AS entree, sum(output_tokens) AS sortie,
                  sum(cache_read_tokens) AS cache_lu, sum(cache_write_tokens) AS cache_ecrit,
                  sum(cost_millicents) AS cout_mc, round(avg(duration_ms)) AS ms_moyen
           FROM ai_calls GROUP BY kind, engine, model ORDER BY cout_mc DESC`
        )
        .all()
        .map((row) => ({ ...row, cout: euros(row.cout_mc), cout_moyen: euros(row.cout_mc / row.appels) }))
    )

    console.log('\n--- Par jour et moteur')
    console.table(
      db
        .prepare(
          `SELECT substr(created_at, 1, 10) AS jour, engine, count(*) AS appels, sum(cost_millicents) AS cout_mc
           FROM ai_calls GROUP BY jour, engine ORDER BY jour`
        )
        .all()
        .map((row) => ({ ...row, cout: euros(row.cout_mc) }))
    )

    console.log('\n--- Échecs (appels payés sans résultat utilisable ?)')
    console.table(
      db
        .prepare(
          `SELECT kind, status, error_code, count(*) AS appels, sum(cost_millicents) AS cout_mc
           FROM ai_calls WHERE status <> 'ok' GROUP BY kind, status, error_code ORDER BY cout_mc DESC`
        )
        .all()
        .map((row) => ({ ...row, cout: euros(row.cout_mc) }))
    )

    console.log('\n--- Les 15 appels les plus chers')
    console.table(
      db
        .prepare(
          `SELECT created_at, kind, model, input_tokens AS entree, output_tokens AS sortie,
                  cache_read_tokens AS cache_lu, cache_write_tokens AS cache_ecrit, cost_millicents AS cout_mc
           FROM ai_calls ORDER BY cost_millicents DESC LIMIT 15`
        )
        .all()
        .map((row) => ({ ...row, cout: euros(row.cout_mc) }))
    )
  } finally {
    db.close()
  }
}

app
  .whenReady()
  .then(report)
  .catch((error) => {
    console.error('Bilan impossible :', error.message)
    process.exitCode = 1
  })
  .finally(() => app.quit())
