import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  LayoutDashboard,
  Briefcase,
  Eye,
  Target,
  PiggyBank,
  Sparkles,
  Settings,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Wrench,
  Activity,
  FileUp,
  CircleDot,
  SearchCheck
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // Schnellstart
  {
    category: "schnellstart",
    question: "Wie starte ich mit dem Portfolio Manager?",
    answer: "Nach dem Login sehen Sie das Dashboard mit einer Übersicht Ihres Portfolios. Beginnen Sie, indem Sie unter 'Portfolio' Ihre ersten Positionen hinzufügen. Geben Sie die WKN ein und die Daten werden automatisch abgerufen."
  },
  {
    category: "schnellstart",
    question: "Wie füge ich eine neue Position hinzu?",
    answer: "Gehen Sie zu 'Portfolio' und klicken Sie auf 'Position hinzufügen'. Geben Sie die WKN ein und klicken Sie auf die Lupe - Name, Ticker und aktueller Kurs werden automatisch geladen. Ergänzen Sie Stückzahl und Kaufpreis und speichern Sie."
  },
  {
    category: "schnellstart",
    question: "Wie aktualisiere ich die Kurse?",
    answer: "Klicken Sie auf 'Kurse aktualisieren' im Dashboard oder auf der Portfolio-Seite. Die Kurse werden über Yahoo Finance abgerufen und automatisch aktualisiert."
  },

  // Dashboard
  {
    category: "dashboard",
    question: "Was zeigt das Dashboard an?",
    answer: "Das Dashboard zeigt Ihr Gesamtvermögen, den Gewinn/Verlust, die Anzahl der Positionen und erwartete Dividenden. Außerdem sehen Sie die Allokation nach Typ (Aktien, ETFs, etc.) und die Top-Kategorien Ihres Portfolios."
  },
  {
    category: "dashboard",
    question: "Was ist der Vermögensverlauf?",
    answer: "Seit dem 08.07.2026 speichert das Dashboard jeden Tag, an dem Sie es öffnen, automatisch Ihren Depotwert. Nach ein paar Tagen erscheint darüber ein Verlaufs-Diagramm mit zwei Linien: der tatsächliche Depotwert und das, was Sie eingezahlt haben. Der Abstand zwischen beiden Linien zeigt Ihren Gewinn/Verlust über Zeit. Es ist kein separater Knopf nötig — der heutige Stand wird beim Öffnen der Seite automatisch nachgetragen, höchstens einmal pro Tag."
  },
  {
    category: "dashboard",
    question: "Was bedeutet die Risiko-Warnung?",
    answer: "Die Risiko-Warnung erscheint, wenn Ihr Portfolio einen hohen Anteil risikoreicher Positionen enthält (z.B. Biotech, Krypto). Empfohlen sind maximal 30% für eine ausgewogene Diversifikation."
  },
  {
    category: "dashboard",
    question: "Wie starte ich eine KI-Analyse?",
    answer: "Klicken Sie auf 'KI-Analyse' im Dashboard. Die KI analysiert Ihr gesamtes Portfolio und gibt Ihnen Empfehlungen zu Diversifikation, Risiken und möglichen Handlungen."
  },

  // Portfolio
  {
    category: "portfolio",
    question: "Welche Wertpapiertypen werden unterstützt?",
    answer: "Der Portfolio Manager unterstützt Aktien, ETFs, Kryptowährungen, Anleihen und Fonds. Jeder Typ wird in der Allokation separat ausgewiesen."
  },
  {
    category: "portfolio",
    question: "Was bedeuten die Status-Empfehlungen (Kaufen/Halten/Verkaufen)?",
    answer: "Diese zeigen die aktuelle Einschätzung für jede Position. 'Kaufen' bedeutet Nachkaufpotenzial, 'Halten' empfiehlt Beibehaltung, 'Verkaufen' signalisiert möglichen Ausstieg. Sie können den Status manuell setzen oder die KI-Empfehlung nutzen."
  },
  {
    category: "portfolio",
    question: "Wie funktioniert die WKN-Suche?",
    answer: "Geben Sie die WKN (Wertpapierkennnummer) ein und klicken Sie auf die Lupe. Das System sucht in einer Datenbank mit über 50 bekannten WKNs und ruft dann den aktuellen Kurs ab. Falls die WKN nicht gefunden wird, können Sie die Daten manuell eingeben."
  },

  // Aktien-Ampel
  {
    category: "ampel",
    question: "Was ist die Aktien-Ampel?",
    answer: "Die Aktien-Ampel zeigt den Trend Ihrer Wertpapiere anhand der gleitenden Durchschnitte SMA 50 und SMA 200. GRÜN = Aufwärtstrend (SMA 50 über SMA 200), GELB = Seitwärtstrend (SMA 50 und SMA 200 nah beieinander), ROT = Abwärtstrend (SMA 50 unter SMA 200)."
  },
  {
    category: "ampel",
    question: "Wie füge ich eine Aktie zur Ampel hinzu?",
    answer: "Auf der Portfolio-Seite finden Sie die Ampel-Tabelle. Klicken Sie auf 'Aktie hinzufügen', geben Sie die WKN ein und klicken Sie auf die Lupe. Der Name und Ticker werden automatisch gefüllt. Alternativ können Sie auch direkt aus Ihren Portfolio-Positionen hinzufügen."
  },
  {
    category: "ampel",
    question: "Wie aktualisiere ich die Ampel-Signale?",
    answer: "Es gibt zwei Wege: (1) Das kleine Pfeil-Symbol (🔄) in einer Zeile aktualisiert NUR diese eine Aktie — geht in Sekunden und kostet nur 1 API-Abruf. Neue Einträge werden beim Hinzufügen automatisch so geholt. (2) Der Button 'Ampeln aktualisieren' oben holt ALLE Einträge — wegen des Twelve-Data-Limits (8 Abrufe/Minute) dauert das bei vielen Einträgen mehrere Minuten. Tipp: Den Alle-Button nur z.B. einmal pro Woche nutzen, sonst das Zeilen-Symbol."
  },
  {
    category: "ampel",
    question: "Was bedeuten die SMA-Werte in der Ampel?",
    answer: "SMA 50 ist der Durchschnittskurs der letzten 50 Handelstage, SMA 200 der letzten 200 Tage. Wenn SMA 50 den SMA 200 von unten nach oben kreuzt, ist das ein positives Signal ('Golden Cross'). Umgekehrt ist ein 'Death Cross' (SMA 50 fällt unter SMA 200) ein Warnsignal."
  },
  {
    category: "ampel",
    question: "Wie nutze ich die KI-Fragen bei der Ampel?",
    answer: "Bei jeder Aktie in der Ampel gibt es ein Chat-Symbol (💬). Klicken Sie darauf, um 5 vorgefertigte KI-Fragen zu sehen: Trend-Analyse, Kaufen/Halten/Verkaufen, Risiko-Check, News & Sentiment und Konkurrenz-Vergleich. Jede Frage enthält automatisch die aktuellen Daten der Aktie (Kurs, SMA, Signal). Klicken Sie auf 'Kopieren' und fügen Sie die Frage in Gemini, ChatGPT oder eine andere KI ein — kostenlos und ohne API-Kosten."
  },
  {
    category: "ampel",
    question: "Was macht der Lupe-Knopf bei einer Ampel-Zeile?",
    answer: "Der Knopf 'Zur Einstiegsanalyse hinzufügen' (Lupe mit Haken) springt direkt zur Einstiegsanalyse-Seite und füllt Ticker, WKN und Name der Aktie schon aus. Praktisch, wenn Sie eine bestehende Ampel-Position noch einmal komplett durch die 5-Kriterien-Checkliste prüfen wollen, bevor Sie nachkaufen."
  },

  // Einstiegsanalyse
  {
    category: "einstiegsanalyse",
    question: "Was ist die Einstiegsanalyse?",
    answer: "Ein fester Ablauf für Kauf-Entscheidungen, damit nicht bei jeder Aktie neu verhandelt wird, was gerade wichtig erscheint. Fünf feste Kriterien (Bewertung, Wachstum, Technische Lage, Depot-Fit + Doppelung, These + Exit-These) werden nacheinander geprüft. Kauf gilt nur als vertretbar, wenn mindestens 4 von 5 Kriterien grün oder gelb sind und keins rot ist — die endgültige Entscheidung bleibt aber immer bei Ihnen."
  },
  {
    category: "einstiegsanalyse",
    question: "Was ist der Kurssprung-Filter?",
    answer: "Läuft automatisch VOR der Checkliste. Ist eine Aktie in den letzten 5 Handelstagen um mehr als 8% gesprungen, fragt das Tool drei Dinge ab: Gibt es einen konkreten Grund? Ist er firmenspezifisch oder Sektor-weit? Läuft der Kurs der Bewertung voraus? Je nach Antwort verlangt die Ampel einen Cool-down (2-4 Wochen abwarten), statt sofort zu kaufen."
  },
  {
    category: "einstiegsanalyse",
    question: "Woher weiß ich, was ich bei Bewertung und Wachstumstrend auswählen soll?",
    answer: "Beide Felder sind Pflicht — ohne Auswahl kann nicht gespeichert werden, damit ein Kriterium nicht unbewertet einfach als 'gelb' durchrutscht. Nutzen Sie den Button 'Direkt recherchieren' bei Kriterium 5: die KI recherchiert dann nicht nur These/Exit-These, sondern schlägt auch Bewertung (KGV/PEG vs. Historie & Peers) und Wachstumstrend (letzte 4 Quartale) mit Begründung vor. Sie prüfen den Vorschlag und übernehmen oder ändern ihn."
  },
  {
    category: "einstiegsanalyse",
    question: "Warum muss ich das KGV manuell eintragen?",
    answer: "Twelve Data liefert im kostenlosen Tarif kein zuverlässiges KGV (der Versuch über den /statistics-Endpunkt blieb schon beim Standalone-Tool bei Testaktien leer). Kurs, SMA50/200 und RSI kommen automatisch — das KGV bleibt bewusst ein manuelles Feld, ebenso wie im ursprünglichen Standalone-Tool."
  },
  {
    category: "einstiegsanalyse",
    question: "Was bedeutet die Gauge bei 'Technische Lage'?",
    answer: "Eine eigene Kurzformel aus RSI + SMA50 + SMA200 (nicht identisch mit Apps wie vincfi, die vermutlich mehr Indikatoren nutzen). Kurs über beiden gleitenden Durchschnitten + RSI über 60 = bullisch (grün), Kurs unter beiden + RSI unter 40 = bärisch (rot), alles dazwischen = neutral/gemischt (gelb). Wird automatisch aus den geladenen Kursdaten berechnet, keine manuelle Eingabe nötig."
  },
  {
    category: "einstiegsanalyse",
    question: "Wie unterscheidet sich die Einstiegsanalyse von der Aktien-Ampel?",
    answer: "Die Ampel ist ein Wächter für bestehende Positionen (rot → Position halbieren, v.a. bei den eingefrorenen ETF-Wetten). Die Einstiegsanalyse ist eine Entscheidungshilfe VOR einem Neukauf. Beide teilen sich dieselbe Kurs/SMA-Datenquelle, sind aber bewusst getrennte Werkzeuge mit unterschiedlichem Zweck."
  },
  {
    category: "einstiegsanalyse",
    question: "Was ist das Innovationsbudget?",
    answer: "Ein fester Jahresbetrag, der in neue thematische Einzelpositionen (statt in den ETF-Kern) fließen darf. Das Jahresziel tragen Sie manuell ein (nicht automatisch aus dem Depotwert berechnet, weil das Geld dafür nicht immer aus dem eigenen Depot kommt) — jede genutzte Position können Sie danach als Eintrag hinzufügen, der Balken zeigt den Verbrauch gegen das Ziel."
  },
  {
    category: "einstiegsanalyse",
    question: "Kann ich statt eines Tickers auch die WKN eingeben?",
    answer: "Ja. Ticker oder WKN reichen jeweils allein — ist nur die WKN ausgefüllt, wird sie beim Laden automatisch zum Ticker aufgelöst. Sind beide ausgefüllt, hat der Ticker Vorrang."
  },
  {
    category: "einstiegsanalyse",
    question: "Werden abgeschlossene Analysen gespeichert?",
    answer: "Ja, im Tab 'Historie' — jede gespeicherte Analyse zeigt Datum, Aktie und Ergebnis (Kauf möglich / Abgelehnt / Cool-down). Ein Klick auf eine Zeile öffnet die volle Checkliste mit allen Begründungen von damals."
  },

  // Frühwarnsystem
  {
    category: "fruehwarnsystem",
    question: "Was ist das Tech-Frühwarnsystem?",
    answer: "Das Frühwarnsystem prüft 5 Markt-Indikatoren per Knopfdruck und zeigt eine Gesamt-Ampel (grün/gelb/rot). Es warnt Sie frühzeitig vor Risiken wie Überhitzung im Tech-Sektor, steigenden Zinsen oder schlechter Marktbreite."
  },
  {
    category: "fruehwarnsystem",
    question: "Welche 5 Indikatoren werden geprüft?",
    answer: "1) Capex/Umsatz-Schere bei den großen Tech-Firmen (MSFT, GOOGL, AMZN, NVDA). 2) Circular Financing News-Scan (Warnsignale für künstliche Umsätze). 3) Effizienz-Sprünge / DeepSeek-Effekt (neue KI-Modelle die Marktführer gefährden). 4) Zinsen & Inflation (Fed Funds Rate + Core CPI). 5) Marktbreite (SPY + QQQ im Vergleich zum 200-Tage-Durchschnitt)."
  },
  {
    category: "fruehwarnsystem",
    question: "Wie benutze ich das Frühwarnsystem?",
    answer: "Gehen Sie über das Menü zu 'Tech-Frühwarnsystem'. Klicken Sie auf 'Snapshot erstellen'. Nach einigen Sekunden erscheinen die 5 Einzelampeln und die Gesamt-Ampel. Die Gesamt-Ampel zeigt immer den schlimmsten Einzelwert (ein Rot = Gesamt Rot)."
  },
  {
    category: "fruehwarnsystem",
    question: "Was ist der Trend-Chart?",
    answer: "Der Trend-Chart zeigt den Verlauf der Ampel-Signale über die letzten 30 Snapshots als Punkte-Matrix. So sehen Sie, ob sich die Lage verbessert oder verschlechtert. Klicken Sie auf einen Punkt, um den zugehörigen Snapshot zu laden."
  },
  {
    category: "fruehwarnsystem",
    question: "Wie oft sollte ich einen Snapshot machen?",
    answer: "Es gibt keine Automatik — Sie entscheiden selbst. Empfohlen ist einmal pro Woche oder bei besonderen Marktbewegungen. Die Snapshots werden gespeichert, sodass Sie Trends über Zeit verfolgen können."
  },

  // Watchlist
  {
    category: "watchlist",
    question: "Wozu dient die Watchlist?",
    answer: "Die Watchlist ermöglicht es Ihnen, interessante Wertpapiere zu beobachten, bevor Sie sie kaufen. Sie können Zielpreise setzen und werden informiert, wenn der Kurs nahe am Ziel ist."
  },
  {
    category: "watchlist",
    question: "Wie übertrage ich eine Position von der Watchlist ins Portfolio?",
    answer: "Klicken Sie auf den 'Kaufen' Button bei der gewünschten Position. Es öffnet sich ein Dialog, in dem Sie Stückzahl und Kaufpreis eingeben können. Nach dem Speichern wird die Position ins Portfolio übertragen."
  },
  {
    category: "watchlist",
    question: "Wie aktualisiere ich die Kurse in der Watchlist?",
    answer: "Klicken Sie auf 'Kurse aktualisieren' oben auf der Watchlist-Seite. Alle Positionen mit bekannter WKN werden automatisch aktualisiert."
  },

  // Strategie
  {
    category: "strategie",
    question: "Was ist die Ziel-Allokation?",
    answer: "Die Ziel-Allokation definiert, wie Ihr ETF-Portfolio idealerweise aufgeteilt sein sollte. Aktuell gilt die Depot-Struktur 2026 (Stand 08.07.2026): 34% All-World (A3D7QX), 22% Anleihen (A2H6ZT), 13% Small Caps (A2DWBY), 17% KI-Wette (A2N6LC), 9% Defence-Wette (A3EB9T), 5% KI-Infra-Wette (A40L9T). Die drei Wetten sind eingefroren — kein neues Geld. Das Rebalancing zeigt, wie Ihre aktuelle Verteilung davon abweicht."
  },
  {
    category: "strategie",
    question: "Warum bekommen die KI-, KI-Infra- und Defence-ETFs nie Kaufempfehlungen?",
    answer: "Das ist Absicht (Finalplan Juli 2026): Alle drei sind bewusste Themen-Wetten und EINGEFROREN — es fließt kein neues Geld hinein, egal wie untergewichtet sie sind. Das Dashboard schließt sie deshalb fest aus allen Kaufempfehlungen aus. Stattdessen bewacht die Aktien-Ampel sie: Springt die Ampel bei A2N6LC, A40L9T oder A3EB9T auf ROT, gilt die Regel 'Position halbieren, ohne Diskussion'. Dazu kommt das Halbjahres-Ritual (Januar + Juli): Tech-Frühwarnsystem-Snapshot ziehen und die 4 Kill-Kriterien prüfen — bei 2 von 4 werden BEIDE KI-ETFs (A2N6LC + A40L9T) halbiert. Im Januar 2027 steht zusätzlich die Wiedervorlage an: Behält der AI Infrastructure (A40L9T) seinen Platz? Details: Desktop/ETF_Depot_Finalplan_2026.html"
  },
  {
    category: "strategie",
    question: "Was zeigt der Rebalancing-Tab?",
    answer: "Der Rebalancing-Tab vergleicht Ihre aktuelle ETF-Allokation mit Ihrer Ziel-Allokation und zeigt, welche Kategorien über- oder untergewichtet sind. Sie erhalten konkrete Empfehlungen, wie viel Sie kaufen oder verkaufen sollten."
  },
  {
    category: "strategie",
    question: "Wie funktioniert die KI-Empfehlung für den Sparplan?",
    answer: "Die KI analysiert Ihr Portfolio UND Ihre Watchlist-ETFs. Sie bewertet jeden ETF (Risiko, Diversifikation, Passung zur Strategie) und schlägt eine optimale Verteilung Ihrer monatlichen Sparrate vor. ETFs können auch abgelehnt werden, wenn sie nicht zur Strategie passen."
  },

  // Dividenden
  {
    category: "dividenden",
    question: "Wie erfasse ich Dividenden?",
    answer: "Gehen Sie zu 'Dividenden' und klicken Sie auf 'Dividende hinzufügen'. Wählen Sie die Position, geben Sie Betrag und Datum ein. Die Dividende wird automatisch der Position zugeordnet."
  },
  {
    category: "dividenden",
    question: "Was zeigt die Dividenden-Übersicht?",
    answer: "Sie sehen die Gesamtdividenden des Jahres, eine monatliche Aufschlüsselung und die Dividenden pro Position. So behalten Sie den Überblick über Ihre passiven Einkünfte."
  },

  // KI-Assistent
  {
    category: "ki",
    question: "Was kann der KI-Assistent?",
    answer: "Der KI-Assistent analysiert Ihr Portfolio, beantwortet Fragen zu Ihren Investments und gibt personalisierte Empfehlungen. Er kennt Ihre Positionen, Watchlist und Strategie und kann fundierte Ratschläge geben."
  },
  {
    category: "ki",
    question: "Wie genau sind die KI-Empfehlungen?",
    answer: "Die KI basiert auf Ihren echten Portfolio-Daten und allgemeinem Finanzwissen. Sie ersetzt keine professionelle Anlageberatung, kann aber wertvolle Denkanstöße geben. Überprüfen Sie Empfehlungen immer kritisch."
  },
  {
    category: "ki",
    question: "Gibt es ein Limit für KI-Anfragen?",
    answer: "Ja, es gibt ein Limit von maximal 20 KI-Anfragen pro Stunde. Das schützt vor unerwarteten API-Kosten. Wenn das Limit erreicht ist, zeigt das System an, wie lange Sie warten müssen. Betrifft: Portfolio-Analyse, Chat, Empfehlungen und Sparplan-KI."
  },
  {
    category: "ki",
    question: "Warum bezieht die KI meine Watchlist ein?",
    answer: "Die KI analysiert Watchlist-ETFs, um zu prüfen, ob sie zu Ihrer bestehenden Strategie passen. So erhalten Sie eine Empfehlung, ob Sie diese ETFs in Ihren Sparplan aufnehmen sollten - inklusive konkreter Beträge."
  },

  // Einstellungen & Import
  {
    category: "einstellungen",
    question: "Wie importiere ich DKB-Abrechnungen?",
    answer: "Gehen Sie zu 'Einstellungen' und scrollen Sie zum Bereich 'DKB PDF Import'. Klicken Sie auf 'PDF auswählen' und wählen Sie eine oder mehrere DKB-Wertpapierabrechnungen (PDF). Die Daten (Datum, WKN, Stückzahl, Kurs, Gebühren) werden automatisch ausgelesen und als Transaktion gespeichert."
  },
  {
    category: "einstellungen",
    question: "Was mache ich wenn der DKB-Import nicht funktioniert?",
    answer: "Falls der PDF-Import Probleme macht, nutzen Sie das manuelle Transaktions-Formular auf der Einstellungen-Seite. Dort können Sie Datum, WKN, Name, Stückzahl, Kurs und Gebühren von Hand eingeben. Das funktioniert immer zuverlässig."
  },
  {
    category: "einstellungen",
    question: "Was macht die PIN-Sperre und wie sicher ist sie?",
    answer: "Unter 'Einstellungen' können Sie eine 4-6-stellige PIN festlegen. Seit dem 08.07.2026 ist das ein echter Zugangsschutz: Ohne korrekte PIN gibt der Server keinerlei Depotdaten mehr heraus — vorher war die PIN-Abfrage nur eine Oberfläche ohne echte Absicherung im Hintergrund. Nach 5 Minuten Inaktivität (einstellbar) sperrt sich die App automatisch wieder. Nach zu vielen falschen PIN-Versuchen hintereinander sperrt der Server für einige Minuten, um automatisiertes Durchprobieren zu verhindern."
  },
  {
    category: "einstellungen",
    question: "Was ist die Transaktionshistorie?",
    answer: "Unter 'Einstellungen' sehen Sie alle importierten Käufe und Verkäufe. Jede Transaktion zeigt Datum, Typ (Kauf/Sparplan/Verkauf), Name, Stückzahl und Gesamtbetrag. Die Historie dient als Nachweis und Übersicht."
  },
  {
    category: "einstellungen",
    question: "Was macht 'Transaktionshistorie leeren'?",
    answer: "Dieser Button löscht alle gespeicherten Transaktionen. Ihre Portfolio-Positionen bleiben davon unberührt! Nutzen Sie das z.B. wenn Sie PDFs neu importieren möchten. Der Button befindet sich in der Gefahrenzone auf der Einstellungen-Seite — direkt über 'Alle Daten löschen'."
  },
  {
    category: "einstellungen",
    question: "Wie exportiere ich meine Daten als Backup?",
    answer: "Auf der Einstellungen-Seite finden Sie den 'Daten exportieren' Button. Der Export enthält seit dem 08.07.2026 ALLES als JSON-Datei: Portfolio, Watchlist, Dividenden, Transaktionshistorie, Notizen, Sparpläne und Einstellungen. Machen Sie regelmäßig Backups! Ein 'Alle Daten löschen'-Button existiert bewusst nicht — Datenlöschung ist eine zu große Entscheidung für einen einzelnen Klick."
  },

  // Technisches
  {
    category: "technisch",
    question: "Woher kommen die Kursdaten?",
    answer: "Kurse aktualisieren nutzt Twelve Data für Ihre Depot-Positionen (bei ausländischen ETFs, wo Twelve Data nur einen anderen Fonds als Näherung liefern könnte, springt automatisch Yahoo Finance mit dem echten Ticker ein) oder Yahoo Finance direkt, falls kein Twelve-Data-Schlüssel hinterlegt ist. Die Aktien-Ampel nutzt für SMA 50/200 immer Twelve Data. Die Frühwarnsystem-Daten kommen zusätzlich von FRED (US-Notenbank) für Zinsen und Inflation."
  },
  {
    category: "technisch",
    question: "Warum werden manche Kurse nicht aktualisiert?",
    answer: "Einige Wertpapiere (besonders kleine deutsche Aktien oder exotische ETFs) sind bei Yahoo Finance nicht gelistet. In diesem Fall müssen Sie den Kurs manuell aktualisieren."
  },
  {
    category: "technisch",
    question: "Sind meine Daten sicher?",
    answer: "Ja, Ihre Daten werden in einer MySQL-Datenbank auf Railway gespeichert. Der Zugriff erfolgt nur über Ihren persönlichen Login. Es werden keine Daten an Dritte weitergegeben. API-Schlüssel sind als Umgebungsvariablen gespeichert und nie im Code sichtbar."
  },

  // Tipps
  {
    category: "tipps",
    question: "Wie diversifiziere ich mein Portfolio richtig?",
    answer: "Eine gute Diversifikation umfasst verschiedene Anlageklassen (Aktien, ETFs, Anleihen), Regionen (Welt, EM, Europa) und Sektoren. Die Risiko-Warnung im Dashboard hilft Ihnen, Klumpenrisiken zu erkennen."
  },
  {
    category: "tipps",
    question: "Was ist Rebalancing und wann sollte ich es machen?",
    answer: "Rebalancing bedeutet, Ihre Portfolio-Gewichtung wieder auf die Ziel-Allokation zu bringen. Empfohlen wird dies 1-2x pro Jahr oder wenn eine Kategorie mehr als 5% von der Ziel-Allokation abweicht."
  },
  {
    category: "tipps",
    question: "Wie nutze ich den Sparplan optimal?",
    answer: "Verteilen Sie Ihre monatliche Sparrate auf verschiedene ETFs gemäß Ihrer Ziel-Allokation. Die KI-Empfehlung kann Ihnen helfen, die optimale Verteilung zu finden. Konzentrieren Sie sich auf untergewichtete Kategorien."
  },
  {
    category: "tipps",
    question: "Wie nutze ich Ampel und Frühwarnsystem zusammen?",
    answer: "Das Frühwarnsystem zeigt die allgemeine Marktlage (Makro-Ebene), die Ampel zeigt den Trend einzelner Aktien/ETFs (Mikro-Ebene). Wenn das Frühwarnsystem rot zeigt UND eine Ihrer Ampeln rot ist, sollten Sie besonders aufmerksam sein."
  },
];

