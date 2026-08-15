# Portfolio Dashboard - Datenbankstruktur

## Übersicht

Das Portfolio Dashboard nutzt **Drizzle ORM** mit einer **MySQL-kompatiblen Datenbank**. Die Datenbank speichert alle Benutzer-, Portfolio-, Transaktions- und KI-Analysedaten.

### Technische Details

- **ORM:** Drizzle ORM
- **Datenbank:** MySQL-kompatibel (PlanetScale/Railway MySQL)
- **Schema-Datei:** `drizzle/schema.ts`
- **Migrations:** `drizzle/` Ordner
- **Hauptdatei:** `server/db.ts` (alle Datenbankfunktionen)

---

## Tabellenübersicht

Das Dashboard verwendet **23 Tabellen** (Stand 15.08.2026, siehe `drizzle/schema.ts`):

| # | Tabelle | Zweck | Beziehung |
|---|---------|-------|-----------|
| 1 | `users` | Benutzerverwaltung und Authentifizierung | Elterntabelle für alle anderen |
| 2 | `portfolio_positions` | Aktuelle Portfolio-Positionen | → `users.id` |
| 3 | `watchlist_items` | Beobachtungsliste für Wertpapiere | → `users.id` |
| 4 | `dividends` | Dividendenzahlungen | → `users.id`, `portfolio_positions.id` |
| 5 | `savings_plans` | Monatliche Sparpläne | → `users.id` |
| 6 | `notes` | Benutzernotizen | → `users.id` |
| 7 | `price_cache` | Cache für Aktienkurse | Unabhängig (global) |
| 8 | `ai_analyses` | KI-Analysehistorie | → `users.id` |
| 9 | `user_settings` | Benutzereinstellungen | → `users.id` (1:1) |
| 10 | `transactions` | Kauf-/Verkaufstransaktionen | → `users.id` |
| 11 | `ai_question_templates` | Vorgefertigte KI-Fragen pro Aktie | Unabhängig (global) |
| 12 | `ai_chat_history` | Verlauf des KI-Chats | → `users.id` |
| 13 | `tax_sources` | Banken/Broker mit Freistellungsauftrag | → `users.id` |
| 14 | `tax_settings` | Verlusttöpfe + maximaler Freibetrag | → `users.id` (1:1) |
| 15 | `stock_traffic_light` | Aktien-Ampel (Trend-Signale SMA50/200) | → `users.id` |
| 16 | `tax_allowances` | Jahres-Freibeträge pro Broker | → `users.id` |
| 17 | `loss_carryforwards` | Verlustvorträge aus Vorjahren | → `users.id` |
| 18 | `tech_warning_signals` | Tech-Frühwarnsystem-Snapshots (5 Indikatoren) | → `users.id` |
| 19 | `portfolio_snapshots` | Vermögensverlauf (1 Eintrag/Tag) | → `users.id` |
| 20 | `einstiegsanalysen` | Historie abgeschlossener Kauf-Entscheidungen | → `users.id` |
| 21 | `morning_notes` | Übernacht-News-Zusammenfassungen | → `users.id` |
| 22 | `innovationsbudget_jahresziel` | Jahresziel Innovationsbudget | → `users.id` |
| 23 | `innovationsbudget_nutzung` | Verbrauchs-Einträge gg. Jahresziel | → `users.id`, `einstiegsanalysen.id` |

**Tabellen 1-10** sind der ursprüngliche Kern (Januar 2026, siehe Detailbeschreibung unten).
**Tabellen 11-23** kamen seither dazu (KI-Fragen-Feature, Steuer-Verwaltung, Aktien-Ampel,
Tech-Frühwarnsystem, Vermögensverlauf, Einstiegsanalyse, Morning Note, Innovationsbudget) —
Kurzbeschreibung je Tabelle im Abschnitt "Neuere Tabellen (seit Mai 2026)" weiter unten.

---

## 1. Tabelle: `users`

