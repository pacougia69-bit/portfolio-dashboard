/**
 * Auto-create media_insights table if it doesn't exist
 * This runs on server startup to ensure the table is always available
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

export async function ensureMediaInsightsTable() {
  console.log('🔍 Checking media_insights table...');

  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available for migration');
    return false;
  }

  try {
    // Create table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS media_insights (
        id int AUTO_INCREMENT NOT NULL,
        userId int NOT NULL,
        assetId int DEFAULT NULL,
        title varchar(255) NOT NULL,
        summary text,
        source varchar(100),
        imageUrl varchar(500),
        pdfUrl varchar(500),
        analysisData json DEFAULT NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_userId (userId),
        KEY idx_assetId (assetId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ media_insights table ready');
    return true;
  } catch (error) {
    console.error('❌ Failed to ensure media_insights table:', error);
    return false;
  }
}
