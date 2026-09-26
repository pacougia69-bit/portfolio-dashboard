/**
 * Pruefmarke (Depot-Rueckgang vom Hoechststand) - reine Logik, ohne Datenbank und Netzwerk.
 * Laeuft im Browser und ist die Grundlage der Unit-Tests.
 * Regel: Die Marke ist nur ein Erinnerungspunkt fuer einen ruhigen Pruefgang,
 * keine Kauf-/Verkaufsanweisung. Sie wandert nur nach oben mit dem Hoechststand.
 */

// Marke bei 20 % unter dem Hoechststand (Rafael, 26.09.2026).
export const PRUEFMARKE_DROP_PCT = 20;
// Gelb ab drei Viertel des Wegs zur Marke (15 % Rueckgang).
export const PRUEFMARKE_WARN_FACTOR = 0.75;

export type PruefmarkeStatus = 'GRUEN' | 'GELB' | 'ROT';

export interface PruefmarkeSnapshot {
  snapshotDate: string; // 'YYYY-MM-DD'
  totalValue: number;
}

export interface PruefmarkeResult {
  peak: number;
  peakDate: string | null; // null = Hoechststand ist der aktuelle Wert
  marke: number;
  current: number;
  fallPct: number; // Rueckgang vom Hoechststand in %, nie negativ
  distanceToMarke: number; // aktuell minus Marke, negativ = Marke unterschritten
  status: PruefmarkeStatus;
  firstDate: string | null; // aeltester Snapshot, ab dem der Hoechststand gilt
}

export function computePruefmarke(
  snapshots: PruefmarkeSnapshot[],
  currentValue?: number | null,
  dropPct: number = PRUEFMARKE_DROP_PCT,
): PruefmarkeResult | null {
  const valid = snapshots
    .filter((s) => Number.isFinite(s.totalValue) && s.totalValue > 0)
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

  const hasCurrent = currentValue != null && Number.isFinite(currentValue) && currentValue > 0;
  const current = hasCurrent ? (currentValue as number) : valid.length > 0 ? valid[valid.length - 1].totalValue : 0;
  if (current <= 0) return null;

  let peak = current;
  let peakDate: string | null = null;
  for (const s of valid) {
    if (s.totalValue > peak) {
      peak = s.totalValue;
      peakDate = s.snapshotDate;
    }
  }

  const marke = peak * (1 - dropPct / 100);
  // (peak - current) / peak statt 1 - current/peak: vermeidet Rundungsfehler genau auf der Marke.
  const fallPct = Math.max(0, ((peak - current) / peak) * 100);
  let status: PruefmarkeStatus = 'GRUEN';
  if (fallPct >= dropPct) status = 'ROT';
  else if (fallPct >= dropPct * PRUEFMARKE_WARN_FACTOR) status = 'GELB';

  return {
    peak,
    peakDate,
    marke,
    current,
    fallPct,
    distanceToMarke: current - marke,
    status,
    firstDate: valid.length > 0 ? valid[0].snapshotDate : null,
  };
}

// Die vier Schritte des Pruefgangs (Rafael, 26.09.2026).
export const PRUEFGANG_SCHRITTE = [
  'Einen Tag warten, nichts am selben Tag verkaufen.',
  'Drei Fragen beantworten: Ist es der ganze Markt oder nur meine Themen und Zockerecke? Hat sich bei einer Aktie die Geschichte geändert? Brauche ich das Geld in den nächsten Jahren?',
  'Bei dreimal Nein: nichts verkaufen, normal weitersparen. Nur bei einem Ja über einen kleinen Schritt nachdenken (Zockerecke kürzen oder ca. 10 % ins Tagesgeld).',
  'Entscheidung und Grund notieren. Die Marke bleibt beim alten Höchststand.',
] as const;
