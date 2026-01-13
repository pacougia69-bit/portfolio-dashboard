-- Manual import script for Nasdaq 100 ETF transaction
-- WKN: A0F5UF / ISIN: DE000A0F5UF5
-- Date: 05.01.2026
-- Quantity: 0.3077 shares
-- Price: 211.25 EUR
-- Total: 66.50 EUR (including 1.50 EUR fees)

-- STEP 1: Insert transaction
INSERT INTO transactions (
  userId,
  date,
  type,
  isin,
  wkn,
  name,
  quantity,
  price,
  fees,
  totalAmount,
  orderNumber,
  invoiceNumber,
  createdAt,
  updatedAt
) VALUES (
  1, -- ADJUST THIS: Replace with your actual user ID (check users table)
  '2026-01-05 12:00:00',
  'Kauf',
  'DE000A0F5UF5',
  'A0F5UF',
  'Nasdaq 100 ETF',
  0.3077,
  211.25,
  1.50,
  66.50,
  'MANUAL-IMPORT-A0F5UF-20260105',
  'MANUAL-A0F5UF-001',
  NOW(),
  NOW()
);

-- STEP 2: Update or insert portfolio position
-- First, check if position exists:
-- SELECT * FROM portfolio_positions WHERE userId = 1 AND (isin = 'DE000A0F5UF5' OR wkn = 'A0F5UF');

-- If position EXISTS, run this UPDATE:
/*
UPDATE portfolio_positions
SET
  amount = amount + 0.3077,
  buyPrice = ((amount * buyPrice) + 66.50) / (amount + 0.3077),
  updatedAt = NOW()
WHERE userId = 1
  AND (isin = 'DE000A0F5UF5' OR wkn = 'A0F5UF');
*/

-- If position DOES NOT EXIST, run this INSERT instead:
/*
INSERT INTO portfolio_positions (
  userId,
  ticker,
  wkn,
  isin,
  name,
  type,
  amount,
  buyPrice,
  currentPrice,
  autoUpdate,
  createdAt,
  updatedAt
) VALUES (
  1, -- ADJUST THIS: Replace with your actual user ID
  'EQQQ.DE', -- Nasdaq 100 ETF ticker on Xetra
  'A0F5UF',
  'DE000A0F5UF5',
  'Nasdaq 100 ETF',
  'ETF',
  0.3077,
  216.09, -- Average buy price (66.50 / 0.3077)
  211.25, -- Current price at purchase
  1, -- Auto-update enabled
  NOW(),
  NOW()
);
*/

-- INSTRUCTIONS:
-- 1. Connect to your Railway MySQL database
-- 2. Find your user ID: SELECT * FROM users;
-- 3. Replace "1" in the SQL above with your actual userId
-- 4. Execute STEP 1 (INSERT transaction)
-- 5. Check if portfolio position exists
-- 6. Execute either the UPDATE or INSERT from STEP 2