**Zweck:** Speichert alle Benutzerkonten und Authentifizierungsdaten.

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Benutzer-ID | PRIMARY KEY, AUTO_INCREMENT |
| `openId` | `varchar(64)` | Eindeutige OAuth-ID | UNIQUE, NOT NULL |
| `name` | `text` | Benutzername | Optional |
| `email` | `varchar(320)` | E-Mail-Adresse | Optional |
| `loginMethod` | `varchar(64)` | Login-Methode (z.B. "google") | Optional |
| `role` | `enum('user','admin')` | Benutzerrolle | DEFAULT 'user' |
| `pin` | `varchar(8)` | ⚠️ Legacy-Feld (nicht mehr verwendet) | DEPRECATED |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |
| `updatedAt` | `timestamp` | Letzte Änderung | ON UPDATE NOW() |
| `lastSignedIn` | `timestamp` | Letzter Login | DEFAULT NOW() |

### Beziehungen

- **1:N** → `portfolio_positions` (Ein Benutzer hat viele Positionen)
- **1:N** → `watchlist_items`
- **1:N** → `dividends`
- **1:N** → `savings_plans`
- **1:N** → `notes`
- **1:N** → `ai_analyses`
- **1:N** → `transactions`
- **1:1** → `user_settings` (Ein Benutzer hat eine Einstellung)

### Beispiel

```typescript
// Benutzer abrufen
const user = await getUserByOpenId("google_123456");
// → { id: 1, openId: "google_123456", name: "Max Mustermann", role: "user", ... }
```

---

## 2. Tabelle: `portfolio_positions`

**Zweck:** Speichert die aktuellen Wertpapier-Positionen im Portfolio.

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Positions-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `wkn` | `varchar(20)` | Wertpapierkennnummer | Optional |
| `ticker` | `varchar(20)` | Ticker-Symbol | NOT NULL |
| `name` | `varchar(255)` | Wertpapier-Name | NOT NULL |
| `type` | `enum` | Typ: Aktie, ETF, Krypto, Anleihe, Fonds | NOT NULL |
| `category` | `varchar(50)` | Kategorie (z.B. "Tech", "Clean Energy") | Optional |
| `amount` | `decimal(18,8)` | Anzahl Stücke/Anteile | NOT NULL, Precision: 8 Dezimalstellen |
| `buyPrice` | `decimal(18,4)` | Durchschnittlicher Einkaufspreis | NOT NULL |
| `currentPrice` | `decimal(18,4)` | Aktueller Kurs | Optional, wird regelmäßig aktualisiert |
| `status` | `enum` | Status: Kaufen, Halten, Verkaufen | DEFAULT 'Halten' |
| `autoUpdate` | `boolean` | Automatische Kurs-Updates? | DEFAULT true |
| `notes` | `text` | Persönliche Notizen | Optional |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |
| `updatedAt` | `timestamp` | Letzte Änderung | ON UPDATE NOW() |

### Wichtige Details

- **Decimal-Precision:** `amount` hat 8 Dezimalstellen → Unterstützt Krypto (z.B. 0.00000001 BTC)
- **Preis-Berechnung:** Wert = `amount * currentPrice`
- **Gewinn/Verlust:** `(currentPrice - buyPrice) / buyPrice * 100`

### Beispiel

```typescript
// Position erstellen
await createPortfolioPosition(userId, {
  ticker: "EUNL.DE",
  name: "MSCI World ETF",
  type: "ETF",
  category: "World",
  amount: 50,
  buyPrice: 95.50,
  currentPrice: 98.20,
  status: "Halten",
});
```

---

## 3. Tabelle: `watchlist_items`

**Zweck:** Beobachtungsliste für Wertpapiere, die man im Auge behalten möchte.

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Watchlist-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `ticker` | `varchar(20)` | Ticker-Symbol | NOT NULL |
| `wkn` | `varchar(20)` | Wertpapierkennnummer | Optional |
| `name` | `varchar(255)` | Wertpapier-Name | NOT NULL |
| `currentPrice` | `decimal(18,4)` | Aktueller Kurs | Optional |
| `targetPrice` | `decimal(18,4)` | Zielpreis für Kauf | Optional |
| `notes` | `text` | Notizen (z.B. Kaufgrund) | Optional |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |
| `updatedAt` | `timestamp` | Letzte Änderung | ON UPDATE NOW() |

