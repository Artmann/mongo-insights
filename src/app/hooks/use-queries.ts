import { useQuery } from '@tanstack/react-query'

export interface QueryStats {
  count: number
  documentsRead: number
  documentsReturned: number
  normalizedStatement: string
  p50Latency: number
  p99Latency: number
  percentOfRuntime: number
  planSummary: string
  responseSize: number
  totalTime: number
}

interface QueriesResponse {
  page: number
  pageSize: number
  queries: QueryStats[]
  total: number
}

interface UseQueriesOptions {
  database: string
  page?: number
  pageSize?: number
}

export function useQueries({
  database,
  page = 1,
  pageSize = 25
}: UseQueriesOptions) {
  return useQuery({
    queryKey: ['queries', database, page, pageSize],
    queryFn: async (): Promise<QueriesResponse> => {
      const response = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database, page, pageSize })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch queries')
      }

      return response.json()
    },
    enabled: !!database
  })
}
