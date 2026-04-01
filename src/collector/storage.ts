import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { tableToIPC, tableFromArrays, Utf8, Int32 } from 'apache-arrow'
import {
  Table as WasmTable,
  writeParquet,
  WriterPropertiesBuilder,
  Compression
} from 'parquet-wasm/node'
import type { Document } from 'mongodb'

const s3 = new S3Client({
  region: process.env.BUCKET_REGION ?? 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ''
  }
})

const bucket = process.env.BUCKET_NAME ?? 'mongo-insights-dev'

export async function uploadProfiles(dbName: string, entries: Document[]) {
  if (entries.length === 0) {
    return
  }

  const buffer = await toParquet(dbName, entries)
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const ts = now.toISOString().replace(/[:.]/g, '-')
  const key = `profiles/${dbName}/${date}/${ts}.parquet`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/octet-stream'
    })
  )

  console.log(
    `[storage] Uploaded ${key} (${entries.length} rows, ${buffer.byteLength} bytes)`
  )
}

async function toParquet(
  dbName: string,
  entries: Document[]
): Promise<Uint8Array> {
  const table = tableFromArrays({
    ts: entries.map((e) => (e.ts ? new Date(e.ts).toISOString() : '')),
    database: entries.map(() => dbName),
    op: entries.map((e) => e.op ?? ''),
    ns: entries.map((e) => e.ns ?? ''),
    millis: Int32Array.from(entries.map((e) => e.millis ?? 0)),
    planSummary: entries.map((e) => e.planSummary ?? ''),
    docsExamined: Int32Array.from(entries.map((e) => e.docsExamined ?? 0)),
    keysExamined: Int32Array.from(entries.map((e) => e.keysExamined ?? 0)),
    nreturned: Int32Array.from(entries.map((e) => e.nreturned ?? 0)),
    responseLength: Int32Array.from(entries.map((e) => e.responseLength ?? 0)),
    client: entries.map((e) => e.client ?? ''),
    user: entries.map((e) => e.user ?? ''),
    queryHash: entries.map((e) => e.queryHash ?? ''),
    command: entries.map((e) => safeStringify(e.command)),
    execStats: entries.map((e) => safeStringify(e.execStats))
  })

  const ipcStream = tableToIPC(table, 'stream')
  const wasmTable = WasmTable.fromIPCStream(ipcStream)

  const props = new WriterPropertiesBuilder()
    .setCompression(Compression.SNAPPY)
    .build()
  return writeParquet(wasmTable, props)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}
