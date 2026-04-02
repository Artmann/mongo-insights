# mongo-insights

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Artmann/mongo-insights/actions/workflows/ci.yml/badge.svg)](https://github.com/Artmann/mongo-insights/actions/workflows/ci.yml)

A
[PlanetScale Insights](https://planetscale.com/docs/concepts/query-insights)-style
dashboard for MongoDB. Identify slow queries, track latency percentiles, and
understand your database performance at a glance.

<!-- ![Dashboard screenshot](docs/screenshot.png) -->

## 🤔 Why mongo-insights?

Most MongoDB monitoring tools are either expensive, complex to set up, or both.
mongo-insights is a lightweight, self-hosted dashboard that's easy to deploy —
it just needs a MongoDB connection and an S3 bucket.

There's no external database to manage. Profiling data is stored as compressed
Parquet files on S3 and queried in-process using DuckDB.

## ✨ Features

- Real-time query profiling collection (polls every 30 seconds)
- P50 and P99 latency charts over time
- Query normalization and grouping by shape
- Multi-database support with automatic discovery
- Time range filtering (1 hour to 7 days)
- Command palette for quick navigation (Cmd+K)

## 🚀 Quick Start

```bash
docker run -d \
  -e DATABASE_URL='mongodb+srv://user:password@cluster.example.com' \
  -e AWS_ACCESS_KEY='your-access-key' \
  -e AWS_SECRET_ACCESS_KEY='your-secret-key' \
  -p 4280:4280 \
  ghcr.io/artmann/mongo-insights
```

Then open [http://localhost:4280](http://localhost:4280).

## ⚙️ Environment Variables

| Variable                | Description               | Default          |
| ----------------------- | ------------------------- | ---------------- |
| `DATABASE_URL`          | MongoDB connection string | Required         |
| `AWS_ACCESS_KEY`        | S3 access key             | Required         |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key             | Required         |
| `BUCKET_NAME`           | S3 bucket name            | `mongo-insights` |
| `BUCKET_REGION`         | S3 bucket region          | `eu-north-1`     |
| `PORT`                  | Server port               | `4280`           |

## 🔍 Enable MongoDB Profiling

mongo-insights reads from MongoDB's built-in `system.profile` collection. You
need to enable profiling on each database you want to monitor.

Connect to your MongoDB instance and run:

```js
use myDatabase

// Level 1: log queries slower than 100ms (recommended)
db.setProfilingLevel(1)

// Level 2: log all queries
db.setProfilingLevel(2)
```

Profiling is configured per database. Repeat for each database you want to
monitor. mongo-insights will automatically discover databases that have
profiling enabled.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## 📄 License

[MIT](LICENSE)
