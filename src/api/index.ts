import { Hono } from 'hono'
import health from './routes/health.ts'

const api = new Hono()

api.route('/health', health)

export default api
