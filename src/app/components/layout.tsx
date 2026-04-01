import { Outlet } from 'react-router'

import { DatabaseCombobox } from './database-combobox'
import { ErrorBoundary } from './error-boundary'

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="w-full max-w-7xl mx-auto flex items-center gap-4 px-6 py-3">
          <DatabaseCombobox />
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
