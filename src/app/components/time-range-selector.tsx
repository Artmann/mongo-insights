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

export function timeRangeLabel(seconds: number): string {
  const option = timeRangeOptions.find((o) => o.seconds === seconds)

  return option?.label ?? '24h'
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
