import { describe, it, expect } from 'vitest';
import {
  classifyTrend, simpleMovingAverage, computeTrendSignal, detectChange,
  isThemenwette, isKiWette, getActionHint, decideCheckable, describeLastChecked,
  THEMENWETTEN_WKNS, KI_WETTEN_WKNS, classifyTwelveDataError, chunkArray, WAECHTER_MAX_RETRY_ROUNDS, parseYahooCloses, formatDateDe, positionKind, formatDateTimeDe, otherPositionNames,
} from './waechter';
import { DEFAULT_TARGET_ALLOCATIONS } from './strategy';

// Hilfsfunktion: Kursreihe, NEUESTER Kurs zuerst (so liefert Twelve Data sie)
const series = (n: number, at: (i: number) => number) => Array.from({ length: n }, (_, i) => at(i));

describe('classifyTrend (Regel 1:1 wie die bisherige Ampel)', () => {
  it('GRUEN mit Golden Cross', () => {
    expect(classifyTrend(110, 100, 90)).toEqual({ signal: 'GRUEN', detail: 'Aufwärtstrend (Golden Cross)' });
  });
  it('GRUEN ohne Golden Cross', () => {
    expect(classifyTrend(110, 90, 100)).toEqual({ signal: 'GRUEN', detail: 'Über SMA 50 & 200' });
  });
  it('ROT mit Death Cross', () => {
    expect(classifyTrend(80, 90, 100)).toEqual({ signal: 'ROT', detail: 'Abwärtstrend (Death Cross)' });
  });
  it('ROT ohne Death Cross', () => {
    expect(classifyTrend(80, 100, 90)).toEqual({ signal: 'ROT', detail: 'Unter SMA 50 & 200' });
  });
  it('GELB: über SMA 200, unter SMA 50', () => {
    expect(classifyTrend(95, 100, 90)).toEqual({ signal: 'GELB', detail: 'Über SMA 200, unter SMA 50 (Korrektur)' });
  });
  it('GELB: über SMA 50, unter SMA 200', () => {
    expect(classifyTrend(95, 90, 100)).toEqual({ signal: 'GELB', detail: 'Über SMA 50, unter SMA 200 (Erholung)' });
  });
});

describe('simpleMovingAverage', () => {
  it('mittelt die neuesten N Kurse', () => {
    expect(simpleMovingAverage([4, 3, 2, 1], 2)).toBe(3.5);
  });
  it('liefert null bei zu wenig Daten', () => {
    expect(simpleMovingAverage([1, 2, 3], 5)).toBeNull();
  });
});

describe('computeTrendSignal', () => {
  it('steigende Reihe (neuester Kurs 300) ergibt GRUEN', () => {
    const r = computeTrendSignal(series(200, (i) => 300 - i));
    expect(r.signal).toBe('GRUEN');
    expect(r.price).toBe(300);
    expect(r.sma50).toBe(275.5);
    expect(r.sma200).toBe(200.5);
  });
  it('fallende Reihe (neuester Kurs 100) ergibt ROT', () => {
    const r = computeTrendSignal(series(200, (i) => 100 + i));
    expect(r.signal).toBe('ROT');
    expect(r.detail).toBe('Abwärtstrend (Death Cross)');
  });
  it('zwischen 50 und 199 Tagen: KEINE_DATEN statt GELB', () => {
    const r = computeTrendSignal(series(120, () => 100));
    expect(r.signal).toBe('KEINE_DATEN');
    expect(r.detail).toBe('Nicht genug Daten für SMA 200 (nur 120 Tage)');
    expect(r.sma50).toBe(100);
    expect(r.sma200).toBeNull();
  });
  it('unter 50 Tage: KEINE_DATEN', () => {
    const r = computeTrendSignal(series(30, () => 100));
    expect(r.signal).toBe('KEINE_DATEN');
    expect(r.detail).toBe('Nicht genug Daten für SMA-Berechnung (nur 30 Tage)');
  });
  it('leere Reihe: KEINE_DATEN', () => {
    const r = computeTrendSignal([]);
    expect(r).toEqual({ signal: 'KEINE_DATEN', detail: 'Keine Kursdaten erhalten', price: null, sma50: null, sma200: null });
  });
});

