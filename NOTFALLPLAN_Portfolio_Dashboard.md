# NOTFALLPLAN – Portfolio Dashboard
Dieses Dokument dient der Wiederherstellung und Übersicht über mein Projekt **„Portfolio 
Dashboard"**, falls mein Laptop/PC ausfällt oder verloren geht.--
#
# 1. Zentrale Anlaufstellen (Logins)
*Alle Passwörter befinden sich im Passwort-Manager!*- **GitHub:** https://github.com  
    - Zweck: Source Code / Versionierung- **Railway:** https://railway.app  
    - Zweck: Hosting & Deployment (Backend/Frontend, Datenbank)- **OpenAI:** https://platform.openai.com  
    - Zweck: API-Keys für KI-Funktionen- **ChatLLM (Abacus.ai):** https://apps.abacus.ai/chatllm  
    - Zweck: KI-Assistent, ChatLLM Teams, DeepAgent- **E-Mail-Konto:** (z.B. Gmail-Adresse, mit der ich mich bei den Diensten anmelde)  
    - Zweck: Passwort-Reset, Rechnungen, Zugang zu allen Accounts
Passwörter, 2FA-Codes und API-Keys werden **nicht** in dieser Datei gespeichert, sondern 
ausschließlich im **Passwort-Manager**.--
#
# 2. Monatliche Fixkosten & Abos- **Railway – Hobby Plan (usage-based):**  
    - Plan: *Hobby Plan* (verbrauchsbasiert).  
    - Prüfung: Bei railway.app einloggen → Profil → Project Usage / Billing.- **OpenAI – Usage-based:**  
    - 
Abrechnung nach Verbrauch (Tokens).  
    - Nutzung & Kosten unter https://platform.openai.com einsehbar.- **ChatLLM Teams (Abacus.ai):**  
    - 
Abo: aktiv (Basic 10 $/Monat oder Pro 20 $/Monat).  
    - Verwaltung, Kündigung, Credits:  
    https://apps.abacus.ai/chatllm/admin/profile--
#
# 3. Wiederherstellungsschritte (Neuer Laptop / Rechner-Totalausfall)
Ziel: Projekt „Portfolio Dashboard" auf einem neuen Gerät wieder lauffähig machen.
#
## 3.1 Grundinstallation
1. Passwort-Manager installieren und entsperren.
2. Browser installieren (z.B. Chrome, Firefox, Edge).
3. VS Code installieren.
4. Git installieren.
5. Node.js (LTS) installieren.
6. pnpm installieren (z.B. über `npm install -g pnpm`).
#
## 3.2 Projekt-Code wiederherstellen
1. Bei GitHub in das Repository vom „Portfolio Dashboard" gehen.
2. Die HTTPS-Repo-URL kopieren.
3. Im Terminal:
```bash
git clone <MEINE_REPO_URL>
cd portfolio-dashboard-source
pnpm install

## 3.3 Umgebungsvariablen / Konfiguration
Aktueller Stand (Dezember 2025):
Produktion läuft komplett über Railway-Variablen (z.B. MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, OpenAI-Key usw.).
Eine lokale .env-Datei wird nicht benötigt, solange ich die App nur über die Live-URL auf Railway benutze.
Falls ich später doch lokal mit echter Datenbank und KI testen möchte:
Auf dem neuen Laptop eine .env anlegen mit den Werten aus dem Passwort-Manager (z.B. DATABASE_URL, OPENAI_API_KEY, VITE_APP_URL usw.).
Dieser Schritt ist optional und nur für lokale Entwicklung gedacht.

## 3.4 Lokal testen (optional)
Nur nötig, wenn ich lokal entwickeln möchte:
```bash
pnpm run dev

Im Browser http://localhost:5173 (oder den angezeigten Port) öffnen und prüfen, ob:
die App startet, das Portfolio angezeigt wird (ggf. ohne echte Daten, bis wieder importiert wurde).

## 3.5 Railway-Deployment prüfen
Bei railway.app einloggen.
Projekt „Portfolio Dashboard" öffnen.
Backend-Service → Tab Deployments.
Prüfen, ob der letzte Commit den Status „Success / Active" hat.
Falls nötig: Redeploy auslösen.

## 3.6 Daten wiederherstellen
Portfolio-Daten (Positionen):
Aus letztem JSON-Backup importieren (Export-Funktion in der App)
oder die Werte erneut eintragen.
Transaktionen (DKB-PDFs):
DKB-PDFs über die Import-Funktion in der App hochladen.
Duplikate werden automatisch erkannt (siehe Abschnitt 5).

