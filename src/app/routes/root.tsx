import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useDatabases } from '@/hooks/use-databases'
import { getLastDatabase } from '@/lib/last-database'

export function RootRedirect() {
  const navigate = useNavigate()
  const { data, isLoading } = useDatabases()

  useEffect(() => {
    if (isLoading) {
      return
    }

    const databases = data?.databases ?? []

    if (databases.length === 0) {
      void navigate('/setup', { replace: true })

      return
    }

    const last = getLastDatabase()
    const match = databases.find((database) => database.name === last)
    const target = match?.name ?? databases[0]?.name

    void navigate(`/databases/${target}`, { replace: true })
  }, [data, isLoading, navigate])

  return null
}
