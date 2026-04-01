import { describe, expect, mock, test } from 'bun:test'

import type { ProfileRow } from '../../collector/buffer.ts'

const mockDownloadProfiles = mock(() =>
  Promise.resolve({ rows: [] as ProfileRow[], etag: null })
)

mock.module('../../collector/storage.ts', () => ({
  downloadProfiles: mockDownloadProfiles
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
    mockDownloadProfiles.mockResolvedValue({ rows: [], etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

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
    mockDownloadProfiles.mockResolvedValue({ rows: [], etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.queries[0].percentOfRuntime).toEqual(75)
    expect(body.queries[1].percentOfRuntime).toEqual(25)
  })
})
