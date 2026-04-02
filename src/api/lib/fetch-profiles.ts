import dayjs from 'dayjs'

export { queryRows } from './duckdb.ts'

export function getDateRange(timeRangeSeconds: number): string[] {
  const days = Math.ceil(timeRangeSeconds / 86400)
  const dates: string[] = []

  for (let i = 0; i < days; i++) {
    dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }

  return dates
}