### Use Case

- Wertpapiere beobachten, die man **noch nicht** gekauft hat
- Zielpreis setzen → Alert, wenn erreicht
- KI-Empfehlungen nutzen für Watchlist-Aktien

### Beispiel

```typescript
// Watchlist-Item hinzufügen
await createWatchlistItem(userId, {
  ticker: "NVDA",
  name: "NVIDIA Corporation",
  currentPrice: 450.50,
  targetPrice: 400.00,
  notes: "Warten auf Rücksetzer unter $400",
});
```

---

## 4. Tabelle: `dividends`

**Zweck:** Tracking von erhaltenen Dividendenzahlungen.

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Dividenden-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `positionId` | `int` | Zugehörige Position | → `portfolio_positions.id`, Optional |
| `ticker` | `varchar(20)` | Ticker-Symbol | NOT NULL |
| `name` | `varchar(255)` | Wertpapier-Name | NOT NULL |
| `amount` | `decimal(18,4)` | Brutto-Betrag | NOT NULL |
| `taxAmount` | `decimal(18,4)` | Abgezogene Steuer | DEFAULT 0 |
| `paymentDate` | `timestamp` | Zahlungsdatum | NOT NULL |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |

### Berechnung

- **Netto-Dividende:** `amount - taxAmount`
- **Jahresübersicht:** Summe aller Dividenden pro Jahr

### Beispiel

```typescript
// Dividende erfassen
await createDividend(userId, {
  ticker: "AAPL",
  name: "Apple Inc.",
  amount: 24.50,
  taxAmount: 6.50,
  paymentDate: "2026-03-15",
  positionId: 42,
});
```

---

## 5. Tabelle: `savings_plans`

**Zweck:** Verwaltung monatlicher Sparpläne (z.B. ETF-Sparplan).

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Sparplan-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `ticker` | `varchar(20)` | Ticker-Symbol | NOT NULL |
| `name` | `varchar(255)` | Wertpapier-Name | NOT NULL |
| `monthlyAmount` | `decimal(18,2)` | Monatlicher Betrag in € | NOT NULL |
| `executionDay` | `int` | Ausführungstag (1-28) | DEFAULT 1 |
| `isActive` | `boolean` | Aktiv/Pausiert | DEFAULT true |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |
| `updatedAt` | `timestamp` | Letzte Änderung | ON UPDATE NOW() |

### Use Case

- **Sparplan-Strategie:** Dashboard berechnet optimale Verteilung des monatlichen Budgets
- **Integration:** Sparpläne werden bei der ETF-Strategie berücksichtigt

### Beispiel

```typescript
// Sparplan anlegen
await createSavingsPlan(userId, {
  ticker: "EUNL.DE",
  name: "MSCI World ETF",
  monthlyAmount: 500,
  executionDay: 15,
  isActive: true,
});
```

---

## 6. Tabelle: `notes`

**Zweck:** Freie Notizen zu Portfolio, Strategien oder Investments.

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Notiz-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `title` | `varchar(255)` | Notiz-Titel | NOT NULL |
| `content` | `text` | Notiz-Inhalt | Optional |
| `category` | `varchar(50)` | Kategorie (z.B. "Strategie") | Optional |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |
| `updatedAt` | `timestamp` | Letzte Änderung | ON UPDATE NOW() |

### Beispiel

```typescript
// Notiz erstellen
await createNote(userId, {
  title: "Portfolio-Rebalancing Q1 2026",
  content: "World ETF von 55% auf 60% erhöhen...",
  category: "Strategie",
});
```

---

## 7. Tabelle: `price_cache`

