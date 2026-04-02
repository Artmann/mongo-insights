import dayjs from 'dayjs'
import { describe, expect, mock, test } from 'bun:test'
import { DuckDBInstance } from '@duckdb/node-api'

import type { ProfileRow } from '../../collector/buffer.ts'
import { normalizeStatement } from '../normalize-statement.ts'

type DuckDBConnection = Awaited<ReturnType<DuckDBInstance['connect']>>

let connection: DuckDBConnection

async function setupConnection() {
  const instance = await DuckDBInstance.create(':memory:')

  connection = await instance.connect()

  await connection.run(`
    CREATE TABLE profiles (
      client VARCHAR, command VARCHAR, database VARCHAR,
      "docsExamined" INTEGER, "execStats" VARCHAR, "keysExamined" INTEGER,
      millis INTEGER, nreturned INTEGER, ns VARCHAR, op VARCHAR,
      "planSummary" VARCHAR, "queryHash" VARCHAR, "responseLength" INTEGER,
      ts VARCHAR, "user" VARCHAR, normalized_statement VARCHAR
    )
  `)
}

async function loadRows(rows: ProfileRow[]) {
  if (!connection) {
    await setupConnection()
  }

  await connection.run('DELETE FROM profiles')

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
}

mock.module('../lib/duckdb.ts', () => ({
  getConnection: () => Promise.resolve(connection),
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
  refreshTable: () => Promise.resolve()
}))

mock.module('../../db.ts', () => ({
  getClient: mock(() => Promise.resolve({}))
}))

const { default: app } = await import('../index.ts')

function request(body: Record<string, unknown>) {
  return app.request('/latency-timeseries', {
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
    ts: dayjs().subtract(1, 'hour').toISOString(),
    user: 'admin',
    ...overrides
  }
}

describe('POST /api/latency-timeseries', () => {
  test('returns 400 when database is missing', async () => {
    const response = await request({ timeRange: 86400 })

    expect(response.status).toEqual(400)

    const body = await response.json()

    expect(body).toEqual({ error: 'database is required' })
  })

  test('returns all buckets with null values when no data exists', async () => {
    await loadRows([])

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(response.status).toEqual(200)
    expect(body.buckets.length).toBeGreaterThanOrEqual(1)

    for (const bucket of body.buckets) {
      expect(bucket).toHaveProperty('time')
      expect(bucket.p50).toEqual(null)
      expect(bucket.p99).toEqual(null)
    }
  })

  test('computes p50 and p99 per bucket', async () => {
    const baseTime = dayjs().subtract(30, 'minute')

    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow({
        ts: baseTime.add(i, 'second').toISOString(),
        millis: (i + 1) * 10
      })
    )

    await loadRows(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.buckets.length).toBeGreaterThanOrEqual(1)

    const dataBuckets = body.buckets.filter(
      (b: { p50: number | null }) => b.p50 !== null
    )

    expect(dataBuckets.length).toBeGreaterThanOrEqual(1)

    const bucket = dataBuckets[0]

    expect(bucket.p50).not.toEqual(bucket.p99)
    expect(bucket).toHaveProperty('time')
    expect(bucket).toHaveProperty('p50')
    expect(bucket).toHaveProperty('p99')
  })

  test('sorts buckets chronologically', async () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeRow({
          ts: dayjs().subtract(3, 'hour').add(i, 'second').toISOString(),
          millis: 50
        })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeRow({
          ts: dayjs().subtract(1, 'hour').add(i, 'second').toISOString(),
          millis: 100
        })
      )
    ]

    await loadRows(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    for (let i = 1; i < body.buckets.length; i++) {
      expect(body.buckets[i].time > body.buckets[i - 1].time).toEqual(true)
    }
  })

  test('filters out rows older than the time range', async () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeRow({
          ts: dayjs().subtract(2, 'day').add(i, 'second').toISOString(),
          millis: 999
        })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeRow({
          ts: dayjs().subtract(30, 'minute').add(i, 'second').toISOString(),
          millis: 50
        })
      )
    ]

    await loadRows(rows)

    const response = await request({ database: 'mydb', timeRange: 3600 })
    const body = await response.json()

    const dataBuckets = body.buckets.filter(
      (b: { p99: number | null }) => b.p99 !== null
    )

    for (const bucket of dataBuckets) {
      expect(bucket.p99).toBeLessThanOrEqual(50)
    }
  })

  test('defaults timeRange to 86400 seconds', async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        ts: dayjs().subtract(12, 'hour').add(i, 'minute').toISOString(),
        millis: 100
      })
    )

    await loadRows(rows)

    const response = await request({ database: 'mydb' })
    const body = await response.json()

    expect(body.buckets.length).toBeGreaterThanOrEqual(1)
  })

  test('produces different p50 and p99 with varied latencies', async () => {
    const baseTime = dayjs().subtract(1, 'hour')

    const rows = Array.from({ length: 100 }, (_, i) =>
      makeRow({
        ts: baseTime.add(i, 'second').toISOString(),
        millis: i < 90 ? 10 : 500
      })
    )

    await loadRows(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    const hasDistinctPercentiles = body.buckets.some(
      (b: { p50: number; p99: number }) => b.p50 !== b.p99
    )

    expect(hasDistinctPercentiles).toEqual(true)
    expect(body.buckets.length).toBeGreaterThanOrEqual(1)
  })

  test('groups entries from different query shapes into the same bucket', async () => {
    const baseTime = dayjs().subtract(30, 'minute')

    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeRow({
          ts: baseTime.add(i, 'second').toISOString(),
          millis: 10,
          command: JSON.stringify({ find: 'users', filter: { id: 1 } })
        })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeRow({
          ts: baseTime.add(i, 'second').toISOString(),
          millis: 200,
          command: JSON.stringify({
            find: 'orders',
            filter: { status: 'pending' }
          })
        })
      )
    ]

    await loadRows(rows)

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    const dataBuckets = body.buckets.filter(
      (b: { p50: number | null }) => b.p50 !== null
    )

    const bucket = dataBuckets[0]

    expect(bucket.p50).toBeLessThan(bucket.p99)
  })
})
