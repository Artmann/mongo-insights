import { MongoClient } from 'mongodb'
import invariant from 'tiny-invariant'
import { log } from 'tiny-typescript-logger'

let client: MongoClient | null = null

export async function getClient(): Promise<MongoClient> {
  if (!client) {
    const url = process.env.DATABASE_URL

    invariant(url, 'DATABASE_URL is not set')

    client = new MongoClient(url)
  }

  await client.connect()

  log.debug('MongoDB client connected')

  return client
}
