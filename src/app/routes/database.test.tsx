import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { JSDOM } from 'jsdom'

const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost'
})

Object.assign(globalThis, {
  document: jsdom.window.document,
  HTMLElement: jsdom.window.HTMLElement,
  navigator: jsdom.window.navigator,
  window: jsdom.window,
  Element: jsdom.window.Element,
  DocumentFragment: jsdom.window.DocumentFragment,
  MutationObserver: jsdom.window.MutationObserver
})

const { cleanup, render, screen } = await import('@testing-library/react')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { MemoryRouter, Route, Routes } = await import('react-router')

import type { QueryStats } from '@/hooks/use-queries'

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { DatabasePage } = await import('./database')

const mockUseDatabases = mock(() => ({
  data: {
    databases: [
      { name: 'mydb', profilingEnabled: true },
      { name: 'noprofile', profilingEnabled: false }
    ]
  },
  isLoading: false
}))

const mockUseQueries = mock(() => ({
  data: null as {
    queries: QueryStats[]
    total: number
    page: number
    pageSize: number
  } | null,
  isLoading: true
}))

mock.module('@/hooks/use-databases', () => ({
  useDatabases: mockUseDatabases
}))

const mockUseLatencyTimeseries = mock(() => ({
  data: null as {
    buckets: { time: string; p50: number; p99: number }[]
  } | null,
  isLoading: false
}))

mock.module('@/hooks/use-queries', () => ({
  useQueries: mockUseQueries
}))

mock.module('@/hooks/use-latency-timeseries', () => ({
  useLatencyTimeseries: mockUseLatencyTimeseries
}))

mock.module('@/lib/last-database', () => ({
  setLastDatabase: mock()
}))

function renderPage(databaseName: string, searchParams?: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  const url = searchParams
    ? `/databases/${databaseName}?${searchParams}`
    : `/databases/${databaseName}`

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route
              path="/databases/:databaseName/*"
              element={<DatabasePage />}
            />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

function makeQuery(overrides: Partial<QueryStats> = {}): QueryStats {
  return {
    count: 100,
    documentsRead: 5000,
    documentsReturned: 50,
    normalizedStatement: 'find users {email: ?}',
    p50Latency: 5,
    p99Latency: 25,
    percentOfRuntime: 50,
    planSummary: 'IXSCAN { email: 1 }',
    responseSize: 1024,
    totalTime: 2.5,
    ...overrides
  }
}

afterEach(() => {
  cleanup()
})

describe('DatabasePage', () => {
  beforeEach(() => {
    mockUseDatabases.mockReturnValue({
      data: {
        databases: [
          { name: 'mydb', profilingEnabled: true },
          { name: 'noprofile', profilingEnabled: false }
        ]
      },
      isLoading: false
    })

    mockUseQueries.mockReturnValue({
      data: null,
      isLoading: true
    })
  })

  test('shows profiling not enabled state', () => {
    renderPage('noprofile')

    expect(screen.getByText('Profiling is not enabled')).toBeTruthy()
    expect(screen.getByText('db.setProfilingLevel(1)')).toBeTruthy()
  })

  test('shows insights header when profiling is enabled', () => {
    renderPage('mydb')

    expect(screen.getByText('Insights')).toBeTruthy()
    expect(screen.getByText('Queries in the last 24 hours')).toBeTruthy()
  })

  test('shows loading state while queries are fetching', () => {
    renderPage('mydb')

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')

    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state when no queries exist', () => {
    mockUseQueries.mockReturnValue({
      data: { queries: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('No queries recorded')).toBeTruthy()
  })

  test('renders query rows in the table', () => {
    mockUseQueries.mockReturnValue({
      data: {
        queries: [
          makeQuery({
            normalizedStatement: 'find users {email: ?}',
            count: 88,
            percentOfRuntime: 84.34
          }),
          makeQuery({
            normalizedStatement: 'find comments {postSlug: ?}',
            count: 6,
            percentOfRuntime: 4.15
          })
        ],
        total: 2,
        page: 1,
        pageSize: 25
      },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('find users {email: ?}')).toBeTruthy()
    expect(screen.getByText('find comments {postSlug: ?}')).toBeTruthy()
    expect(screen.getByText('84.34%')).toBeTruthy()
    expect(screen.getByText('4.15%')).toBeTruthy()
    expect(screen.getByText('88')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
  })

  test('shows warning icon for queries without an index', () => {
    mockUseQueries.mockReturnValue({
      data: {
        queries: [
          makeQuery({ planSummary: 'COLLSCAN' }),
          makeQuery({
            planSummary: 'IXSCAN { email: 1 }',
            normalizedStatement: 'find orders {id: ?}'
          })
        ],
        total: 2,
        page: 1,
        pageSize: 25
      },
      isLoading: false
    })

    renderPage('mydb')

    const rows = screen.getAllByRole('row')
    const collscanRow = rows[1]
    const indexedRow = rows[2]

    expect(collscanRow?.querySelector('[class*="text-amber"]')).toBeTruthy()
    expect(indexedRow?.querySelector('[class*="text-amber"]')).toBeNull()
  })

  test('shows pagination controls when there are multiple pages', () => {
    mockUseQueries.mockReturnValue({
      data: {
        queries: [makeQuery()],
        total: 50,
        page: 1,
        pageSize: 25
      },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    expect(screen.getByText('Previous')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })

  test('shows pagination controls even on single page', () => {
    mockUseQueries.mockReturnValue({
      data: {
        queries: [makeQuery()],
        total: 1,
        page: 1,
        pageSize: 25
      },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('Page 1 of 1')).toBeTruthy()
    expect(screen.getByText('Previous')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })

  test('formats large numbers with separators', () => {
    mockUseQueries.mockReturnValue({
      data: {
        queries: [makeQuery({ documentsRead: 67055 })],
        total: 1,
        page: 1,
        pageSize: 25
      },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('67,055')).toBeTruthy()
  })

  test('shows "< 1" for total time under one second', () => {
    mockUseQueries.mockReturnValue({
      data: {
        queries: [makeQuery({ totalTime: 0.3 })],
        total: 1,
        page: 1,
        pageSize: 25
      },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('< 1')).toBeTruthy()
  })

  test('shows time range selector buttons', () => {
    renderPage('mydb')

    expect(screen.getByText('1h')).toBeTruthy()
    expect(screen.getByText('8h')).toBeTruthy()
    expect(screen.getByText('24h')).toBeTruthy()
    expect(screen.getByText('3d')).toBeTruthy()
    expect(screen.getByText('7d')).toBeTruthy()
  })

  test('shows query latency section', () => {
    renderPage('mydb')

    expect(screen.getByText('Query latency')).toBeTruthy()
  })

  test('updates heading based on time range param', () => {
    renderPage('mydb', 'timeRange=3600')

    expect(screen.getByText('Queries in the last 1 hour')).toBeTruthy()
  })

  test('shows 7d label for 7-day time range', () => {
    renderPage('mydb', 'timeRange=604800')

    expect(screen.getByText('Queries in the last 7 days')).toBeTruthy()
  })

  test('shows chart loading state', () => {
    mockUseLatencyTimeseries.mockReturnValue({
      data: null,
      isLoading: true
    })

    renderPage('mydb')

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')

    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty chart state when no latency data', () => {
    mockUseLatencyTimeseries.mockReturnValue({
      data: { buckets: [] },
      isLoading: false
    })

    renderPage('mydb')

    expect(screen.getByText('No latency data available')).toBeTruthy()
  })
})
