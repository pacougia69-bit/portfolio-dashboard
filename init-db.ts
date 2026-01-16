/**
 * Database initialization script
 * Creates tax management tables if they don't exist
 * Runs automatically before server start
 */

import { getDb } from './server/db';
import { sql } from 'drizzle-orm';

async function initDatabase() {
  console.log('🔧 Initializing database tables...');

  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Create tax_settings table
    console.log('Creating tax_settings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_settings (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        stockLossPot decimal(10,2) NOT NULL DEFAULT 0,
        otherLossPot decimal(10,2) NOT NULL DEFAULT 0,
        maxExemptionOrder decimal(10,2) NOT NULL DEFAULT 1000,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT tax_settings_id PRIMARY KEY(id),
        CONSTRAINT tax_settings_userId_unique UNIQUE(userId)
      )
    `);
    console.log('✅ tax_settings table ready');

    // Create tax_sources table
    console.log('Creating tax_sources table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_sources (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        name varchar(100) NOT NULL,
        exemptionOrder decimal(10,2) NOT NULL DEFAULT 0,
        notes text,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT tax_sources_id PRIMARY KEY(id)
      )
    `);
    console.log('✅ tax_sources table ready');

    // Create tax_allowances table
    console.log('Creating tax_allowances table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_allowances (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        year int NOT NULL,
        amount decimal(10,2) NOT NULL DEFAULT 0,
        used decimal(10,2) NOT NULL DEFAULT 0,
        broker varchar(100),
        notes text,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT tax_allowances_id PRIMARY KEY(id)
      )
    `);
    console.log('✅ tax_allowances table ready');

    // Create loss_carryforwards table
    console.log('Creating loss_carryforwards table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS loss_carryforwards (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        year int NOT NULL,
        category enum('general','stocks','other') NOT NULL,
        amount decimal(10,2) NOT NULL DEFAULT 0,
        broker varchar(100),
        notes text,
        createdAt timestamp NOT NULL DEFAULT (now()),
        updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT loss_carryforwards_id PRIMARY KEY(id)
      )
    `);
    console.log('✅ loss_carryforwards table ready');

    console.log('✅ Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