**Zweck:** Cache für abgerufene Aktienkurse (reduziert API-Calls).

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Cache-ID | PRIMARY KEY, AUTO_INCREMENT |
| `ticker` | `varchar(20)` | Ticker-Symbol | UNIQUE, NOT NULL |
| `price` | `decimal(18,4)` | Aktueller Kurs | NOT NULL |
| `changePercent` | `decimal(10,4)` | Änderung in % | Optional |
| `currency` | `varchar(10)` | Währung | DEFAULT 'EUR' |
| `lastUpdated` | `timestamp` | Letztes Update | ON UPDATE NOW() |

### Wichtig

- **Global:** Nicht user-spezifisch → Ein Cache für alle Benutzer
- **Cache-Dauer:** Üblicherweise 15-60 Minuten
- **API-Quelle:** Twelve Data API

### Beispiel

```typescript
// Kurs cachen
await updatePriceCache("AAPL", 175.50, 2.3);
// → { ticker: "AAPL", price: 175.50, changePercent: 2.3, lastUpdated: NOW() }
```

---

## 8. Tabelle: `ai_analyses`

**Zweck:** Speichert Historie aller KI-Analysen (OpenAI).

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Analyse-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `type` | `enum` | Typ: portfolio, position, market, recommendation | NOT NULL |
| `targetTicker` | `varchar(20)` | Ticker (bei position/recommendation) | Optional |
| `analysis` | `text` | KI-Antwort (Markdown) | NOT NULL |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |

### Analyse-Typen

- **`portfolio`:** Gesamtportfolio-Analyse
- **`position`:** Einzelne Position analysieren
- **`market`:** Marktanalyse
- **`recommendation`:** Kauf-/Verkaufsempfehlung

### Beispiel

```typescript
// Analyse speichern
await saveAiAnalysis(userId, "recommendation", "Dein Portfolio ist...", "NVDA");
```

---

## 9. Tabelle: `user_settings`

**Zweck:** Benutzereinstellungen (Budget, Strategie, PIN-Sperre).

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Einstellungs-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id`, UNIQUE (1:1) |
| `monthlyBudget` | `decimal(18,2)` | Monatliches Budget in € | DEFAULT 500 |
| `targetAllocations` | `json` | Ziel-Allokation (z.B. 60/10/10/20) | JSON-Array |
| `pinEnabled` | `boolean` | PIN-Sperre aktiviert? | DEFAULT false |
| `pinHash` | `varchar(128)` | SHA-256 Hash der PIN | Optional |
| `autoLockMinutes` | `int` | Auto-Lock nach X Minuten | DEFAULT 5 |
| `createdAt` | `timestamp` | Erstellungsdatum | DEFAULT NOW() |
| `updatedAt` | `timestamp` | Letzte Änderung | ON UPDATE NOW() |

### targetAllocations Format

```json
[
  { "category": "World", "target": 60 },
  { "category": "Emerging Markets", "target": 10 },
  { "category": "Small Caps", "target": 10 },
  { "category": "Themen", "target": 20 }
]
```

### Sicherheit

- **PIN:** Wird als SHA-256 Hash gespeichert, niemals im Klartext
- **Auto-Lock:** Dashboard sperrt sich nach Inaktivität

### Beispiel

```typescript
// Einstellungen speichern
await saveUserSettings(userId, {
  monthlyBudget: 1350,
  targetAllocations: [
    { category: "World", target: 60 },
    { category: "Tech", target: 20 },
  ],
});
```

---

## 10. Tabelle: `transactions`

**Zweck:** Tracking aller Kauf-/Verkaufstransaktionen (DKB PDF Import).

### Felder

| Feld | Typ | Beschreibung | Besonderheiten |
|------|-----|--------------|----------------|
| `id` | `int` | Eindeutige Transaktions-ID | PRIMARY KEY, AUTO_INCREMENT |
| `userId` | `int` | Benutzer-ID | → `users.id` |
| `date` | `timestamp` | Transaktionsdatum | NOT NULL |
| `type` | `enum` | Typ: Kauf, Verkauf, Sparplan | NOT NULL |
| `isin` | `varchar(20)` | ISIN-Nummer | NOT NULL |
| `wkn` | `varchar(20)` | WKN | Optional |
| `name` | `varchar(255)` | Wertpapier-Name | NOT NULL |
| `quantity` | `decimal(18,8)` | Anzahl Stücke | NOT NULL |
| `price` | `decimal(18,4)` | Stückpreis | NOT NULL |
| `fees` | `decimal(18,4)` | Gebühren | DEFAULT 0 |
| `totalAmount` | `decimal(18,4)` | Gesamtbetrag | NOT NULL |
| `orderNumber` | `varchar(100)` | DKB Auftragsnummer | UNIQUE, NOT NULL |
| `invoiceNumber` | `varchar(100)` | DKB Abrechnungsnummer | Optional |
| `createdAt` | `timestamp` | Import-Datum | DEFAULT NOW() |

### Wichtig

- **Duplicate Prevention:** `orderNumber` ist UNIQUE → Verhindert doppelte Imports
- **Portfolio-Sync:** Transaktionen aktualisieren automatisch `portfolio_positions`
- **Berechnung:** `totalAmount = (quantity * price) + fees`

### Beispiel

```typescript
// Transaktion importieren (DKB PDF)
const result = await createTransaction(userId, {
  date: new Date("2026-01-05"),
  type: "Kauf",
  isin: "IE00B4L5Y983",
  wkn: "A0RPWH",
  name: "iShares Core MSCI World",
  quantity: 10.5,
  price: 95.20,
  fees: 1.50,
  totalAmount: 1000.10,
  orderNumber: "123456789",
  invoiceNumber: "INV-2026-001",
});

