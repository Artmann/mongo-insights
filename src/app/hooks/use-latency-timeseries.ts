import { useQuery } from '@tanstack/react-query'

interface LatencyBucket {
  p50: number
  p99: number
  time: string
}

interface LatencyTimeseriesResponse {
  buckets: LatencyBucket[]
}

interface UseLatencyTimeseriesOptions {
  database: string
  timeRange?: number
}

export function useLatencyTimeseries({
  database,
  timeRange = 86400
}: UseLatencyTimeseriesOptions) {
  return useQuery({
    queryKey: ['latency-timeseries', database, timeRange],
    queryFn: async (): Promise<LatencyTimeseriesResponse> => {
      const response = await fetch('/api/latency-timeseries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database, timeRange })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch latency timeseries')
      }

      return response.json()
    },
    enabled: !!database
  })
}
