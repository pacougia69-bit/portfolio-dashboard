# Portfolio Dashboard

## Projektstruktur

- **Frontend:** React + TypeScript + Vite, in `client/src/`
- **Backend:** Express + tRPC + Drizzle ORM (MySQL), in `server/`
- **DB-Migrationen:** `drizzle/` (SQL-Dateien)
- **Build:** Vite (Client) + esbuild (Server) → `dist/`
- **Deployment:** Railway (Nixpacks), Config in `railway.json`

## Aktuelle Strategie: Depot-Struktur 2026 (Finalplan 06.07.2026, löst 5+1 Wellen ab)

| Baustein | Kategorie | Ziel-% | WKN | Status |
|----------|-----------|--------|-----|--------|
| 1 | Kern (All-World) | 39% | A3D7QX | Sparplan 850 €/Monat |
| 2 | Anleihen (Global Aggregate) | 17% | A2H6ZT | Sparplan 550 €/Monat |
| 3 | Small Caps | 11% | A2DWBY | Halten |
| 4 | KI-Wette | 11% | A2N6LC | EINGEFROREN — kein neues Geld, nie Kaufempfehlung |
| 5 | Defence-Wette | 11% | A3EB9T | EINGEFROREN — kein neues Geld, nie Kaufempfehlung |
| 6 | iBonds 2030 | 11% | A40KHS | Hält bis Auslauf Ende 2030 |

**Summe: 100%** · Verkauft Juli 2026 (Doppelungen): A0RPWH, A111X9, A40L9T, A3D6N1, A113FD
Hintergrund: `C:\Users\rafae\Claude.Dateien\PROJEKTE\Portfolio-Dashboard\ETF-STRATEGIE.md`

## Wo sind die Zielwerte definiert?

Die Strategie-Prozente müssen an 4 Stellen konsistent sein:

1. **`client/src/pages/StrategiePage.tsx`** — `DEFAULT_ALLOCATIONS` (Zeile ~56)
   - Wird als Fallback verwendet, wenn der User noch keine eigenen Settings gespeichert hat
   - Kategorienamen: "Kern (All-World)", "Anleihen (Global Aggregate)", "Small Caps", "KI-Wette (eingefroren)", "Defence-Wette (eingefroren)", "iBonds 2030"

2. **`client/src/pages/DashboardPage.tsx`** — `STRATEGY_TARGETS` (Zeile ~160)
   - Steuert die Rebalancing-Anzeige und Investment-Vorschläge im Dashboard
   - Nutzt WKN-basierte Zuordnung; `frozen: true` schließt eine Position von allen Kaufempfehlungen aus

3. **`server/routers.ts`** — `individualETFTargets` (im Sparplan-/Rebalancing-Endpoint, Zeile ~1203)
   - Server-seitige Rebalancing-Berechnung für die RebalancingPage
   - Nutzt ebenfalls WKN-basierte Zuordnung

4. **`server/dkb-parser.ts`** — `WKN_STRATEGY_MAP` (Zeile ~21)
   - Kategorisiert importierte DKB-Abrechnungen; verkaufte WKNs bleiben als "Verkauft 2026" gemappt

## Deployment (Railway)

- Builder: Nixpacks mit pnpm
- Build: `pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start` (→ `node dist/index.prod.js`)
- Health-Check: `GET /health`
- `.npmrc` enthält `strict-peer-dependencies=false` wegen zod@4 / openai Peer-Konflikt
- Alle devDependencies sind in `dependencies` (Railway installiert keine devDeps)

## Infrastruktur & Wiederherstellung

### Wo läuft das System?

