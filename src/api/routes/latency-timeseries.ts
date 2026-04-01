import dayjs from 'dayjs'
import { Hono } from 'hono'

import { fetchRows, getDateRange } from '../lib/fetch-profiles.ts'

const latencyTimeseries = new Hono()

type Bucket = {
  p50: number
  p99: number
  time: string
}

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
  const rows = await fetchRows(database, dates)

  const cutoff = dayjs().subtract(timeRange, 'second')
  const filtered = rows.filter((row) => dayjs(row.ts).isAfter(cutoff))

  const interval = computeInterval(timeRange, filtered.length)
  const bucketMap = new Map<string, number[]>()

  for (const row of filtered) {
    const timestamp = dayjs(row.ts)
    const bucketTime = timestamp
      .subtract(timestamp.unix() % interval, 'second')
      .startOf('second')
      .toISOString()

    const existing = bucketMap.get(bucketTime)

    if (existing) {
      existing.push(row.millis)
    } else {
      bucketMap.set(bucketTime, [row.millis])
    }
  }

  const buckets: Bucket[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, latencies]) => {
      const sorted = latencies.sort((a, b) => a - b)

      return {
        p50: percentile(sorted, 50),
        p99: percentile(sorted, 99),
        time
      }
    })

  return context.json({ buckets })
})

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0
  }

  const index = Math.ceil((p / 100) * sorted.length) - 1

  return sorted[Math.max(0, index)] ?? 0
}

export default latencyTimeseries
