# Portfolio Dashboard

## Projektstruktur

- **Frontend:** React + TypeScript + Vite, in `client/src/`
- **Backend:** Express + tRPC + Drizzle ORM (MySQL), in `server/`
- **DB-Migrationen:** `drizzle/` (SQL-Dateien)
- **Build:** Vite (Client) + esbuild (Server) → `dist/`
- **Deployment:** Railway (Nixpacks), Config in `railway.json`

## Aktuelle Strategie: Depot-Struktur 2026 (Stand 23.08.2026, "eingefroren"-Konzept aufgehoben)

| Baustein | Kategorie | Ziel-% | WKN | Sparplan/Monat |
|----------|-----------|--------|-----|----------------|
| 1 | Kern (All-World) | 37% | A3D7QX | 500 € |
| 2 | Small Caps | 22% | A2DWBY | 300 € |
| 3 | KI-Wette | 19% | A2N6LC | 250 € |
| 4 | Defence-Wette | 8% | A3EB9T | 100 € |
| 5 | KI-Infra-Wette | 7% | A40L9T | 100 € |
| 6 | Digital Security | 7% | A2JMGE | 100 € |

**Summe: 100%, Sparrate 1.350 €/Monat.** Alle 6 Bausteine aktiv, keine eingefroren (Rafael, 23.08.2026:
"bitte alle auf aktiv setzen"). Anleihen (A2H6ZT) und iBonds (A40KHS) sind raus, Erlös liegt auf dem
Tagesgeld. Verkauft Juli 2026 (Doppelungen): A0RPWH, A111X9, A40L9T (später neu dazugekommen als eigener
Baustein), A3D6N1, A113FD.
Hintergrund: `C:\Users\rafae\Claude.Dateien\PROJEKTE\Portfolio-Dashboard\ETF-STRATEGIE.md`

## Wo sind die Zielwerte definiert?

**Eine Quelle der Wahrheit:** `shared/strategy.ts` (`DEFAULT_TARGET_ALLOCATIONS`). Alle anderen Stellen
importieren von dort, nichts ist mehr separat gepflegt (Stand 27.09.2026 geprüft):
`client/src/pages/StrategiePage.tsx`, `client/src/pages/DashboardPage.tsx` (`STRATEGY_TARGETS`),
`server/routers.ts` (`individualETFTargets`), `server/dkb-parser.ts`, `shared/waechter-prompt.ts`.
Eine Änderung an der Zielstruktur reicht also in `shared/strategy.ts` allein.

**Wichtig bei den Rebalancing-Berechnungen** (DashboardPage `waveValues`, routers.ts `etfDeficits`):
Die Prozente (37/22/19/8/7/7) beziehen sich nur auf den ETF-Teil des Depots, nicht aufs Gesamtdepot
(Einzelaktien, Krypto, Hebel zählen nicht mit) — als Basis für Soll-Werte und Ist-Prozente immer die
Summe der ETF-Positionen nehmen, nicht `totalValue`. Außerdem beim Zusammenzählen einer Position nach
WKN `filter()+reduce()` statt `find()` benutzen: A2N6LC steht absichtlich zweimal im Depot (Altbestand
und neuerer Bestand getrennt geführt), `find()` findet nur den ersten Treffer und unterschlägt den Rest.

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
