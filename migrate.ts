import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL ist nicht gesetzt');
    process.exit(1);
  }

  console.log('🔄 Starte Datenbank-Migrationen...');

  let connection;
  try {
    // Erstelle Verbindung zur Datenbank
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    // Führe Migrationen aus
    await migrate(db, { migrationsFolder: './drizzle' });

    console.log('✅ Migrationen erfolgreich durchgeführt!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migrations-Fehler:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigrations();
