import { useEffect } from 'react'
import { useParams } from 'react-router'

import { useDatabases } from '@/hooks/use-databases'
import { setLastDatabase } from '@/lib/last-database'

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
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h2 className="text-xl font-semibold">Profiling is not enabled</h2>
        <p className="max-w-md text-center text-muted-foreground">
          To start collecting query insights for{' '}
          <span className="font-medium text-foreground">{databaseName}</span>,
          enable profiling in your MongoDB shell:
        </p>
        <pre className="rounded-lg bg-muted px-6 py-4 text-sm">
          db.setProfilingLevel(1)
        </pre>
        <p className="text-sm text-muted-foreground">
          This logs queries slower than 100ms. Use level 2 to log all queries.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">{databaseName}</h2>
      <p className="mt-2 text-muted-foreground">Dashboard coming soon.</p>
    </div>
  )
}
