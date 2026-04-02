import { DuckDBInstance } from '@duckdb/node-api'
import { log } from 'tiny-typescript-logger'

import { normalizeStatement } from '../normalize-statement.ts'

type DuckDBConnection = Awaited<ReturnType<DuckDBInstance['connect']>>

let connectionPromise: Promise<DuckDBConnection> | null = null

const bucket = process.env.BUCKET_NAME ?? 'mongo-insights-dev'
const region = process.env.BUCKET_REGION ?? 'eu-north-1'
const accessKey = process.env.AWS_ACCESS_KEY ?? ''
const secretKey = process.env.AWS_SECRET_ACCESS_KEY ?? ''

async function createConnection(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  await connection.run(`SET s3_region = '${region}'`)
  await connection.run(`SET s3_access_key_id = '${accessKey}'`)
  await connection.run(`SET s3_secret_access_key = '${secretKey}'`)

  return connection
}

export async function getConnection(): Promise<DuckDBConnection> {
  connectionPromise ??= createConnection()

  return connectionPromise
}

function s3Path(database: string, date: string): string {
  return `s3://${bucket}/profiles/${database}/${date}/profiles.parquet`
}

export async function loadProfiles(
  database: string,
  dates: string[]
): Promise<string> {
  const connection = await getConnection()
  const tableName = `profiles_${crypto.randomUUID().replace(/-/g, '')}`

  const loadedFirst = await loadFirstDate(
    connection,
    tableName,
    database,
    dates
  )

  if (!loadedFirst) {
    await connection.run(
      `CREATE TEMP TABLE ${tableName} (
        ts VARCHAR, database VARCHAR, op VARCHAR, ns VARCHAR,
        millis INTEGER, "planSummary" VARCHAR, "docsExamined" INTEGER,
        "keysExamined" INTEGER, nreturned INTEGER, "responseLength" INTEGER,
        client VARCHAR, "user" VARCHAR, "queryHash" VARCHAR,
        command VARCHAR, "execStats" VARCHAR
      )`
    )
  }

  log.info(`Loaded documents into ${tableName}`)

  await addNormalizedStatements(connection, tableName)

  return tableName
}

async function loadFirstDate(
  connection: DuckDBConnection,
  tableName: string,
  database: string,
  dates: string[]
): Promise<boolean> {
  let created = false

  for (const date of dates) {
    const path = s3Path(database, date)

    try {
      if (!created) {
        await connection.run(
          `CREATE TEMP TABLE ${tableName} AS SELECT * FROM read_parquet('${path}')`
        )

        created = true
      } else {
        await connection.run(
          `INSERT INTO ${tableName} SELECT * FROM read_parquet('${path}')`
        )
      }
    } catch {
      log.info(`No parquet file at ${path}`)
    }
  }

  return created
}

async function addNormalizedStatements(
  connection: DuckDBConnection,
  tableName: string
): Promise<void> {
  const reader = await connection.runAndReadAll(
    `SELECT rowid, command FROM ${tableName}`
  )

  const rows = reader.getRows()
  const mappings: [number, string][] = rows.map((row) => [
    Number(row[0]),
    normalizeStatement(String(row[1]))
  ])

  await connection.run(
    `ALTER TABLE ${tableName} ADD COLUMN normalized_statement VARCHAR DEFAULT ''`
  )

  if (mappings.length > 0) {
    const prepared = await connection.prepare(
      `UPDATE ${tableName} SET normalized_statement = $1 WHERE rowid = $2`
    )

    for (const [rowId, statement] of mappings) {
      prepared.bindVarchar(1, statement)
      prepared.bindInteger(2, rowId)
      await prepared.run()
    }
  }
}

export async function queryRows(
  sql: string
): Promise<Record<string, unknown>[]> {
  const connection = await getConnection()
  const reader = await connection.runAndReadAll(sql)

  const columns = reader.columnNames()
  const rows = reader.getRows()

  return rows.map((row) => {
    const record: Record<string, unknown> = {}

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      const value = row[i]

      if (column) {
        record[column] = typeof value === 'bigint' ? Number(value) : value
      }
    }

    return record
  })
}

export async function cleanup(tableName: string): Promise<void> {
  const connection = await getConnection()

  await connection.run(`DROP TABLE IF EXISTS ${tableName}`)
}
