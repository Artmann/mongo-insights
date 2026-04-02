import { Hono } from 'hono'

import {
  cleanup,
  getDateRange,
  loadProfiles,
  queryRows
} from '../lib/fetch-profiles.ts'

const queries = new Hono()

const sortableColumns: Record<string, string> = {
  count: '"count"',
  documentsRead: '"documentsRead"',
  documentsReturned: '"documentsReturned"',
  p50Latency: '"p50Latency"',
  p99Latency: '"p99Latency"',
  percentOfRuntime: '"percentOfRuntime"',
  responseSize: '"responseSize"',
  totalTime: '"totalTime"'
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
  const tableName = await loadProfiles(database, dates)

  try {
    const sortColumn = sortableColumns[sortBy] ?? '"totalTime"'
    const direction = sortDirection === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * pageSize

    const rows = await queryRows(`
      WITH totals AS (
        SELECT COALESCE(SUM(millis), 0) AS total_runtime
        FROM ${tableName}
      )
      SELECT
        normalized_statement AS "normalizedStatement",
        CASE WHEN t.total_runtime > 0
          THEN (SUM(millis)::DOUBLE / t.total_runtime) * 100
          ELSE 0
        END AS "percentOfRuntime",
        COUNT(*)::INTEGER AS "count",
        SUM(millis)::DOUBLE / 1000 AS "totalTime",
        PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY millis)::INTEGER AS "p50Latency",
        PERCENTILE_DISC(0.99) WITHIN GROUP (ORDER BY millis)::INTEGER AS "p99Latency",
        SUM("docsExamined")::INTEGER AS "documentsRead",
        SUM(nreturned)::INTEGER AS "documentsReturned",
        MODE("planSummary") AS "planSummary",
        SUM("responseLength")::INTEGER AS "responseSize"
      FROM ${tableName}, totals t
      GROUP BY normalized_statement, t.total_runtime
      ORDER BY ${sortColumn} ${direction}
      LIMIT ${pageSize} OFFSET ${offset}
    `)

    const totalResult = await queryRows(`
      SELECT COUNT(DISTINCT normalized_statement)::INTEGER AS total
      FROM ${tableName}
    `)

    const total = (totalResult[0]?.total as number) ?? 0

    return context.json({ queries: rows, total, page, pageSize })
  } finally {
    await cleanup(tableName)
  }
})

export default queries
