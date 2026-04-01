import dayjs from 'dayjs'
import { describe, expect, mock, test } from 'bun:test'

import type { ProfileRow } from '../../collector/buffer.ts'

const mockDownloadProfiles = mock(() =>
  Promise.resolve({ rows: [] as ProfileRow[], etag: null })
)

mock.module('../../collector/storage.ts', () => ({
  downloadProfiles: mockDownloadProfiles
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

  test('returns empty buckets when no data exists', async () => {
    mockDownloadProfiles.mockResolvedValue({ rows: [], etag: null })

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(response.status).toEqual(200)
    expect(body).toEqual({ buckets: [] })
  })

  test('computes p50 and p99 per bucket', async () => {
    const baseTime = dayjs().subtract(30, 'minute')

    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow({
        ts: baseTime.add(i, 'second').toISOString(),
        millis: (i + 1) * 10
      })
    )

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    expect(body.buckets.length).toBeGreaterThanOrEqual(1)

    const bucket = body.buckets[0]

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

    const response = await request({ database: 'mydb', timeRange: 3600 })
    const body = await response.json()

    for (const bucket of body.buckets) {
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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    const allP50 = body.buckets.map((b: { p50: number }) => b.p50)
    const allP99 = body.buckets.map((b: { p99: number }) => b.p99)

    const hasDistinctPercentiles = body.buckets.some(
      (b: { p50: number; p99: number }) => b.p50 !== b.p99
    )

    expect(hasDistinctPercentiles).toEqual(true)
    expect(allP50.length).toBeGreaterThanOrEqual(1)
    expect(allP99.length).toBeGreaterThanOrEqual(1)
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

    mockDownloadProfiles.mockResolvedValue({ rows, etag: null })

    const response = await request({ database: 'mydb', timeRange: 86400 })
    const body = await response.json()

    const bucket = body.buckets[0]

    expect(bucket.p50).toBeLessThan(bucket.p99)
  })
})
