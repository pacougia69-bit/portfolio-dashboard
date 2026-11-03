import { describe, it, expect } from 'vitest';
import {
  abstandZurMarke,
  einordnungText,
  logRenditen,
  mulberry32,
  parseYahooSchlusskurse,
  perzentil,
  pruefeAusstieg,
  pruefeMarken,
  ruecklauf,
  simuliere,
} from './ausstieg';

const lineare = (n: number, wachstum: number) => Array.from({ length: n }, (_, i) => 100 * Math.pow(1 + wachstum, i));

describe('pruefeMarken', () => {
  it('nimmt gültige Marken an', () => {
    expect(pruefeMarken({ verlustPct: -40, gewinnPct: 50, monate: 58 })).toBeNull();
    expect(pruefeMarken({ verlustPct: -40, gewinnPct: null, monate: 12 })).toBeNull();
  });
  it('lehnt falsche Marken ab', () => {
    expect(pruefeMarken({ verlustPct: 10, gewinnPct: 50, monate: 12 })).toMatch(/Verlust/);
    expect(pruefeMarken({ verlustPct: -99, gewinnPct: 50, monate: 12 })).toMatch(/Verlust/);
    expect(pruefeMarken({ verlustPct: -40, gewinnPct: -5, monate: 12 })).toMatch(/Gewinn/);
    expect(pruefeMarken({ verlustPct: -40, gewinnPct: 50, monate: 0 })).toMatch(/Zeitraum/);
    expect(pruefeMarken({ verlustPct: -40, gewinnPct: 50, monate: 12.5 })).toMatch(/Zeitraum/);
    expect(pruefeMarken({ verlustPct: NaN, gewinnPct: 50, monate: 12 })).toMatch(/Verlust/);
  });
});

