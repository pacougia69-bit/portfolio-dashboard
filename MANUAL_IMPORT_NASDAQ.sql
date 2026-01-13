-- ============================================
-- MANUAL IMPORT: Nasdaq 100 ETF (A0F5UF)
-- Datum: 05.01.2026
-- ============================================

-- SCHRITT 1: Finde deine User ID
-- Führe dies zuerst aus:
SELECT id, username, email FROM users;

-- SCHRITT 2: Ersetze @USER_ID mit deiner tatsächlichen User ID
SET @USER_ID = 1; -- HIER DEINE USER ID EINTRAGEN!

-- SCHRITT 3: Transaktion einfügen
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
  @USER_ID,
  '2026-01-05 12:07:11',
  'Kauf',
  'DE000A0F5UF5',
  'A0F5UF',
  'ISHARE.NASDAQ-100 UCITS ETF DE INHABER-ANTEILE',
  0.3077,
  211.25,
  1.50,
  66.50,
  'MANUAL-NASDAQ-20260105-120711',
  'W00883-0000264432/26',
  NOW(),
  NOW()
);

-- SCHRITT 4: Prüfe, ob Portfolio-Position existiert
SELECT * FROM portfolio_positions
WHERE userId = @USER_ID
  AND (isin = 'DE000A0F5UF5' OR wkn = 'A0F5UF');

-- SCHRITT 5a: Falls POSITION EXISTIERT, führe UPDATE aus:
UPDATE portfolio_positions
SET
  amount = amount + 0.3077,
  buyPrice = ((amount * buyPrice) + 66.50) / (amount + 0.3077),
  updatedAt = NOW()
WHERE userId = @USER_ID
  AND (isin = 'DE000A0F5UF5' OR wkn = 'A0F5UF');

-- SCHRITT 5b: Falls POSITION NICHT EXISTIERT, führe INSERT aus:
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
  @USER_ID,
  'EQQQ.DE',
  'A0F5UF',
  'DE000A0F5UF5',
  'ISHARE.NASDAQ-100 UCITS ETF DE INHABER-ANTEILE',
  'ETF',
  0.3077,
  216.09,  -- Durchschnittskaufpreis: 66.50 / 0.3077
  211.25,
  1,
  NOW(),
  NOW()
);

-- ============================================
-- VERIFIZIERUNG
-- ============================================

-- Prüfe Transaktion:
SELECT * FROM transactions
WHERE userId = @USER_ID
  AND wkn = 'A0F5UF'
ORDER BY date DESC
LIMIT 1;

-- Prüfe Portfolio-Position:
SELECT * FROM portfolio_positions
WHERE userId = @USER_ID
  AND wkn = 'A0F5UF';

-- ============================================
-- ANLEITUNG:
-- 1. Verbinde dich mit Railway MySQL
-- 2. Führe SCHRITT 1 aus, um deine User ID zu finden
-- 3. Ersetze @USER_ID in SCHRITT 2
-- 4. Führe SCHRITT 3 aus (INSERT transaction)
-- 5. Führe SCHRITT 4 aus (CHECK if position exists)
-- 6. Führe ENTWEDER SCHRITT 5a ODER 5b aus
-- 7. Führe VERIFIZIERUNG aus
-- ============================================
