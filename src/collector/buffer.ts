import type { Document } from 'mongodb'

export type ProfileRow = {
  client: string
  command: string
  database: string
  docsExamined: number
  execStats: string
  keysExamined: number
  millis: number
  nreturned: number
  ns: string
  op: string
  planSummary: string
  queryHash: string
  responseLength: number
  ts: string
  user: string
}

const buffers = new Map<string, ProfileRow[]>()
const seen = new Map<string, Set<string>>()
const etags = new Map<string, string | null>()

function bufferKey(dbName: string, date: string): string {
  return `${dbName}:${date}`
}

function dedupKey(row: ProfileRow): string {
  return `${row.ts}|${row.ns}|${row.op}`
}

export function getEtag(dbName: string, date: string): string | null {
  return etags.get(bufferKey(dbName, date)) ?? null
}

export function setEtag(dbName: string, date: string, etag: string | null) {
  etags.set(bufferKey(dbName, date), etag)
}

export function initializeBuffer(
  dbName: string,
  date: string,
  existingRows: ProfileRow[],
  etag: string | null
) {
  const key = bufferKey(dbName, date)
  const keys = new Set<string>()

  for (const row of existingRows) {
    keys.add(dedupKey(row))
  }

  buffers.set(key, [...existingRows])
  seen.set(key, keys)
  etags.set(key, etag)

  console.log(
    `[buffer] Initialized ${dbName} for ${date} with ${existingRows.length} existing rows`
  )
}

export function addEntries(
  dbName: string,
  entries: Document[]
): { rows: ProfileRow[]; changed: boolean } {
  const date = new Date().toISOString().slice(0, 10)
  const key = bufferKey(dbName, date)

  if (!buffers.has(key)) {
    buffers.set(key, [])
    seen.set(key, new Set())
    etags.set(key, null)
  }

  const buffer = buffers.get(key)!
  const keys = seen.get(key)!
  let changed = false

  for (const entry of entries) {
    const row = toProfileRow(dbName, entry)
    const dk = dedupKey(row)

    if (!keys.has(dk)) {
      keys.add(dk)
      buffer.push(row)
      changed = true
    }
  }

  return { rows: buffer, changed }
}

function toProfileRow(dbName: string, entry: Document): ProfileRow {
  return {
    client: entry.client ?? '',
    command: safeStringify(entry.command),
    database: dbName,
    docsExamined: entry.docsExamined ?? 0,
    execStats: safeStringify(entry.execStats),
    keysExamined: entry.keysExamined ?? 0,
    millis: entry.millis ?? 0,
    nreturned: entry.nreturned ?? 0,
    ns: entry.ns ?? '',
    op: entry.op ?? '',
    planSummary: entry.planSummary ?? '',
    queryHash: entry.queryHash ?? '',
    responseLength: entry.responseLength ?? 0,
    ts: entry.ts ? new Date(entry.ts).toISOString() : '',
    user: entry.user ?? ''
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}
