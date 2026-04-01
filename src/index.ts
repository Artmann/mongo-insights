import { Hono } from 'hono'
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
} else {
  // Start Vite dev server as a subprocess
  const viteProcess = Bun.spawn(['bunx', 'vite', '--port', String(vitePort)], {
    stdio: ['ignore', 'inherit', 'inherit']
  })
  process.on('exit', () => viteProcess.kill())

  // Proxy all non-API requests to Vite
  app.all('/*', async (c) => {
    const url = new URL(c.req.url)
    url.host = `localhost:${vitePort}`
    const res = await fetch(url.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body:
        c.req.method === 'GET' || c.req.method === 'HEAD'
          ? undefined
          : c.req.raw.body
    })
    return new Response(res.body, {
      status: res.status,
      headers: res.headers
    })
  })
}

// Start collector (runs in background, don't block server startup)
startCollector().catch((err) => console.error('[collector] Fatal error:', err))

// Start server
export default {
  port,
  fetch: app.fetch
}

console.log(`[server] Running on http://localhost:${port}`)
