import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      logs.push(`  - ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
    });
    logs.push("");

    logs.push("✅ Database repair completed successfully!");
    logs.push("ℹ️  The transactions table has been recreated with the correct schema.");
    logs.push("ℹ️  All previous transaction data has been removed.");
    
    return logs;
  } catch (error: any) {
    logs.push("");
    logs.push(`❌ Error during repair: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

async function checkAndRepairDatabase() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log('[DB Check] DATABASE_URL not set, skipping check');
      return;
    }

    const connection = await mysql.createConnection(databaseUrl);
    
    try {
      // Check if transactions table exists and has the correct schema
      const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
      if (!Array.isArray(tables) || tables.length === 0) {
        console.log('[DB Check] Transactions table does not exist yet, will be created later');
        return;
      }

      const [columns]: any = await connection.query("DESCRIBE transactions");
      const columnNames = columns.map((col: any) => col.Field);
      
      // Check if we have the corrupted 'world' column or missing 'userId' column
      if (columnNames.includes('world') || !columnNames.includes('userId')) {
        console.log('[DB Repair] 🔧 Detected corrupted transactions table! Starting auto-repair...');
        console.log('[DB Repair] Current columns:', columnNames.join(', '));
        
        // Drop and recreate the table
        await connection.query("DROP TABLE IF EXISTS transactions");
        console.log('[DB Repair] ✅ Dropped corrupted table');
        
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
        console.log('[DB Repair] ✅ Created new table with correct schema');
        console.log('[DB Repair] ✅ Auto-repair completed successfully!');
      } else {
        console.log('[DB Check] ✅ Transactions table schema is correct');
      }
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('[DB Check] Error during database check/repair:', error.message);
  }
}

async function startServer() {
  // Run database check and repair on startup
  await checkAndRepairDatabase();
  
  const app = express();
  const server = createServer(app);

  // Admin endpoint to fix database schema (adds missing columns)
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

  // Admin endpoint to check current schema
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

  // dist/server -> dist/public
  const staticPath = path.resolve(__dirname, "..", "public");

  // 1) Statische Dateien (JS, CSS, Bilder) direkt ausliefern
  app.use(express.static(staticPath));

  // 2) Nur HTML‑Routen auf index.html umleiten
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/admin") ||
      req.path.startsWith("/assets") ||
      req.path.match(/.(js|css|png|jpg|jpeg|svg|ico|webp|map)$/)
    ) {
      return next(); // das sind Dateien oder Admin-Routen, nicht index.html
    }
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);