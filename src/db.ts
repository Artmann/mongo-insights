import { MongoClient } from 'mongodb'
import invariant from 'tiny-invariant'
import { log } from 'tiny-typescript-logger'

const url = process.env.DATABASE_URL

invariant(url, 'DATABASE_URL is not set')

const client = new MongoClient(url)

export async function getClient(): Promise<MongoClient> {
  await client.connect()

  log.debug('MongoDB client connected')

  return client
}
