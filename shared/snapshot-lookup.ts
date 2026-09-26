/**
 * Vermoegensverlauf: "Stand an einem Datum nachsehen" - reine Logik, ohne Datenbank.
 * Es gibt nur Werte fuer Tage, an denen das Dashboard geoeffnet wurde. Fehlt der
 * gesuchte Tag, wird der letzte gespeicherte Stand davor genannt (sonst der erste danach).
 */

export interface LookupSnapshot {
  snapshotDate: string; // 'YYYY-MM-DD'
  totalValue: number;
}

export type LookupKind = 'exakt' | 'davor' | 'danach';

export interface LookupResult {
  kind: LookupKind;
  snapshot: LookupSnapshot;
}

export function findSnapshotAtDate(snapshots: LookupSnapshot[], isoDate: string): LookupResult | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const sorted = snapshots
    .filter((s) => Number.isFinite(s.totalValue))
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  if (sorted.length === 0) return null;

  let before: LookupSnapshot | null = null;
  for (const s of sorted) {
    if (s.snapshotDate === isoDate) return { kind: 'exakt', snapshot: s };
    if (s.snapshotDate < isoDate) before = s;
    else break;
  }
  if (before) return { kind: 'davor', snapshot: before };
  return { kind: 'danach', snapshot: sorted[0] };
}
