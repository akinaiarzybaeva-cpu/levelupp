/**
 * PostgreSQL persistence for the SQLite working database.
 *
 * The app runs every query against SQLite (synchronous, better-sqlite3). When
 * DATABASE_URL is set, this module makes PostgreSQL the durable store:
 *
 *  1. At startup it creates every SQLite table in PostgreSQL (same columns,
 *     same primary key) and adds columns that are missing.
 *  2. First run (PostgreSQL empty): all SQLite rows are copied to PostgreSQL.
 *     Later runs: SQLite is emptied and loaded from PostgreSQL, so data
 *     survives Render restarts/deploys that wipe the SQLite file.
 *  3. SQLite triggers record every INSERT/UPDATE/DELETE in `_pg_changes`;
 *     a background flusher copies those rows to PostgreSQL about every second
 *     (and once more on SIGTERM/SIGINT before the process exits).
 *
 * Run only ONE backend instance against a given DATABASE_URL: each instance
 * reads from its own SQLite copy and would not see another instance's writes.
 */
import pg from 'pg'

const CHANGES_TABLE = '_pg_changes'
const META_TABLE = '_levelup_sync_meta'
const FLUSH_INTERVAL_MS = 1000
const FLUSH_BATCH = 500
const INSERT_BATCH_ROWS = 200

const qi = (name) => `"${String(name).replace(/"/g, '""')}"`
const log = (...args) => console.log('[PG]', ...args) // eslint-disable-line no-console
const warn = (...args) => console.error('[PG]', ...args) // eslint-disable-line no-console

function pgType(sqliteType) {
  const t = String(sqliteType ?? '').toUpperCase()
  if (t.includes('INT')) return 'BIGINT'
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) return 'DOUBLE PRECISION'
  return 'TEXT'
}

/** Describe every user table in SQLite: columns, types and primary key. */
function readSqliteSchema(db) {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN (?, ?)
    ORDER BY name
  `).all(CHANGES_TABLE, META_TABLE).map((row) => row.name)

  return tables.map((name) => {
    const columns = db.prepare(`PRAGMA table_info(${qi(name)})`).all()
    const pk = columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name)
    // Tables without an explicit primary key are keyed by SQLite's rowid.
    const useRowid = pk.length === 0
    return {
      name,
      columns: columns.map((c) => ({ name: c.name, type: pgType(c.type) })),
      pk: useRowid ? ['_rowid'] : pk,
      useRowid
    }
  })
}

const selectList = (table) => [
  ...(table.useRowid ? ['rowid AS _rowid'] : []),
  ...table.columns.map((c) => qi(c.name))
].join(', ')

const allColumnNames = (table) => [...(table.useRowid ? ['_rowid'] : []), ...table.columns.map((c) => c.name)]

async function ensurePgSchema(client, schema) {
  // One round trip: the database may be far away (every query costs latency).
  const statements = [`CREATE TABLE IF NOT EXISTS ${qi(META_TABLE)} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`]
  for (const table of schema) {
    const defs = [
      ...(table.useRowid ? ['"_rowid" BIGINT NOT NULL'] : []),
      ...table.columns.map((c) => `${qi(c.name)} ${c.type}`),
      `PRIMARY KEY (${table.pk.map(qi).join(', ')})`
    ]
    statements.push(`CREATE TABLE IF NOT EXISTS ${qi(table.name)} (${defs.join(', ')})`)
    statements.push(`ALTER TABLE ${qi(table.name)} ${table.columns.map((c) => `ADD COLUMN IF NOT EXISTS ${qi(c.name)} ${c.type}`).join(', ')}`)
  }
  await client.query(statements.join(';\n'))
}

async function upsertRows(client, table, rows) {
  if (rows.length === 0) return
  const cols = allColumnNames(table)
  const nonPk = cols.filter((c) => !table.pk.includes(c))
  const conflict = nonPk.length
    ? `DO UPDATE SET ${nonPk.map((c) => `${qi(c)} = EXCLUDED.${qi(c)}`).join(', ')}`
    : 'DO NOTHING'
  for (let i = 0; i < rows.length; i += INSERT_BATCH_ROWS) {
    const chunk = rows.slice(i, i + INSERT_BATCH_ROWS)
    const params = []
    const tuples = chunk.map((row) => `(${cols.map((c) => {
      const value = row[c]
      params.push(Buffer.isBuffer(value) ? value.toString('base64') : value)
      return `$${params.length}`
    }).join(', ')})`)
    await client.query(
      `INSERT INTO ${qi(table.name)} (${cols.map(qi).join(', ')}) VALUES ${tuples.join(', ')}
       ON CONFLICT (${table.pk.map(qi).join(', ')}) ${conflict}`,
      params
    )
  }
}

function pkExpr(table, prefix) {
  const parts = table.useRowid ? [`${prefix}.rowid`] : table.pk.map((c) => `${prefix}.${qi(c)}`)
  return `json_array(${parts.join(', ')})`
}

function dropTriggers(db) {
  const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '_pgsync_%'").all()
  for (const { name } of triggers) db.exec(`DROP TRIGGER IF EXISTS ${qi(name)}`)
}

function createTriggers(db, schema) {
  for (const table of schema) {
    const t = qi(table.name)
    const ins = (expr) => `INSERT INTO ${CHANGES_TABLE} (tbl, pk) VALUES ('${table.name.replace(/'/g, "''")}', ${expr});`
    db.exec(`
      CREATE TRIGGER ${qi(`_pgsync_${table.name}_ins`)} AFTER INSERT ON ${t} BEGIN ${ins(pkExpr(table, 'NEW'))} END;
      CREATE TRIGGER ${qi(`_pgsync_${table.name}_upd`)} AFTER UPDATE ON ${t} BEGIN
        ${ins(pkExpr(table, 'OLD'))}
        ${ins(pkExpr(table, 'NEW'))}
      END;
      CREATE TRIGGER ${qi(`_pgsync_${table.name}_del`)} AFTER DELETE ON ${t} BEGIN ${ins(pkExpr(table, 'OLD'))} END;
    `)
  }
}

