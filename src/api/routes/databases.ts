import { Hono } from 'hono'

import { getClient } from '../../db.ts'
import { systemDatabases } from '../../lib/system-databases.ts'

const databases = new Hono()

databases.get('/', async (context) => {
  const client = await getClient()
  const admin = client.db('admin')
  const result = await admin.command({ listDatabases: 1, nameOnly: true })

  const names = (result.databases as { name: string }[])
    .map((database) => database.name)
    .filter((name) => !systemDatabases.includes(name))

  const entries = await Promise.all(
    names.map(async (name) => {
      try {
        const db = client.db(name)
        const status = await db.command({ profile: -1 })
        const level = status.was as number

        return { name, profilingEnabled: level === 1 || level === 2 }
      } catch {
        return { name, profilingEnabled: false }
      }
    })
  )

  entries.sort((a, b) => {
    if (a.profilingEnabled !== b.profilingEnabled) {
      return a.profilingEnabled ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })

  return context.json({ databases: entries })
})

export default databases
