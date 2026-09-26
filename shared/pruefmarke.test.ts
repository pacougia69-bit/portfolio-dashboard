import { describe, it, expect } from 'vitest';
import { computePruefmarke } from './pruefmarke';

const snap = (snapshotDate: string, totalValue: number) => ({ snapshotDate, totalValue });

describe('computePruefmarke', () => {
  it('gibt null ohne Daten zurueck', () => {
    expect(computePruefmarke([])).toBeNull();
    expect(computePruefmarke([], 0)).toBeNull();
  });

  it('berechnet Hoechststand, Marke und Abstand (Beispiel 138.800 EUR)', () => {
    const r = computePruefmarke([snap('2026-09-01', 130000), snap('2026-09-20', 138800)], 135000)!;
    expect(r.peak).toBe(138800);
    expect(r.peakDate).toBe('2026-09-20');
    expect(r.marke).toBeCloseTo(111040, 5);
    expect(r.distanceToMarke).toBeCloseTo(135000 - 111040, 5);
    expect(r.status).toBe('GRUEN');
    expect(r.firstDate).toBe('2026-09-01');
  });

  it('nimmt den aktuellen Wert als Hoechststand, wenn er ueber allen Snapshots liegt', () => {
    const r = computePruefmarke([snap('2026-09-01', 100000)], 120000)!;
    expect(r.peak).toBe(120000);
    expect(r.peakDate).toBeNull();
    expect(r.fallPct).toBe(0);
    expect(r.status).toBe('GRUEN');
  });

  it('wird gelb ab 15 % und rot ab 20 % Rueckgang', () => {
    const base = [snap('2026-09-01', 100000)];
    expect(computePruefmarke(base, 86000)!.status).toBe('GRUEN');
    expect(computePruefmarke(base, 85000)!.status).toBe('GELB');
    expect(computePruefmarke(base, 80001)!.status).toBe('GELB');
    expect(computePruefmarke(base, 80000)!.status).toBe('ROT');
    expect(computePruefmarke(base, 70000)!.status).toBe('ROT');
  });

  it('bleibt beim alten Hoechststand, wenn das Depot faellt (Marke wandert nicht nach unten)', () => {
    const r = computePruefmarke([snap('2026-09-01', 100000), snap('2026-09-10', 75000)], 75000)!;
    expect(r.peak).toBe(100000);
    expect(r.marke).toBe(80000);
    expect(r.distanceToMarke).toBe(-5000);
  });

  it('ignoriert ungueltige Snapshots und nutzt ohne currentValue den letzten Snapshot', () => {
    const r = computePruefmarke([snap('2026-09-03', 0), snap('2026-09-02', NaN), snap('2026-09-01', 90000), snap('2026-09-04', 95000)])!;
    expect(r.current).toBe(95000);
    expect(r.peak).toBe(95000);
  });
});
