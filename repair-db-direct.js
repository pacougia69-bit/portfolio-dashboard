// One-time script to repair the transactions table
// Run this directly: NODE_ENV=production node repair-db-direct.js

import mysql from 'mysql2/promise';

async function repairDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔧 Connecting to database...');
  const connection = await mysql.createConnection(databaseUrl);

  try {
    console.log('📋 Starting database repair...');
    console.log('⚠️  WARNING: This will DROP and recreate the transactions table!');
    console.log('');

    // Check current state
    const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
    if (Array.isArray(tables) && tables.length > 0) {
      const [columns] = await connection.query("DESCRIBE transactions");
      console.log('Current table structure:');
      columns.forEach((col) => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
      console.log('');
    } else {
      console.log('ℹ️  Transactions table does not exist yet.');
      console.log('');
    }

    // Drop existing table
    console.log('🗑️  Dropping existing transactions table...');
    await connection.query("DROP TABLE IF EXISTS transactions");
    console.log('✅ Table dropped successfully');
    console.log('');

    // Create new table with correct schema
    console.log('🏗️  Creating new transactions table with correct schema...');
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
    console.log('✅ Table created successfully');
    console.log('');

    // Verify new structure
    const [newColumns] = await connection.query("DESCRIBE transactions");
    console.log('New table structure:');
    newColumns.forEach((col) => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
    });
    console.log('');

    console.log('✅ Database repair completed successfully!');
    console.log('ℹ️  The transactions table has been recreated with the correct schema.');
    console.log('ℹ️  All previous transaction data has been removed.');
    
  } catch (error) {
    console.error('❌ Error during repair:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('🔌 Database connection closed');
  }
}

repairDatabase()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
