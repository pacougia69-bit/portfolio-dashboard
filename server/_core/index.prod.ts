import express from 'express'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { registerOAuthRoutes } from './oauth'
import { appRouter } from '../routers'
import { createContext } from './context'

function serveStatic(app: express.Express) {
  const distPath = path.resolve(import.meta.dirname, "../../public")
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}`)
  } else {
    console.log(`Serving static files from ${distPath}`)
  }
  app.use(express.static(distPath))
  app.use('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'))
  })
}

async function startServer() {
  const app = express()
  
  // ✅ Railway gibt den Port vor - nicht selbst suchen!
  const port = Number(process.env.PORT || 3000)
  const host = '0.0.0.0' // ✅ Nicht 'localhost'!

  // ✅ Health-Check Endpunkt für Railway
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
  
  // ✅ Auf 0.0.0.0 und process.env.PORT lauschen
  httpServer.listen(port, host, () => {
    console.log(`✅ Server is running on http://${host}:${port}`)
  })

  // ✅ Graceful Shutdown für Railway
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    httpServer.close(() => {
      console.log('HTTP server closed')
      process.exit(0)
    })
  })
}

startServer().catch(console.error)