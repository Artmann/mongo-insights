import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  TriangleAlert
} from 'lucide-react'
import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useQueries, type SortDirection } from '@/hooks/use-queries'

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function formatTime(seconds: number): string {
  if (seconds < 1) {
    return '< 1'
  }

  return formatNumber(Math.round(seconds))
}

type SortKey =
  | 'count'
  | 'documentsRead'
  | 'documentsReturned'
  | 'p50Latency'
  | 'p99Latency'
  | 'percentOfRuntime'
  | 'totalTime'

function SortIcon({
  active,
  direction
}: {
  active: boolean
  direction: SortDirection
}) {
  if (!active) {
    return <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
  }

  if (direction === 'asc') {
    return <ArrowUp className="size-3.5" />
  }

  return <ArrowDown className="size-3.5" />
}

interface SortableHeaderProps {
  children: React.ReactNode
  className?: string
  currentDirection: SortDirection
  currentSort: string
  onClick: (key: SortKey) => void
  sortKey: SortKey
}

function SortableHeader({
  children,
  className,
  currentDirection,
  currentSort,
  onClick,
  sortKey
}: SortableHeaderProps) {
  const active = currentSort === sortKey

  return (
    <TableHead className={className}>
      <button
        className="inline-flex w-full cursor-pointer items-center gap-1"
        onClick={() => onClick(sortKey)}
      >
        {children}
        <SortIcon
          active={active}
          direction={currentDirection}
        />
      </button>
    </TableHead>
  )
}

interface QueriesTableProps {
  database: string
  timeRange: number
}

export function QueriesTable({ database, timeRange }: QueriesTableProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = 25
  const sortBy = (searchParams.get('sortBy') ?? 'totalTime') as SortKey
  const sortDirection = (searchParams.get('sortDirection') ??
    'desc') as SortDirection

  function setPage(newPage: number) {
    const next = new URLSearchParams(searchParams)

    if (newPage === 1) {
      next.delete('page')
    } else {
      next.set('page', String(newPage))
    }

    setSearchParams(next)
  }

  function toggleSort(key: SortKey) {
    const next = new URLSearchParams(searchParams)

    if (sortBy === key) {
      const newDirection = sortDirection === 'desc' ? 'asc' : 'desc'

      next.set('sortDirection', newDirection)
    } else {
      next.set('sortBy', key)
      next.set('sortDirection', 'desc')
    }

    next.delete('page')

    setSearchParams(next)
  }

  const { data, isLoading } = useQueries({
    database,
    page,
    pageSize,
    sortBy,
    sortDirection,
    timeRange
  })

  const queries = data?.queries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Loading queries...
      </div>
    )
  }

  if (queries.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No queries recorded in this time range.
      </div>
    )
  }

  const headerProps = {
    currentDirection: sortDirection,
    currentSort: sortBy,
    onClick: toggleSort
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6"></TableHead>
            <TableHead className="min-w-[300px]">Query</TableHead>
            <SortableHeader
              className="text-right"
              sortKey="percentOfRuntime"
              {...headerProps}
            >
              % of runtime
            </SortableHeader>
            <SortableHeader
              className="text-right"
              sortKey="count"
              {...headerProps}
            >
              Count
            </SortableHeader>
            <SortableHeader
              className="text-right"
              sortKey="totalTime"
              {...headerProps}
            >
              Total time (s)
            </SortableHeader>
            <SortableHeader
              className="text-right"
              sortKey="p50Latency"
              {...headerProps}
            >
              p50 latency (ms)
            </SortableHeader>
            <SortableHeader
              className="text-right"
              sortKey="p99Latency"
              {...headerProps}
            >
              p99 latency (ms)
            </SortableHeader>
            <SortableHeader
              className="text-right"
              sortKey="documentsRead"
              {...headerProps}
            >
              Docs read
            </SortableHeader>
            <SortableHeader
              className="text-right"
              sortKey="documentsReturned"
              {...headerProps}
            >
              Docs returned
            </SortableHeader>
          </TableRow>
        </TableHeader>

        <TableBody>
          {queries.map((query, index) => (
            <TableRow key={index}>
              <TableCell className="w-6 pr-0">
                {query.planSummary === 'COLLSCAN' && (
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <TriangleAlert className="size-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      No index used (collection scan)
                    </TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell className="max-w-[400px] truncate font-mono text-xs">
                {query.normalizedStatement}
              </TableCell>
              <TableCell className="text-right">
                {formatPercent(query.percentOfRuntime)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(query.count)}
              </TableCell>
              <TableCell className="text-right">
                {formatTime(query.totalTime)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(query.p50Latency)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(query.p99Latency)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(query.documentsRead)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(query.documentsReturned)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
