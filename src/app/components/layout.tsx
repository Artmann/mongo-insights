import { Outlet } from 'react-router'

import { useTheme } from '../hooks/use-theme'
import { CommandPalette } from './command-palette'
import { DatabaseCombobox } from './database-combobox'
import { ErrorBoundary } from './error-boundary'

export function Layout() {
  useTheme()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette />
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="w-full max-w-7xl mx-auto flex items-center gap-4 px-6 py-3">
          <span className="text-lg font-semibold">Mongo Insights</span>
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
