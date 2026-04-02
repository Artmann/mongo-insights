import { useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { Circle, Table2 } from 'lucide-react'

import { BallChart } from '@/components/ball-chart'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { LatencyChart } from '@/components/latency-chart'
import { QueriesTable } from '@/components/queries-table'
import {
  TimeRangeSelector,
  timeRangeLabel,
  useTimeRange
} from '@/components/time-range-selector'
import { useDatabases } from '@/hooks/use-databases'
import { setLastDatabase } from '@/lib/last-database'

function BarChartIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line
        x1="12"
        x2="12"
        y1="20"
        y2="10"
      />
      <line
        x1="18"
        x2="18"
        y1="20"
        y2="4"
      />
      <line
        x1="6"
        x2="6"
        y1="20"
        y2="16"
      />
    </svg>
  )
}

export function DatabasePage() {
  const { databaseName } = useParams()
  const { data } = useDatabases()
  const [viewMode, setViewMode] = useState<'ball' | 'table'>('table')

  const database = data?.databases.find(
    (candidate) => candidate.name === databaseName
  )
  const timeRange = useTimeRange()

  useEffect(() => {
    if (databaseName) {
      setLastDatabase(databaseName)
    }
  }, [databaseName])

  if (database && !database.profilingEnabled) {
    return (
      <Empty className="min-h-[calc(100vh-12rem)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BarChartIcon />
          </EmptyMedia>

          <EmptyTitle>Profiling is not enabled</EmptyTitle>

          <EmptyDescription>
            Enable profiling for{' '}
            <span className="font-medium text-foreground">{databaseName}</span>{' '}
            to start collecting query insights.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <pre className="w-full rounded-lg bg-muted px-6 py-4 text-left text-sm">
            {`use ${databaseName ?? ''}\ndb.setProfilingLevel(1)`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Logs queries slower than 100ms. Use level 2 to log all queries.
          </p>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Insights</h1>

        <TimeRangeSelector />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Query latency</h2>

        <div className="mt-4">
          <LatencyChart
            database={databaseName ?? ''}
            timeRange={timeRange}
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            Queries in the last {timeRangeLabel(timeRange)}
          </h2>

          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="size-3.5" />
            </Button>

            <Button
              variant={viewMode === 'ball' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              onClick={() => setViewMode('ball')}
            >
              <Circle className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {viewMode === 'table' ? (
            <QueriesTable
              database={databaseName ?? ''}
              timeRange={timeRange}
            />
          ) : (
            <BallChart
              database={databaseName ?? ''}
              timeRange={timeRange}
            />
          )}
        </div>
      </section>
    </div>
  )
}
