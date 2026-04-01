import dayjs from 'dayjs'

import { downloadProfiles } from '../collector/storage.ts'

const database = process.argv[2]
const date = process.argv[3] ?? dayjs().format('YYYY-MM-DD')

if (!database) {
  console.error('Usage: bun src/cli/list-queries.ts <database> [date]')
  console.error('  date defaults to today (YYYY-MM-DD)')
  process.exit(1)
}

const { rows } = await downloadProfiles(database, date)

if (rows.length === 0) {
  console.log(`No queries found for ${database} on ${date}.`)
  process.exit(0)
}

console.log(`Found ${rows.length} queries for ${database} on ${date}:\n`)

let totalMillis = 0

for (const row of rows) {
  const timestamp = dayjs(row.ts).format('HH:mm:ss')

  console.log(`[${timestamp}] ${row.millis}ms ${row.ns} ${row.op}`)
  console.log(`  ${row.command}`)
  console.log(
    `  plan: ${row.planSummary}  docs: ${row.docsExamined} read, ${row.nreturned} returned`
  )
  console.log()

  totalMillis += row.millis
}

const millis = rows.map((row) => row.millis).sort((a, b) => a - b)
const p50 = millis[Math.ceil(millis.length * 0.5) - 1] ?? 0
const p99 = millis[Math.ceil(millis.length * 0.99) - 1] ?? 0

console.log('---')
console.log(
  `Total: ${rows.length} queries, ${(totalMillis / 1000).toFixed(2)}s total time`
)
console.log(`Latency: p50 ${p50}ms, p99 ${p99}ms`)
