import { describe, it, expect } from 'vitest';
import {
  EINZAHLUNGS_ZEITRAEUME,
  berechneZeitraum,
  berechneGesamt,
} from './einzahlungen';

const HEUTE = 193513; // Depotwert laut Backup vom 10.11.2026

describe('berechneZeitraum', () => {
  it('2025: Endwert fest, Ergebnis ca. +35.515 EUR', () => {
    const r = berechneZeitraum(EINZAHLUNGS_ZEITRAEUME[0], HEUTE);
    expect(r.endWert).toBeCloseTo(143264.9, 2);
    expect(r.nettoEingezahlt).toBeCloseTo(30023.4, 2);
    expect(r.ergebnis).toBeCloseTo(35515.32, 2);
  });

  it('2026: offener Zeitraum nimmt den heutigen Depotwert, Ergebnis ca. -1.191 EUR', () => {
    const r = berechneZeitraum(EINZAHLUNGS_ZEITRAEUME[1], HEUTE);
    expect(r.endWert).toBe(HEUTE);
    expect(r.nettoEingezahlt).toBeCloseTo(51529.88, 2);
    expect(r.ergebnis).toBeCloseTo(-1190.79, 2);
  });
});

describe('berechneGesamt', () => {
  it('seit 01.01.2025: netto 81.553,28 EUR eingezahlt, Ergebnis ca. +34.325 EUR', () => {
    const g = berechneGesamt(EINZAHLUNGS_ZEITRAEUME, HEUTE)!;
    expect(g.startWert).toBeCloseTo(77813.25, 2);
    expect(g.nettoEingezahlt).toBeCloseTo(81553.28, 2);
    expect(g.ertraege).toBeCloseTo(178.06, 2);
    expect(g.ergebnis).toBeCloseTo(34324.53, 2);
  });

  it('Gesamtergebnis = Summe der Zeitraum-Ergebnisse (Stichtage schliessen luckenlos an)', () => {
    const teile = EINZAHLUNGS_ZEITRAEUME.map((z) => berechneZeitraum(z, HEUTE));
    const g = berechneGesamt(EINZAHLUNGS_ZEITRAEUME, HEUTE)!;
    expect(g.ergebnis).toBeCloseTo(teile[0].ergebnis + teile[1].ergebnis, 2);
  });

  it('ohne Zeitraeume: null', () => {
    expect(berechneGesamt([], HEUTE)).toBeNull();
  });
});
