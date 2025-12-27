import express from 'express'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { registerOAuthRoutes } from './oauth'
import { appRouter } from '../routers'
import { createContext } from './context'

function serveStatic(app: express.Express) {
  // Wenn dein public-Ordner woanders liegt, diesen Pfad anpassen
  const distPath = path.resolve(process.cwd(), 'public')

  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}`)
  } else {
    console.log(`Serving static files from ${distPath}`)
  }

  app.use(express.static(distPath))

  // Alle anderen Routen auf index.html leiten (SPA)
  app.use('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'))
  })
}

async function startServer() {
  const app = express()

  // ✅ Railway-Port verwenden
  const port = Number(process.env.PORT || 3000)
  const host = '0.0.0.0'

  // ✅ Healthcheck-Endpoint für Railway
  app.get('/health', (_req, res) => {
    res.status(200).send('OK')
  })

  // Deine OAuth-Routen
  registerOAuthRoutes(app)

  // tRPC Middleware
  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  )

  // Statische Dateien (Frontend)
  serveStatic(app)

  const httpServer = createServer(app)

  // ✅ Auf 0.0.0.0 und process.env.PORT hören
  httpServer.listen(port, host, () => {
    console.log(`✅ Server is running on http://${host}:${port}`)
  })

  // ✅ Sauber herunterfahren (Railway SIGTERM)
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    httpServer.close(() => {
      console.log('HTTP server closed')
      process.exit(0)
    })
  })
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err)
})