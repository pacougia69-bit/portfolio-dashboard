import { describe, it, expect } from 'vitest';
import { findSnapshotAtDate } from './snapshot-lookup';

const snap = (snapshotDate: string, totalValue: number) => ({ snapshotDate, totalValue });
const data = [snap('2027-01-22', 210000), snap('2027-01-18', 200000), snap('2027-01-25', 215000)];

describe('findSnapshotAtDate', () => {
  it('gibt null ohne Daten oder bei ungueltigem Datum', () => {
    expect(findSnapshotAtDate([], '2027-01-20')).toBeNull();
    expect(findSnapshotAtDate(data, '')).toBeNull();
    expect(findSnapshotAtDate(data, '20.01.2027')).toBeNull();
  });

  it('findet einen exakten Tag', () => {
    const r = findSnapshotAtDate(data, '2027-01-22')!;
    expect(r.kind).toBe('exakt');
    expect(r.snapshot.totalValue).toBe(210000);
  });

  it('nimmt bei fehlendem Tag den letzten Stand davor (20.01.2027)', () => {
    const r = findSnapshotAtDate(data, '2027-01-20')!;
    expect(r.kind).toBe('davor');
    expect(r.snapshot.snapshotDate).toBe('2027-01-18');
  });

  it('nimmt bei einem Datum nach dem letzten Eintrag den letzten Stand davor', () => {
    const r = findSnapshotAtDate(data, '2027-03-01')!;
    expect(r.kind).toBe('davor');
    expect(r.snapshot.snapshotDate).toBe('2027-01-25');
  });

  it('nimmt bei einem Datum vor dem ersten Eintrag den ersten Stand danach', () => {
    const r = findSnapshotAtDate(data, '2026-12-31')!;
    expect(r.kind).toBe('danach');
    expect(r.snapshot.snapshotDate).toBe('2027-01-18');
  });
});
