import { describe, expect, mock, test } from 'bun:test'
import { DuckDBInstance } from '@duckdb/node-api'

import type { ProfileRow } from '../../collector/buffer.ts'
import { normalizeStatement } from '../normalize-statement.ts'

type DuckDBConnection = Awaited<ReturnType<DuckDBInstance['connect']>>

let connection: DuckDBConnection
let currentTable = ''

async function setupConnection() {
  const instance = await DuckDBInstance.create(':memory:')

  connection = await instance.connect()
}

async function createTable(rows: ProfileRow[]): Promise<string> {
  if (!connection) {
    await setupConnection()
  }

  const tableName = `test_${crypto.randomUUID().replace(/-/g, '')}`

  await connection.run(`
    CREATE TEMP TABLE ${tableName} (
      client VARCHAR, command VARCHAR, database VARCHAR,
      "docsExamined" INTEGER, "execStats" VARCHAR, "keysExamined" INTEGER,
      millis INTEGER, nreturned INTEGER, ns VARCHAR, op VARCHAR,
      "planSummary" VARCHAR, "queryHash" VARCHAR, "responseLength" INTEGER,
      ts VARCHAR, "user" VARCHAR, normalized_statement VARCHAR
    )
  `)

  if (rows.length > 0) {
    const prepared = await connection.prepare(`
      INSERT INTO ${tableName} VALUES (
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
  }

  currentTable = tableName

  return tableName
}

mock.module('../lib/duckdb.ts', () => ({
  getConnection: () => Promise.resolve(connection),
  loadProfiles: (_database: string, _dates: string[]) =>
    Promise.resolve(currentTable),
  queryRows: async (sql: string) => {
    const reader = await connection.runAndReadAll(sql)
    const columns = reader.columnNames()
    const rows = reader.getRows()

    return rows.map((row: unknown[]) => {
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
  },
  cleanup: async (tableName: string) => {
    await connection.run(`DROP TABLE IF EXISTS ${tableName}`)
  }
}))

mock.module('../../db.ts', () => ({
  getClient: mock(() => Promise.resolve({}))
}))

const { default: app } = await import('../index.ts')

function request(body: Record<string, unknown>) {
  return app.request('/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function makeRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    client: '127.0.0.1',
    command: JSON.stringify({
      find: 'users',
      filter: { email: 'test@test.com' }
    }),
    database: 'mydb',
    docsExamined: 100,
    execStats: '{}',
    keysExamined: 50,
    millis: 10,
    nreturned: 1,
    ns: 'mydb.users',
    op: 'query',
    planSummary: 'IXSCAN { email: 1 }',
    queryHash: 'abc123',
    responseLength: 512,
    ts: '2026-04-01T12:00:00.000Z',
    user: 'admin',
    ...overrides
  }
}

describe('POST /api/queries', () => {
  test('returns 400 when database is missing', async () => {
    const response = await request({ timeRange: 86400 })

    expect(response.status).toEqual(400)

    const body = await response.json()

    expect(body).toEqual({ error: 'database is required' })
  })

  test('returns empty queries when no data exists', async () => {
    await createTable([])

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(response.status).toEqual(200)
    expect(body).toEqual({
      queries: [],
      total: 0,
      page: 1,
      pageSize: 25
    })
  })

  test('aggregates rows by query hash', async () => {
    const rows = [
      makeRow({
        millis: 10,
        docsExamined: 100,
        nreturned: 1,
        responseLength: 512
      }),
      makeRow({
        millis: 20,
        docsExamined: 200,
        nreturned: 2,
        responseLength: 1024
      }),
      makeRow({
        millis: 30,
        docsExamined: 300,
        nreturned: 3,
        responseLength: 2048
      })
    ]

    await createTable(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.queries).toHaveLength(1)
    expect(body.queries[0]).toEqual({
      normalizedStatement: 'find users {email: ?}',
      percentOfRuntime: 100,
      count: 3,
      totalTime: 0.06,
      p50Latency: 20,
      p99Latency: 30,
      documentsRead: 600,
      documentsReturned: 6,
      planSummary: 'IXSCAN { email: 1 }',
      responseSize: 3584
    })
  })

  test('groups different query shapes separately', async () => {
    const rows = [
      makeRow({ queryHash: 'hash1', millis: 100 }),
      makeRow({
        queryHash: 'hash2',
        millis: 50,
        command: JSON.stringify({
          find: 'orders',
          filter: { status: 'pending' }
        })
      })
    ]

    await createTable(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.queries).toHaveLength(2)
    expect(body.total).toEqual(2)
    expect(body.queries[0].normalizedStatement).toEqual('find users {email: ?}')
    expect(body.queries[1].normalizedStatement).toEqual(
      'find orders {status: ?}'
    )
  })

  test('sorts by total time descending', async () => {
    const rows = [
      makeRow({ queryHash: 'slow', millis: 5 }),
      makeRow({
        queryHash: 'fast',
        millis: 1,
        command: JSON.stringify({ find: 'logs', filter: { level: 'info' } })
      }),
      makeRow({ queryHash: 'slow', millis: 10 })
    ]

    await createTable(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.queries[0].totalTime).toEqual(0.015)
    expect(body.queries[1].totalTime).toEqual(0.001)
  })

  test('paginates results', async () => {
    const collections = ['users', 'orders', 'products', 'logs', 'sessions']

    const rows = Array.from({ length: 5 }, (_, i) =>
      makeRow({
        millis: (5 - i) * 10,
        command: JSON.stringify({ find: collections[i], filter: { id: 1 } })
      })
    )

    await createTable(rows)

    const response = await request({
      database: 'mydb',
      timeRange: 86400,
      page: 2,
      pageSize: 2
    })
    const body = await response.json()

    expect(body.total).toEqual(5)
    expect(body.page).toEqual(2)
    expect(body.pageSize).toEqual(2)
    expect(body.queries).toHaveLength(2)
  })

  test('defaults to page 1 and pageSize 25', async () => {
    await createTable([])

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.page).toEqual(1)
    expect(body.pageSize).toEqual(25)
  })

  test('calculates percent of runtime across groups', async () => {
    const rows = [
      makeRow({ queryHash: 'a', millis: 75 }),
      makeRow({
        queryHash: 'b',
        millis: 25,
        command: JSON.stringify({ find: 'other', filter: {} })
      })
    ]

    await createTable(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.queries[0].percentOfRuntime).toEqual(75)
    expect(body.queries[1].percentOfRuntime).toEqual(25)
  })
})
