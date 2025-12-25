# Portfolio Analyse Dashboard

Ein umfassendes Portfolio-Management-Dashboard mit KI-gestützter Analyse, Live-Kursen und Sparplan-Verwaltung.

## Features

- **Dashboard**: Übersicht über Gesamtvermögen, Gewinn/Verlust, Allokation
- **Portfolio-Verwaltung**: Positionen hinzufügen, bearbeiten, löschen mit WKN-Lookup
- **Watchlist**: Beobachtungsliste mit Zielpreisen und Transfer ins Portfolio
- **Strategie**: ETF-Sparplan mit Ziel-Allokation und Rebalancing-Empfehlungen
- **KI-Analyse**: Portfolio-Analyse und Sparplan-Empfehlungen mit GPT
- **Dividenden-Tracking**: Übersicht über Dividendenzahlungen
- **Simulator**: Zinseszins- und Sparplan-Rechner
- **Notizen**: Recherche-Dokumentation
- **PIN-Sperre**: Optionaler PIN-Schutz für die App
- **Mobile-optimiert**: Responsive Design für Smartphone und Desktop

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js, tRPC, Express
- **Datenbank**: PostgreSQL mit Drizzle ORM
- **KI**: OpenAI GPT API (via Manus Forge)
- **Kursdaten**: Yahoo Finance, Twelve Data API

## Voraussetzungen

- Node.js 18+
- PostgreSQL 14+
- pnpm (empfohlen) oder npm

## Installation

### 1. Repository klonen

```bash
git clone <repository-url>
cd portfolio-dashboard
```

### 2. Abhängigkeiten installieren

```bash
pnpm install
```

### 3. Umgebungsvariablen konfigurieren

Kopieren Sie `.env.example` nach `.env` und füllen Sie die Werte aus:

```bash
cp .env.example .env
```

### 4. Datenbank einrichten

```bash
# Datenbank-Schema erstellen
pnpm db:push
```

### 5. Entwicklungsserver starten

```bash
pnpm dev
```

Die App ist dann unter `http://localhost:3000` erreichbar.

## Docker Deployment

### Mit Docker Compose

```bash
docker-compose up -d
```

### Manuell mit Docker

```bash
# Image bauen
docker build -t portfolio-dashboard .

# Container starten
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  portfolio-dashboard
```

## Vercel Deployment

1. Repository mit Vercel verbinden
2. Umgebungsvariablen in Vercel Dashboard konfigurieren
3. Build-Befehl: `pnpm build`
4. Output-Verzeichnis: `dist`

## Umgebungsvariablen

| Variable | Beschreibung | Erforderlich |
|----------|--------------|--------------|
| `DATABASE_URL` | PostgreSQL Connection String | Ja |
| `JWT_SECRET` | Secret für JWT-Token | Ja |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API Key für KI | Ja |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL | Ja |
| `TWELVE_DATA_API_KEY` | Twelve Data API Key für Kurse | Optional |
| `VITE_APP_TITLE` | App-Titel | Optional |

## Projektstruktur

```
portfolio-dashboard/
├── client/                 # Frontend (React)
│   ├── src/
│   │   ├── components/    # UI-Komponenten
│   │   ├── pages/         # Seiten-Komponenten
│   │   ├── hooks/         # Custom React Hooks
│   │   ├── lib/           # Utilities (tRPC Client)
│   │   └── contexts/      # React Contexts
│   └── index.html
├── server/                 # Backend (Node.js/tRPC)
│   ├── routers.ts         # tRPC Router
│   ├── services.ts        # Business Logic
│   ├── db.ts              # Datenbank-Funktionen
│   └── _core/             # Server-Kern
├── drizzle/               # Datenbank-Schema
│   └── schema.ts
├── shared/                # Geteilte Typen
├── package.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API-Endpunkte (tRPC)

- `portfolio.list` - Alle Portfolio-Positionen abrufen
- `portfolio.create` - Position hinzufügen
- `portfolio.update` - Position bearbeiten
- `portfolio.delete` - Position löschen
- `prices.update` - Kurse aktualisieren
- `ai.analyzePortfolio` - KI-Analyse
- `ai.suggestSparplan` - Sparplan-Empfehlung
- `watchlist.*` - Watchlist-Operationen
- `dividends.*` - Dividenden-Operationen
- `notes.*` - Notizen-Operationen
- `settings.*` - Einstellungen

## Lizenz

MIT License

## Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im Repository.
