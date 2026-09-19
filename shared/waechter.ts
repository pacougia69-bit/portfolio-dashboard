/**
 * Waechter (Trend-Pruefung auf Knopfdruck) - reine Logik, ohne Datenbank und Netzwerk.
 * Laeuft in Server UND Browser und ist die Grundlage der Unit-Tests.
 * Regel: Der Waechter liest nur und gibt keine Kauf-/Verkaufsanweisung.
 */

export type TrendSignal = 'GRUEN' | 'GELB' | 'ROT' | 'KEINE_DATEN';
export type ChangeDirection = 'neu' | 'gleich' | 'verschlechtert' | 'verbessert';

// Twelve-Data-Free-Plan: 8 Aufrufe/Minute -> gleiche Haeppchen wie die Ampel.
export const WAECHTER_CHUNK_SIZE = 8;
export const WAECHTER_CHUNK_DELAY_MS = 62000;
// Ab so vielen Tagen ohne Pruefung wird die Startseiten-Zeile orange.
export const WAECHTER_STALE_DAYS = 7;

// Die drei konzentrierten Themenwetten (Quelle: shared/strategy.ts, Regel: ETF-STRATEGIE.md).
export const THEMENWETTEN_WKNS = ['A2N6LC', 'A3EB9T', 'A40L9T'] as const;
// Nur die zwei KI-ETFs teilen sich die Kill-Kriterien (Defence hat nur den Ampel-Backstop).
export const KI_WETTEN_WKNS = ['A2N6LC', 'A40L9T'] as const;

export const THEMENWETTEN_KILL_KRITERIEN = [
  'Zwei der vier großen Cloud-Konzerne (Hyperscaler) senken ihre Investitionsprognose (Capex-Guidance)',
  'Nvidia-Wachstum bei Rechenzentren (Data-Center) unter 20 % pro Jahr oder Einkaufsverpflichtungen schrumpfen 2 Quartale',
  'Risikoaufschläge (Credit Spreads) der Cloud-Konzerne weiten sich aus oder ein großer Zirkular-Deal (gegenseitige Lieferverträge) platzt',
  'IT-Sektor: KGV auf Basis erwarteter Gewinne (Forward-KGV) Richtung 45-55x ohne Gewinnwachstum',
] as const;

export interface WaechterResultRow {
  positionId: number;
  ticker: string;
  name: string;
  wkn: string | null;
  signal: TrendSignal;
  signalDetail: string;
  price: number | null;
  sma50: number | null;
  sma200: number | null;
  prevSignal: TrendSignal | null;
  change: ChangeDirection;
  isProxy: boolean;
  actionHint: string;
}

/** Kernregel der Ampel: Kurs gegen SMA 50 und SMA 200. Texte 1:1 wie bisher im Router. */
export function classifyTrend(
  price: number,
  sma50: number,
  sma200: number,
): { signal: 'GRUEN' | 'GELB' | 'ROT'; detail: string } {
  const aboveSma50 = price > sma50;
  const aboveSma200 = price > sma200;
  const goldenCross = sma50 > sma200;

  if (aboveSma50 && aboveSma200) {
    return { signal: 'GRUEN', detail: goldenCross ? 'Aufwärtstrend (Golden Cross)' : 'Über SMA 50 & 200' };
  }
  if (!aboveSma50 && !aboveSma200) {
    return { signal: 'ROT', detail: sma50 < sma200 ? 'Abwärtstrend (Death Cross)' : 'Unter SMA 50 & 200' };
  }
  return {
    signal: 'GELB',
    detail: aboveSma200 ? 'Über SMA 200, unter SMA 50 (Korrektur)' : 'Über SMA 50, unter SMA 200 (Erholung)',
  };
}

/** Einfacher Durchschnitt der neuesten `days` Kurse (Reihe: neuester Kurs zuerst). */
export function simpleMovingAverage(closesNewestFirst: number[], days: number): number | null {
  if (closesNewestFirst.length < days) return null;
  let sum = 0;
  for (let i = 0; i < days; i++) sum += closesNewestFirst[i];
  return sum / days;
}

export interface TrendResult {
  signal: TrendSignal;
  detail: string;
  price: number | null;
  sma50: number | null;
  sma200: number | null;
}

