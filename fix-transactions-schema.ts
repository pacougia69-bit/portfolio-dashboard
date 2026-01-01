/**
 * Database Schema Fix Script for Transactions Table
 * 
 * This script:
 * 1. Connects to the Railway MySQL database
 * 2. Checks the current schema of the transactions table
 * 3. Adds any missing columns to match the Drizzle schema
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

async function fixTransactionsSchema() {
  console.log("🔍 Starting database schema fix...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("📡 Connecting to database...");
  const connection = await mysql.createConnection(databaseUrl);
  const db = drizzle(connection);

  try {
    // 1. Check if transactions table exists
    console.log("\n📋 Checking if transactions table exists...");
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'transactions'"
    );
    
    if (!Array.isArray(tables) || tables.length === 0) {
      console.log("❌ Transactions table does not exist!");
      console.log("   This should be created by Drizzle on first startup.");
      return;
    }
    
    console.log("✅ Transactions table exists");

    // 2. Get current columns
    console.log("\n📋 Checking current schema...");
    const [columns]: any = await connection.query(
      "DESCRIBE transactions"
    );
    
    console.log("\nCurrent columns:");
    columns.forEach((col: any) => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    const existingColumns = new Set(columns.map((col: any) => col.Field));

    // 3. Define required columns based on Drizzle schema
    const requiredColumns = [
      { 
        name: 'wkn', 
        sql: 'wkn VARCHAR(20) DEFAULT NULL AFTER isin' 
      },
      { 
        name: 'fees', 
        sql: 'fees DECIMAL(18, 4) DEFAULT "0" NOT NULL AFTER price' 
      },
      { 
        name: 'totalAmount', 
        sql: 'totalAmount DECIMAL(18, 4) NOT NULL AFTER fees' 
      },
      { 
        name: 'invoiceNumber', 
        sql: 'invoiceNumber VARCHAR(100) DEFAULT NULL AFTER orderNumber' 
      },
    ];

    // 4. Add missing columns
    const missingColumns = requiredColumns.filter(
      col => !existingColumns.has(col.name)
    );

    if (missingColumns.length === 0) {
      console.log("\n✅ All required columns already exist!");
      return;
    }

    console.log(`\n⚠️  Found ${missingColumns.length} missing columns:`);
    missingColumns.forEach(col => console.log(`  - ${col.name}`));

    console.log("\n🔧 Adding missing columns...");
    
    for (const col of missingColumns) {
      try {
        console.log(`\n  Adding column: ${col.name}`);
        await connection.query(`ALTER TABLE transactions ADD COLUMN ${col.sql}`);
        console.log(`  ✅ Successfully added ${col.name}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to add ${col.name}:`, error.message);
      }
    }

    // 5. Verify the fix
    console.log("\n\n📋 Verifying updated schema...");
    const [updatedColumns]: any = await connection.query(
      "DESCRIBE transactions"
    );
    
    console.log("\nUpdated columns:");
    updatedColumns.forEach((col: any) => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Check if all required columns now exist
    const updatedColumnNames = new Set(updatedColumns.map((col: any) => col.Field));
    const stillMissing = requiredColumns.filter(
      col => !updatedColumnNames.has(col.name)
    );

    if (stillMissing.length === 0) {
      console.log("\n✅ ✅ ✅ Schema fix completed successfully!");
      console.log("The transactions table now has all required columns.");
    } else {
      console.log("\n⚠️  Some columns are still missing:");
      stillMissing.forEach(col => console.log(`  - ${col.name}`));
    }

  } catch (error: any) {
    console.error("\n❌ Error during schema fix:", error.message);
    throw error;
  } finally {
    await connection.end();
    console.log("\n📡 Database connection closed");
  }
}

// Run the fix
fixTransactionsSchema()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
