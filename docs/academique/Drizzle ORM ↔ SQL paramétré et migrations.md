---
type: pont
subject: Drizzle ORM ↔ requêtes SQL paramétrées écrites à la main, et migrations versionnées up/down
source: pont
seances: [2026-09-28]
tags: [#pont, #sql, #orm, #drizzle, #migrations, #securite]
date: 2026-09-28
niveau: intermédiaire
statut: complet
---

# Drizzle ORM ↔ SQL paramétré et migrations

> **En 30 secondes** — Drizzle (l'ORM — *Object-Relational Mapper*, traducteur entre objets du code et tables SQL — choisi à la place de Prisma) te laisse écrire `db.select().from(aiCalls).where(eq(aiCalls.engine, 'claude'))` en TypeScript typé. Sous le capot, il produit exactement ce que tu écrirais à la main en PHP/C# : une **requête préparée** `SELECT … WHERE engine = ?` avec la valeur **liée à part**. Côté schéma, `drizzle-kit` génère le SQL **montant** (`up`) ; le SQL **descendant** (`down`) est écrit à la main, comme l'exige la constitution.

## 1. Vue Macro & Utilité
- **Problématique** : deux problèmes classiques de la couche donnée. (1) L'**injection SQL** : si on colle une saisie utilisateur dans une chaîne SQL, elle peut devenir du code. (2) L'**évolution du schéma** : ajouter une colonne sur la machine de l'utilisateur sans perdre ses idées, et pouvoir revenir en arrière.
- **Emplacement dans la carte globale** : couche **infrastructure**, entre les `*Repository` et le fichier SQLite chiffré.
- **Analogie** : faire la cuisine soi-même (PDO / `SqlCommand` avec paramètres, scripts `ALTER TABLE` à la main) ↔ un **traiteur** (Drizzle) qui applique la même recette d'hygiène, mais dont tu dois quand même savoir lire la fiche technique. Pourquoi ce traiteur et pas Prisma ? Prisma livre avec son **propre camion** (un moteur binaire séparé), mal accepté dans l'emballage Electron, et ne sait pas ouvrir une chambre froide chiffrée (SQLCipher) — exception motivée dans le `CLAUDE.md` projet.

## 2. Le Pont Systémique (sous le capot)
1. `db.select()…where(eq(col, valeur))` construit un **arbre de requête** en mémoire.
2. Drizzle le compile en texte SQL avec des `?` à la place des valeurs, et une **liste de paramètres** séparée.
3. better-sqlite3 appelle `sqlite3_prepare` : SQLite **analyse et compile** la requête (plan d'exécution) **avant** de connaître les valeurs.
4. Les valeurs sont **liées** (`sqlite3_bind_*`) comme de simples données : même si elles contiennent `' OR 1=1 --`, elles ne peuvent plus changer la structure de la requête.
5. Migrations : au démarrage, `migrate()` lit `migrations/meta/_journal.json`, compare avec la table interne des migrations déjà appliquées, et exécute **dans l'ordre** les fichiers `0000_…sql` à `0005_…sql` manquants.

## 3. Correspondance

| Ce que fait Drizzle | Le mécanisme « à la main » | Où dans le projet |
|---------------------|----------------------------|-------------------|
| `sqliteTable('neurons', { id: text('id').primaryKey(), … })` | `CREATE TABLE neurons (id TEXT PRIMARY KEY, …)` | `schemaNeurons.ts` → `0003_neurons_model.sql` |
| `where(eq(aiCalls.engine, 'claude'))` | `WHERE engine = ?` + `bind('claude')` | `AiCallRepository.ts` |
| `select({ total: sum(aiCalls.costMillicents) })` | `SELECT SUM(cost_millicents) AS total` | budget du mois |
| `` sql`${neurons.id} IN (… MATCH ${query})` `` | requête brute **avec valeur liée** (`${query}` devient `?`) | recherche FTS dans `NeuronRepository.ts` |
| `db.transaction(() => …)` | `BEGIN … COMMIT / ROLLBACK` | éclosion (`FusionRepository`) |
| `npm run db:generate` (drizzle-kit) | écrire le script `ALTER TABLE` montant | `0001_cache_write_tokens.sql` |
| *(rien : non généré)* | écrire le script **descendant** | `migrations/down/0001_cache_write_tokens.down.sql` |

Exemple réel d'une paire up/down :

```sql
-- up : 0001_cache_write_tokens.sql (généré)
ALTER TABLE `ai_calls` ADD `cache_write_tokens` integer DEFAULT 0 NOT NULL;
-- down : down/0001_cache_write_tokens.down.sql (écrit à la main)
-- Annulation de 0001_cache_write_tokens.sql (SQLite >= 3.35 : DROP COLUMN).
ALTER TABLE `ai_calls` DROP COLUMN `cache_write_tokens`;
```

**Ce que l'outil cache** : le SQL réellement exécuté (à relire dans les fichiers générés) ; le fait que `` sql`…` `` reste du SQL brut — sûr **uniquement** si on n'y met que des valeurs interpolées par Drizzle (liées), jamais une chaîne concaténée ; et le fait qu'une clé de chiffrement dans un `PRAGMA` **ne peut pas** être liée (d'où le format hex strict, voir [[Stockage local chiffré — SQLite, SQLCipher et DPAPI]]).
**Ce que l'outil fait mieux / différemment** : types TypeScript inférés du schéma (`typeof neurons.$inferSelect`) → une colonne renommée casse la compilation, pas la production ; pas de moteur binaire ; compatible avec l'alias `better-sqlite3` → variante chiffrée. **Limite** : pas de `down` automatique — la discipline est humaine.

## 4. Synthèse & Prochaine Étape
**À retenir (3 puces max)** :
- Drizzle = requêtes **préparées + valeurs liées**, comme PDO/`SqlParameter`, avec des types en plus.
- `` sql`…` `` brut n'est sûr qu'avec des valeurs interpolées par Drizzle ; tout ce qui n'est pas paramétrable doit être validé par format.
- Chaque migration générée a son **down écrit à la main** (constitution) ; les montants restent en centimes entiers.

**Question d'oral probable** : « Votre standard impose Prisma ; pourquoi Drizzle ? » → Prisma embarque un moteur binaire séparé, fragile à empaqueter dans Electron, et ne gère pas SQLite chiffré ; Drizzle conserve les garanties exigées (requêtes typées et paramétrées, migrations versionnées avec `down`) — exception validée et écrite dans le `CLAUDE.md` du projet.

**Lien avec la suite** : [[Éclosion atomique — transaction, version et historique]] — la transaction Drizzle en action ; [[Glossaire — Transaction ACID]].
