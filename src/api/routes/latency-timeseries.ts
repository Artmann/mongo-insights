import dayjs from 'dayjs'
import { Hono } from 'hono'

import {
  cleanup,
  getDateRange,
  loadProfiles,
  queryRows
} from '../lib/fetch-profiles.ts'

const latencyTimeseries = new Hono()

function computeInterval(timeRange: number, rowCount: number): number {
  const targetBuckets = Math.min(50, Math.max(10, Math.floor(rowCount / 5)))

  return Math.ceil(timeRange / targetBuckets)
}

latencyTimeseries.post('/', async (context) => {
  const body = await context.req.json()

  const database = body.database as string
  const timeRange = (body.timeRange ?? 86400) as number

  if (!database) {
    return context.json({ error: 'database is required' }, 400)
  }

  const dates = getDateRange(timeRange)
  const tableName = await loadProfiles(database, dates)

  try {
    const cutoff = dayjs().subtract(timeRange, 'second').toISOString()

    const countResult = await queryRows(`
      SELECT COUNT(*)::INTEGER AS cnt
      FROM ${tableName}
      WHERE ts >= '${cutoff}'
    `)

    const rowCount = (countResult[0]?.cnt as number) ?? 0

    if (rowCount === 0) {
      return context.json({ buckets: [] })
    }

    const interval = computeInterval(timeRange, rowCount)

    const buckets = await queryRows(`
      SELECT
        time_bucket(INTERVAL '${interval} seconds', ts::TIMESTAMP)::VARCHAR AS "time",
        PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY millis)::INTEGER AS "p50",
        PERCENTILE_DISC(0.99) WITHIN GROUP (ORDER BY millis)::INTEGER AS "p99"
      FROM ${tableName}
      WHERE ts >= '${cutoff}'
      GROUP BY 1
      ORDER BY 1
    `)

    return context.json({ buckets })
  } finally {
    await cleanup(tableName)
  }
})

export default latencyTimeseries
