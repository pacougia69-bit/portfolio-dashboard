-- Drop the corrupted transactions table and recreate it
DROP TABLE IF EXISTS transactions;

CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  date TIMESTAMP NOT NULL,
  type ENUM('Kauf', 'Verkauf', 'Sparplan') NOT NULL,
  isin VARCHAR(20) NOT NULL,
  wkn VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,8) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  fees DECIMAL(18,4) DEFAULT '0',
  totalAmount DECIMAL(18,4) NOT NULL,
  orderNumber VARCHAR(100) NOT NULL UNIQUE,
  invoiceNumber VARCHAR(100),
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