- **Hosting:** Railway (https://railway.app)
- **Datenbank:** MySQL (Railway-interner Service, URL via `DATABASE_URL` Env-Var)
- **Git-Repo:** GitHub, Branch `main` → Railway auto-deploy bei Push
- **Domain:** Wird über Railway bereitgestellt

### Benötigte Environment-Variablen (Railway)

| Variable | Zweck |
|----------|-------|
| `DATABASE_URL` | MySQL-Connection-String (Railway stellt das automatisch bereit) |
| `JWT_SECRET` | Cookie-Signierung für Auth |
| `OPENAI_API_KEY` | KI-Analyse-Features (Portfolio-Analyse, Chat) |
| `TWELVE_DATA_API_KEY` | Live-Kurse (optional, Fallback: Yahoo Finance) |
| `OAUTH_SERVER_URL` | OAuth-Redirect-URL (= Railway-App-URL) |
| `VITE_APP_ID` | App-Identifier für OAuth |
| `OWNER_OPEN_ID` | OpenID des Admin-Users (Rafael) |
| `NODE_ENV` | `production` auf Railway |
| `PORT` | Railway setzt das automatisch |

### Externe Services

- **OpenAI API** — GPT für Portfolio-Analyse, Sparplan-Empfehlungen, Chat
- **Twelve Data API** — Live-Aktienkurse (kostenloser Tier reicht)
- **Yahoo Finance** — Fallback für Kurse wenn kein Twelve Data Key

### Neuaufsetzen von Null (Disaster Recovery)

1. Repo von GitHub klonen
2. Railway-Projekt erstellen, MySQL-Service hinzufügen
3. Env-Vars setzen (siehe Tabelle oben)
4. Push auf `main` → Railway baut automatisch
5. Erster Start führt DB-Migrationen aus (`dist/drizzle/` wird kopiert)
6. Login über OAuth → erster User mit `OWNER_OPEN_ID` wird Admin

### Tech-Stack Übersicht

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Recharts, Framer Motion |
| UI-Lib | shadcn/ui (Radix Primitives) |
| Routing | Wouter (Client-Side SPA) |
| State | TanStack React Query + tRPC |
| Backend | Express, tRPC v11 |
| ORM | Drizzle ORM (MySQL2) |
| Auth | OAuth + JWT Cookies |
| AI | OpenAI GPT API |
| Build | Vite (Client) + esbuild (Server) |
| Deploy | Railway (Nixpacks, pnpm) |

### Wichtige Seiten/Features

| Route | Datei | Funktion |
|-------|-------|----------|
| `/` | DashboardPage.tsx | Gesamtübersicht, Rebalancing, Investment-Vorschläge |
| `/strategie` | StrategiePage.tsx | Ziel-Allokation, Sparplan-Verteilung, KI-Empfehlung |
| `/rebalancing` | RebalancingPage.tsx | Einmalsumme optimal verteilen |
| `/portfolio` | PortfolioPage.tsx | Alle Positionen verwalten |
| `/dividenden` | DividendenPage.tsx | Dividenden-Tracking |
| `/watchlist` | WatchlistPage.tsx | Beobachtungsliste |
| `/ki-assistent` | AIAssistantPage.tsx | KI-Chat mit Portfolio-Kontext |
| `/einstellungen` | EinstellungenPage.tsx | DKB-PDF-Import, Einstellungen |

### DKB-PDF-Import

- Importiert Kauf/Sparplan-Abrechnungen der DKB
- Parser: `server/dkb-parser.ts` (nutzt pdf2json)
- Erkennt Duplikate über Auftragsnummer
- Aktualisiert Portfolio automatisch (Durchschnittspreis-Berechnung)
- Entfernt gekaufte Werte automatisch von der Watchlist

## Bekannte Eigenheiten

- `TaxManagement.tsx` hat vorbestehende TS-Fehler (null vs undefined bei broker/notes) — blockiert den Build nicht (Vite ignoriert TS-Fehler)
- pnpm-lock.yaml muss committed sein (Railway nutzt `--frozen-lockfile`)
- `dist/` ist in `.gitignore` — wird auf Railway frisch gebaut
- USD-Positionen werden automatisch in EUR umgerechnet (dynamischer EUR/USD-Kurs)
- Positionen mit `autoUpdate: false` werden bei Kurs-Refresh übersprungen