export async function initPostgresSync(db, databaseUrl) {
  if (!databaseUrl) {
    log('DATABASE_URL is not set: data is stored only in the SQLite file.')
    return null
  }

  const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl)
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: isLocal || /sslmode=disable/.test(databaseUrl) ? false : { rejectUnauthorized: false },
    max: 3
  })
  pool.on('error', (error) => warn('pool error:', error.message))

  db.exec(`CREATE TABLE IF NOT EXISTS ${CHANGES_TABLE} (id INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, pk TEXT NOT NULL)`)
  const schema = readSqliteSchema(db)
  const byName = new Map(schema.map((t) => [t.name, t]))

  let flushing = null
  const flushOnce = async () => {
    const changes = db.prepare(`SELECT id, tbl, pk FROM ${CHANGES_TABLE} ORDER BY id LIMIT ?`).all(FLUSH_BATCH)
    if (changes.length === 0) return 0
    const maxId = changes[changes.length - 1].id
    const unique = new Map()
    for (const ch of changes) unique.set(`${ch.tbl}\u0000${ch.pk}`, ch)

    const client = await pool.connect()
    try {
      // Group by table: one upsert and one delete statement per table.
      const perTable = new Map()
      for (const { tbl, pk } of unique.values()) {
        const table = byName.get(tbl)
        if (!table) continue
        if (!perTable.has(tbl)) perTable.set(tbl, { table, upserts: [], deletes: [] })
        const entry = perTable.get(tbl)
        const keyValues = JSON.parse(pk)
        const where = (table.useRowid ? ['rowid'] : table.pk.map(qi)).map((c) => `${c} IS ?`).join(' AND ')
        const row = db.prepare(`SELECT ${selectList(table)} FROM ${qi(tbl)} WHERE ${where}`).get(...keyValues)
        if (row) entry.upserts.push(row)
        else entry.deletes.push(keyValues)
      }
      await client.query('BEGIN')
      for (const { table, upserts, deletes } of perTable.values()) {
        if (deletes.length) {
          const params = []
          const tuples = deletes.map((key) => `(${key.map((v) => { params.push(v); return `$${params.length}` }).join(', ')})`)
          await client.query(
            `DELETE FROM ${qi(table.name)} WHERE (${table.pk.map(qi).join(', ')}) IN (${tuples.join(', ')})`,
            params
          )
        }
        await upsertRows(client, table, upserts)
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
    db.prepare(`DELETE FROM ${CHANGES_TABLE} WHERE id <= ?`).run(maxId)
    return changes.length
  }

  const flush = () => {
    if (!flushing) {
      flushing = (async () => {
        try {
          while ((await flushOnce()) === FLUSH_BATCH) { /* keep draining */ }
        } catch (error) {
          warn('sync failed, will retry:', error instanceof Error ? error.message : error)
        } finally {
          flushing = null
        }
      })()
    }
    return flushing
  }

  const client = await pool.connect()
  try {
    await ensurePgSchema(client, schema)
    const initialized = (await client.query(`SELECT value FROM ${qi(META_TABLE)} WHERE key = 'initialized'`)).rowCount > 0
    client.release()

    if (initialized) {
      // Push changes left over from a previous run of this SQLite file first.
      await flush()
      const loaded = {}
      const pgData = {}
      for (const table of schema) {
        const cols = allColumnNames(table)
        const { rows } = await pool.query(`SELECT ${cols.map(qi).join(', ')} FROM ${qi(table.name)}`)
        pgData[table.name] = rows
      }
      dropTriggers(db)
      db.transaction(() => {
        for (const table of schema) {
          db.exec(`DELETE FROM ${qi(table.name)}`)
          const cols = allColumnNames(table)
          const target = (table.useRowid ? ['rowid'] : []).concat(table.columns.map((c) => qi(c.name)))
          const stmt = db.prepare(`INSERT INTO ${qi(table.name)} (${target.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
          for (const row of pgData[table.name]) stmt.run(...cols.map((c) => row[c]))
          loaded[table.name] = pgData[table.name].length
        }
        db.exec(`DELETE FROM ${CHANGES_TABLE}`)
      })()
      log(`loaded ${Object.values(loaded).reduce((a, b) => a + b, 0)} rows from PostgreSQL into ${schema.length} tables.`)
    } else {
      const tx = await pool.connect()
      try {
        await tx.query('BEGIN')
        let total = 0
        for (const table of schema) {
          const rows = db.prepare(`SELECT ${selectList(table)} FROM ${qi(table.name)}`).all()
          await upsertRows(tx, table, rows)
          total += rows.length
        }
        await tx.query(`INSERT INTO ${qi(META_TABLE)} (key, value) VALUES ('initialized', $1) ON CONFLICT (key) DO NOTHING`, [new Date().toISOString()])
        await tx.query('COMMIT')
        log(`first run: created ${schema.length} tables and copied ${total} rows from SQLite to PostgreSQL.`)
      } catch (error) {
        await tx.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        tx.release()
      }
      dropTriggers(db)
      db.exec(`DELETE FROM ${CHANGES_TABLE}`)
    }
  } catch (error) {
    try { client.release() } catch { /* already released */ }
    await pool.end().catch(() => {})
    throw new Error(`PostgreSQL sync could not start: ${error instanceof Error ? error.message : error}`)
  }

  createTriggers(db, schema)

  const timer = setInterval(() => { void flush() }, FLUSH_INTERVAL_MS)
  timer.unref()

  let stopping = false
  const shutdown = async (signal) => {
    if (stopping) return
    stopping = true
    clearInterval(timer)
    await flush()
    await pool.end().catch(() => {})
    log(`flushed pending changes on ${signal}.`)
    process.exit(0)
  }
  process.once('SIGTERM', () => { void shutdown('SIGTERM') })
  process.once('SIGINT', () => { void shutdown('SIGINT') })

  return { flush, pool }
}
