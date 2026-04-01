import { Fragment, useState } from 'react'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SearchX,
  TriangleAlert
} from 'lucide-react'
import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
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
import { cn } from '@/lib/utils'
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
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
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6"></TableHead>
              <TableHead className="min-w-[300px]">Query</TableHead>
              <TableHead className="text-right">% of runtime</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Total time (s)</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                p50 latency (ms)
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                p99 latency (ms)
              </TableHead>
              <TableHead className="hidden text-right lg:table-cell">
                Docs read
              </TableHead>
              <TableHead className="hidden text-right lg:table-cell">
                Docs returned
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index}>
                <TableCell className="w-6">
                  <Skeleton className="size-4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-64" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <Skeleton className="ml-auto h-4 w-12" />
                </TableCell>
                <TableCell className="hidden text-right lg:table-cell">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
                <TableCell className="hidden text-right lg:table-cell">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              className="hidden text-right md:table-cell"
              sortKey="p50Latency"
              {...headerProps}
            >
              p50 latency (ms)
            </SortableHeader>
            <SortableHeader
              className="hidden text-right md:table-cell"
              sortKey="p99Latency"
              {...headerProps}
            >
              p99 latency (ms)
            </SortableHeader>
            <SortableHeader
              className="hidden text-right lg:table-cell"
              sortKey="documentsRead"
              {...headerProps}
            >
              Docs read
            </SortableHeader>
            <SortableHeader
              className="hidden text-right lg:table-cell"
              sortKey="documentsReturned"
              {...headerProps}
            >
              Docs returned
            </SortableHeader>
          </TableRow>
        </TableHeader>

        <TableBody>
          {queries.map((query, index) => {
            const isExpanded = expandedIndex === index

            return (
              <Fragment key={index}>
                <TableRow
                  aria-expanded={isExpanded}
                  className="cursor-pointer"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <TableCell className="w-6 pr-0">
                    <ChevronDown
                      className={cn(
                        'size-3.5 text-muted-foreground transition-transform',
                        !isExpanded && '-rotate-90'
                      )}
                    />
                  </TableCell>
                  <TableCell className="max-w-[400px] truncate font-mono text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      {query.planSummary === 'COLLSCAN' && (
                        <Tooltip>
                          <TooltipTrigger
                            className="cursor-default"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            No index used (collection scan)
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className="truncate">
                        {query.normalizedStatement}
                      </span>
                    </span>
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
                  <TableCell className="hidden text-right md:table-cell">
                    {formatNumber(query.p50Latency)}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {formatNumber(query.p99Latency)}
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    {formatNumber(query.documentsRead)}
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    {formatNumber(query.documentsReturned)}
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="bg-muted/30 px-8 py-4"
                    >
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Full query
                        </p>

                        <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs whitespace-pre-wrap break-all">
                          {query.normalizedStatement}
                        </pre>

                        <p className="text-xs text-muted-foreground">
                          Plan: {query.planSummary}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
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
