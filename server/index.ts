import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import mysql from "mysql2/promise";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * RAILWAY PRODUCTION SERVER
 * This file is used by Railway for production deployments
 */

async function runDatabaseMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not configured - skipping database migration');
    return;
  }

  try {
    console.log('🔄 Starting database migration...');

    const connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);

    // Run migrations
    await migrate(db, { migrationsFolder: './drizzle' });
    await connection.end();

    // Ensure media_insights table exists
    console.log('📸 Ensuring media_insights table...');
    const { ensureMediaInsightsTable } = await import('./ensure-media-table');
    await ensureMediaInsightsTable();

    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
  }
}

async function startServer() {
  // Run database migration
  await runDatabaseMigration();

  const app = express();
  const port = Number(process.env.PORT || 3000);
  const host = '0.0.0.0';

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  console.log('');
  console.log('='.repeat(60));
  console.log('🚀 RAILWAY PRODUCTION SERVER STARTING');
  console.log('='.repeat(60));
  console.log('');

  // Health check endpoint
  app.get('/health', (_req, res) => res.status(200).send('OK'));

  // Debug endpoint - RAILWAY DEPLOYMENT VERIFICATION
  app.get("/api/debug", (req, res) => {
    console.log('🔍 /api/debug endpoint hit');
    res.json({
      timestamp: new Date().toISOString(),
      deploymentCheck: '🚀 RAILWAY-FIX-V4-DEPLOYED ✓',
      serverFile: 'server/index.ts (PRODUCTION)',
      environment: {
        PUBLIC_URL: process.env.PUBLIC_URL || '(not set)',
        RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || '(not set)',
        RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || '(not set)',
        OAUTH_SERVER_URL: process.env.OAUTH_SERVER_URL || '(not set)',
        NODE_ENV: process.env.NODE_ENV || '(not set)',
        PORT: process.env.PORT || '(not set)',
      },
      message: '✅ If you see RAILWAY-FIX-V4-DEPLOYED, the new code is running!',
      hardcodedDomain: 'https://portfolio-dashboard-production-e5c1.up.railway.app',
    });
  });

  console.log('✅ /api/debug endpoint registered');

  // OAuth and tRPC routes
  registerOAuthRoutes(app);
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }));

  console.log('✅ OAuth and tRPC routes registered');

  // Static file serving
  const distPath = path.resolve(process.cwd(), 'dist', 'public');

  if (fs.existsSync(distPath)) {
    console.log(`✅ Serving static files from: ${distPath}`);

    // Serve uploaded files
    const uploadsPath = path.resolve(distPath, 'uploads');
    if (fs.existsSync(uploadsPath)) {
      console.log(`✅ Serving uploads from: ${uploadsPath}`);
      app.use('/uploads', express.static(uploadsPath));
    }

    app.use(express.static(distPath));

    // Catch-all for SPA
    app.get('*', (req, res) => {
      if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
        return res.status(404).send('Not found');
      }

      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('index.html not found');
      }
    });
  } else {
    console.error(`❌ Build folder not found: ${distPath}`);
  }

  const httpServer = createServer(app);
  httpServer.listen(port, host, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log(`✅ Railway server running on http://${host}:${port}`);
    console.log(`📍 Test: https://portfolio-dashboard-production-e5c1.up.railway.app/api/debug`);
    console.log('='.repeat(60));
    console.log('');
  });
}

startServer().catch((err) => {
  console.error('❌ Server start failed:', err);
  process.exit(1);
});
