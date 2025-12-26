import express from 'express'
import { createServer } from 'http'
import net from 'net'
import path from 'path'
import fs from 'fs'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { registerOAuthRoutes } from './oauth'
import { appRouter } from '../routers'
import { createContext } from './context'

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(port, () => {
      server.close()
      resolve(true)
    })
    server.on('error', () => resolve(false))
  })
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No available port found starting from ${startPort}`)
}

function serveStatic(app: express.Express) {
const distPath = path.resolve(import.meta.dirname, '../../dist/public')  if (!fs.existsSync(distPath)) {
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
  const server = createServer(app)
  
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true }))
  
  registerOAuthRoutes(app)
  app.use('/api/trpc', createExpressMiddleware({
    router: appRouter,
    createContext
  }))
  
  serveStatic(app)
  
  const preferredPort = parseInt(process.env.PORT || '3000')
  const port = await findAvailablePort(preferredPort)
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`)
  })
}

startServer().catch(console.error)