describe('mulberry32', () => {
  it('liefert bei gleichem Startwert dieselbe Folge, Werte in [0,1)', () => {
    const a = mulberry32(19);
    const b = mulberry32(19);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('simuliere', () => {
  const stopLog = Math.log(0.9);
  const zielLog = Math.log(1.1);
  it('konstant steigend trifft das Ziel', () => {
    const r = simuliere(Array(300).fill(0.01), 63, stopLog, zielLog, 100, 10, mulberry32(1));
    expect(r.zaehlung).toEqual({ target: 100, stop: 0, none: 0 });
    expect(r.enden[0]).toBeCloseTo(Math.exp(0.63), 6);
  });
  it('konstant fallend trifft den Stopp', () => {
    const r = simuliere(Array(300).fill(-0.01), 63, stopLog, zielLog, 100, 10, mulberry32(1));
    expect(r.zaehlung.stop).toBe(100);
  });
  it('flach: keins von beiden', () => {
    const r = simuliere(Array(300).fill(0), 63, stopLog, zielLog, 100, 10, mulberry32(1));
    expect(r.zaehlung.none).toBe(100);
  });
  it('ohne Gewinn-Marke (Infinity) zählt nur der Stopp', () => {
    const r = simuliere(Array(300).fill(0.01), 63, stopLog, Infinity, 50, 10, mulberry32(1));
    expect(r.zaehlung).toEqual({ target: 0, stop: 0, none: 50 });
  });
  it('gleicher Startwert, gleiche Zahlen', () => {
    const rend = [0.01, -0.012, 0.004, -0.02, 0.015].flatMap((x) => Array(80).fill(x));
    const a = simuliere(rend, 63, Math.log(0.95), Math.log(1.06), 200, 5, mulberry32(19));
    const b = simuliere(rend, 63, Math.log(0.95), Math.log(1.06), 200, 5, mulberry32(19));
    expect(a.zaehlung).toEqual(b.zaehlung);
  });
});

describe('ruecklauf', () => {
  it('linear steigend: immer Gewinn zuerst', () => {
    const r = ruecklauf(lineare(400, 0.01), 63, 0.9, 1.1)!;
    expect(r.zaehlung.target).toBe(r.starts);
  });
  it('zu wenig Geschichte: null', () => {
    expect(ruecklauf(Array(70).fill(100), 63, 0.9, 1.1)).toBeNull();
  });
  it('zählt die erste Berührung (Stopp vor Ziel)', () => {
    const kurse = [100, 100, 100, 100, 100, 88, ...Array(400).fill(130)];
    const r = ruecklauf(kurse, 10, 0.9, 1.1)!;
    expect(r.zaehlung.stop).toBeGreaterThan(0);
  });
});

describe('perzentil', () => {
  it('ist index-basiert', () => {
    const s = Array.from({ length: 100 }, (_, i) => i);
    expect(perzentil(s, 0.5)).toBe(50);
    expect(perzentil(s, 0.05)).toBe(5);
    expect(perzentil(s, 1)).toBe(99);
  });
});

describe('einordnungText', () => {
  it('bleibt neutral und nennt den Break-even', () => {
    expect(einordnungText({ target: 50, stop: 50, none: 0 }, 50)).toContain('Münzwurf');
    expect(einordnungText({ target: 90, stop: 10, none: 0 }, 50)).toContain('deutlich');
    expect(einordnungText({ target: 10, stop: 90, none: 0 }, 50)).toContain('unter dem Break-even');
    expect(einordnungText({ target: 0, stop: 0, none: 5 }, 50)).toContain('je erreicht');
  });
  it('ohne Gewinn-Marke nur Verlust-Anteil', () => {
    expect(einordnungText({ target: 0, stop: 25, none: 75 }, null)).toContain('25 %');
  });
});

describe('logRenditen', () => {
  it('rechnet Tagesrenditen', () => {
    const r = logRenditen([100, 110]);
    expect(r).toHaveLength(1);
    expect(r[0]).toBeCloseTo(Math.log(1.1), 10);
  });
});

describe('pruefeAusstieg', () => {
  const zickzack = (() => {
    const k = [100];
    for (let i = 0; i < 700; i++) k.push(k[k.length - 1] * (i % 2 === 0 ? 1.02 : 0.99));
    return k;
  })();

  it('wirft bei zu wenig Geschichte und bei falschen Marken', () => {
    expect(() => pruefeAusstieg(Array(100).fill(100), { verlustPct: -20, gewinnPct: 30, monate: 12 })).toThrow(/Zu wenig Geschichte/);
    expect(() => pruefeAusstieg(zickzack, { verlustPct: 20, gewinnPct: 30, monate: 12 })).toThrow(/Verlust/);
  });

  it('Aufwärtstrend: mit Trend öfter Gewinn zuerst als ohne Trend', () => {
    const e = pruefeAusstieg(zickzack, { verlustPct: -20, gewinnPct: 30, monate: 12 }, { replays: 400, block: 2 });
    expect(e.trendProJahrPct).toBeGreaterThan(0);
    expect(e.simMitTrend.target).toBeGreaterThan(e.simOhneTrend.target);
    expect(e.verhaeltnis).toBeCloseTo(1.5, 10);
    expect(e.breakEvenPct).toBeCloseTo(40, 10);
    expect(e.ruecklauf).not.toBeNull();
  });

  it('gleicher Startwert, gleiches Ergebnis', () => {
    const m = { verlustPct: -20, gewinnPct: 30, monate: 12 };
    const a = pruefeAusstieg(zickzack, m, { replays: 300, block: 2, seed: 7 });
    const b = pruefeAusstieg(zickzack, m, { replays: 300, block: 2, seed: 7 });
    expect(a.simMitTrend).toEqual(b.simMitTrend);
    expect(a.endeOhneTrend).toEqual(b.endeOhneTrend);
  });

  it('ohne Gewinn-Marke: kein Verhältnis, kein Gewinn zuerst', () => {
    const e = pruefeAusstieg(zickzack, { verlustPct: -40, gewinnPct: null, monate: 12 }, { replays: 200, block: 2 });
    expect(e.verhaeltnis).toBeNull();
    expect(e.breakEvenPct).toBeNull();
    expect(e.simMitTrend.target).toBe(0);
    expect(e.ruecklauf!.zaehlung.target).toBe(0);
  });

  it('Zählungen ergeben immer die Anzahl der Verläufe', () => {
    const e = pruefeAusstieg(zickzack, { verlustPct: -10, gewinnPct: 10, monate: 6 }, { replays: 250, block: 3 });
    expect(e.simMitTrend.target + e.simMitTrend.stop + e.simMitTrend.none).toBe(250);
    expect(e.simOhneTrend.target + e.simOhneTrend.stop + e.simOhneTrend.none).toBe(250);
    expect(e.endeMitTrend.p05).toBeLessThanOrEqual(e.endeMitTrend.p50);
    expect(e.endeMitTrend.p50).toBeLessThanOrEqual(e.endeMitTrend.p95);
  });

  it('weist auf starken Aufwärtstrend und kurze Geschichte hin', () => {
    const e = pruefeAusstieg(lineare(400, 0.002), { verlustPct: -20, gewinnPct: 30, monate: 12 }, { replays: 100, block: 5 });
    expect(e.hinweise.join(' ')).toMatch(/unter 3 Jahren/);
    expect(e.hinweise.join(' ')).toMatch(/Aufwärtstrend/);
  });
});

describe('parseYahooSchlusskurse', () => {
  const antwort = (close: unknown) => ({ chart: { result: [{ meta: { currency: 'USD' }, indicators: { quote: [{ close }] } }] } });
  it('behält die Reihenfolge (älteste zuerst) und lässt Lücken weg', () => {
    const r = parseYahooSchlusskurse(antwort([10, null, 0, 12, 11]));
    expect(r).toEqual({ closes: [10, 12, 11], currency: 'USD' });
  });
  it('meldet Fehler statt zu raten', () => {
    expect(parseYahooSchlusskurse({ chart: { result: null, error: { description: 'Not Found' } } })).toEqual({ error: 'Yahoo: Not Found' });
    expect(parseYahooSchlusskurse(antwort([null, null]))).toEqual({ error: 'Yahoo: keine Kursdaten' });
    expect(parseYahooSchlusskurse(undefined)).toEqual({ error: 'Yahoo: Keine Daten' });
  });
});

describe('abstandZurMarke', () => {
  it('rechnet Marke und Abstand (ServiceNow-Beispiel)', () => {
    const r = abstandZurMarke(96.14, 96.14, -40)!;
    expect(r.markeKurs).toBeCloseTo(57.684, 3);
    expect(r.abstandPct).toBeCloseTo(66.67, 1);
  });
  it('negativ, wenn der Kurs unter der Marke liegt', () => {
    expect(abstandZurMarke(50, 96.14, -40)!.abstandPct).toBeLessThan(0);
  });
  it('null bei ungültigen Werten', () => {
    expect(abstandZurMarke(0, 96, -40)).toBeNull();
    expect(abstandZurMarke(90, -1, -40)).toBeNull();
    expect(abstandZurMarke(90, 96, NaN)).toBeNull();
  });
});
