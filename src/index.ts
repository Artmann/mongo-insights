import { Hono } from 'hono'
import { log } from 'tiny-typescript-logger'

import { startCollector } from './collector/index.ts'
import api from './api/index.ts'

const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 4280
const vitePort = Number(process.env.VITE_PORT) || 4281

const app = new Hono()

// Mount API routes
app.route('/api', api)

if (isProd) {
  // Serve built frontend assets
  const { serveStatic } = await import('hono/bun')
  app.use('/*', serveStatic({ root: './dist/client' }))

  // SPA fallback for client-side routing
  app.get('/*', async (context) => {
    const html = await Bun.file('./dist/client/index.html').text()

    return context.html(html)
  })
} else {
  // Start Vite dev server as a subprocess
  const viteProcess = Bun.spawn(['bunx', 'vite', '--port', String(vitePort)], {
    stdio: ['ignore', 'inherit', 'inherit']
  })
  process.on('exit', () => viteProcess.kill())

  // Proxy all non-API requests to Vite
  app.all('/*', async (context) => {
    const url = new URL(context.req.url)
    url.host = `localhost:${vitePort}`

    const response = await fetch(url.toString(), {
      method: context.req.method,
      headers: context.req.raw.headers,
      body:
        context.req.method === 'GET' || context.req.method === 'HEAD'
          ? undefined
          : context.req.raw.body
    })

    const headers = new Headers(response.headers)

    headers.delete('transfer-encoding')

    return new Response(response.body, {
      status: response.status,
      headers
    })
  })
}

// Start collector (runs in background, don't block server startup)
startCollector().catch((error: unknown) =>
  log.fatal('Collector fatal error:', error)
)

// Start server
export default {
  port,
  fetch: app.fetch
}

log.info(`Running on http://localhost:${port}`)
