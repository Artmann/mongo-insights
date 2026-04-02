import { DuckDBInstance } from '@duckdb/node-api'
import { log } from 'tiny-typescript-logger'

import type { ProfileRow } from '../../collector/buffer.ts'
import { normalizeStatement } from '../normalize-statement.ts'

type DuckDBConnection = Awaited<ReturnType<DuckDBInstance['connect']>>

let connectionPromise: Promise<DuckDBConnection> | null = null

async function createConnection(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  await connection.run(`
    CREATE TABLE profiles (
      client VARCHAR,
      command VARCHAR,
      database VARCHAR,
      "docsExamined" INTEGER,
      "execStats" VARCHAR,
      "keysExamined" INTEGER,
      millis INTEGER,
      nreturned INTEGER,
      ns VARCHAR,
      op VARCHAR,
      "planSummary" VARCHAR,
      "queryHash" VARCHAR,
      "responseLength" INTEGER,
      ts VARCHAR,
      "user" VARCHAR,
      normalized_statement VARCHAR
    )
  `)

  return connection
}

export async function getConnection(): Promise<DuckDBConnection> {
  connectionPromise ??= createConnection()

  return connectionPromise
}

export async function refreshTable(
  database: string,
  rows: ProfileRow[]
): Promise<void> {
  const connection = await getConnection()

  await connection.run(`DELETE FROM profiles WHERE database = '${database}'`)

  if (rows.length === 0) {
    return
  }

  const prepared = await connection.prepare(`
    INSERT INTO profiles VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    )
  `)

  for (const row of rows) {
    prepared.bindVarchar(1, row.client)
    prepared.bindVarchar(2, row.command)
    prepared.bindVarchar(3, row.database)
    prepared.bindInteger(4, row.docsExamined)
    prepared.bindVarchar(5, row.execStats)
    prepared.bindInteger(6, row.keysExamined)
    prepared.bindInteger(7, row.millis)
    prepared.bindInteger(8, row.nreturned)
    prepared.bindVarchar(9, row.ns)
    prepared.bindVarchar(10, row.op)
    prepared.bindVarchar(11, row.planSummary)
    prepared.bindVarchar(12, row.queryHash)
    prepared.bindInteger(13, row.responseLength)
    prepared.bindVarchar(14, row.ts)
    prepared.bindVarchar(15, row.user)
    prepared.bindVarchar(16, normalizeStatement(row.command))
    await prepared.run()
  }

  log.info(`Refreshed ${rows.length} documents for ${database} in DuckDB`)
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
