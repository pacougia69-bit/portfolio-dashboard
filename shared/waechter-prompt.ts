/**
 * Baut den Text, den Rafael aus dem Waechter in eine KI seiner Wahl kopiert
 * (Gemini, ChatGPT, Claude). Die App ruft selbst keine KI auf.
 */
import { DEFAULT_TARGET_ALLOCATIONS } from './strategy';
import { THEMENWETTEN_KILL_KRITERIEN, isKiWette, type TrendSignal } from './waechter';

export interface WaechterPromptInput {
  name: string;
  ticker: string;
  wkn: string | null;
  signal: TrendSignal;
  signalDetail: string;
  prevSignal: TrendSignal | null;
  price: number | null;
  sma50: number | null;
  sma200: number | null;
  isProxy: boolean;
}

const fmt = (v: number | null) => (v === null ? 'unbekannt' : v.toFixed(2));

export function buildWaechterPrompt(p: WaechterPromptInput): string {
  const baustein = p.wkn
    ? DEFAULT_TARGET_ALLOCATIONS.find((a) => a.wkn.toUpperCase() === p.wkn!.trim().toUpperCase())
    : undefined;

  const lines: string[] = [];
  lines.push('Bitte prüfe diese Position aus meinem Depot genauer (Einordnung der Grundlagen, kein Kursziel).');
  lines.push('');
  lines.push(`Position: ${p.name} (Ticker: ${p.ticker}${p.wkn ? `, WKN: ${p.wkn}` : ''})`);
  lines.push(
    `Trend-Signal meines Wächters: ${p.signal} – ${p.signalDetail}${p.prevSignal ? ` (beim letzten Lauf: ${p.prevSignal})` : ''}`,
  );
  lines.push(
    `Kurs: ${fmt(p.price)}, SMA 50 (Durchschnitt 50 Tage): ${fmt(p.sma50)}, SMA 200 (Durchschnitt 200 Tage): ${fmt(p.sma200)}`,
  );
  if (p.isProxy) {
    lines.push(
      'Hinweis: Der Trend wurde über einen ähnlichen US-Wert als Näherung berechnet, nicht über den echten Kurs dieser Position.',
    );
  }
  if (baustein) {
    lines.push(`Rolle in meiner Strategie: ${baustein.shortLabel}, Ziel-Anteil ${baustein.targetPercent} % am ETF-Depot.`);
  }
  if (isKiWette(p.wkn)) {
    lines.push('');
    lines.push('Meine Kill-Kriterien (Ausstiegs-Kriterien), bei 2 von 4 wird halbiert:');
    THEMENWETTEN_KILL_KRITERIEN.forEach((k, i) => lines.push(`${i + 1}. ${k}`));
    lines.push('Bitte sage, welche davon nach aktueller Datenlage erfüllt, nicht erfüllt oder unklar sind.');
  }
  lines.push('');
  lines.push('Prüfe bitte:');
  lines.push('1. Kosten: Gesamtkostenquote (TER) und Fondsgröße – hat sich etwas geändert?');
  lines.push('2. Zusammensetzung: größte Positionen, Branchen- und Länder-Schwerpunkte, Klumpen (einzelne Firmen über 10 %).');
  lines.push('3. Index: Wurde der Index oder die Methodik geändert? Überschneidet sich das mit meinen anderen ETFs (z. B. Welt-ETFs)?');
  lines.push('4. Wirtschaftsumfeld: Passt das Thema noch zur aktuellen Wirtschaftslage? Was spricht dafür, was dagegen?');
  lines.push('5. Trend: Ist der Signalwechsel frisch oder besteht er schon länger?');
  lines.push('');
  lines.push(
    'Wichtig: Gib keine Kauf-, Verkaufs- oder Halteanweisung. Nenne Quellen mit Datum. Kennzahlen, die du nicht prüfen kannst, ' +
      'lässt du weg – erfinde keine Zahlen. Kennzeichne unsichere oder nicht überprüfbare Angaben ausdrücklich. ' +
      'Das ist keine Anlageberatung; die Entscheidung treffe ich selbst.',
  );
  return lines.join('\n');
}
