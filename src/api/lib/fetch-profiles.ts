import dayjs from 'dayjs'

import type { ProfileRow } from '../../collector/buffer.ts'
import { downloadProfiles } from '../../collector/storage.ts'

export function getDateRange(timeRangeSeconds: number): string[] {
  const days = Math.ceil(timeRangeSeconds / 86400)
  const dates: string[] = []

  for (let i = 0; i < days; i++) {
    dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  }

  return dates
}

export async function fetchRows(
  database: string,
  dates: string[]
): Promise<ProfileRow[]> {
  const results = await Promise.all(
    dates.map((date) => downloadProfiles(database, date))
  )

  return results.flatMap((result) => result.rows)
}
