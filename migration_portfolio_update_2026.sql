-- ============================================================
-- Portfolio Update – Mai 2026
-- Ausführen auf Railway MySQL (z.B. via Railway CLI oder DB-Client)
-- WICHTIG: Zuerst auf einem Test-Backup testen!
-- ============================================================

-- Deine userId (bitte vor Ausführung prüfen / anpassen):
SET @userId = 1;

-- ============================================================
-- 1. NEUE POSITIONEN HINZUFÜGEN
-- ============================================================

INSERT INTO portfolio_positions (userId, wkn, ticker, name, type, category, amount, buyPrice, status, autoUpdate)
VALUES
  (@userId, 'A113FD', 'XDWH.DE', 'Xtrackers MSCI World Health Care UCITS ETF', 'ETF', 'Healthcare', 85,    46.89, 'Halten', true),
  (@userId, 'A3D6N1', 'CBUX.DE', 'iShares Global Infrastructure UCITS ETF',     'ETF', 'Infra',      669,   5.98,  'Halten', true),
  (@userId, 'A40L9T', 'AIFS.DE', 'iShares AI Infrastructure UCITS ETF',          'ETF', 'Thema AI',   456,   8.77,  'Kaufen', true);

-- ============================================================
-- 2. ALTE POSITIONEN LÖSCHEN
-- ============================================================

DELETE FROM portfolio_positions
WHERE userId = @userId AND wkn IN ('A1KWPR', 'A3D47K', 'A0MW0M');

-- ============================================================
-- 3. EINFRIEREN: A2N6LC und A3EB9T → Status auf 'Halten' setzen
--    (kein eigener "frozen"-Status in der DB; 'Halten' = Position
--     bleibt, kein aktiver Kauf mehr)
-- ============================================================

UPDATE portfolio_positions
SET status = 'Halten', notes = CONCAT(IFNULL(notes, ''), ' [Eingefroren Mai 2026]')
WHERE userId = @userId AND wkn IN ('A2N6LC', 'A3EB9T');

-- ============================================================
-- 4. SPARPLÄNE AKTUALISIEREN / ANLEGEN
--    Erst alle alten Pläne des Users deaktivieren,
--    dann neue anlegen.
-- ============================================================

-- Alle bestehenden Sparpläne deaktivieren
UPDATE savings_plans SET isActive = false WHERE userId = @userId;

-- Neue Sparpläne anlegen
INSERT INTO savings_plans (userId, ticker, name, monthlyAmount, executionDay, isActive)
VALUES
  (@userId, 'EUNL.DE', 'iShares Core MSCI World ETF (A0RPWH)',          500.00, 1, true),
  (@userId, 'AIFS.DE', 'iShares AI Infrastructure ETF (A40L9T)',         350.00, 1, true),
  (@userId, 'CBUX.DE', 'iShares Global Infrastructure ETF (A3D6N1)',     250.00, 1, true),
  (@userId, 'IS3N.DE', 'iShares Core MSCI EM IMI ETF (A111X9)',          150.00, 1, true),
  (@userId, 'XDWH.DE', 'Xtrackers MSCI World Health Care ETF (A113FD)',  100.00, 1, true),
  (@userId, '30IA.DE', 'iShares iBonds Dec 2030 EUR Corp ETF (A40KHS)',   50.00, 1, true);

-- ============================================================
-- PRÜFUNG: Ergebnis anzeigen
-- ============================================================

SELECT 'Neue Positionen:' AS info;
SELECT wkn, ticker, name, amount, buyPrice, status FROM portfolio_positions
WHERE userId = @userId AND wkn IN ('A113FD', 'A3D6N1', 'A40L9T');

SELECT 'Eingefrorene Positionen:' AS info;
SELECT wkn, ticker, name, status, notes FROM portfolio_positions
WHERE userId = @userId AND wkn IN ('A2N6LC', 'A3EB9T');

SELECT 'Aktive Sparpläne:' AS info;
SELECT ticker, name, monthlyAmount FROM savings_plans
WHERE userId = @userId AND isActive = true ORDER BY monthlyAmount DESC;
