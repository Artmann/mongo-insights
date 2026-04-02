# Contributing

## Prerequisites

- [Bun](https://bun.sh) runtime

## Getting Started

```bash
git clone https://github.com/Artmann/mongo-insights.git

cd mongo-insights

bun install
```

Create a `.env` file in the project root:

```
DATABASE_URL=mongodb+srv://user:password@cluster.example.com
AWS_ACCESS_KEY=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
BUCKET_NAME=mongo-insights-dev
BUCKET_REGION=eu-north-1
```

Start the dev server:

```bash
bun dev
```

This starts the Hono API server with hot reload and a Vite dev server for the
frontend with HMR.

## Commands

| Command         | Description                      |
| --------------- | -------------------------------- |
| `bun dev`       | Start dev server with hot reload |
| `bun test`      | Run tests                        |
| `bun typecheck` | TypeScript type checking         |
| `bun lint`      | Lint with ESLint                 |
| `bun format`    | Format code with Prettier        |

## Code Style

See [CODE_STYLE.md](CODE_STYLE.md) for the full guide. The highlights:

- Single quotes, no semicolons.
- Use full words as variable names (`request` not `req`).
- No `CONSTANT_CASE` — this is not Java.
- Use blank lines to separate logical groups in function bodies.
- Put test files next to the implementation.

## Tech Stack

- **Runtime:** Bun
- **API:** Hono
- **Frontend:** React 19, Vite, TailwindCSS, Recharts, shadcn/ui
- **Analytics:** DuckDB (in-process), Apache Arrow, Parquet
- **Storage:** AWS S3
- **Database:** MongoDB

## Architecture

```
MongoDB (system.profile) → Collector → S3 (Parquet) → DuckDB → API → React SPA
```

The **collector** (`src/collector/`) polls each MongoDB database's
`system.profile` collection every 30 seconds. New profiling entries are
serialized to Parquet using Apache Arrow and uploaded as daily files to S3.
Concurrent writes are handled with ETag-based optimistic concurrency.

The **API** (`src/api/`) loads Parquet files from S3 into DuckDB in-memory
tables and runs SQL queries for aggregations like latency percentiles, query
grouping, and time series.

The **frontend** (`src/app/`) is a React SPA. In production, Hono serves the
static build from `dist/client/`. In development, Vite runs as a subprocess and
Hono proxies non-API requests to it.

## Project Structure

```
src/
  index.ts            # Entry point, Hono server setup
  db.ts               # MongoDB client singleton
  api/                # API routes
    routes/           # Endpoint handlers
    lib/              # DuckDB setup, profile fetching
  app/                # React frontend
    components/       # UI components (charts, tables, command palette)
    hooks/            # React Query hooks
    routes/           # Page components
  collector/          # Background profiling data collector
    buffer.ts         # In-memory document buffer
    storage.ts        # S3 upload/download, Parquet serialization
  lib/                # Shared utilities
```
