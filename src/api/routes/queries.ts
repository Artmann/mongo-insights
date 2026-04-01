import { Hono } from 'hono'

import type { ProfileRow } from '../../collector/buffer.ts'
import { percentile } from '../../lib/percentile.ts'
import { fetchRows, getDateRange } from '../lib/fetch-profiles.ts'
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
  const timeRange = (body.timeRange ?? 86400) as number
  const page = (body.page ?? 1) as number
  const pageSize = (body.pageSize ?? 25) as number
  const sortBy = (body.sortBy ?? 'totalTime') as string
  const sortDirection = (body.sortDirection ?? 'desc') as string

  if (!database) {
    return context.json({ error: 'database is required' }, 400)
  }

  const dates = getDateRange(timeRange)
  const rows = await fetchRows(database, dates)

  const grouped = groupByQueryShape(rows)
  const totalRuntime = rows.reduce((sum, row) => sum + row.millis, 0)

  const sortableKeys: (keyof QueryStats)[] = [
    'count',
    'documentsRead',
    'documentsReturned',
    'p50Latency',
    'p99Latency',
    'percentOfRuntime',
    'responseSize',
    'totalTime'
  ]

  const sortKey = sortableKeys.includes(sortBy as keyof QueryStats)
    ? (sortBy as keyof QueryStats)
    : 'totalTime'

  const direction = sortDirection === 'asc' ? 1 : -1

  const aggregated = Array.from(grouped.entries())
    .map(([key, group]) => aggregate(key, group, totalRuntime))
    .sort(
      (a, b) => direction * ((a[sortKey] as number) - (b[sortKey] as number))
    )

  const total = aggregated.length
  const start = (page - 1) * pageSize
  const paged = aggregated.slice(start, start + pageSize)

  return context.json({ queries: paged, total, page, pageSize })
})

function groupByQueryShape(rows: ProfileRow[]): Map<string, ProfileRow[]> {
  const groups = new Map<string, ProfileRow[]>()

  for (const row of rows) {
    const key = normalizeStatement(row.command)
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
