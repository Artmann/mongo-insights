import { Outlet } from 'react-router'

import { DatabaseCombobox } from './database-combobox'

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Mongo Insights</h1>
        <DatabaseCombobox />
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
