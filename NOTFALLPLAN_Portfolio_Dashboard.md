# NOTFALLPLAN: Portfolio Dashboard (Stand: 05.01.2026)

## 1. Technischer Überblick (Dashboard)
- **Backend:** Node.js mit Hono Framework.
- **Frontend:** React mit Vite (JavaScript/TypeScript).
- **Datenbank:** SQLite (lokale Datei `portfolio.sqlite` im Projektordner).
- **Hosting:** Railway (automatisch verbunden mit GitHub).

## 2. Übersicht & Technik
Dieses Dashboard ist mein zentrales Tool zur Portfolio-Verwaltung.
- **Technik:** Node.js (Backend: Hono) & React (Frontend: Vite/JavaScript).
- **Datenbank:** SQLite (lokale Datei im Projektordner).
- **Hosting:** Railway (automatisch verbunden mit GitHub).
- **KI-Unterstützung:** Abacus.ai (ChatLLM) für Strategie & OpenAI API für Dashboard-Analysen.

## 3. Wichtiger Hinweis zu Daten & Railway (Persistenz)
**ACHTUNG:** Das Dashboard auf Railway hat aktuell **kein Volume** (festen Speicher) direkt eingebunden. 
- Änderungen, die NUR online im Dashboard gemacht werden, gehen bei einem neuen Deployment verloren!
- **Die "Master-Wahrheit" liegt lokal auf meinem Laptop** in der SQLite-Datei.
- **Sicherheits-Routine:** 
  1. Änderungen bevorzugt lokal machen -> `git push` zu GitHub.
  2. Nach jeder Online-Änderung sofort einen **JSON-Export** ziehen.
  3. Monatliches ZIP-Backup des gesamten Ordners in die Cloud.

## 4. Backup-Strategie (3-2-1 Regel)
- **Code:** GitHub (täglich `git push`).
- **Daten:** JSON-Exporte aus dem Dashboard (nach jeder Änderung).
- **Cloud-Backup:** Google Drive / OneDrive Ordner `Backup_Portfolio_Dashboard`.
  - `01_Code_Snapshots`: Monatliche ZIP-Datei des Projektordners.
  - `02_Daten_Backups`: Alle JSON-Exporte der Datenbank.
  - `03_Konfiguration_Doku`: Dieser Notfallplan & API-Keys.

### Wichtiger Hinweis: SQLite & Railway (Persistenz)
- **Kein Volume:** Mein Dashboard auf Railway hat aktuell KEINEN festen Speicher (Volume) für die SQLite-Datenbank.
- **Folge:** Änderungen, die NUR online im Dashboard gemacht werden, gehen bei einem neuen Deployment verloren.
- **Lösung:** Die "Master-Wahrheit" der Daten liegt immer lokal auf meinem Laptop. Nach Online-Änderungen muss zwingend ein JSON-Export gemacht und in der Cloud gesichert werden.

## 5. Logins & Fixkosten
| Dienst | Zweck | Kosten (ca.) |
| :--- | :--- | :--- |
| **GitHub** | Code-Speicher | 0 € |
| **Railway** | Hosting | < 1,00 $ / Monat |
| **Abacus.ai** | KI-Strategie / Chat | 10–20 $ / Monat |
| **OpenAI** | Dashboard-KI | Nutzungsbasiert (Cent) |

*Passwörter & API-Keys sind sicher im Passwort-Manager (z.B. Bitwarden) gespeichert.*

## 6. Wiederherstellung (Neuer Laptop)
1. **Umgebung:** VS Code & Node.js (LTS Version) installieren.
2. **Code:** `git clone [GitHub-URL]` in den neuen Ordner.
3. **Konfiguration:** `.env` Datei aus dem Cloud-Backup (03_Konfiguration) erstellen.
4. **Daten:** Aktuellste SQLite-Datei oder JSON-Import nutzen.
5. **Start:** `npm install` und dann `npm run dev` zum Testen.

## 7. Strategie-Check (60/10/10/20 Regel)
- **60% Basis:** World & Emerging Markets (EUNL, IS3N).
- **10% Small Caps:** (ISUSN).
- **10% Tech/Growth:** (Nasdaq 100).
- **20% Themen/Satelliten:** (AI, Clean Energy, Uran, Defence).

*Bei Extra-Geld: Erst Rebalancing-Modul im Dashboard prüfen, dann Schnellfragen nutzen.*

## 8. Checkpoints / Änderungsprotokoll

### Checkpoint 2026-01-01 (Git-Tag: checkpoint-2026-01-01)
**Stabiler Stand nach ETF-Strategie-Fix**
- **Status:** Produktiv einsatzbereit
- **Wichtige Änderungen:**
  - Sparrate auf 1.350 € korrekt konfiguriert
  - Datenbank bereinigt und validiert
  - ETF-Strategie-Modul funktionsfähig
- **Wiederherstellung auf diesen Stand:**
  ```bash
  cd C:\Users\rafae\Desktop\portfolio-dashboard-source
  git fetch origin
  git checkout checkpoint-2026-01-01