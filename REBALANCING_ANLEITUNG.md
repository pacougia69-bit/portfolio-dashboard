# Portfolio Rebalancing Analyzer - Anleitung

## 📊 Was macht dieses Tool?

Das **Rebalancing Analyzer Script** berechnet die optimale Verteilung einer Einmalsumme (z.B. 10.000 €) für dein Portfolio-Rebalancing.

### Features:
- ✅ Liest aktuelle Portfolio-Positionen aus der Datenbank
- ✅ Vergleicht Ist-Verteilung mit Soll-Verteilung (aus `user_settings`)
- ✅ Identifiziert untergewichtete und übergewichtete Gruppen
- ✅ Verteilt verfügbares Kapital **proportional zur Untergewichtung**
- ✅ Übergewichtete Gruppen erhalten **0 €**
- ✅ Ignoriert Watchlist komplett

---

## 🚀 Anleitung: Script ausführen

### Voraussetzungen:
- Node.js installiert
- Projekt-Dependencies installiert (`pnpm install`)
- **Datenbank-Verbindung** (lokal oder Railway)

### Schritt 1: Kapital anpassen (optional)

Öffne `server/rebalancing-analyzer.ts` und ändere den Wert:

```typescript
// KONFIGURATION - Hier anpassbar!
const VERFUEGBARES_KAPITAL = 10000; // In Euro - Hier ändern!
const USER_ID = 1; // Deine User-ID
```

**Beispiele:**
- `2000` → Analyse für 2.000 €
- `5000` → Analyse für 5.000 €
- `10000` → Analyse für 10.000 €

### Schritt 2: Script ausführen

#### Methode A: Mit tsx (empfohlen)

```bash
pnpm tsx server/rebalancing-analyzer.ts
```

#### Methode B: Mit ts-node

```bash
npx ts-node server/rebalancing-analyzer.ts
```

#### Methode C: Kompilieren und ausführen

```bash
pnpm tsc server/rebalancing-analyzer.ts
node server/rebalancing-analyzer.js
```

---

## 📋 Beispiel-Ausgabe

```
=== Portfolio Rebalancing Analyse ===

Verfügbares Kapital: 10.000 €

Gefundene Positionen: 25

Ziel-Allokation (4 Gruppen):
  - World: 60%
  - Emerging Markets: 10%
  - Small Caps: 10%
  - Themen: 20%

Aktueller Portfolio-Wert: 45.320,50 €

=== IST-VERTEILUNG vs SOLL-VERTEILUNG ===

UNTERGEWICHTETE GRUPPEN (erhalten Geld):
  Emerging Markets:
    Ist:  5.20%
    Soll: 10.00%
    Diff: -4.80% (4.80% zu wenig)

  Small Caps:
    Ist:  7.50%
    Soll: 10.00%
    Diff: -2.50% (2.50% zu wenig)

ÜBERGEWICHTETE GRUPPEN (erhalten KEIN Geld):
  World:
    Ist:  62.30%
    Soll: 60.00%
    Diff: +2.30% (2.30% zu viel)

  Themen:
    Ist:  25.00%
    Soll: 20.00%
    Diff: +5.00% (5.00% zu viel)

=== INVESTITIONS-VERTEILUNG ===

Verfügbares Kapital: 10.000 €

Verteilung:
  Emerging Markets:
    Betrag: 6.575,34 €
    Grund:  4.80% untergewichtet

  Small Caps:
    Betrag: 3.424,66 €
    Grund:  2.50% untergewichtet

Gesamt investiert: 10.000,00 €
Rundungsdifferenz: 0,00 €

=== ZUSAMMENFASSUNG ===

Portfolio-Wert: 45.320,50 €
Untergewichtete Gruppen: 2
Größte Untergewichtung: Emerging Markets
Zu investieren: 10.000 €
Tatsächlich verteilt: 10.000,00 €

✅ Analyse abgeschlossen!
```

---

## 📊 Interpretation der Ergebnisse

### 1. Untergewichtete Gruppen

**Beispiel:** Emerging Markets ist 4.80% untergewichtet
- **Bedeutung:** Diese Gruppe hat aktuell 5.20%, sollte aber 10.00% haben
- **Aktion:** Erhält **6.575,34 €** von den 10.000 € (65.75%)
- **Grund:** Proportional zur Untergewichtung (4.80% von insgesamt 7.30%)

### 2. Übergewichtete Gruppen

