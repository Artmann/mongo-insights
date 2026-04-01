import { SearchX } from 'lucide-react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useQueries } from '@/hooks/use-queries'

const ballColors = [
  'oklch(0.65 0.2 25)',
  'oklch(0.65 0.2 145)',
  'oklch(0.65 0.2 265)',
  'oklch(0.7 0.15 55)',
  'oklch(0.6 0.2 305)',
  'oklch(0.65 0.2 185)',
  'oklch(0.7 0.18 85)',
  'oklch(0.6 0.2 345)',
  'oklch(0.55 0.15 225)',
  'oklch(0.7 0.12 115)'
]

function computeAnimationDuration(
  p99: number,
  minimumP99: number,
  maximumP99: number
): number {
  if (maximumP99 === minimumP99) {
    return 6
  }

  const minimumDuration = 3
  const maximumDuration = 12
  const ratio = (p99 - minimumP99) / (maximumP99 - minimumP99)

  return minimumDuration + ratio * (maximumDuration - minimumDuration)
}

function formatLatency(milliseconds: number): string {
  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  }

  return `${Math.round(milliseconds)}ms`
}

interface BallChartProps {
  database: string
  timeRange: number
}

export function BallChart({ database, timeRange }: BallChartProps) {
  const { data, isLoading } = useQueries({
    database,
    page: 1,
    pageSize: 25,
    sortBy: 'p99Latency',
    sortDirection: 'desc',
    timeRange
  })

  const queries = data?.queries ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b py-3"
          >
            <div className="w-2/5 shrink-0 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-16" />
            </div>

            <div className="h-6 flex-1">
              <Skeleton className="h-full w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (queries.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>

          <EmptyTitle>No queries recorded</EmptyTitle>

          <EmptyDescription>
            No queries were found in this time range. Try selecting a wider
            range or verify that profiling is enabled.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const minimumP99 = Math.min(...queries.map((query) => query.p99Latency))
  const maximumP99 = Math.max(...queries.map((query) => query.p99Latency))

  return (
    <div className="space-y-1">
      {queries.map((query, index) => {
        const duration = computeAnimationDuration(
          query.p99Latency,
          minimumP99,
          maximumP99
        )

        return (
          <div
            key={index}
            className="flex items-center gap-4 border-b py-3"
          >
            <div className="w-2/5 shrink-0">
              <p className="truncate font-mono text-xs">
                {query.normalizedStatement}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                p99: {formatLatency(query.p99Latency)}
              </p>
            </div>

            <div
              className="flex flex-1 items-center"
              style={{ containerType: 'inline-size' }}
            >
              <div
                className="size-4 rounded-full"
                style={{
                  animation: `ball-bounce ${duration}s ease-in-out infinite`,
                  backgroundColor: ballColors[index % ballColors.length]
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
