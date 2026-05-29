# NOTFALLPLAN: Portfolio Dashboard (Stand: 29.05.2026)

## 1. Technischer Überblick (Dashboard)
- **Frontend:** React 19 + TypeScript, Tailwind CSS 4, shadcn/ui, Wouter (Routing), tRPC + TanStack React Query
- **Backend:** Node.js + Express, tRPC v11 (Type-Safe API), Drizzle ORM
- **Datenbank:** MySQL (Railway-interner Service, Connection via `DATABASE_URL`)
- **Build:** Vite (Client) + esbuild (Server) → `dist/`
- **Paketmanager:** pnpm (Railway nutzt `--frozen-lockfile`)
- **Hosting:** Railway, auto-deploy bei jedem `git push origin main`
- **Auth:** OAuth + JWT-Cookies, optional PIN-Sperre

## 2. KI- und Datenquellen
- **OpenAI API:** Portfolio-Analysen, Sparplan-Empfehlungen, KI-Chat, Tech-Frühwarnsystem (Chat Completions + Responses API mit `web_search_preview`)
- **Twelve Data:** Live-Aktienkurse, EUR/USD-Rate, Marktbreite (SPY/QQQ vs. GD200) — Free Tier 800 Calls/Tag
- **Yahoo Finance:** Fallback für Kurse, läuft auf Home Assistant (siehe CLAUDE.md im Userverzeichnis)
- **FRED API:** Fed Funds Rate + Core CPI YoY für das Tech-Frühwarnsystem — kostenlos, registrierungspflichtig

## 3. Datenbank & Persistenz
**WICHTIG — anders als früher:** Das Dashboard nutzt jetzt **MySQL auf Railway** (kein SQLite mehr, keine lokale Datei). Railway hat persistenten Speicher, deshalb sind die Daten online sicher.

- Alle User-Daten (Portfolio, Watchlist, Dividenden, Transaktionen, Notizen, Sparpläne, Tech-Frühwarnsystem-Snapshots) liegen in der MySQL auf Railway
- Schema-Quelle: `drizzle/schema.ts` im Code-Repo
- Migrationen: SQL-Dateien in `drizzle/`, automatisch ausgeführt beim Server-Start (`runDatabaseMigration` in `server/_core/index.prod.ts`)
- **Backup-Pflicht:** Railway-Plan prüfen, ob automatische Snapshots aktiviert sind (MySQL-Service → Backups-Tab). Monatlich auch ein **JSON-Export** via Dashboard ziehen (Einstellungen → Export)

## 4. Backup-Strategie (3-2-1 Regel)
- **Code:** GitHub Branch `main` (`git push` nach jeder Änderung)
- **DB-Daten:** Railway automatische Snapshots + monatlicher JSON-Export aus dem Dashboard
- **Cloud-Backup-Ordner:** `Google Drive / OneDrive` → `Backup_Portfolio_Dashboard/`
  - `01_Code_Snapshots/` — monatliches ZIP des Projektordners
  - `02_Daten_Backups/` — JSON-Exporte aus dem Dashboard
  - `03_Konfiguration_Doku/` — diesen Notfallplan, ENV-Variablen-Liste (Namen, nicht Werte!), API-Key-Hinweise

## 5. Environment-Variablen (Railway → Variables)
| Variable | Pflicht | Zweck |
|---|---|---|
| `DATABASE_URL` | ja | MySQL-Connection, stellt Railway automatisch |
| `JWT_SECRET` | ja | Cookie-Signierung |
| `OPENAI_API_KEY` | ja | KI-Features inkl. Tech-Frühwarnsystem |
| `OAUTH_SERVER_URL` | ja | OAuth-Redirect (= Railway-App-URL) |
| `VITE_APP_ID` | ja | App-Identifier für OAuth |
| `OWNER_OPEN_ID` | ja | OpenID von Rafael = Admin |
| `TWELVE_DATA_API_KEY` | empfohlen | Live-Kurse + Marktbreite |
| `FRED_API_KEY` | empfohlen | Tech-Frühwarnsystem Zinsen/Inflation |
| `NODE_ENV=production` | ja | wird von Railway gesetzt |
| `PORT` | auto | Railway setzt das automatisch |

## 6. Fixkosten
| Dienst | Zweck | Kosten (ca.) |
|---|---|---|
| **GitHub** | Code-Speicher | 0 € |
| **Railway** | Hosting + MySQL | < 5 $ / Monat |
| **OpenAI** | Dashboard-KI + Tech-Frühwarnsystem | Nutzungsbasiert (typisch Cent–niedrige €) |
| **FRED** | US-Zinsen / Inflation | 0 € |
| **Twelve Data** | Live-Kurse + Marktbreite | 0 € (Free Tier 800 Calls/Tag) |

Passwörter & API-Keys sind im Passwort-Manager (z.B. Bitwarden) gespeichert.