const categories = [
  { id: "schnellstart", label: "Schnellstart", icon: Lightbulb },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "ampel", label: "Aktien-Ampel", icon: CircleDot },
  { id: "einstiegsanalyse", label: "Einstiegsanalyse", icon: SearchCheck },
  { id: "fruehwarnsystem", label: "Frühwarnsystem", icon: Activity },
  { id: "watchlist", label: "Watchlist", icon: Eye },
  { id: "strategie", label: "Strategie", icon: Target },
  { id: "dividenden", label: "Dividenden", icon: PiggyBank },
  { id: "ki", label: "KI-Assistent", icon: Sparkles },
  { id: "einstellungen", label: "Einstellungen & Import", icon: Settings },
  { id: "technisch", label: "Technisches", icon: Wrench },
  { id: "tipps", label: "Tipps & Tricks", icon: TrendingUp },
];

export default function HilfePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFAQ = faqData.filter(item => {
    const matchesSearch = searchQuery === "" ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === null || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const groupedFAQ = categories.map(cat => ({
    ...cat,
    items: filteredFAQ.filter(item => item.category === cat.id)
  })).filter(cat => cat.items.length > 0);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 pt-12 sm:pt-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="w-5 h-5 sm:w-7 sm:h-7 text-cyan-500" />
              Hilfe & FAQ
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base mt-1">
              Anleitungen und häufige Fragen zu allen Funktionen
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                selectedCategory === null
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-accent/50 text-muted-foreground hover:bg-accent"
              }`}
            >
              Alle
            </button>
            {categories.map(cat => {
              const Icon = cat.icon;
              const count = faqData.filter(f => f.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                  <span className="text-xs opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ Content */}
        {groupedFAQ.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Keine Ergebnisse für "{searchQuery}" gefunden.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Versuchen Sie einen anderen Suchbegriff oder wählen Sie eine Kategorie.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedFAQ.map(category => {
              const Icon = category.icon;
              return (
                <Card key={category.id} className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Icon className="w-5 h-5 text-cyan-500" />
                      {category.label}
                    </CardTitle>
                    <CardDescription>
                      {category.items.length} {category.items.length === 1 ? "Frage" : "Fragen"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.items.map((item, index) => (
                        <AccordionItem key={index} value={`${category.id}-${index}`}>
                          <AccordionTrigger className="text-left hover:text-cyan-400">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground leading-relaxed">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick Info */}
        <Card className="glass-card border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Tipp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Nutzen Sie den <strong className="text-foreground">KI-Assistenten</strong> für personalisierte Fragen zu Ihrem Portfolio.
              Er kennt Ihre Positionen und kann individuelle Empfehlungen geben. Maximal 20 Anfragen pro Stunde.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
