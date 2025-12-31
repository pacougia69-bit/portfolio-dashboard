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

  // Catch-all route for SPA - but exclude admin and API routes
  app.use('*', (req, res) => {
    // Don't serve index.html for API or admin routes
    if (req.originalUrl.startsWith('/admin') || req.originalUrl.startsWith('/api')) {
      return res.status(404).send('Not found');
    }
    
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
    
    // CRITICAL FIX: Drop and recreate transactions table if it has wrong structure
    try {
      console.log('🔍 Checking transactions table structure...');
      const [columns]: any = await connection.query("DESCRIBE transactions");
      const columnNames = columns.map((col: any) => col.Field);
      
      // Check if table has 'world' or other wrong columns instead of 'userId'
      if (columnNames.includes('world') || !columnNames.includes('userId')) {
        console.log('⚠️  Detected corrupted transactions table schema! Dropping and recreating...');
        await connection.query("DROP TABLE IF EXISTS transactions");
        console.log('✅ Dropped corrupted transactions table');
      }
    } catch (checkError: any) {
      console.log('ℹ️  Transactions table does not exist yet (this is fine for first deployment)');
    }
    
    // Run migrations from the drizzle folder
    await migrate(db, { migrationsFolder: './drizzle' });
    
    // ADDITIONAL FIX: Check and fix transactions table schema if it exists but is incomplete
    try {
      console.log('🔍 Checking transactions table schema...');
      const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
      
      if (Array.isArray(tables) && tables.length > 0) {
        const [columns]: any = await connection.query("DESCRIBE transactions");
        const existingColumns = new Set(columns.map((col: any) => col.Field));
        
        const requiredColumns = [
          { name: 'wkn', sql: 'wkn VARCHAR(20) DEFAULT NULL AFTER isin' },
          { name: 'fees', sql: 'fees DECIMAL(18, 4) DEFAULT "0" NOT NULL AFTER price' },
          { name: 'totalAmount', sql: 'totalAmount DECIMAL(18, 4) NOT NULL AFTER fees' },
          { name: 'invoiceNumber', sql: 'invoiceNumber VARCHAR(100) DEFAULT NULL AFTER orderNumber' },
        ];
        
        const missingColumns = requiredColumns.filter(col => !existingColumns.has(col.name));
        
        if (missingColumns.length > 0) {
          console.log(`⚠️  Found ${missingColumns.length} missing columns in transactions table`);
          for (const col of missingColumns) {
            try {
              console.log(`  Adding column: ${col.name}`);
              await connection.query(`ALTER TABLE transactions ADD COLUMN ${col.sql}`);
              console.log(`  ✅ Added ${col.name}`);
            } catch (colError: any) {
              console.error(`  ❌ Failed to add ${col.name}:`, colError.message);
            }
          }
        } else {
          console.log('✅ All required columns exist in transactions table');
        }
      }
    } catch (schemaError: any) {
      console.error('⚠️  Error checking/fixing transactions schema:', schemaError.message);
    }
    
    await connection.end();
    
    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    console.error('⚠️  Server will continue, but database may be out of sync');
    // Don't exit - allow server to start even if migration fails
    // This prevents deployment failures due to temporary DB issues
  }
}

/**
 * Fix transactions table schema by adding missing columns
 */
async function fixTransactionsSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const connection = await mysql.createConnection(databaseUrl);
  const logs: string[] = [];

  try {
    logs.push("📋 Checking transactions table schema...");

    // Check if table exists
    const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
    if (!Array.isArray(tables) || tables.length === 0) {
      logs.push("❌ Transactions table does not exist!");
      return logs;
    }

    // Get current columns
    const [columns]: any = await connection.query("DESCRIBE transactions");
    logs.push("\nCurrent columns:");
    columns.forEach((col: any) => {
      logs.push(`  - ${col.Field} (${col.Type})`);
    });

    const existingColumns = new Set(columns.map((col: any) => col.Field));

    // Define required columns
    const requiredColumns = [
      { name: 'wkn', sql: 'wkn VARCHAR(20) DEFAULT NULL AFTER isin' },
      { name: 'fees', sql: 'fees DECIMAL(18, 4) DEFAULT "0" NOT NULL AFTER price' },
      { name: 'totalAmount', sql: 'totalAmount DECIMAL(18, 4) NOT NULL AFTER fees' },
      { name: 'invoiceNumber', sql: 'invoiceNumber VARCHAR(100) DEFAULT NULL AFTER orderNumber' },
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.has(col.name));

    if (missingColumns.length === 0) {
      logs.push("\n✅ All required columns already exist!");
      return logs;
    }

    logs.push(`\n⚠️  Found ${missingColumns.length} missing columns: ${missingColumns.map(c => c.name).join(', ')}`);
    logs.push("\n🔧 Adding missing columns...");

    for (const col of missingColumns) {
      try {
        logs.push(`  Adding: ${col.name}`);
        await connection.query(`ALTER TABLE transactions ADD COLUMN ${col.sql}`);
        logs.push(`  ✅ Successfully added ${col.name}`);
      } catch (error: any) {
        logs.push(`  ❌ Failed to add ${col.name}: ${error.message}`);
      }
    }

    logs.push("\n✅ Schema fix completed!");
    return logs;
  } finally {
    await connection.end();
  }
}

async function startServer() {
  // Run database migration before starting the server
  await runDatabaseMigration();
  
  const app = express()
  const port = Number(process.env.PORT || 3000)
  const host = '0.0.0.0'

  // Health check endpoint
  app.get('/health', (_req, res) => res.status(200).send('OK'))

  // OAuth and tRPC routes - MUST be before static files
  registerOAuthRoutes(app)
  app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext }))

  // Admin endpoints - must be before static file serving
  app.get("/admin/fix-schema", async (req, res) => {
    try {
      const logs = await fixTransactionsSchema();
      res.setHeader('Content-Type', 'text/plain');
      res.send(logs.join('\n'));
    } catch (error: any) {
      res.status(500).send(`Error: ${error.message}\n${error.stack}`);
    }
  });

  app.get("/admin/check-schema", async (req, res) => {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not set");
      }
      const connection = await mysql.createConnection(databaseUrl);
      const [columns]: any = await connection.query("DESCRIBE transactions");
      await connection.end();
      
      res.setHeader('Content-Type', 'application/json');
      res.json({ columns });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Static file serving - this includes the catch-all
  const distPath = path.resolve(process.cwd(), 'dist', 'public')
  if (fs.existsSync(distPath)) {
    console.log(`✅ Statische Dateien werden serviert von: ${distPath}`)
    app.use(express.static(distPath))
    
    // Catch-all for SPA - MUST be last
    app.get('*', (_req, res) => {
      const indexPath = path.resolve(distPath, 'index.html')
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
      } else {
        res.status(404).send('index.html nicht gefunden')
      }
    })
  } else {
    console.error(`❌ Build-Ordner nicht gefunden: ${distPath}`)
  }

  const httpServer = createServer(app)
  httpServer.listen(port, host, () => {
    console.log(`✅ Server läuft auf http://${host}:${port}`)
  })
}

startServer().catch((err) => {
  console.error('❌ Server-Start fehlgeschlagen:', err)
  process.exit(1)
})