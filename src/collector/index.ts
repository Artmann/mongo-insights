import { MongoClient } from 'mongodb'
import { uploadProfiles } from './storage.ts'

const POLL_INTERVAL_MS = 30_000
const PROFILE_LIMIT = 100
const SYSTEM_DBS = ['admin', 'local', 'config']

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
  } catch (err) {
    console.error('[collector] Failed to connect:', err)
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

  await poll(client, profilable)
  setInterval(() => poll(client, profilable), POLL_INTERVAL_MS)
}

async function listDatabases(client: MongoClient): Promise<string[]> {
  const admin = client.db('admin')
  const result = await admin.command({ listDatabases: 1, nameOnly: true })
  return (result.databases as { name: string }[])
    .map((d) => d.name)
    .filter((name) => !SYSTEM_DBS.includes(name))
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
        // Check if there's existing profile data even if profiling is currently off
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
    } catch (err) {
      console.error(
        `[collector]   ${dbName}: failed to check profiling status:`,
        err
      )
    }
  }

  return enabled
}

async function poll(client: MongoClient, databases: string[]) {
  for (const dbName of databases) {
    try {
      await collectProfiles(client, dbName)
    } catch (err) {
      console.error(`[collector] Error polling ${dbName}:`, err)
    }
  }
}

async function collectProfiles(client: MongoClient, dbName: string) {
  const db = client.db(dbName)
  const filter = lastSeenTs.has(dbName)
    ? { ts: { $gt: lastSeenTs.get(dbName) } }
    : {}

  const profiles = await db
    .collection('system.profile')
    .find(filter)
    .sort({ ts: -1 })
    .limit(PROFILE_LIMIT)
    .toArray()

  if (profiles.length === 0) {
    return
  }

  // Update last seen timestamp
  const newest = profiles[0]?.ts
  if (newest) {
    lastSeenTs.set(dbName, new Date(newest))
  }

  console.log(`[collector] ${dbName} — ${profiles.length} new profile entries`)

  // Upload to S3
  try {
    await uploadProfiles(dbName, profiles)
  } catch (err) {
    console.error(`[collector] Failed to upload profiles for ${dbName}:`, err)
  }
}
