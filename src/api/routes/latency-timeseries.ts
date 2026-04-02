import dayjs from 'dayjs'
import { Hono } from 'hono'

import { queryRows } from '../lib/fetch-profiles.ts'

const latencyTimeseries = new Hono()

function computeInterval(timeRange: number, rowCount: number): number {
  const targetBuckets =
    rowCount === 0 ? 20 : Math.min(50, Math.max(10, Math.floor(rowCount / 5)))

  return Math.ceil(timeRange / targetBuckets)
}

latencyTimeseries.post('/', async (context) => {
  const body = await context.req.json()

  const database = body.database as string
  const timeRange = (body.timeRange ?? 86400) as number

  if (!database) {
    return context.json({ error: 'database is required' }, 400)
  }

  const cutoff = dayjs().subtract(timeRange, 'second').toISOString()

  const countResult = await queryRows(`
    SELECT COUNT(*)::INTEGER AS cnt
    FROM profiles
    WHERE database = '${database}' AND ts >= '${cutoff}'
  `)

  const rowCount = (countResult[0]?.cnt as number) ?? 0
  const interval = computeInterval(timeRange, rowCount)

  const buckets = await queryRows(`
    WITH data AS (
      SELECT
        time_bucket(INTERVAL '${interval} seconds', ts::TIMESTAMP) AS bucket,
        PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY millis)::INTEGER AS "p50",
        PERCENTILE_DISC(0.99) WITHIN GROUP (ORDER BY millis)::INTEGER AS "p99"
      FROM profiles
      WHERE database = '${database}' AND ts >= '${cutoff}'
      GROUP BY 1
    ),
    series AS (
      SELECT unnest(generate_series(
        time_bucket(INTERVAL '${interval} seconds', '${cutoff}'::TIMESTAMP),
        time_bucket(INTERVAL '${interval} seconds', NOW()::TIMESTAMP),
        INTERVAL '${interval} seconds'
      )) AS bucket
    )
    SELECT
      s.bucket::VARCHAR AS "time",
      d."p50",
      d."p99"
    FROM series s
    LEFT JOIN data d ON s.bucket = d.bucket
    ORDER BY s.bucket
  `)

  return context.json({ buckets })
})

export default latencyTimeseries