// → { duplicate: false, id: 42 }
```

---

## Neuere Tabellen (seit Mai 2026)

Kompakter gehalten als die Tabellen 1-10 oben — bei Bedarf direkt in `drizzle/schema.ts` nachschauen.

### 11. `ai_question_templates`
**Zweck:** Vorgefertigte KI-Fragen, die per Chat-Icon bei jeder Aktie in der Aktien-Ampel aufklappbar sind (Trend-Analyse, Kaufen/Halten/Verkaufen, Risiko-Check, News, Konkurrenz).
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `title`, `prompt` | text/varchar | Anzeigename + der eigentliche Fragetext |
| `category`, `icon` | varchar | Für die Darstellung im Frontend |
| `isActive`, `sortOrder` | boolean/int | Ein-/Ausblenden, Reihenfolge |

### 12. `ai_chat_history`
**Zweck:** Speichert den Verlauf des freien KI-Chats (Frage/Antwort-Paare).
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `role` | enum | `user` / `assistant` / `system` |
| `content` | text | Nachrichtentext |
| `templateId` | int | Falls die Nachricht aus einer Vorlage kam (→ `ai_question_templates.id`) |
| `sessionId` | varchar | Gruppiert zusammenhängende Chat-Sitzungen |

### 13. `tax_sources`
**Zweck:** Banken/Broker mit ihrem jeweiligen Freistellungsauftrag (Steuer-Verwaltung).
Felder: `name`, `exemptionOrder` (Betrag), `notes`.

### 14. `tax_settings`
**Zweck:** Verlusttöpfe und maximaler Freibetrag pro Nutzer (1:1 zu `users`).
Felder: `stockLossPot`, `otherLossPot`, `maxExemptionOrder`.

### 15. `stock_traffic_light` (Aktien-Ampel)
**Zweck:** Trend-Signal grün/gelb/rot je beobachteter Position, auf Basis SMA50/SMA200-Kreuzung.
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `sma50`, `sma200` | decimal | Gleitende Durchschnitte |
| `signal` | enum | `GRUEN` / `GELB` / `ROT` |
| `signalDetail` | varchar | Kurzbegründung |
| `lastUpdated` | timestamp | Letzter Kurs-Refresh (einzeln oder als Sammel-Update) |

### 16. `tax_allowances`
**Zweck:** Jahres-Freibeträge pro Broker, mit separat erfasstem Verbrauch.
Felder: `year`, `amount` (Freibetrag), `used` (bereits verbraucht), `broker`, `notes`.

### 17. `loss_carryforwards`
**Zweck:** Verlustvorträge aus Vorjahren, nach Kategorie getrennt.
Felder: `year`, `category` (`general`/`stocks`/`other`), `amount`, `broker`, `notes`.

### 18. `tech_warning_signals` (Tech-Frühwarnsystem)
**Zweck:** Ein Eintrag = ein Knopfdruck-Snapshot der 5 KI-Markt-Frühwarn-Indikatoren (Capex/Umsatz-Schere, Circular Financing, Effizienzsprünge, Zinsen/Inflation, Marktbreite SPY/QQQ vs. 200-Tage-Linie).
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `overallSignal` | enum | `gruen`/`gelb`/`rot` — Worst-Case aller 5 Indikatoren |
| `indicators` | json | Alle 5 Einzelsignale + Details |
| `summary` | text | KI-Kurzfassung |

Backend: `server/tech-warning.ts`, tRPC-Namespace `techWarning.*`.

### 19. `portfolio_snapshots`
**Zweck:** Vermögensverlauf-Chart auf der Startseite. Ein Eintrag pro Kalendertag, an dem das Dashboard geöffnet wurde — kein Cron nötig, wird beim Laden nachgetragen.
Felder: `snapshotDate` (`YYYY-MM-DD`), `totalValue`, `totalInvested`.

### 20. `einstiegsanalysen`
**Zweck:** Historie abgeschlossener Kauf-Entscheidungsprozesse (5-Kriterien-Checkliste + Kurssprung-Filter, siehe `PROJEKTE/Aktien-Einstiegsanalyse`).
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `kurssprung*` (6 Felder) | — | Ergebnis des Kurssprung-Filters (ausgelöst, Wochenperformance, Grund, firmenspezifisch/Sektor, Vorlauf, Konsequenz), plus `coolDown` |
| `kriterium1-4Signal/-Detail` | enum/varchar | Die 4 Checkliste-Kriterien mit Ampel + Begründung |
| `these`, `exitThese` | text | Kaufthese und Ausstiegs-Kriterium |
| `ergebnis` | enum | `KAUF_MOEGLICH` / `ABGELEHNT` / `COOLDOWN` |
| `gruenCount`/`gelbCount`/`rotCount` | int | Zusammenfassung der 4 Kriterien-Ampeln |

Backend: `server/einstiegsanalyse.ts`, tRPC-Namespace `einstiegsanalyse.*`.

### 21. `morning_notes`
**Zweck:** On-Demand-Zusammenfassung von Übernacht-News zu ausgewählten Portfolio-Positionen (Feature seit 09.08.2026).
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `headline`, `bodyMarkdown` | varchar/text | KI-generierte Zusammenfassung |
| `positionsCovered` | json | `Array<{ticker, name, hasNews}>` — welche Position tatsächlich News hatte |

Backend: `server/morning-note.ts`, tRPC-Namespace `morningNote.*`.

### 22. `innovationsbudget_jahresziel`
**Zweck:** Jahresziel für das Innovationsbudget — **manuell gepflegt**, nicht automatisch aus dem Depotwert berechnet (das Geld dafür kommt nicht immer aus dem eigenen Depot).
Felder: `jahr`, `zielbetrag`.

### 23. `innovationsbudget_nutzung`
**Zweck:** Einzelne Verbrauchs-Einträge gegen das Jahresziel, optional verknüpft mit der auslösenden Einstiegsanalyse.
Felder: `jahr`, `ticker`, `name`, `betrag`, `beschreibung`, `einstiegsanalyseId` (→ `einstiegsanalysen.id`), `datum`.

---

## Datenbankbeziehungen (ER-Diagramm)

```
┌─────────────┐
│   users     │
│  (id, ...)  │
└──────┬──────┘
       │
       ├─────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
       │         │          │          │          │          │          │          │
       ▼         ▼          ▼          ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────┐ ┌─────────┐ ┌──────┐ ┌──────────┐ ┌────────────┐
