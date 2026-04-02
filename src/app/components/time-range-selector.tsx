import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'

const timeRangeOptions = [
  { label: '1h', seconds: 3600 },
  { label: '8h', seconds: 28800 },
  { label: '24h', seconds: 86400 },
  { label: '3d', seconds: 259200 },
  { label: '7d', seconds: 604800 }
]

const defaultTimeRange = 86400

export function useTimeRange(): number {
  const [searchParams] = useSearchParams()

  return Number(searchParams.get('timeRange')) || defaultTimeRange
}

const timeRangeLabels: Record<number, string> = {
  3600: '1 hour',
  28800: '8 hours',
  86400: '24 hours',
  259200: '3 days',
  604800: '7 days'
}

export function timeRangeLabel(seconds: number): string {
  return timeRangeLabels[seconds] ?? '24 hours'
}

export function TimeRangeSelector() {
  const [searchParams, setSearchParams] = useSearchParams()

  const current = Number(searchParams.get('timeRange')) || defaultTimeRange

  function selectRange(seconds: number) {
    const next = new URLSearchParams(searchParams)

    if (seconds === defaultTimeRange) {
      next.delete('timeRange')
    } else {
      next.set('timeRange', String(seconds))
    }

    next.delete('page')

    setSearchParams(next)
  }

  return (
    <div className="flex gap-1">
      {timeRangeOptions.map((option) => (
        <Button
          key={option.seconds}
          variant={current === option.seconds ? 'default' : 'ghost'}
          size="sm"
          onClick={() => selectRange(option.seconds)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
