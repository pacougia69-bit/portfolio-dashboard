import express from 'express'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { registerOAuthRoutes } from './oauth'
import { appRouter } from '../routers'
import { createContext } from './context'

function serveStatic(app: express.Express) {
const distPath = path.resolve(process.cwd(), 'dist', 'public')

  if (!fs.existsSync(distPath)) {
    console.error(`❌ Could not find the build directory: ${distPath}`)
    console.error('Make sure "pnpm build" was run and created the dist/public/ folder.')
    return // Wichtig: Nicht weiter machen, wenn public/ fehlt
  }

  console.log(`✅ Serving static files from ${distPath}`)

  app.use(express.static(distPath))

  app.use('*', (_req, res) => {
    const indexPath = path.resolve(distPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath)
    } else {
      console.error(`❌ index.html not found at ${indexPath}`)
      res.status(404).send('index.html not found')
    }
  })
}

async function startServer() {
  const app = express()

  const port = Number(process.env.PORT || 3000)
  const host = '0.0.0.0'

  app.get('/health', (_req, res) => {
    res.status(200).send('OK')
  })

  registerOAuthRoutes(app)

  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  )

  serveStatic(app)

  const httpServer = createServer(app)

  httpServer.listen(port, host, () => {
    console.log(`✅ Server is running on http://${host}:${port}`)
  })

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    httpServer.close(() => {
      console.log('HTTP server closed')
      process.exit(0)
    })
  })

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server')
    httpServer.close(() => {
      console.log('HTTP server closed')
      process.exit(0)
    })
  })
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err)
  process.exit(1)
})