describe('detectChange', () => {
  it('erste Prüfung', () => expect(detectChange(null, 'GRUEN')).toBe('neu'));
  it('vorher ohne Daten zählt als neu', () => expect(detectChange('KEINE_DATEN', 'GELB')).toBe('neu'));
  it('unverändert', () => expect(detectChange('GRUEN', 'GRUEN')).toBe('gleich'));
  it('verschlechtert', () => expect(detectChange('GRUEN', 'ROT')).toBe('verschlechtert'));
  it('verbessert', () => expect(detectChange('ROT', 'GELB')).toBe('verbessert'));
  it('jetzt ohne Daten ist keine Änderung', () => expect(detectChange('GRUEN', 'KEINE_DATEN')).toBe('gleich'));
});

describe('Themenwetten', () => {
  it('alle stehen in shared/strategy.ts', () => {
    const wkns = DEFAULT_TARGET_ALLOCATIONS.map((a) => a.wkn);
    for (const w of THEMENWETTEN_WKNS) expect(wkns).toContain(w);
    for (const w of KI_WETTEN_WKNS) expect(THEMENWETTEN_WKNS).toContain(w);
  });
  it('erkennt WKN unabhängig von Groß-/Kleinschreibung', () => {
    expect(isThemenwette('a2n6lc')).toBe(true);
    expect(isThemenwette('A2DWBY')).toBe(false);
    expect(isKiWette('A3EB9T')).toBe(false);
    expect(isKiWette('A40L9T')).toBe(true);
    expect(isThemenwette(null)).toBe(false);
  });
});

describe('getActionHint', () => {
  it('ROT bei Themenwette erinnert an Rafaels eigene Regel', () => {
    expect(getActionHint('ROT', 'A2N6LC')).toContain('Deine Regel: ROT → halbieren.');
  });
  it('ROT bei normalem ETF ohne diese Regel', () => {
    const hint = getActionHint('ROT', 'A2DWBY');
    expect(hint).toBe('Kein neues Geld – selbst prüfen');
    expect(hint).not.toContain('halbieren');
  });
  it('GRUEN, GELB, KEINE_DATEN', () => {
    expect(getActionHint('GRUEN', null)).toBe('Keine Aktion nötig');
    expect(getActionHint('GELB', null)).toBe('Beobachten');
    expect(getActionHint('KEINE_DATEN', null)).toBe('Ohne Daten – nicht bewertet');
  });
  it('enthält nie eine eigene Verkaufsempfehlung', () => {
    for (const s of ['GRUEN', 'GELB', 'ROT', 'KEINE_DATEN'] as const) {
      for (const w of ['A2N6LC', 'A2DWBY', null]) {
        expect(getActionHint(s, w).toLowerCase()).not.toContain('verkauf');
      }
    }
  });
});

describe('decideCheckable', () => {
  it('normale Aktie ist prüfbar', () => {
    expect(decideCheckable({ type: 'Aktie', ticker: 'AAPL', waechterMuted: false })).toEqual({ checkable: true });
  });
  it('stumm hat Vorrang', () => {
    expect(decideCheckable({ type: 'Hebelprodukt', ticker: 'X', waechterMuted: true })).toEqual({ checkable: false, reason: 'stumm' });
  });
  it('Hebelprodukt wird übersprungen', () => {
    expect(decideCheckable({ type: 'Hebelprodukt', ticker: 'BY34053' })).toEqual({ checkable: false, reason: 'hebelprodukt' });
  });
  it('ohne Ticker wird übersprungen', () => {
    expect(decideCheckable({ type: 'ETF', ticker: '  ' })).toEqual({ checkable: false, reason: 'kein-ticker' });
  });
});

