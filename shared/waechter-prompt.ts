/**
 * Baut den Text, den Rafael aus dem Waechter in eine KI seiner Wahl kopiert
 * (Gemini, ChatGPT, Claude). Die App ruft selbst keine KI auf.
 * Die Fragen passen sich der Art der Position an (ETF/Fonds, Einzelaktie, Kryptowert).
 */
import { DEFAULT_TARGET_ALLOCATIONS } from './strategy';
import { THEMENWETTEN_KILL_KRITERIEN, formatDateDe, isKiWette, positionKind, type TrendSignal } from './waechter';

export interface WaechterPromptInput {
  name: string;
  ticker: string;
  wkn: string | null; // bei Einzelaktien steht hier teils die ISIN
  positionType: string | null;
  signal: TrendSignal;
  signalDetail: string;
  prevSignal: TrendSignal | null;
  price: number | null;
  sma50: number | null;
  sma200: number | null;
  currency: string | null;
  isProxy: boolean;
  proxySymbol: string | null;
  runAt: string | null; // ISO: Lauf, aus dem die Zahlen stammen
  prevRunAt: string | null; // ISO: vorheriger Lauf
  entryThesis: { these: string; exitThese: string; analysedAt: string } | null;
  // Nur auf Wunsch (Schalter im Fenster): Namen der uebrigen Positionen, keine Betraege
  otherPositions?: string[] | null;
}

const fmt = (v: number | null) => (v === null ? 'unbekannt' : v.toFixed(2));
const isIsin = (s: string) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s.trim().toUpperCase());

const KIND_LABEL = { fonds: 'ETF/Fonds', krypto: 'Kryptowert', einzelwert: 'Einzelaktie' } as const;

const QUESTIONS = {
  fonds: [
    'Kosten: Gesamtkostenquote (TER) und Fondsgröße – hat sich etwas geändert?',
    'Zusammensetzung: größte Positionen, Branchen- und Länder-Schwerpunkte, Klumpen (einzelne Firmen über 10 %).',
    'Index: Wurde der Index oder die Methodik geändert? Überschneidet sich das mit meinen anderen ETFs (z. B. Welt-ETFs)?',
    'Wirtschaftsumfeld: Passt das Thema noch zur aktuellen Wirtschaftslage? Was spricht dafür, was dagegen?',
    'Trend: Ist der Signalwechsel frisch oder besteht er schon länger?',
  ],
  einzelwert: [
    'Geschäftsmodell: Womit verdient das Unternehmen sein Geld, und wie stark hängt der Umsatz von einzelnen Produkten oder Großkunden ab?',
    'Zahlen: Wie waren die letzten Quartalszahlen (Umsatz, Gewinn, Ausblick)? Gab es Abweichungen von den Erwartungen?',
    'Bewertung: Wie hoch ist die Bewertung (z. B. Kurs-Gewinn-Verhältnis, KGV) im Vergleich zur Branche und zur eigenen Vergangenheit? Ohne Kursziele.',
    'Überschneidung: In welchen verbreiteten ETFs (z. B. Welt-ETFs, Themen-ETFs) steckt die Firma mit welchem Gewicht?',
    'Wirtschaftsumfeld: Passt das Geschäftsfeld noch zur aktuellen Wirtschaftslage und zum Branchentrend? Was spricht dafür, was dagegen? Was sind die größten Risiken?',
    'Trend: Ist der Signalwechsel frisch oder besteht er schon länger?',
  ],
  krypto: [
    'Produkt: Was genau ist das (Coin direkt, ETP = börsengehandeltes Wertpapier, oder Fonds)? Welche Kosten fallen an, wer ist der Herausgeber (Emittent)?',
    'Marktumfeld: Was treibt den Kurs aktuell? Was spricht dafür, was dagegen?',
    'Regulierung und Risiken: Gibt es aktuelle Änderungen bei Regeln, Steuern oder Sicherheit?',
    'Trend: Ist der Signalwechsel frisch oder besteht er schon länger?',
  ],
} as const;

export function buildWaechterPrompt(p: WaechterPromptInput): string {
  const kind = positionKind(p.positionType);
  const baustein = p.wkn
    ? DEFAULT_TARGET_ALLOCATIONS.find((a) => a.wkn.toUpperCase() === p.wkn!.trim().toUpperCase())
    : undefined;
  const idPart = p.wkn ? `, ${isIsin(p.wkn) ? 'ISIN' : 'WKN'}: ${p.wkn}` : '';
  const cur = p.currency ? ` ${p.currency}` : '';

  const lines: string[] = [];
  lines.push('Bitte prüfe diese Position aus meinem Depot genauer (Einordnung der Grundlagen, kein Kursziel).');
  lines.push('');
  lines.push(`Position: ${p.name} (Ticker: ${p.ticker}${idPart})`);
  lines.push(`Art der Position: ${KIND_LABEL[kind]}`);
  lines.push(
    `Trend-Signal meines Wächters${p.runAt ? ` (Lauf vom ${formatDateDe(p.runAt)})` : ''}: ${p.signal} – ${p.signalDetail.replace(/ · Quelle: Yahoo Finance$/, '')}` +
      (p.prevSignal
        ? ` (beim letzten Lauf${p.prevRunAt ? ` am ${formatDateDe(p.prevRunAt)}` : ''}: ${p.prevSignal})`
        : ''),
  );
  const sma = `SMA 50 (Durchschnitt 50 Tage): ${fmt(p.sma50)}, SMA 200 (Durchschnitt 200 Tage): ${fmt(p.sma200)}`;
  if (p.isProxy) {
    lines.push(
      `Achtung: Diese Kennzahlen gehören NICHT zum ETF selbst, sondern ${
        p.proxySymbol ? `zum US-Vergleichswert ${p.proxySymbol}` : 'zu einem US-Vergleichswert'
      } (Näherung, kann bei Ländern und Branchen vom ETF abweichen).`,
    );
    lines.push(`Kurs des Vergleichswerts: ${fmt(p.price)}${cur}, ${sma}`);
  } else {
    lines.push(`Kurs: ${fmt(p.price)}${cur}, ${sma}`);
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
  if (p.entryThesis) {
    lines.push('');
    lines.push(`Meine Einstiegs-These (Analyse vom ${formatDateDe(p.entryThesis.analysedAt)}): ${p.entryThesis.these}`);
    lines.push(`Meine Exit-These (wann ich aussteigen würde): ${p.entryThesis.exitThese}`);
    lines.push('Bitte sage, ob die These noch trägt und ob ein Punkt meiner Exit-These eingetreten oder gefährdet ist.');
  }
  if (p.otherPositions && p.otherPositions.length > 0) {
    lines.push('');
    lines.push(`Meine übrigen Positionen (nur Namen, keine Beträge): ${p.otherPositions.join(', ')}`);
    lines.push('Bitte nutze diese Liste, um Überschneidungen konkret zu prüfen (gleiche Firmen in mehreren ETFs, Doppelungen mit Einzelaktien).');
  }
  lines.push('');
  lines.push('Prüfe bitte:');
  QUESTIONS[kind].forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  lines.push('');
  lines.push(
    'Wichtig: Gib keine Kauf-, Verkaufs- oder Halteanweisung. Nenne Quellen mit Datum. Kennzahlen, die du nicht prüfen kannst, ' +
      'lässt du weg – erfinde keine Zahlen. Kennzeichne unsichere oder nicht überprüfbare Angaben ausdrücklich. ' +
      'Das ist keine Anlageberatung; die Entscheidung treffe ich selbst.',
  );
  return lines.join('\n');
}
