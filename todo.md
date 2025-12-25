# Portfolio Dashboard Upgrade TODO

## Full-Stack Upgrade
- [x] Projekt auf web-db-user upgraden
- [x] Datenbank synchronisieren
- [x] Portfolio-Daten in Datenbank speichern
- [x] Live-Kurse API Integration (Yahoo Finance - implementiert)
- [x] KI-Assistent für Portfolio-Analysen
- [x] Dashboard mit Live-Daten verbinden
- [ ] Tests schreiben

## Features
- [x] Automatische Kurs-Updates (Button implementiert)
- [x] KI-Portfolio-Analyse
- [x] KI-Empfehlungen (Kaufen/Verkaufen)
- [ ] Portfolio-Briefing generieren
- [x] Backup Import/Export über Backend
- [x] 8 Seiten komplett implementiert (Dashboard, Portfolio, Watchlist, Strategie, Dividenden, Simulator, Notizen, Einstellungen)
- [x] KI-Assistent Seite mit Chat-Interface

## Bekannte Einschränkungen
- [x] Yahoo Finance API kann von einigen Servern blockiert werden
- [x] Alternative: Twelve Data API mit API-Key eingerichtet

## Twelve Data API Integration
- [x] Twelve Data API Service implementieren
- [x] API-Key Secret einrichten
- [x] Kurs-Updates über Twelve Data abrufen
- [x] Währungsumrechnung USD -> EUR
- [x] Ticker-Mappings für deutsche Börsen

## ETF-Fokus Update
- [x] Manuelle Kurseingabe für alle Positionen (via Edit-Dialog)
- [x] Strategie-Seite mit ETF-Fokus und Ziel-Allokation
- [x] Ist vs. Soll Allokation Vergleich
- [x] Rebalancing-Empfehlungen
- [x] Yahoo Finance als optionale Kurs-Quelle (nicht Hauptfunktion)

## Bugfixes und neue Features
- [x] Fehler: useFinanzplaner Context nicht gefunden - alle Seiten auf tRPC umgestellt
- [x] Sparrate persistent in Datenbank speichern (userSettings Tabelle)
- [x] KI-Empfehlung für Sparplan-Verteilung (wie 1400€ auf ETFs verteilen)


## Aktuelle Bugs
- [x] Kurse werden abgerufen (25 aktualisiert) aber "Aktuell" Felder bleiben leer - BEHOBEN

- [x] Sparplan-Verteilung: Jeden ETF einzeln mit individuellem Betrag anzeigen (nicht gruppiert nach Kategorie)

## Individuelle ETF-Sparraten

- [x] Eingabefelder für jeden ETF im Sparplan-Tab
- [x] Summen-Anzeige der eingetragenen Beträge
- [x] Differenz zur Ziel-Sparrate anzeigen (z.B. "50 € noch zu verteilen")
- [x] Speicherung der individuellen Beträge in der Datenbank


## UI Verbesserungen

- [x] Sidebar einklappbar machen (Toggle-Button)
- [x] WKN-Spalte in Portfolio-Tabelle hinzufügen
- [x] WKN in Watchlist anzeigen
- [x] WKN in Strategie-Seite anzeigen


## WKN und KI-Empfehlung Verbesserungen

- [x] WKN in Strategie-Seite ETF-Liste hinzufügen
- [x] WKN im Sparplan-Tab anzeigen
- [x] KI-Empfehlung übersichtlicher formatieren (Tabellen, Überschriften)
- [x] Kopierfunktion für KI-Empfehlung Text hinzufügen


## Automatische Datenabruf und Verbesserungen

- [x] WKN-Lookup API Service implementieren (Name, Ticker, Kurs automatisch abrufen)
- [x] Watchlist-Formular: Automatischer Datenabruf bei WKN-Eingabe
- [x] Portfolio-Formular: Automatischer Datenabruf bei WKN-Eingabe
- [x] Watchlist → Portfolio Transfer-Button (Position kaufen und ins Portfolio übertragen)
- [x] Stückzahl-Formatierung: Ganze Zahlen ohne Dezimalstellen anzeigen (1 statt 1.0000)

- [x] WKN-Datenbank erweitert (A0HGV5, A0LGP4 und weitere Anleihen-ETFs)
- [x] Kurse aktualisieren Button in Watchlist (aktualisiert alle Einträge mit WKN)


## KI-Empfehlung mit Watchlist-Integration

- [x] Watchlist-ETFs in KI-Analyse einbeziehen
- [x] Jeden Watchlist-ETF bewerten (Risiko, Diversifikation, Passung zur Strategie)
- [x] Empfehlung oder Ablehnung mit Begründung für jeden Watchlist-ETF
- [x] Neue Sparplan-Verteilung vorschlagen (bestehende + empfohlene Watchlist-ETFs)

## Hilfe-Seite

- [x] Hilfe-Seite mit Akkordeon-Stil FAQ erstellen
- [x] Handbuch-Inhalte integrieren (Schnellstart, Funktionen, FAQ, Tipps)
- [x] Suchfunktion für FAQ hinzufügen
- [x] Navigation um Hilfe-Menüpunkt erweitern

## Mobile-Optimierung (Smartphone)

- [x] Globale mobile Styles optimieren (Schriftgrößen, Abstände, Touch-Targets)
- [x] Sidebar/Navigation für Mobile verbessern
- [x] Dashboard: Karten untereinander, Charts angepasst
- [x] Portfolio: Karten-Ansicht statt Tabelle auf Mobile
- [x] Watchlist: Kompaktere Darstellung
- [x] Strategie: Tabs und Eingabefelder optimiert
- [x] Dividenden: Mobile-freundliche Übersicht
- [x] Simulator: Angepasste Eingabefelder
- [x] Notizen: Vollbreite auf Mobile
- [x] KI-Assistent: Chat-Bereich optimiert
- [x] Hilfe: FAQ-Akkordeons angepasst
- [x] Einstellungen: Formulare optimiert

## PIN-Sperre (Optional)

- [x] PIN-Einstellungen in Datenbank (userSettings: pinEnabled, pinHash, autoLockMinutes)
- [x] PIN-Eingabe Komponente (4-6 stellig, Zahlenfeld)
- [x] PIN aktivieren/deaktivieren in Einstellungen
- [x] PIN festlegen/ändern Dialog
- [x] PIN-Abfrage beim App-Start (wenn aktiviert)
- [x] Automatische Sperre nach X Minuten Inaktivität (optional)
- [x] PIN-Sperre funktioniert auf Laptop und Smartphone

## Manueller Kurs Option

- [x] Datenbank: autoUpdate Boolean-Feld bereits vorhanden (nutzen statt manualPrice)
- [x] Backend: Bei Kursaktualisierung Positionen mit autoUpdate=false überspringen
- [x] Frontend: Checkbox "Manueller Kurs" im Edit-Dialog
- [x] Frontend: Icon/Badge "M" in Portfolio-Tabelle für manuelle Kurse
- [x] Hinweis bei Kursaktualisierung: "X Kurse aktualisiert, Y manuelle übersprungen"


## Notizen-Seite Verbesserungen

- [x] Bug: Cursor springt beim Tippen zum Anfang - BEHOBEN
- [x] Vereinfachtes Erstellen: Inline-Formular statt Dialog, Titel-Feld automatisch fokussiert