**Beispiel:** Themen ist 5.00% übergewichtet
- **Bedeutung:** Diese Gruppe hat aktuell 25.00%, sollte aber nur 20.00% haben
- **Aktion:** Erhält **0,00 €**
- **Grund:** Bereits zu stark gewichtet

### 3. Proportionale Verteilung

Die Formel:
```
Betrag = Verfügbares Kapital × (Untergewichtung Gruppe / Gesamt-Untergewichtung)
```

**Beispiel:**
- Gesamt-Untergewichtung: 4.80% + 2.50% = 7.30%
- Emerging Markets: 10.000 € × (4.80% / 7.30%) = 6.575,34 €
- Small Caps: 10.000 € × (2.50% / 7.30%) = 3.424,66 €

---

## 🔧 Anpassungen

### Kapital ändern

**Für 2.000 €:**
```typescript
const VERFUEGBARES_KAPITAL = 2000;
```

**Für 5.000 €:**
```typescript
const VERFUEGBARES_KAPITAL = 5000;
```

### User-ID ändern

Wenn du mehrere User hast:
```typescript
const USER_ID = 2; // Andere User-ID
```

---

## ⚠️ Wichtige Hinweise

### 1. Datenbank-Verbindung

Das Script benötigt Zugriff auf deine Datenbank:
- **Lokal:** SQLite-Datei muss existieren
- **Railway:** `DATABASE_URL` in `.env` muss gesetzt sein

### 2. Ziel-Allokation muss existieren

In `user_settings` muss `targetAllocations` definiert sein:

```json
{
  "targetAllocations": [
    { "category": "World", "target": 60 },
    { "category": "Emerging Markets", "target": 10 },
    { "category": "Small Caps", "target": 10 },
    { "category": "Themen", "target": 20 }
  ]
}
```

**Wenn nicht vorhanden:**
- Gehe zu `/einstellungen` im Dashboard
- Setze deine Strategie (z.B. 60/10/10/20)

### 3. Portfolio-Positionen müssen kategorisiert sein

Jede Position in `portfolio_positions` muss eine `category` haben:
- World → `category: "World"`
- Emerging Markets → `category: "Emerging Markets"`
- etc.

**Wenn Positionen keine Kategorie haben:**
- Sie werden als "Ohne Kategorie" gruppiert
- Können nicht für Rebalancing verwendet werden

---

## 🐛 Fehlerbehebung

### Fehler: "Keine Portfolio-Positionen gefunden"

**Lösung:**
- Prüfe ob `portfolio_positions` Einträge hat
- Prüfe `USER_ID` (standardmäßig: 1)

### Fehler: "Keine Ziel-Allokation gefunden"

**Lösung:**
- Gehe zu `/einstellungen` → Strategie setzen
- Oder manuell in `user_settings` eintragen

### Fehler: "Database not available"

**Lösung:**
- Prüfe `.env` Datei: `DATABASE_URL` gesetzt?
- Lokal: SQLite-Datei existiert?
- Railway: Deployment läuft?

---

## 📊 Export als JSON

Wenn du die Ergebnisse als JSON brauchst:

**In `rebalancing-analyzer.ts` aktivieren:**
```typescript
// Am Ende der main() Funktion:
console.log(JSON.stringify(result, null, 2));
```

**Dann:**
```bash
pnpm tsx server/rebalancing-analyzer.ts > rebalancing-result.json
```

---

## 🔄 Integration ins Dashboard (Optional)

Du kannst das Script auch als **tRPC-Endpoint** verfügbar machen:

1. Import in `server/routers.ts`:
```typescript
import { analyzeRebalancing } from './rebalancing-analyzer';
```

2. Neuer Endpoint:
```typescript
rebalancing: router({
  analyze: protectedProcedure
    .input(z.object({
      amount: z.number().min(0),
    }))
    .query(async ({ ctx, input }) => {
      return analyzeRebalancing(ctx.user.id, input.amount);
    }),
}),
```

3. Neue Seite im Frontend erstellen (z.B. `/rebalancing`)

---

## 📚 Weitere Informationen

- **DB_STRUCTURE.md** → Datenbank-Struktur
- **OPENAI_INTEGRATION.md** → KI-Integration
- **PIN_LOCK_FIX_REPORT.md** → PIN-Sperre

---

**Erstellt:** Januar 2026
**Version:** 1.0.0
**Maintainer:** Portfolio Dashboard Team
