import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
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
import { useQueries } from '@/hooks/use-queries'

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

interface QueriesTableProps {
  database: string
  timeRange: number
}

export function QueriesTable({ database, timeRange }: QueriesTableProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = 25

  function setPage(newPage: number) {
    const next = new URLSearchParams(searchParams)

    if (newPage === 1) {
      next.delete('page')
    } else {
      next.set('page', String(newPage))
    }

    setSearchParams(next)
  }

  const { data, isLoading } = useQueries({
    database,
    page,
    pageSize,
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
            <TableHead className="text-right">p50 latency (ms)</TableHead>
            <TableHead className="text-right">p99 latency (ms)</TableHead>
            <TableHead className="text-right">Docs read</TableHead>
            <TableHead className="text-right">Docs returned</TableHead>
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
