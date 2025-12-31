import express from 'express'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { registerOAuthRoutes } from './oauth'
import { appRouter } from '../routers'
import { createContext } from './context'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

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

/**
 * Run database migrations automatically on server startup
 * This ensures the transactions table and other schema changes are applied
 */
async function runDatabaseMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not configured - skipping database migration');
    return;
  }

  try {
    console.log('🔄 Starting database migration...');
    
    // Create a connection for migrations
    const connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);
    
    // Run migrations from the drizzle folder
    await migrate(db, { migrationsFolder: './drizzle' });
    
    await connection.end();
    
    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    console.error('⚠️  Server will continue, but database may be out of sync');
    // Don't exit - allow server to start even if migration fails
    // This prevents deployment failures due to temporary DB issues
  }
}

async function startServer() {
  // Run database migration before starting the server
  await runDatabaseMigration();
  
  const app = express()
  const port = Number(process.env.PORT || 3000)
  const host = '0.0.0.0'

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