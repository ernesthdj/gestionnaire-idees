import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { neurons } from './schemaNeurons'

/**
 * Dossier d'un nœud sur la carte (spec 028 D6, research R11) : sa place par rapport à sa place par défaut et sa
 * dernière ouverture par mentalyas (« nouveau » se juge par dossier). Ses fichiers ne sont pas recopiés ici : les
 * documents sont lus dans `documents`, les fichiers couverts dans les chemins des éléments, le reste dans
 * `folder_entries`.
 */
export const folders = sqliteTable('folders', {
  neuronId: text('neuron_id')
    .primaryKey()
    .references(() => neurons.id),
  offsetX: real('offset_x').notNull().default(0),
  offsetY: real('offset_y').notNull().default(0),
  /** Glissé par mentalyas : « Réorganiser » ne le replace pas. */
  moved: integer('moved', { mode: 'boolean' }).notNull().default(false),
  seenAt: text('seen_at')
})

/**
 * Fichiers rangés dans le dossier d'un nœud (spec 028 D2 c, d ; data-model) : écrits par Claude dans la conversation
 * du nœud, ajoutés à la main par mentalyas, ou fichiers couverts qu'il a choisi de ne plus afficher. Un chemin relatif
 * au projet lié ; le fichier n'est jamais copié ni déplacé. Retrait logique (annulable).
 */
export const folderEntries = sqliteTable(
  'folder_entries',
  {
    id: text('id').primaryKey(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => neurons.id),
    path: text('path').notNull(),
    /** `path` en minuscules : sous Windows, la casse ne distingue pas deux fichiers. */
    pathKey: text('path_key').notNull(),
    source: text('source', { enum: ['manual', 'conversation', 'covered'] }).notNull(),
    /** Fichier couvert « Ne plus afficher dans le dossier ». */
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    addedBy: text('added_by', { enum: ['user', 'claude'] }).notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [
    uniqueIndex('folder_entries_path_idx').on(t.neuronId, t.pathKey),
    index('folder_entries_neuron_idx').on(t.neuronId)
  ]
)
