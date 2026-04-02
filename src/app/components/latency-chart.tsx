import dayjs from 'dayjs'
import { BarChart3 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useLatencyTimeseries } from '@/hooks/use-latency-timeseries'

const chartConfig = {
  p50: {
    label: 'p50 latency',
    color: 'var(--chart-1)'
  },
  p99: {
    label: 'p99 latency',
    color: 'var(--chart-2)'
  }
} satisfies ChartConfig

function formatTime(isoString: string, timeRange: number): string {
  const date = dayjs(isoString)

  if (timeRange <= 86400) {
    return date.format('HH:mm')
  }

  return date.format('MMM D, HH:mm')
}

interface LatencyChartProps {
  database: string
  timeRange: number
}

export function LatencyChart({ database, timeRange }: LatencyChartProps) {
  const { data, isLoading } = useLatencyTimeseries({ database, timeRange })

  const buckets = data?.buckets ?? []

  if (isLoading) {
    return (
      <div className="flex h-[200px] flex-col gap-3 pt-3 sm:h-[300px]">
        <div className="flex flex-1 items-end gap-2 px-12">
          <Skeleton className="h-[60%] flex-1" />
          <Skeleton className="h-[80%] flex-1" />
          <Skeleton className="h-[45%] flex-1" />
          <Skeleton className="h-[70%] flex-1" />
          <Skeleton className="h-[55%] flex-1" />
          <Skeleton className="h-[90%] flex-1" />
          <Skeleton className="h-[65%] flex-1" />
          <Skeleton className="h-[50%] flex-1" />
        </div>

        <Skeleton className="mx-12 h-4" />
      </div>
    )
  }

  if (buckets.length === 0) {
    return (
      <Empty className="h-[200px] sm:h-[300px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BarChart3 />
          </EmptyMedia>

          <EmptyTitle>No latency data available</EmptyTitle>

          <EmptyDescription>
            Try selecting a wider time range, or make sure queries are being
            executed against this database.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[200px] w-full sm:h-[300px]"
    >
      <LineChart
        data={buckets}
        margin={{ left: 12, right: 12, top: 12 }}
      >
        <CartesianGrid vertical={false} />

        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => formatTime(value, timeRange)}
        />

        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value}ms`}
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatTime(value, timeRange)}
              formatter={(value, name) => {
                const config = chartConfig[name as keyof typeof chartConfig]

                return (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: config?.color }}
                    />
                    <span className="text-muted-foreground">
                      {config?.label}
                    </span>
                    <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                      {value}ms
                    </span>
                  </div>
                )
              }}
            />
          }
        />

        <ChartLegend content={<ChartLegendContent />} />

        <Line
          dataKey="p50"
          type="monotone"
          stroke="var(--color-p50)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />

        <Line
          dataKey="p99"
          type="monotone"
          stroke="var(--color-p99)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  )
}