/** Berechnet das Wächter-Signal aus einer Kursreihe (neuester Kurs zuerst). "Keine Daten" ist ein eigener Zustand, kein Gelb. */
export function computeTrendSignal(closesNewestFirst: number[]): TrendResult {
  const closes = closesNewestFirst.filter((c) => Number.isFinite(c));
  if (closes.length === 0) {
    return { signal: 'KEINE_DATEN', detail: 'Keine Kursdaten erhalten', price: null, sma50: null, sma200: null };
  }
  const price = closes[0];
  const sma50 = simpleMovingAverage(closes, 50);
  const sma200 = simpleMovingAverage(closes, 200);

  if (sma50 === null) {
    return { signal: 'KEINE_DATEN', detail: `Nicht genug Daten für SMA-Berechnung (nur ${closes.length} Tage)`, price, sma50, sma200 };
  }
  if (sma200 === null) {
    return { signal: 'KEINE_DATEN', detail: `Nicht genug Daten für SMA 200 (nur ${closes.length} Tage)`, price, sma50, sma200 };
  }
  const trend = classifyTrend(price, sma50, sma200);
  return { signal: trend.signal, detail: trend.detail, price, sma50, sma200 };
}

const RANK = { GRUEN: 0, GELB: 1, ROT: 2 } as const;

export function detectChange(prev: TrendSignal | null, curr: TrendSignal): ChangeDirection {
  if (prev === null || prev === 'KEINE_DATEN') return 'neu';
  if (curr === 'KEINE_DATEN') return 'gleich';
  if (RANK[curr] > RANK[prev]) return 'verschlechtert';
  if (RANK[curr] < RANK[prev]) return 'verbessert';
  return 'gleich';
}

const inList = (list: readonly string[], wkn: string | null | undefined) =>
  !!wkn && list.includes(wkn.trim().toUpperCase());

export const isThemenwette = (wkn: string | null | undefined) => inList(THEMENWETTEN_WKNS, wkn);
export const isKiWette = (wkn: string | null | undefined) => inList(KI_WETTEN_WKNS, wkn);

/** Handlungsstufe: nie eine eigene Verkaufsempfehlung. Bei ROT auf einer Themenwette wird Rafaels eigene Regel als Erinnerung gezeigt. */
export function getActionHint(signal: TrendSignal, wkn: string | null | undefined): string {
  switch (signal) {
    case 'GRUEN':
      return 'Keine Aktion nötig';
    case 'GELB':
      return 'Beobachten';
    case 'ROT':
      return isThemenwette(wkn)
        ? 'Kein neues Geld – selbst prüfen. Deine Regel: ROT → halbieren.'
        : 'Kein neues Geld – selbst prüfen';
    default:
      return 'Ohne Daten – nicht bewertet';
  }
}

export type CheckDecision =
  | { checkable: true }
  | { checkable: false; reason: 'stumm' | 'hebelprodukt' | 'kein-ticker' };

/** Welche Positionen prüft der Wächter? Stumm > Hebelprodukt (eigene K.O.-Logik, Ticker = WKN) > ohne Ticker. */
export function decideCheckable(p: { type: string; ticker: string | null; waechterMuted?: boolean | null }): CheckDecision {
  if (p.waechterMuted) return { checkable: false, reason: 'stumm' };
  if (p.type === 'Hebelprodukt') return { checkable: false, reason: 'hebelprodukt' };
  if (!p.ticker || p.ticker.trim() === '') return { checkable: false, reason: 'kein-ticker' };
  return { checkable: true };
}

/** Text der Startseiten-Zeile. Orange (stale) ab WAECHTER_STALE_DAYS Tagen oder wenn noch nie gestartet. */
export function describeLastChecked(finishedAt: Date | string | null, now: Date = new Date()): { text: string; stale: boolean } {
  if (!finishedAt) return { text: 'Wächter noch nie gestartet', stale: true };
  const then = new Date(finishedAt);
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  const dateText = then.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin',
  });
  const when = days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
  return { text: `Wächter zuletzt geprüft ${when} (${dateText})`, stale: days >= WAECHTER_STALE_DAYS };
}
