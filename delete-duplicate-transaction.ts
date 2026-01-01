import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { transactions } from "./drizzle/schema";

async function deleteDuplicateTransaction() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set");
  }

  console.log("Connecting to database...");
  const connection = await mysql.createConnection(databaseUrl);
  const db = drizzle(connection);

  try {
    // Delete transaction with orderNumber 219905/74.00
    console.log("Deleting transaction with orderNumber: 219905/74.00");
    const result = await db.delete(transactions)
      .where(eq(transactions.orderNumber, "219905/74.00"));
    
    console.log("✅ Transaction deleted successfully");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await connection.end();
  }
}

deleteDuplicateTransaction();