## 3.7 Wenn wieder große Fehler auftreten
Keine eigenen Datenbank-Experimente.
Stattdessen in ChatLLM DeepAgent nutzen mit Hinweis:
„Bitte nur bestehende Fehler beheben, keine neuen Features einbauen."

## 4. Backup-Strategie
## 4.1 Code
GitHub ist das Haupt-Backup für den Code.

Regelmäßig git commit und git push.
Zusätzlich (optional):
Einmal im Monat ZIP-Backup des Ordners portfolio-dashboard-source auf Google Drive / OneDrive speichern.

## 4.1.1 Fester Checkpoint (stabiler Stand)
Git-Tag: checkpoint-2026-01-01
Bedeutung: Stabiler Stand nach ETF-Strategie-Fix (Sparrate 1.350 € korrekt, DB bereinigt).

Wiederherstellung auf diesen Stand:

1. Terminal öffnen:
```bash
cd C:\Users\rafae\Desktop\portfolio-dashboard-source
git fetch origin
git checkout checkpoint-2026-01-01

2. Wenn main im Notfall wieder exakt auf diesen Stand gesetzt werden soll:
git branch -f main checkpoint-2026-01-01
git checkout main
git push origin main --force

3. Danach App wie gewohnt bauen/starten.

## 4.2 Daten (Portfolio)
Einmal im Monat:

JSON-Export der Portfolio-Daten über die App (Einstellungen → Export).
Speichern unter z.B.:
Backup_Portfolio_Dashboard/02_Daten_Backups/portfolio-dashboard_YYYY-MM-DD.json (Cloud).

## 4.3 Dokumentation
Diese Datei NOTFALLPLAN_Portfolio_Dashboard.md:
liegt im Projekt (wird mit auf GitHub gesichert),
zusätzlich eine Kopie in der Cloud, z.B.:
Backup_Portfolio_Dashboard/03_Konfiguration_Doku/.

## 5. DKB‑PDF Import – Verhalten bei doppeltem Upload
Jede DKB‑Abrechnung hat eine eindeutige Auftragsnummer (z.B. 219005/74.00).
Diese Auftragsnummer wird beim Import in der Datenbank gespeichert.
Wenn ich dieselbe DKB‑PDF ein zweites Mal hochlade, passiert Folgendes:

Die App prüft zuerst, ob es bereits eine Transaktion mit dieser Auftragsnummer gibt.
Ist sie schon vorhanden, wird keine neue Transaktion angelegt.
Mein Portfolio ändert sich dadurch nicht – die Stückzahl bleibt gleich.
Es kann dabei eine technische Meldung erscheinen (z.B. mit SQL-Text).
Diese Meldung bedeutet in diesem Fall nur:
„Die Abrechnung mit dieser Auftragsnummer ist bereits importiert."
Sie ist kein Hinweis darauf, dass mein Portfolio kaputt ist.

Empfehlung für mich:

Jede DKB‑PDF am besten nur einmal hochladen.
Wenn ich unsicher bin, ob eine Abrechnung schon importiert wurde:
zuerst im Portfolio nachsehen, ob die entsprechende Position (z.B. ETF A0MW0M) bereits mit der richtigen Stückzahl angezeigt wird.
Datenbank-Reparatur Dezember 2025 (DeepAgent)
Problem:

Die Tabelle transactions war kaputt (falsche Spalte worldUserId o.ä.).
Folge: 500‑Fehler bei API-Calls und beim DKB‑Import.
Lösung durch DeepAgent:

Admin-Endpoint /admin/repair-db auf Railway ausgeführt.
Tabelle transactions gelöscht und mit korrektem Schema neu erstellt, u.a.:
saubere Duplikat-Erkennung.
DKB-Import und Duplikat-Upload erfolgreich getestet (keine 500‑Fehler, deutsche Meldung).
Ergebnis:

DKB‑Import ist produktiv funktionsfähig.
Duplikate werden sauber erkannt.
Keine manuellen Eingriffe in die Datenbank mehr nötig.

## 7. Wichtige Links & Ressourcen
GitHub-Repo: https://github.com/pacougia69-bit/portfolio-dashboard
Railway-Projekt: https://railway.com/project/12e48c2d-c1aa-49cd-8b84-4b9bd6f23511
Live-App: https://portfolio-dashboard-production-e5c1.up.railway.app
ChatLLM Teams: https://apps.abacus.ai/chatllm
OpenAI Platform: https://platform.openai.com7. Wichtige Links & Ressourcen

Letzte Aktualisierung: 01.01.2026