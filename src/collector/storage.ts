import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { tableFromArrays, tableFromIPC, tableToIPC } from 'apache-arrow'
import {
  Table as WasmTable,
  readParquet,
  writeParquet,
  WriterPropertiesBuilder,
  Compression
} from 'parquet-wasm/node'

import type { ProfileRow } from './buffer.ts'

const s3 = new S3Client({
  region: process.env.BUCKET_REGION ?? 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ''
  }
})

const bucket = process.env.BUCKET_NAME ?? 'mongo-insights-dev'

export function dailyKey(dbName: string, date: string): string {
  return `profiles/${dbName}/${date}/profiles.parquet`
}

export async function downloadProfiles(
  dbName: string,
  date: string
): Promise<{ rows: ProfileRow[]; etag: string | null }> {
  const key = dailyKey(dbName, date)

  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    )

    const body = await response.Body?.transformToByteArray()

    if (!body) {
      return { rows: [], etag: null }
    }

    const rows = fromParquet(body)
    const etag = response.ETag ?? null

    console.log(
      `[storage] Downloaded ${key} (${rows.length} rows, etag: ${etag})`
    )

    return { rows, etag }
  } catch (error: unknown) {
    if (isNoSuchKeyError(error)) {
      return { rows: [], etag: null }
    }

    throw error
  }
}

export async function uploadProfiles(
  dbName: string,
  date: string,
  rows: ProfileRow[],
  etag: string | null
): Promise<{ status: 'ok'; etag: string | null } | { status: 'conflict' }> {
  if (rows.length === 0) {
    return { status: 'ok', etag }
  }

  const buffer = toParquet(rows)
  const key = dailyKey(dbName, date)

  const command: ConstructorParameters<typeof PutObjectCommand>[0] = {
    Body: buffer,
    Bucket: bucket,
    ContentType: 'application/octet-stream',
    Key: key
  }

  if (etag) {
    command.IfMatch = etag
  } else {
    command.IfNoneMatch = '*'
  }

  try {
    const response = await s3.send(new PutObjectCommand(command))
    const newEtag = response.ETag ?? null

    console.log(
      `[storage] Uploaded ${key} (${rows.length} rows, ${buffer.byteLength} bytes)`
    )

    return { status: 'ok', etag: newEtag }
  } catch (error: unknown) {
    if (isPreconditionFailedError(error)) {
      console.warn(`[storage] Write conflict on ${key}, will retry`)

      return { status: 'conflict' }
    }

    throw error
  }
}

function toParquet(rows: ProfileRow[]): Uint8Array {
  const table = tableFromArrays({
    ts: rows.map((r) => r.ts),
    database: rows.map((r) => r.database),
    op: rows.map((r) => r.op),
    ns: rows.map((r) => r.ns),
    millis: Int32Array.from(rows.map((r) => r.millis)),
    planSummary: rows.map((r) => r.planSummary),
    docsExamined: Int32Array.from(rows.map((r) => r.docsExamined)),
    keysExamined: Int32Array.from(rows.map((r) => r.keysExamined)),
    nreturned: Int32Array.from(rows.map((r) => r.nreturned)),
    responseLength: Int32Array.from(rows.map((r) => r.responseLength)),
    client: rows.map((r) => r.client),
    user: rows.map((r) => r.user),
    queryHash: rows.map((r) => r.queryHash),
    command: rows.map((r) => r.command),
    execStats: rows.map((r) => r.execStats)
  })

  const ipcStream = tableToIPC(table, 'stream')
  const wasmTable = WasmTable.fromIPCStream(ipcStream)

  const props = new WriterPropertiesBuilder()
    .setCompression(Compression.SNAPPY)
    .build()

  return writeParquet(wasmTable, props)
}

function fromParquet(data: Uint8Array): ProfileRow[] {
  const wasmTable = readParquet(data)
  const ipcStream = wasmTable.intoIPCStream()
  const table = tableFromIPC(ipcStream)

  const rows: ProfileRow[] = []

  for (let i = 0; i < table.numRows; i++) {
    rows.push({
      client: String(table.getChild('client')?.get(i) ?? ''),
      command: String(table.getChild('command')?.get(i) ?? ''),
      database: String(table.getChild('database')?.get(i) ?? ''),
      docsExamined: Number(table.getChild('docsExamined')?.get(i) ?? 0),
      execStats: String(table.getChild('execStats')?.get(i) ?? ''),
      keysExamined: Number(table.getChild('keysExamined')?.get(i) ?? 0),
      millis: Number(table.getChild('millis')?.get(i) ?? 0),
      nreturned: Number(table.getChild('nreturned')?.get(i) ?? 0),
      ns: String(table.getChild('ns')?.get(i) ?? ''),
      op: String(table.getChild('op')?.get(i) ?? ''),
      planSummary: String(table.getChild('planSummary')?.get(i) ?? ''),
      queryHash: String(table.getChild('queryHash')?.get(i) ?? ''),
      responseLength: Number(table.getChild('responseLength')?.get(i) ?? 0),
      ts: String(table.getChild('ts')?.get(i) ?? ''),
      user: String(table.getChild('user')?.get(i) ?? '')
    })
  }

  return rows
}

function isNoSuchKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'NoSuchKey'
  )
}

function isPreconditionFailedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    '$metadata' in error &&
    (error as { $metadata: { httpStatusCode?: number } }).$metadata
      .httpStatusCode === 412
  )
}
