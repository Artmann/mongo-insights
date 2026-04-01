import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './index.css'

import { Layout } from './components/layout'
import { DatabasePage } from './routes/database'
import { RootRedirect } from './routes/root'
import { SetupPage } from './routes/setup'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1
    }
  }
})

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        Component: RootRedirect
      },
      {
        path: 'databases/:databaseName/*',
        Component: DatabasePage
      },
      {
        path: 'setup',
        Component: SetupPage
      }
    ]
  }
])

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element not found')
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
