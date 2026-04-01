import dayjs from 'dayjs'
import { Hono } from 'hono'

import type { ProfileRow } from '../../collector/buffer.ts'
import { downloadProfiles } from '../../collector/storage.ts'
import { normalizeStatement } from '../normalize-statement.ts'

const queries = new Hono()

type QueryStats = {
  normalizedStatement: string
  percentOfRuntime: number
  count: number
  totalTime: number
  p50Latency: number
  p99Latency: number
  documentsRead: number
  documentsReturned: number
  planSummary: string
  responseSize: number
}

queries.post('/', async (context) => {
  const body = await context.req.json()

  const database = body.database as string
  const timeRange = (body.timeRange as number) ?? 86400
  const page = (body.page as number) ?? 1
  const pageSize = (body.pageSize as number) ?? 25

  if (!database) {
    return context.json({ error: 'database is required' }, 400)
  }

  const dates = getDateRange(timeRange)
  const rows = await fetchRows(database, dates)

  const grouped = groupByQueryShape(rows)
  const totalRuntime = rows.reduce((sum, row) => sum + row.millis, 0)

  const aggregated = Array.from(grouped.entries())
    .map(([key, group]) => aggregate(key, group, totalRuntime))
    .sort((a, b) => b.totalTime - a.totalTime)

  const total = aggregated.length
  const start = (page - 1) * pageSize
  const paged = aggregated.slice(start, start + pageSize)

  return context.json({ queries: paged, total, page, pageSize })
})

function getDateRange(timeRangeSeconds: number): string[] {
  const days = Math.ceil(timeRangeSeconds / 86400)
  const dates: string[] = []

  for (let i = 0; i < days; i++) {
    dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }

  return dates
}

async function fetchRows(
  database: string,
  dates: string[]
): Promise<ProfileRow[]> {
  const results = await Promise.all(
    dates.map((date) => downloadProfiles(database, date))
  )

  return results.flatMap((result) => result.rows)
}

function groupByQueryShape(rows: ProfileRow[]): Map<string, ProfileRow[]> {
  const groups = new Map<string, ProfileRow[]>()

  for (const row of rows) {
    const key = row.queryHash || normalizeStatement(row.command)
    const group = groups.get(key)

    if (group) {
      group.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  return groups
}

function aggregate(
  key: string,
  rows: ProfileRow[],
  totalRuntime: number
): QueryStats {
  const millis = rows.map((row) => row.millis).sort((a, b) => a - b)
  const totalMillis = millis.reduce((sum, ms) => sum + ms, 0)

  return {
    normalizedStatement: normalizeStatement(rows[0]?.command ?? ''),
    percentOfRuntime: totalRuntime > 0 ? (totalMillis / totalRuntime) * 100 : 0,
    count: rows.length,
    totalTime: totalMillis / 1000,
    p50Latency: percentile(millis, 50),
    p99Latency: percentile(millis, 99),
    documentsRead: rows.reduce((sum, row) => sum + row.docsExamined, 0),
    documentsReturned: rows.reduce((sum, row) => sum + row.nreturned, 0),
    planSummary: mostCommon(rows.map((row) => row.planSummary)),
    responseSize: rows.reduce((sum, row) => sum + row.responseLength, 0)
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0
  }

  const index = Math.ceil((p / 100) * sorted.length) - 1

  return sorted[Math.max(0, index)] ?? 0
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  let best = ''
  let bestCount = 0

  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }

  return best
}

export default queries
