import { describe, expect, test } from 'bun:test'

import { normalizeStatement } from './normalize-statement.ts'

describe('normalizeStatement', () => {
  test('normalizes a find command with filter', () => {
    const command = JSON.stringify({
      find: 'users',
      filter: { email: 'test@example.com' }
    })

    expect(normalizeStatement(command)).toEqual('find users {email: ?}')
  })

  test('normalizes nested filter values', () => {
    const command = JSON.stringify({
      find: 'orders',
      filter: { status: 'active', amount: { $gt: 100 } }
    })

    expect(normalizeStatement(command)).toEqual(
      'find orders {amount: {$gt: ?}, status: ?}'
    )
  })

  test('normalizes aggregate command', () => {
    const command = JSON.stringify({ aggregate: 'events' })

    expect(normalizeStatement(command)).toEqual('aggregate events')
  })

  test('normalizes update command with filter', () => {
    const command = JSON.stringify({
      update: 'users',
      filter: { _id: '123abc' }
    })

    expect(normalizeStatement(command)).toEqual('update users {_id: ?}')
  })

  test('normalizes insert command', () => {
    const command = JSON.stringify({ insert: 'logs' })

    expect(normalizeStatement(command)).toEqual('insert logs')
  })

  test('normalizes delete command with filter', () => {
    const command = JSON.stringify({
      delete: 'sessions',
      filter: { expiresAt: { $lt: '2026-01-01' } }
    })

    expect(normalizeStatement(command)).toEqual(
      'delete sessions {expiresAt: {$lt: ?}}'
    )
  })

  test('returns first key for unknown commands', () => {
    const command = JSON.stringify({ serverStatus: 1 })

    expect(normalizeStatement(command)).toEqual('serverStatus')
  })

  test('returns raw string for invalid json', () => {
    expect(normalizeStatement('not json')).toEqual('not json')
  })

  test('handles command with query instead of filter', () => {
    const command = JSON.stringify({
      find: 'products',
      query: { category: 'electronics' }
    })

    expect(normalizeStatement(command)).toEqual('find products {category: ?}')
  })
})
