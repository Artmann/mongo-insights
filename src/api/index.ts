import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import health from './routes/health.ts'
import queries from './routes/queries.ts'

const api = new Hono()

api.use('*', cors())
api.use('*', logger())
api.use('*', prettyJSON())

api.route('/health', health)
api.route('/queries', queries)

export default api
