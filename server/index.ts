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

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Admin endpoint to fix database schema
  app.get("/admin/fix-schema", async (req, res) => {
    try {
      const logs = await fixTransactionsSchema();
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
      req.path.startsWith("/assets") ||
      req.path.match(/.(js|css|png|jpg|jpeg|svg|ico|webp|map)$/)
    ) {
      return next(); // das sind Dateien, nicht index.html
    }
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);