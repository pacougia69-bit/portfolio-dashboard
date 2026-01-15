/**
 * Database initialization script
 * Creates tax management tables if they don't exist
 * Runs automatically before server start
 */

import { getDb } from './server/db';

async function initDatabase() {
  console.log('🔧 Initializing database tables...');

  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Create tax_settings table
    console.log('Creating tax_settings table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`tax_settings\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`stockLossPot\` decimal(10,2) NOT NULL DEFAULT '0',
        \`otherLossPot\` decimal(10,2) NOT NULL DEFAULT '0',
        \`maxExemptionOrder\` decimal(10,2) NOT NULL DEFAULT '1000',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`tax_settings_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`tax_settings_userId_unique\` UNIQUE(\`userId\`)
      )
    `);
    console.log('✅ tax_settings table ready');

    // Create tax_sources table
    console.log('Creating tax_sources table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`tax_sources\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`exemptionOrder\` decimal(10,2) NOT NULL DEFAULT '0',
        \`notes\` text,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`tax_sources_id\` PRIMARY KEY(\`id\`)
      )
    `);
    console.log('✅ tax_sources table ready');

    console.log('✅ Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