│portfolio │ │watch   │ │dividends│ │notes │ │savings  │ │ai_   │ │transac   │ │user_       │
│positions │ │list    │ │         │ │      │ │plans    │ │analy │ │tions     │ │settings    │
│          │ │items   │ │         │ │      │ │         │ │ses   │ │          │ │  (1:1)     │
└──────────┘ └────────┘ └─────────┘ └──────┘ └─────────┘ └──────┘ └──────────┘ └────────────┘
                           │
                           └──> portfolio_positions (positionId, optional)

┌──────────────┐
│ price_cache  │  ← Global (kein userId)
└──────────────┘

┌───────────────────────┐
│ ai_question_templates │  ← Global (kein userId)
└───────────────────────┘
```

**Hinweis:** Das Diagramm oben zeigt nur die 8 ursprünglichen `users`-Kindtabellen. Alle 13
neueren Tabellen (11-23) hängen ebenfalls 1:N an `users` (Ausnahme: `tax_settings` ist 1:1,
`ai_question_templates` ist wie `price_cache` global) — der Übersicht halber nicht extra
eingezeichnet, siehe Tabellenübersicht ganz oben für die vollständige Liste.

### Beziehungstypen

- **1:N (One-to-Many):** Ein User hat viele Positionen/Dividenden/etc.
- **1:1 (One-to-One):** Ein User hat genau ein user_settings
- **Optional:** `dividends.positionId` kann NULL sein

---

## Datentypen & Precision

### Decimal-Felder

| Feld-Typ | Precision | Scale | Beispiel | Verwendung |
|----------|-----------|-------|----------|------------|
| `decimal(18,8)` | 18 | 8 | `0.00000001` | Krypto-Mengen |
| `decimal(18,4)` | 18 | 4 | `1234.5678` | Preise, Beträge |
| `decimal(18,2)` | 18 | 2 | `1350.50` | Geldbeträge |
| `decimal(10,4)` | 10 | 4 | `99.9999` | Prozentsätze |

**Warum Decimal statt Float?**
- **Genauigkeit:** Keine Rundungsfehler bei Geldbeträgen
- **Finanz-Standard:** Banken/Börsen verwenden Decimal

### VARCHAR vs TEXT

- **VARCHAR(N):** Begrenzte Länge, indexierbar → Ticker, Namen
- **TEXT:** Unbegrenzt → Notizen, Analysen

---

## Migrations & Schema-Updates

### Migration-Files

- **Location:** `drizzle/*.sql`
- **Naming:** `0000_boring_warpath.sql` (automatisch generiert)
- **Anwendung:** Automatisch bei Deployment

### Neues Feld hinzufügen

```bash
# 1. Schema bearbeiten (drizzle/schema.ts)
export const users = mysqlTable("users", {
  // ... existing fields
  newField: varchar("newField", { length: 50 }),
});

# 2. Migration generieren
pnpm drizzle-kit generate:mysql

# 3. Migration anwenden
pnpm drizzle-kit push:mysql
```

---

## Häufige Queries

### Portfolio-Wert berechnen

```typescript
const positions = await getPortfolioPositions(userId);
const totalValue = positions.reduce((sum, p) => {
  const price = p.currentPrice || p.buyPrice;
  return sum + (p.amount * price);
}, 0);
```

### Dividenden pro Jahr

```typescript
const dividends2026 = await getDividends(userId, 2026);
const totalDividends = dividends2026.reduce((sum, d) => sum + d.amount - d.taxAmount, 0);
```

### Aktive Sparpläne

```typescript
const plans = await getSavingsPlans(userId);
const activePlans = plans.filter(p => p.isActive);
const monthlyTotal = activePlans.reduce((sum, p) => sum + p.monthlyAmount, 0);
```

---

## Backup & Export

### JSON-Export

```typescript
const data = await exportPortfolioData(userId);
// → Enthält: portfolio, watchlist, dividends, notes, savingsPlans
```

### Format

```json
{
  "timestamp": "2026-01-05T12:00:00.000Z",
  "portfolio": [...],
  "watchlist": [...],
  "dividends": [...],
  "notes": [...],
  "savingsPlans": [...]
}
```

### Import

```typescript
await importPortfolioData(userId, data.portfolio, data.watchlist);
// ACHTUNG: Löscht existierende Daten!
```

---

## Performance-Optimierung

### Indizes

- **Primary Keys:** Automatisch indexiert
- **Unique Fields:** `users.openId`, `price_cache.ticker`, `transactions.orderNumber`
- **Foreign Keys:** `userId` in allen Tabellen

### Caching-Strategie

1. **Kurse:** `price_cache` → 15-60 Min Cache
2. **User-Daten:** In-Memory Session-Cache
3. **Analysen:** `ai_analyses` → Historische Daten

---

## Sicherheit

### Sensitive Daten

| Feld | Schutz | Methode |
|------|--------|---------|
| `user_settings.pinHash` | ✅ Gehashed | SHA-256 |
| `users.email` | ⚠️ Verschlüsselt empfohlen | TBD |
| `transactions.orderNumber` | ✅ Unique | Duplicate Prevention |

### Best Practices

- ✅ Niemals Passwörter im Klartext
- ✅ Prepared Statements (Drizzle ORM)
- ✅ Input Validation
- ✅ User-spezifische Queries (WHERE userId = ?)

---

## Troubleshooting

### Häufige Probleme

**1. "Database not available"**
```typescript
// Ursache: DATABASE_URL fehlt in .env
// Lösung: .env Datei mit DATABASE_URL anlegen
```

**2. Duplicate Key Error (orderNumber)**
```typescript
// Ursache: Transaktion bereits importiert
// Lösung: Automatisch durch createTransaction() behandelt
// → Gibt { duplicate: true } zurück
```

**3. Decimal Conversion Fehler**
```typescript
// Ursache: Drizzle speichert Decimal als String
// Lösung: Immer Number() konvertieren beim Lesen
const amount = Number(position.amount);
```

---

## Changelog

### Version 2.0 (15.08.2026)

- ✅ Tabellenzahl 10 → 23, alle neuen Tabellen dokumentiert (siehe "Neuere Tabellen" oben)
- ✅ Wichtigste Ergänzungen seit v1.0: Aktien-Ampel (`stock_traffic_light`), Tech-Frühwarnsystem
  (`tech_warning_signals`), Vermögensverlauf (`portfolio_snapshots`), Einstiegsanalyse
  (`einstiegsanalysen`), Morning Note (`morning_notes`), Steuer-Verwaltung (`tax_sources`,
  `tax_settings`, `tax_allowances`, `loss_carryforwards`), Innovationsbudget
  (`innovationsbudget_jahresziel`, `innovationsbudget_nutzung`), KI-Fragen-Vorlagen +
  Chat-Verlauf (`ai_question_templates`, `ai_chat_history`)
- ⚠️ Diese Aktualisierung wurde nachgeholt — die Datei war seit Januar 2026 nicht mehr
  gepflegt worden, obwohl die Datenbank in der Zwischenzeit stark gewachsen ist. Künftig bei
  jeder neuen Tabelle direkt mit aktualisieren, nicht erst wieder sammeln lassen.

### Version 1.0 (Januar 2026)

- ✅ Initiale Datenbankstruktur
- ✅ 10 Haupttabellen implementiert
- ✅ DKB PDF Import mit `transactions`
- ✅ PIN-Sperre in `user_settings`
- ✅ OpenAI Integration mit `ai_analyses`

---

## Nächste Schritte (Roadmap)

- [ ] **Foreign Key Constraints:** Explizite Relationen definieren
- [ ] **Indizes optimieren:** Performance-Analyse durchführen
- [ ] **Archivierung:** Alte Transaktionen in Archive-Tabelle
- [ ] **Audit-Log:** Änderungshistorie für kritische Tabellen
- [ ] **Encryption:** E-Mail-Verschlüsselung implementieren

---

**Dokumentation erstellt:** Januar 2026
**Zuletzt aktualisiert:** 15.08.2026
**Version:** 2.0.0
**Maintainer:** Portfolio Dashboard Team (Rafael + Claude Code)
