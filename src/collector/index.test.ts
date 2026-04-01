import { describe, expect, mock, test } from 'bun:test'

import type { ProfileRow } from './buffer.ts'

const mockFind = mock()
const mockToArray = mock()

mockFind.mockImplementation(() => ({
  sort: () => ({
    limit: () => ({
      toArray: mockToArray
    })
  })
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

    const firstCallFilter = mockFind.mock.calls[0][0]
    const secondCallFilter = mockFind.mock.calls[1][0]

    expect(firstCallFilter).toEqual({})
    expect(secondCallFilter.ts.$gt).toBe(profileTimestamp)
  })
})
