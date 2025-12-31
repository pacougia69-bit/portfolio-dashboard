const { drizzle } = require("drizzle-orm/mysql2");
const mysql = require("mysql2/promise");

async function checkDB() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  const results = await connection.query("SELECT id, orderNumber, invoiceNumber FROM transactions LIMIT 5");
  console.log("Transactions in DB:");
  console.log(JSON.stringify(results[0], null, 2));
  
  await connection.end();
}

checkDB().catch(console.error);
