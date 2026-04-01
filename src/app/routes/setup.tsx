import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'

export function SetupPage() {
  const queryClient = useQueryClient()

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['databases'] })
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <h2 className="text-xl font-semibold">No databases found</h2>
      <p className="text-muted-foreground">
        Make sure your MongoDB instance has profiling enabled on at least one
        database.
      </p>
      <Button
        variant="outline"
        onClick={handleRefresh}
      >
        Refresh
      </Button>
    </div>
  )
}
