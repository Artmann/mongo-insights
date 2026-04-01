# Collector

Connects to a MongoDB instance, discovers databases with profiling enabled, and
periodically collects `system.profile` entries. Results are written to S3 as
Parquet files.

## Configuration

| Env var                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `DATABASE_URL`          | MongoDB connection string                      |
| `AWS_ACCESS_KEY`        | AWS access key for S3                          |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3                          |
| `BUCKET_NAME`           | S3 bucket name (default: `mongo-insights-dev`) |
| `BUCKET_REGION`         | S3 bucket region (default: `eu-north-1`)       |

## How it works

1. Connects to MongoDB and lists all non-system databases
2. Checks each database's profiling status via `db.command({ profile: -1 })`
3. Includes databases with profiling enabled (level 1 or 2) or existing
   historical data
4. Polls `system.profile` every 30 seconds, fetching only entries newer than the
   last seen timestamp

## S3 file structure

```
s3://{bucket}/
  profiles/
    {database}/
      {YYYY-MM-DD}/
        {ISO-timestamp}.parquet
```

Example:
`profiles/gustavs-kitchen-production/2026-04-01/2026-04-01T11-40-05-965Z.parquet`

## Parquet schema

| Column           | Type              | Description                                          |
| ---------------- | ----------------- | ---------------------------------------------------- |
| `ts`             | string (ISO 8601) | When the operation was profiled                      |
| `database`       | string            | Database name                                        |
| `op`             | string            | Operation type (`query`, `getmore`, `command`, etc.) |
| `ns`             | string            | Namespace (`database.collection`)                    |
| `millis`         | int32             | Execution time in milliseconds                       |
| `planSummary`    | string            | Query plan (`COLLSCAN`, `IXSCAN { field: 1 }`, etc.) |
| `docsExamined`   | int32             | Number of documents scanned                          |
| `keysExamined`   | int32             | Number of index keys scanned                         |
| `nreturned`      | int32             | Number of documents returned                         |
| `responseLength` | int32             | Response size in bytes                               |
| `client`         | string            | Client IP address                                    |
| `user`           | string            | Authenticated user (e.g. `pmkin@admin`)              |
| `queryHash`      | string            | Hash identifying the query shape                     |
| `command`        | string (JSON)     | Full command document                                |
| `execStats`      | string (JSON)     | Execution statistics tree                            |
