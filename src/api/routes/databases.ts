import { Hono } from 'hono'
import { MongoClient } from 'mongodb'
import invariant from 'tiny-invariant'

const databases = new Hono()

const systemDatabases = ['admin', 'config', 'local']

databases.get('/', async (context) => {
  const url = process.env.DATABASE_URL

  invariant(url, 'DATABASE_URL is not set')

  const client = new MongoClient(url)

  try {
    await client.connect()

    const admin = client.db('admin')
    const result = await admin.command({ listDatabases: 1, nameOnly: true })

    const names = (result.databases as { name: string }[])
      .map((database) => database.name)
      .filter((name) => !systemDatabases.includes(name))
      .sort()

    return context.json({ databases: names })
  } finally {
    await client.close()
  }
})

export default databases