## 7. Wiederherstellung auf neuem Laptop
1. **Umgebung:** Node.js 20+, pnpm, Git Bash (Windows) installieren
2. **Repo klonen:** `git clone https://github.com/pacougia69/portfolio-dashboard.git` (Ziel: `C:\Users\rafae\Desktop\Projekte\portfolio-dashboard\`)
3. **Dependencies:** `pnpm install` im Projektordner
4. **`.env` lokal anlegen** (für lokale Entwicklung) — Werte aus `03_Konfiguration_Doku/` oder vom Bitwarden:
   - `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `TWELVE_DATA_API_KEY`, `FRED_API_KEY`, `OWNER_OPEN_ID`, etc.
5. **Lokal testen:** `pnpm dev` → http://localhost:3000
6. **Build prüfen:** `pnpm build` (Vite + esbuild müssen sauber durchlaufen)
7. **Railway:** Falls Railway-Projekt verloren, neues anlegen, MySQL-Service hinzufügen, alle ENV-Variablen setzen (siehe Punkt 5), GitHub-Repo verbinden → auto-deploy

## 8. Strategie-Check — 5+1 Wellen-Strategie (seit Mai 2026)
| Welle | Kategorie | Ziel-% | WKN |
|---|---|---|---|
| 1 | Kern (MSCI World) | 50 % | A0RPWH |
| 2 | EM (Emerging Markets) | 15 % | A111X9 |
| 3 | KI-Infrastruktur | 10 % | A40L9T |
| 4 | Infrastruktur | 10 % | A3D6N1 |
| 5 | Healthcare | 10 % | A113FD |
| +1 | Puffer (iBonds 2030) | 5 % | A40KHS |

**Summe: 100 %**

Die Ziel-Prozente müssen an drei Stellen im Code konsistent sein (siehe CLAUDE.md im Projektordner):
- `client/src/pages/StrategiePage.tsx` → `DEFAULT_ALLOCATIONS`
- `client/src/pages/DashboardPage.tsx` → `STRATEGY_TARGETS`
- `server/routers.ts` → `individualETFTargets` im `rebalancing.analyze` Endpoint

Bei Extra-Geld: Erst Rebalancing-Modul im Dashboard prüfen, dann investieren.

## 9. Hauptseiten (Routen)
| Route | Datei | Funktion |
|---|---|---|
| `/` | DashboardPage.tsx | Gesamtübersicht, Rebalancing, Investment-Vorschläge |
| `/strategie` | StrategiePage.tsx | Ziel-Allokation, Sparplan-Verteilung, KI-Empfehlung |
| `/rebalancing` | RebalancingPage.tsx | Einmalsumme optimal verteilen |
| `/portfolio` | PortfolioPage.tsx | Alle Positionen verwalten |
| `/dividenden` | DividendenPage.tsx | Dividenden-Tracking |
| `/watchlist` | WatchlistPage.tsx | Beobachtungsliste |
| `/ki-assistent` | AIAssistantPage.tsx | KI-Chat mit Portfolio-Kontext |
| `/tech-fruehwarnsystem` | TechFruehwarnsystemPage.tsx | Tech-Crash-Frühwarnsystem (5 Indikatoren + Verlauf) |
| `/einstellungen` | EinstellungenPage.tsx | DKB-PDF-Import, Einstellungen |

## 10. Tech-Frühwarnsystem — 5 Indikatoren (seit 29.05.2026)
Per Knopfdruck wird ein Snapshot mit fünf Indikatoren geholt:
1. **Capex/Umsatz-Schere** bei MSFT/GOOGL/AMZN/NVDA (OpenAI Web-Suche)
2. **Circular Financing** News-Scan (OpenAI Web-Suche)
3. **Effizienz-Sprünge** / DeepSeek-Effekt (OpenAI Web-Suche)
4. **Zinsen & Inflation** Fed Funds + Core CPI (FRED)
5. **Marktbreite** SPY + QQQ vs. GD200 (Twelve Data)

Jeder Snapshot wird in der DB-Tabelle `tech_warning_signals` gespeichert. Die Seite zeigt automatisch die letzten 10 Snapshots als Verlaufs-Leiste.

Bei Problemen: Railway-Logs nach `[tech-warning]` filtern.

## 11. Checkpoints / Änderungsprotokoll

### Checkpoint 2026-05-29 — Tech-Frühwarnsystem live
- 5-Indikatoren-Frühwarnsystem als 4. Säule integriert
- Verlaufs-Historie der letzten Snapshots in der Seite eingebaut
- 5+1 Wellen-Strategie ist die aktive Anlage-Strategie
- Stack umgestellt: MySQL statt SQLite, Express+tRPC statt Hono

### Checkpoint 2026-01-01 — ETF-Strategie-Fix
- Sparrate auf 1.350 € korrekt konfiguriert
- Datenbank bereinigt und validiert
- ETF-Strategie-Modul funktionsfähig
- **Wiederherstellung auf diesen Stand:**
  ```bash
  cd C:/Users/rafae/Desktop/Projekte/portfolio-dashboard
  git fetch origin
  git checkout checkpoint-2026-01-01
  ```
