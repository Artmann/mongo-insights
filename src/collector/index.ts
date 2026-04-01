import { MongoClient } from 'mongodb'

import { addEntries, getEtag, initializeBuffer, setEtag } from './buffer.ts'
import { downloadProfiles, uploadProfiles } from './storage.ts'

const pollInterval = 30_000
const profileLimit = 100
const systemDatabases = ['admin', 'local', 'config']

const lastSeenTs = new Map<string, Date>()

export async function startCollector() {
  const url = process.env.DATABASE_URL

  if (!url) {
    console.error('[collector] DATABASE_URL not set, skipping')

    return
  }

  const client = new MongoClient(url)

  try {
    await client.connect()
    console.log('[collector] Connected to MongoDB')
  } catch (error) {
    console.error('[collector] Failed to connect:', error)

    return
  }

  const allDatabases = await listDatabases(client)

  console.log(
    `[collector] Found ${allDatabases.length} databases: ${allDatabases.join(', ')}`
  )

  const profilable = await filterByProfilingStatus(client, allDatabases)

  if (profilable.length === 0) {
    console.log('[collector] No databases have profiling enabled')

    return
  }

  const today = new Date().toISOString().slice(0, 10)

  for (const dbName of profilable) {
    const { rows, etag } = await downloadProfiles(dbName, today)

    initializeBuffer(dbName, today, rows, etag)
  }

  await poll(client, profilable)
  setInterval(() => poll(client, profilable), pollInterval)
}

async function listDatabases(client: MongoClient): Promise<string[]> {
  const admin = client.db('admin')
  const result = await admin.command({ listDatabases: 1, nameOnly: true })

  return (result.databases as { name: string }[])
    .map((d) => d.name)
    .filter((name) => !systemDatabases.includes(name))
}

async function filterByProfilingStatus(
  client: MongoClient,
  databases: string[]
): Promise<string[]> {
  const enabled: string[] = []

  for (const dbName of databases) {
    try {
      const db = client.db(dbName)
      const status = await db.command({ profile: -1 })
      const level = status.was as number
      const slowms = status.slowms as number

      if (level === 1) {
        console.log(
          `[collector]   ${dbName}: profiling SLOW OPS (>${slowms}ms)`
        )
        enabled.push(dbName)
      } else if (level === 2) {
        console.log(`[collector]   ${dbName}: profiling ALL OPS`)
        enabled.push(dbName)
      } else {
        const hasData = await db
          .collection('system.profile')
          .countDocuments({}, { limit: 1 })

        if (hasData > 0) {
          console.log(
            `[collector]   ${dbName}: profiling OFF (has historical data)`
          )
          enabled.push(dbName)
        } else {
          console.log(`[collector]   ${dbName}: profiling OFF`)
        }
      }
    } catch (error) {
      console.error(
        `[collector]   ${dbName}: failed to check profiling status:`,
        error
      )
    }
  }

  return enabled
}

async function poll(client: MongoClient, databases: string[]) {
  for (const dbName of databases) {
    try {
      await collectProfiles(client, dbName)
    } catch (error) {
      console.error(`[collector] Error polling ${dbName}:`, error)
    }
  }
}

async function collectProfiles(client: MongoClient, dbName: string) {
  const db = client.db(dbName)
  const date = new Date().toISOString().slice(0, 10)

  const filter = lastSeenTs.has(dbName)
    ? { ts: { $gt: lastSeenTs.get(dbName) } }
    : {}

  const profiles = await db
    .collection('system.profile')
    .find(filter)
    .sort({ ts: -1 })
    .limit(profileLimit)
    .toArray()

  if (profiles.length === 0) {
    return
  }

  const newest = profiles[0]?.ts

  if (newest) {
    lastSeenTs.set(dbName, new Date(newest))
  }

  console.log(`[collector] ${dbName} — ${profiles.length} new profile entries`)

  const { rows, changed } = addEntries(dbName, profiles)

  if (!changed) {
    return
  }

  const etag = getEtag(dbName, date)
  const result = await uploadProfiles(dbName, date, rows, etag)

  if (result.status === 'ok') {
    setEtag(dbName, date, result.etag)

    return
  }

  const { rows: freshRows, etag: freshEtag } = await downloadProfiles(
    dbName,
    date
  )

  initializeBuffer(dbName, date, freshRows, freshEtag)

  const merged = addEntries(dbName, profiles)

  if (merged.changed) {
    const retryEtag = getEtag(dbName, date)
    const retryResult = await uploadProfiles(
      dbName,
      date,
      merged.rows,
      retryEtag
    )

    if (retryResult.status === 'ok') {
      setEtag(dbName, date, retryResult.etag)
    }
  }
}