describe('describeLastChecked', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  it('noch nie gestartet ist orange', () => {
    expect(describeLastChecked(null, now)).toEqual({ text: 'Wächter noch nie gestartet', stale: true });
  });
  it('heute', () => {
    expect(describeLastChecked('2026-09-19T08:00:00Z', now)).toEqual({ text: 'Wächter zuletzt geprüft heute (19.09.2026)', stale: false });
  });
  it('gestern', () => {
    expect(describeLastChecked('2026-09-18T12:00:00Z', now).text).toBe('Wächter zuletzt geprüft gestern (18.09.2026)');
  });
  it('5 Tage ist noch nicht orange', () => {
    expect(describeLastChecked('2026-09-14T12:00:00Z', now)).toEqual({ text: 'Wächter zuletzt geprüft vor 5 Tagen (14.09.2026)', stale: false });
  });
  it('ab 7 Tagen orange', () => {
    expect(describeLastChecked('2026-09-12T11:00:00Z', now).stale).toBe(true);
  });
});

describe('classifyTwelveDataError', () => {
  it('Minuten-Limit ist nachholbar und hat einen deutschen Text', () => {
    const r = classifyTwelveDataError(
      429,
      'You have run out of API credits for the current minute. 10 API credits were used, with the current limit being 8. Wait for the next minute or consider upgrading',
      'VT',
    );
    expect(r.kind).toBe('limit');
    expect(r.retryable).toBe(true);
    expect(r.text).toBe('Kursabruf-Limit erreicht (8 pro Minute) – bitte Wächter später erneut starten');
  });
  it('Tageslimit ist nicht nachholbar', () => {
    const r = classifyTwelveDataError(429, 'You have run out of API credits for the day. Upgrade your plan', 'NVDA');
    expect(r.kind).toBe('daily');
    expect(r.retryable).toBe(false);
    expect(r.text).toContain('Tageskontingent');
  });
  it('Gratis-Plan-Grenze (Xetra-Wert) ist nicht nachholbar', () => {
    const r = classifyTwelveDataError(
      403,
      'This symbol is available starting with the Grow or Venture plan. Consider upgrading now at https://twelvedata.com/pricing',
      'RHM:XETR',
    );
    expect(r.kind).toBe('plan');
    expect(r.retryable).toBe(false);
    expect(r.text).toBe('Im Gratis-Plan des Kursanbieters nicht abrufbar (Xetra-Wert)');
  });
  it('sonstige Fehler zeigen Symbol und Meldung, nicht nachholbar', () => {
    const r = classifyTwelveDataError(400, 'symbol not found', 'XYZ');
    expect(r).toEqual({ kind: 'other', retryable: false, text: 'Ticker "XYZ": symbol not found' });
  });
  it('fehlende Meldung ergibt "Keine Daten"', () => {
    expect(classifyTwelveDataError(undefined, undefined, 'ABC').text).toBe('Ticker "ABC": Keine Daten');
  });
});

describe('chunkArray', () => {
  it('teilt in Häppchen', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('leere Liste ergibt keine Häppchen', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });
  it('Nachhol-Runden sind begrenzt', () => {
    expect(WAECHTER_MAX_RETRY_ROUNDS).toBe(2);
  });
});

