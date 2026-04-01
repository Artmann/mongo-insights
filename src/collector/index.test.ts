import { describe, expect, mock, test } from 'bun:test'

import type { ProfileRow } from './buffer.ts'

const mockToArray = mock()
const mockLimit = mock()
const mockSort = mock()
const mockFind = mock()

mockLimit.mockImplementation(() => ({
  toArray: mockToArray
}))

mockSort.mockImplementation(() => ({
  limit: mockLimit
}))

mockFind.mockImplementation(() => ({
  sort: mockSort
}))

const mockCollection = mock(() => ({
  find: mockFind
}))

const mockDb = mock(() => ({
  collection: mockCollection
}))

const mockClient = { db: mockDb } as never

mock.module('./storage.ts', () => ({
  downloadProfiles: mock(() =>
    Promise.resolve({ rows: [] as ProfileRow[], etag: null })
  ),
  uploadProfiles: mock(() =>
    Promise.resolve({ status: 'ok' as const, etag: '"abc"' })
  )
}))

mock.module('./buffer.ts', () => ({
  addEntries: mock(() => ({ rows: [] as ProfileRow[], changed: true })),
  getEtag: mock(() => null),
  initializeBuffer: mock(),
  setEtag: mock()
}))

mock.module('tiny-typescript-logger', () => ({
  log: {
    debug: mock(),
    error: mock(),
    info: mock(),
    warn: mock()
  }
}))

const { collectProfiles } = await import('./index.ts')

describe('collectProfiles', () => {
  test('passes the raw MongoDB timestamp to the $gt filter without conversion', async () => {
    const profileTimestamp = new Date('2026-04-01T14:00:00.000Z')

    mockToArray
      .mockResolvedValueOnce([
        {
          ts: profileTimestamp,
          ns: 'mydb.users',
          op: 'query',
          millis: 5
        }
      ])
      .mockResolvedValueOnce([])

    await collectProfiles(mockClient, 'testdb')
    await collectProfiles(mockClient, 'testdb')

    const firstCallFilter = mockFind.mock.calls[0]![0]
    const secondCallFilter = mockFind.mock.calls[1]![0]

    expect(firstCallFilter).toEqual({})
    expect(secondCallFilter.ts.$gt).toBe(profileTimestamp)
  })

  test('sorts ascending so oldest unseen entries are fetched first', async () => {
    mockToArray.mockResolvedValueOnce([
      { ts: new Date('2026-04-01T12:00:00Z'), ns: 'mydb.users', op: 'query', millis: 5 }
    ])

    await collectProfiles(mockClient, 'testdb')

    const sortArg = mockSort.mock.calls[mockSort.mock.calls.length - 1]![0]

    expect(sortArg).toEqual({ ts: 1 })
  })

  test('sets lastSeenTs to the newest entry when multiple are returned', async () => {
    const oldest = new Date('2026-04-01T10:00:00Z')
    const middle = new Date('2026-04-01T11:00:00Z')
    const newest = new Date('2026-04-01T12:00:00Z')

    mockToArray
      .mockResolvedValueOnce([
        { ts: oldest, ns: 'mydb.a', op: 'query', millis: 5 },
        { ts: middle, ns: 'mydb.b', op: 'query', millis: 10 },
        { ts: newest, ns: 'mydb.c', op: 'query', millis: 15 }
      ])
      .mockResolvedValueOnce([])

    await collectProfiles(mockClient, 'regression-db')
    await collectProfiles(mockClient, 'regression-db')

    const filterAfterFirstPoll =
      mockFind.mock.calls[mockFind.mock.calls.length - 1]![0]

    expect(filterAfterFirstPoll).toEqual({ ts: { $gt: newest } })
  })
})
