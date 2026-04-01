import { Hono } from 'hono'

const health = new Hono()

health.get('/', (context) => {
  return context.json({ status: 'ok' })
})

export default health
