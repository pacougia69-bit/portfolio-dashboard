import { describe, it, expect } from 'vitest';
import {
  classifyTrend, simpleMovingAverage, computeTrendSignal, detectChange,
  isThemenwette, isKiWette, getActionHint, decideCheckable, describeLastChecked,
  THEMENWETTEN_WKNS, KI_WETTEN_WKNS,
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
