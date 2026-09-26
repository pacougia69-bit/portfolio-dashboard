/** Vermögensverlauf: Datum wählen und den gespeicherten Depotwert dieses Tages ansehen. */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { findSnapshotAtDate, type LookupSnapshot } from '@shared/snapshot-lookup';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

// ISO 'YYYY-MM-DD' -> 'TT.MM.JJJJ' ohne Zeitzonen-Umweg
const formatIso = (iso: string) => iso.split('-').reverse().join('.');

interface Props {
  snapshots: LookupSnapshot[];
  currentValue?: number | null;
}

export default function SnapshotLookup({ snapshots, currentValue }: Props) {
  const [date, setDate] = useState('');
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const first = sorted[0].snapshotDate;
  const last = sorted[sorted.length - 1].snapshotDate;
  const result = date ? findSnapshotAtDate(snapshots, date) : null;
  const diff = result && currentValue ? currentValue - result.snapshot.totalValue : null;

  return (
    <div className="mt-4 border-t border-border pt-3 space-y-2">
      <label className="text-xs sm:text-sm text-muted-foreground block" htmlFor="verlauf-datum">
        Stand an einem Datum nachsehen (gespeichert von {formatIso(first)} bis {formatIso(last)})
      </label>
      <Input
        id="verlauf-datum"
        type="date"
        value={date}
        min={first}
        max={last}
        onChange={(e) => setDate(e.target.value)}
        className="w-full sm:w-48"
      />
      {result && (
        <div className="text-xs sm:text-sm">
          <div>
            <span className="text-muted-foreground">Depotwert am {formatIso(result.snapshot.snapshotDate)}: </span>
            <span className="font-medium text-foreground">{formatCurrency(result.snapshot.totalValue)}</span>
          </div>
          {result.kind === 'davor' && (
            <p className="text-muted-foreground">
              Für {formatIso(date)} gibt es keinen Eintrag, weil das Dashboard an dem Tag nicht geöffnet wurde. Das ist der letzte gespeicherte Stand davor.
            </p>
          )}
          {result.kind === 'danach' && (
            <p className="text-muted-foreground">
              Vor {formatIso(result.snapshot.snapshotDate)} gibt es keine gespeicherten Werte. Das ist der erste vorhandene Stand.
            </p>
          )}
          {diff !== null && (
            <p className="text-muted-foreground">
              Seitdem: <span className={diff >= 0 ? 'text-emerald-400' : 'text-red-400'}>{diff >= 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))}</span> bis heute
              {' '}(Einzahlungen sind darin enthalten).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
