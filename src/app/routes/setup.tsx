import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'

function DatabaseIcon(props: React.ComponentProps<'svg'>) {
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
      <ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
      />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
}

export function SetupPage() {
  const queryClient = useQueryClient()

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['databases'] })
  }

  return (
    <Empty className="min-h-[calc(100vh-12rem)]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>

        <EmptyTitle>No databases found</EmptyTitle>

        <EmptyDescription>
          To get started, make sure MongoDB is running and profiling is enabled
          on at least one database.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <ol className="space-y-3 text-left text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1.</span> Ensure your
            MongoDB instance is running and accessible.
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Connect to
            your database and enable profiling:
          </li>
        </ol>

        <pre className="rounded-lg bg-muted px-6 py-3 text-sm">
          db.setProfilingLevel(1)
        </pre>

        <p className="text-xs text-muted-foreground">
          Level 1 logs queries slower than 100ms. Use level 2 to log all
          queries.
        </p>

        <Button
          variant="outline"
          onClick={handleRefresh}
        >
          <RefreshCw />
          Refresh
        </Button>
      </EmptyContent>
    </Empty>
  )
}
