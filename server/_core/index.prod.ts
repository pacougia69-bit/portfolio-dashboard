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

  // === Tech-Frühwarnsystem: tech_warning_signals Tabelle sicherstellen ===
  // Läuft GANZ AM ANFANG mit eigener Connection und eigenem try/catch.
  // Begründung: Die Drizzle-Migration weiter unten scheitert in der Praxis
  // immer (versucht alte CREATE TABLEs erneut → "table already exists").
  // Damit unsere Tabelle trotzdem garantiert angelegt wird, machen wir es hier
  // unabhängig von Drizzle und vor allem unabhängig vom äußeren try/catch.
  try {
    console.log('🔍 Checking tech_warning_signals table (pre-migration)...');
    const twsConnection = await mysql.createConnection(DATABASE_URL);
    try {
      await twsConnection.query(`
        CREATE TABLE IF NOT EXISTS tech_warning_signals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          overallSignal ENUM('gruen','gelb','rot') NOT NULL,
          indicators JSON NOT NULL,
          summary TEXT,
          errorMessage TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ tech_warning_signals table ready');
    } finally {
      await twsConnection.end();
    }
  } catch (twsError: any) {
    console.error('⚠️  Error creating tech_warning_signals table:', twsError?.message || twsError);
    // Bewusst kein throw — Server soll trotzdem starten, andere Features funktionieren weiter.
  }

  // === Stock Traffic Light table ===
  try {
    console.log('🔍 Checking stock_traffic_light table...');
    const stlConn = await mysql.createConnection(DATABASE_URL);
    try {
      await stlConn.query(`
        CREATE TABLE IF NOT EXISTS stock_traffic_light (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          ticker VARCHAR(20) NOT NULL,
          wkn VARCHAR(20),
          \`name\` VARCHAR(255) NOT NULL,
          currentPrice DECIMAL(18,4),
          sma50 DECIMAL(18,4),
          sma200 DECIMAL(18,4),
          \`signal\` ENUM('GRUEN','GELB','ROT'),
          signalDetail VARCHAR(255),
          lastUpdated TIMESTAMP NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ stock_traffic_light table ready');
    } finally {
      await stlConn.end();
    }
  } catch (stlError: any) {
    console.error('⚠️  Error creating stock_traffic_light table:', stlError?.message || stlError);
  }

  // === Fix UNIQUE constraint: remove global unique, add per-user composite ===
  // Sparplan-PDFs teilen sich dieselbe Auftragsnummer, Duplikat-Prüfung läuft jetzt per User im Code
  try {
    console.log('🔧 Fixing transactions UNIQUE constraints...');
    const uqConn = await mysql.createConnection(DATABASE_URL);
    try {
      // Drop old orderNumber unique constraint if it still exists
      const [oIndexes]: any = await uqConn.query(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transactions'
          AND INDEX_NAME = 'transactions_orderNumber_unique'
      `);
      if (Array.isArray(oIndexes) && oIndexes.length > 0) {
        await uqConn.query('ALTER TABLE `transactions` DROP INDEX `transactions_orderNumber_unique`');
        console.log('   ✅ Dropped orderNumber UNIQUE');
      }

      // Drop global invoiceNumber unique constraint if it exists
      const [ivIndexes]: any = await uqConn.query(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transactions'
          AND INDEX_NAME = 'transactions_invoiceNumber_unique'
      `);
      if (Array.isArray(ivIndexes) && ivIndexes.length > 0) {
        await uqConn.query('ALTER TABLE `transactions` DROP INDEX `transactions_invoiceNumber_unique`');
        console.log('   ✅ Dropped global invoiceNumber UNIQUE');
      }

      // Add composite unique constraint (userId + invoiceNumber) if not exists
      const [compIndexes]: any = await uqConn.query(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transactions'
          AND INDEX_NAME = 'transactions_user_invoice_unique'
      `);
      if (Array.isArray(compIndexes) && compIndexes.length === 0) {
        // First: delete orphaned transactions that don't belong to any real user session
        // These block re-imports but don't show in the Transaktionshistorie
        const [orphaned]: any = await uqConn.query(`
          SELECT COUNT(*) as cnt FROM transactions t
          LEFT JOIN portfolio_positions p ON t.userId = p.userId
          WHERE p.userId IS NULL
        `);
        if (orphaned[0]?.cnt > 0) {
          console.log(`   Deleting ${orphaned[0].cnt} orphaned transaction records...`);
          await uqConn.query(`
            DELETE t FROM transactions t
            LEFT JOIN portfolio_positions p ON t.userId = p.userId
            WHERE p.userId IS NULL
          `);
        }

        await uqConn.query('ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_invoice_unique` UNIQUE(`userId`, `invoiceNumber`)');
        console.log('   ✅ Added composite UNIQUE(userId, invoiceNumber)');
      } else {
        console.log('   ✅ Composite UNIQUE constraint already exists');
      }
    } finally {
      await uqConn.end();
    }
  } catch (uqError: any) {
    console.error('⚠️  Error fixing UNIQUE constraint:', uqError?.message || uqError);
  }

  try {
    console.log('🔄 Starting database migration...');

    // Create a connection for migrations
    const connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);

    // CRITICAL FIX: ALWAYS drop transactions table if it exists to ensure clean schema
    console.log('🔧 FORCING transactions table recreation...');
    try {
      // Check if table exists first
      const [tables]: any = await connection.query("SHOW TABLES LIKE 'transactions'");
      
      if (Array.isArray(tables) && tables.length > 0) {
        console.log('   Found existing transactions table, checking structure...');
        
        // Get column info
        const [columns]: any = await connection.query("DESCRIBE transactions");
        const columnNames = columns.map((col: any) => col.Field);
        console.log(`   Current columns: ${columnNames.join(', ')}`);
        
        // Check if it has wrong structure
        if (columnNames.includes('world') || !columnNames.includes('userId')) {
          console.log('   ⚠️  CORRUPTED SCHEMA DETECTED! Has "world" instead of "userId"');
          
          // Remove all foreign keys first
          try {
            const [fks]: any = await connection.query(`
              SELECT CONSTRAINT_NAME 
              FROM information_schema.KEY_COLUMN_USAGE 
              WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'transactions' 
              AND REFERENCED_TABLE_NAME IS NOT NULL
            `);
            
            for (const fk of fks) {
              console.log(`   Dropping FK: ${fk.CONSTRAINT_NAME}`);
              await connection.query(`ALTER TABLE transactions DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
            }
          } catch (fkErr) {
            console.log('   No FKs to drop');
          }
          
          // Drop the corrupted table
          console.log('   Dropping corrupted transactions table...');
          await connection.query("DROP TABLE IF EXISTS transactions");
          console.log('   ✅ Dropped corrupted table');
        } else {
          console.log('   ✅ Table structure looks correct');
        }
      } else {
        console.log('   ℹ️  Transactions table does not exist yet');
      }
    } catch (checkError: any) {
      console.log(`   ℹ️  Could not check table: ${checkError.message}`);
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
 * Repair transactions table by dropping and recreating it with correct schema
 * This is more aggressive than fixTransactionsSchema - it deletes all data!
 */
async function repairTransactionsTable() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const connection = await mysql.createConnection(databaseUrl);
  const logs: string[] = [];

  try {
    logs.push("🔧 Starting database repair for transactions table...");
    logs.push("⚠️  WARNING: This will DROP and recreate the transactions table!");
    logs.push("");

    // Check current state
    const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
    if (Array.isArray(tables) && tables.length > 0) {
      const [columns]: any = await connection.query("DESCRIBE transactions");
      logs.push("Current table structure:");
      columns.forEach((col: any) => {
        logs.push(`  - ${col.Field} (${col.Type})`);
      });
      logs.push("");
    } else {
      logs.push("ℹ️  Transactions table does not exist yet.");
      logs.push("");
    }

    // Drop existing table
    logs.push("🗑️  Dropping existing transactions table...");
    await connection.query("DROP TABLE IF EXISTS transactions");
    logs.push("✅ Table dropped successfully");
    logs.push("");

    // Create new table with correct schema
    logs.push("🏗️  Creating new transactions table with correct schema...");
    const createTableSQL = `
      CREATE TABLE transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        date TIMESTAMP NOT NULL,
        type ENUM('Kauf', 'Verkauf', 'Sparplan') NOT NULL,
        isin VARCHAR(20) NOT NULL,
        wkn VARCHAR(20) DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        quantity DECIMAL(18, 8) NOT NULL,
        price DECIMAL(18, 4) NOT NULL,
        fees DECIMAL(18, 4) DEFAULT '0' NOT NULL,
        totalAmount DECIMAL(18, 4) NOT NULL,
        orderNumber VARCHAR(100) NOT NULL UNIQUE,
        invoiceNumber VARCHAR(100) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await connection.query(createTableSQL);
    logs.push("✅ Table created successfully");
    logs.push("");

    // Verify new structure
    const [newColumns]: any = await connection.query("DESCRIBE transactions");
    logs.push("New table structure:");
    newColumns.forEach((col: any) => {
      logs.push(`  - ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ""}`);
    });
    logs.push("");

    logs.push("✅ Database repair completed successfully!");
    logs.push("ℹ️  The transactions table has been recreated with the correct schema.");
    logs.push("ℹ️  All previous transaction data has been removed.");
    
    return logs;
  } finally {
    await connection.end();
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

  // Admin endpoint to repair database (drops and recreates transactions table)
  app.get("/admin/repair-db", async (req, res) => {
    try {
      const logs = await repairTransactionsTable();
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

  app.post("/api/admin/fix-db-table", async (req, res) => {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not set");
      }
      const connection = await mysql.createConnection(databaseUrl);
      const logs: string[] = [];
      
      logs.push('🔧 FIXING DATABASE TABLE\n');
      logs.push('='.repeat(50) + '\n');
      
      // Check current structure
      logs.push('1. Checking current table structure...');
      try {
        const [columns]: any = await connection.query("DESCRIBE transactions");
        logs.push(`   Current columns: ${columns.map((c: any) => c.Field).join(', ')}\n`);
        
        const hasWorld = columns.some((c: any) => c.Field === 'world');
        if (hasWorld) {
          logs.push('   ⚠️  DETECTED: Table has "world" column (CORRUPTED!)\n');
        }
      } catch (err: any) {
        logs.push(`   Table doesn't exist or error: ${err.message}\n`);
      }
      
      // Drop all foreign keys first
      logs.push('2. Removing foreign key constraints...');
      try {
        const [fks]: any = await connection.query(`
          SELECT CONSTRAINT_NAME 
          FROM information_schema.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'transactions' 
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        
        for (const fk of fks) {
          await connection.query(`ALTER TABLE transactions DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
          logs.push(`   Dropped FK: ${fk.CONSTRAINT_NAME}`);
        }
        logs.push('   ✅ All FKs removed\n');
      } catch (err: any) {
        logs.push(`   No FKs or error: ${err.message}\n`);
      }
      
      // Drop table
      logs.push('3. Dropping transactions table...');
      await connection.query("DROP TABLE IF EXISTS transactions");
      logs.push('   ✅ Dropped\n');
      
      // Recreate with correct schema
      logs.push('4. Creating new transactions table...');
      await connection.query(`
        CREATE TABLE transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          date TIMESTAMP NOT NULL,
          type ENUM('Kauf', 'Verkauf', 'Sparplan') NOT NULL,
          isin VARCHAR(20) NOT NULL,
          wkn VARCHAR(20),
          name VARCHAR(255) NOT NULL,
          quantity DECIMAL(18,8) NOT NULL,
          price DECIMAL(18,4) NOT NULL,
          fees DECIMAL(18,4) DEFAULT '0',
          totalAmount DECIMAL(18,4) NOT NULL,
          orderNumber VARCHAR(100) NOT NULL UNIQUE,
          invoiceNumber VARCHAR(100),
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logs.push('   ✅ Created\n');
      
      // Verify
      logs.push('5. Verifying new table structure...');
      const [newColumns]: any = await connection.query("DESCRIBE transactions");
      logs.push(`   ✅ Table has ${newColumns.length} columns:\n`);
      newColumns.forEach((col: any) => {
        logs.push(`      - ${col.Field} (${col.Type})`);
      });
      
      await connection.end();
      
      logs.push('\n' + '='.repeat(50));
      logs.push('\n✅ SUCCESS! Database fixed!\n');
      logs.push('The transactions table now has the correct schema.');
      logs.push('You can now upload DKB PDFs without errors.');
      
      res.json({ success: true, logs: logs.join('\n') });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
  });

  // Static file serving - this includes the catch-all
  const distPath = path.resolve(process.cwd(), 'dist', 'public')
  if (fs.existsSync(distPath)) {
    console.log(`✅ Statische Dateien werden serviert von: ${distPath}`)
    app.use(express.static(distPath))
    
    // Catch-all for SPA - MUST be last (but exclude admin and API routes)
    app.get('*', (req, res) => {
      // Don't serve index.html for admin or API routes
      if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
        return res.status(404).send('Not found');
      }
      
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