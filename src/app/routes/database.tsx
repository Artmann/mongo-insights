import { useEffect } from 'react'
import { useParams } from 'react-router'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
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
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  )
}

export function DatabasePage() {
  const { databaseName } = useParams()
  const { data } = useDatabases()

  const database = data?.databases.find((d) => d.name === databaseName)

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
            <span className="font-medium text-foreground">{databaseName}</span>
            {' '}to start collecting query insights.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <pre className="rounded-lg bg-muted px-6 py-3 text-sm">
            db.setProfilingLevel(1)
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
      <h2 className="text-xl font-semibold">{databaseName}</h2>
      <p className="mt-2 text-muted-foreground">Dashboard coming soon.</p>
    </div>
  )
}
