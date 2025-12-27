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
  const port = await findAvailablePort(Number(process.env.PORT) || 3000)

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
  httpServer.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
  })
}

startServer().catch(console.error)
