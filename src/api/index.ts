import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import databases from './routes/databases.ts'
import health from './routes/health.ts'
import latencyTimeseries from './routes/latency-timeseries.ts'
import queries from './routes/queries.ts'

const api = new Hono()

api.use('*', cors())
api.use('*', logger())
api.use('*', prettyJSON())

api.route('/databases', databases)
api.route('/health', health)
api.route('/latency-timeseries', latencyTimeseries)
api.route('/queries', queries)

export default api
