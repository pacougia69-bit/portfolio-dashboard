/** Startseiten-Karte: Prüfmarke 20 % unter dem Depot-Höchststand. Nur ein Erinnerungspunkt, keine Verkaufsanweisung. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ShieldAlert } from 'lucide-react';
import {
  computePruefmarke,
  PRUEFMARKE_DROP_PCT,
  PRUEFGANG_SCHRITTE,
  type PruefmarkeSnapshot,
  type PruefmarkeStatus,
} from '@shared/pruefmarke';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

const STATUS_STYLE: Record<PruefmarkeStatus, { label: string; badge: string; bar: string }> = {
  GRUEN: { label: 'Grün', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', bar: '[&>div]:bg-emerald-500' },
  GELB: { label: 'Gelb', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/40', bar: '[&>div]:bg-amber-500' },
  ROT: { label: 'Rot', badge: 'bg-red-500/15 text-red-400 border-red-500/40', bar: '[&>div]:bg-red-500' },
};

interface Props {
  snapshots: PruefmarkeSnapshot[];
  currentValue?: number | null;
}

export default function PruefmarkeCard({ snapshots, currentValue }: Props) {
  const r = computePruefmarke(snapshots, currentValue);
  if (!r) return null;
  const style = STATUS_STYLE[r.status];
  // Balken: wie weit ist der Rückgang auf dem Weg zur Marke (100 % = Marke erreicht)
  const barValue = Math.min(100, (r.fallPct / PRUEFMARKE_DROP_PCT) * 100);

  return (
    <Card className="glass-card">
      <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Prüfmarke ({PRUEFMARKE_DROP_PCT} % unter dem Höchststand)
          <Badge variant="outline" className={`ml-auto ${style.badge}`}>{style.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
          <div>
            <div className="text-muted-foreground">Höchststand{r.peakDate ? ` (${formatDate(r.peakDate)})` : ' (heute)'}</div>
            <div className="font-medium">{formatCurrency(r.peak)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Marke</div>
            <div className="font-medium">{formatCurrency(r.marke)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Aktuell</div>
            <div className="font-medium">{formatCurrency(r.current)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Abstand zur Marke</div>
            <div className={`font-medium ${r.distanceToMarke < 0 ? 'text-red-400' : ''}`}>
              {r.distanceToMarke >= 0 ? '' : '−'}{formatCurrency(Math.abs(r.distanceToMarke))}
            </div>
          </div>
        </div>

        <div>
          <Progress value={barValue} className={`h-2 ${style.bar}`} />
          <p className="text-xs text-muted-foreground mt-1">
            Rückgang vom Höchststand: {r.fallPct.toFixed(1)} % von {PRUEFMARKE_DROP_PCT} %
          </p>
        </div>

        {r.status === 'ROT' && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs sm:text-sm">
            <p className="font-medium text-red-400 mb-1">Marke erreicht – Zeit für einen ruhigen Prüfgang, kein Verkaufsbefehl:</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              {PRUEFGANG_SCHRITTE.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-[11px] sm:text-xs text-muted-foreground">
          Basis: Vermögensverlauf{r.firstDate ? ` seit ${formatDate(r.firstDate)}` : ''}. Der Höchststand gilt ab dem ersten gespeicherten Tag.
          Neue Einzahlungen erhöhen den Depotwert und können einen kleinen Rückgang etwas verdecken.
        </p>
      </CardContent>
    </Card>
  );
}
