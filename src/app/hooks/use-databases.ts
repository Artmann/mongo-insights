import { useQuery } from '@tanstack/react-query'

export interface DatabaseInfo {
  name: string
  profilingEnabled: boolean
}

interface DatabasesResponse {
  databases: DatabaseInfo[]
}

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: async (): Promise<DatabasesResponse> => {
      const response = await fetch('/api/databases')

      if (!response.ok) {
        throw new Error('Failed to fetch databases')
      }

      return response.json()
    }
  })
}
