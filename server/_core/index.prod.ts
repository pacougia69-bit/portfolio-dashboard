import express from 'express'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { registerOAuthRoutes } from './oauth'
import { appRouter } from '../routers'
import { createContext } from './context'

function serveStatic(app: express.Express) {
  // Wir nutzen dist/public, weil dein Build dort landet
  const distPath = path.resolve(process.cwd(), 'dist', 'public')

  if (!fs.existsSync(distPath)) {
    console.error(`❌ Build-Ordner nicht gefunden: ${distPath}`)
    return 
  }

  console.log(`✅ Statische Dateien werden serviert von: ${distPath}`)
  app.use(express.static(distPath))

  app.use('*', (_req, res) => {
    const indexPath = path.resolve(distPath, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath)
    } else {
      res.status(404).send('index.html nicht gefunden')
    }
  })
}

async function startServer() {
  const app = express()
  const port = Number(process.env.PORT || 3000)
  const host = '0.0.0.0'

  // CORS-Headers für Entwicklung (erlaubt localhost-Anfragen)
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200)
    }
    next()
  })

  app.get('/health', (_req, res) => res.status(200).send('OK'))

  registerOAuthRoutes(app)
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }))
  
  serveStatic(app)

  const httpServer = createServer(app)
  httpServer.listen(port, host, () => {
    console.log(`✅ Server läuft auf http://${host}:${port}`)
  })
}

startServer().catch((err) => {
  console.error('❌ Server-Start fehlgeschlagen:', err)
  process.exit(1)
})