describe('parseYahooCloses', () => {
  const chart = (close: (number | null)[]) => ({ chart: { result: [{ indicators: { quote: [{ close }] } }], error: null } });

  it('dreht die Reihe auf "neuester zuerst" und entfernt Lücken', () => {
    expect(parseYahooCloses(chart([1, 2, null, 4]))).toEqual({ closes: [4, 2, 1], currency: null });
  });
  it('kappt auf die neuesten 200 Kurse', () => {
    const r = parseYahooCloses(chart(Array.from({ length: 250 }, (_, i) => i + 1)));
    expect('closes' in r && r.closes.length).toBe(200);
    expect('closes' in r && r.closes[0]).toBe(250);
  });
  it('meldet Yahoo-Fehler auf Deutsch mit der Originalmeldung', () => {
    const r = parseYahooCloses({ chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } });
    expect(r).toEqual({ error: 'Yahoo: No data found, symbol may be delisted' });
  });
  it('leere Kursliste ist ein Fehler', () => {
    expect(parseYahooCloses(chart([null, null]))).toEqual({ error: 'Yahoo: Keine Kursdaten' });
  });
  it('kaputte Antwort ist ein Fehler', () => {
    expect(parseYahooCloses(null)).toEqual({ error: 'Yahoo: Keine Daten' });
  });
});

describe('parseYahooCloses: Währung', () => {
  it('liest die Währung aus den Metadaten', () => {
    const data = { chart: { result: [{ meta: { currency: 'EUR' }, indicators: { quote: [{ close: [1, 2] }] } }], error: null } };
    expect(parseYahooCloses(data)).toEqual({ closes: [2, 1], currency: 'EUR' });
  });
});

describe('formatDateDe', () => {
  it('formatiert deutsch mit Zeitzone Berlin', () => {
    expect(formatDateDe('2026-09-19T08:00:00Z')).toBe('19.09.2026');
    expect(formatDateDe(new Date('2026-12-31T23:30:00Z'))).toBe('01.01.2027');
  });
});

describe('positionKind', () => {
  it('ETF, Fonds, Anleihe sind Fonds-artig', () => {
    expect(positionKind('ETF')).toBe('fonds');
    expect(positionKind('Fonds')).toBe('fonds');
    expect(positionKind('Anleihe')).toBe('fonds');
  });
  it('Krypto', () => expect(positionKind('Krypto')).toBe('krypto'));
  it('Aktie und alles andere sind Einzelwerte', () => {
    expect(positionKind('Aktie')).toBe('einzelwert');
    expect(positionKind('Sonstiges')).toBe('einzelwert');
  });
  it('unbekannt (alte Ergebnisse) verhält sich wie bisher: Fonds', () => {
    expect(positionKind(null)).toBe('fonds');
  });
});

describe('formatDateTimeDe', () => {
  it('zeigt Tag, Monat und Uhrzeit in deutscher Zeit', () => {
    expect(formatDateTimeDe('2026-09-19T12:32:00Z')).toBe('19.09., 14:32');
  });
});

describe('otherPositionNames', () => {
  const all = [
    { name: 'Rheinmetall AG', ticker: 'RHM.DE' },
    { name: 'Xtrackers AI & Big Data ETF', ticker: 'XAIX.DE' },
    { name: 'Xtrackers AI & Big Data UCITS ETF', ticker: 'XAIX.DE' },
    { name: 'Amazon', ticker: 'AMZ.F' },
    { name: 'Broadcom Inc.', ticker: 'AVGO' },
    { name: 'Amazon', ticker: 'AMZ.F' },
  ];
  it('lässt die aktuelle Position weg, auch wenn sie unter zwei Namen im Depot steht', () => {
    const r = otherPositionNames(all, { name: 'Xtrackers AI & Big Data ETF', ticker: 'XAIX.DE' });
    expect(r).not.toContain('Xtrackers AI & Big Data ETF');
    expect(r).not.toContain('Xtrackers AI & Big Data UCITS ETF');
  });
  it('entfernt Doppelte und sortiert alphabetisch', () => {
    expect(otherPositionNames(all, { name: 'Broadcom Inc.', ticker: 'AVGO' })).toEqual([
      'Amazon',
      'Rheinmetall AG',
      'Xtrackers AI & Big Data ETF',
      'Xtrackers AI & Big Data UCITS ETF',
    ]);
  });
  it('leere Namen werden ignoriert', () => {
    expect(otherPositionNames([{ name: '  ', ticker: 'X' }], { name: 'A', ticker: 'A' })).toEqual([]);
  });
});
