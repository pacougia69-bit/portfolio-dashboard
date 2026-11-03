/**
 * Ausstiegs-Prüfung (Kaufkarte 2a/2b): Realitätscheck für Verlust- und Gewinn-Marke einer Position.
 * Rechnet nur, gibt kein Kauf-/Verkaufssignal und bewegt kein Geld. Marken lassen sich je Position merken.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { parseGermanNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { Calculator, ChevronDown, ChevronUp, Loader2, Save, Trash2 } from 'lucide-react';
import { abstandZurMarke, prozentVon, summeZaehlung, type Zaehlung } from '@shared/ausstieg';

interface PositionLite {
  id: number;
  name: string;
  ticker: string;
  type: string;
  currentPrice?: number | null;
  buyPrice: number;
}

const eur = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v);
const pct = (v: number, digits = 0) => `${v.toFixed(digits).replace('.', ',')} %`;

/** Monate von heute bis September 2031 (Rafaels Horizont, Regel 4). */
function monateBis2031(): number {
  const n = new Date();
  return Math.max(1, (2031 - n.getFullYear()) * 12 + (8 - n.getMonth()));
}

function ZaehlZeile({ name, z, mitGewinn }: { name: string; z: Zaehlung; mitGewinn: boolean }) {
  const n = summeZaehlung(z);
  return (
    <tr className="border-b border-border/40">
      <td className="py-1.5 pr-2 text-xs sm:text-sm">{name}</td>
      {mitGewinn && <td className="py-1.5 px-2 text-right font-mono text-xs sm:text-sm text-emerald-400">{pct(prozentVon(z.target, n))}</td>}
      <td className="py-1.5 px-2 text-right font-mono text-xs sm:text-sm text-red-400">{pct(prozentVon(z.stop, n))}</td>
      <td className="py-1.5 pl-2 text-right font-mono text-xs sm:text-sm text-muted-foreground">{pct(prozentVon(z.none, n))}</td>
    </tr>
  );
}

export default function AusstiegCard({ portfolio }: { portfolio: PositionLite[] }) {
  const utils = trpc.useUtils();
  const { data: marken = [] } = trpc.ausstieg.listMarken.useQuery();
  const pruefen = trpc.ausstieg.pruefen.useMutation({ onError: (e) => toast.error(e.message) });
  const speichern = trpc.ausstieg.saveMarken.useMutation({
    onSuccess: () => {
      utils.ausstieg.listMarken.invalidate();
      toast.success('Marken gespeichert');
    },
    onError: (e) => toast.error(e.message),
  });
  const loeschen = trpc.ausstieg.deleteMarken.useMutation({
    onSuccess: () => {
      utils.ausstieg.listMarken.invalidate();
      toast.success('Marken gelöscht');
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [positionId, setPositionId] = useState('');
  const [verlust, setVerlust] = useState('');
  const [gewinn, setGewinn] = useState('');
  const [monate, setMonate] = useState('58');
  const [details, setDetails] = useState(false);

  const positionen = useMemo(
    () => portfolio.filter((p) => p.type !== 'Hebelprodukt').sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [portfolio],
  );
  const position = positionen.find((p) => String(p.id) === positionId);
  const bis2031 = monateBis2031();
  const monateOptionen = useMemo(() => {
    const set = new Set<number>([12, 24, 36, 60, bis2031]);
    const aktuell = parseInt(monate, 10);
    if (Number.isInteger(aktuell) && aktuell >= 1) set.add(aktuell);
    return Array.from(set).sort((a, b) => a - b);
  }, [bis2031, monate]);

  const verlustZahl = verlust.trim() ? -Math.abs(parseGermanNumber(verlust)) : NaN;
  const gewinnZahl = gewinn.trim() ? Math.abs(parseGermanNumber(gewinn)) : null;
  const startKurs = position ? (position.currentPrice ?? position.buyPrice) : null;
  const eingabeOk = !!position && Number.isFinite(verlustZahl) && verlustZahl < 0 && (gewinnZahl === null || Number.isFinite(gewinnZahl));

  const waehle = (id: string) => {
    setPositionId(id);
    pruefen.reset();
    const m = marken.find((x) => String(x.positionId) === id);
    if (m) {
      setVerlust(String(Math.abs(m.verlustPct)).replace('.', ','));
      setGewinn(m.gewinnPct === null ? '' : String(m.gewinnPct).replace('.', ','));
      setMonate(String(m.monate));
    }
  };

  const rechne = () => {
    if (!eingabeOk || !position) return;
    pruefen.mutate({ positionId: position.id, verlustPct: verlustZahl, gewinnPct: gewinnZahl, monate: parseInt(monate, 10) });
  };

  const speichere = () => {
    if (!eingabeOk || !position) return;
    speichern.mutate({ positionId: position.id, verlustPct: verlustZahl, gewinnPct: gewinnZahl, monate: parseInt(monate, 10) });
  };

  const r = pruefen.data?.ergebnis;
  const mitGewinn = gewinnZahl !== null;
  const nameVon = (id: number) => portfolio.find((p) => p.id === id);

  return (
    <Card className="glass-card">
      <CardHeader className="p-3 sm:p-6 pb-2">
        <button type="button" className="flex items-center gap-2 w-full text-left" onClick={() => setOpen(!open)}>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Ausstiegs-Prüfung
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">Realitätscheck, kein Signal</Badge>
          <span className="ml-auto text-muted-foreground">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Wie oft wäre bei diesem Wert zuerst dein Gewinn-Ausstieg, wie oft zuerst dein Verlust-Ausstieg erreicht worden (nur Tagesschlusskurse)? Die Zahlen
            stehen für die Kaufkarte (2a und 2b). Keine Prognose, kein Kauf- oder Verkaufssignal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Position</Label>
              <Select value={positionId} onValueChange={waehle}>
                <SelectTrigger><SelectValue placeholder="Position wählen" /></SelectTrigger>
                <SelectContent>
                  {positionen.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.ticker})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Verlust-Ausstieg: % unter heutigem Kurs</Label>
              <Input inputMode="decimal" placeholder="z. B. 40" value={verlust} onChange={(e) => setVerlust(e.target.value)} />
              {position && startKurs && Number.isFinite(verlustZahl) && (
                <p className="text-[11px] text-muted-foreground">= unter {eur(startKurs * (1 + verlustZahl / 100))} (Tagesschluss)</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gewinn-Ausstieg: % über heutigem Kurs (leer = keiner)</Label>
              <Input inputMode="decimal" placeholder="leer lassen" value={gewinn} onChange={(e) => setGewinn(e.target.value)} />
              {position && startKurs && gewinnZahl !== null && Number.isFinite(gewinnZahl) && (
                <p className="text-[11px] text-muted-foreground">= ab {eur(startKurs * (1 + gewinnZahl / 100))}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zeitraum</Label>
              <Select value={monate} onValueChange={setMonate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monateOptionen.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m === bis2031 ? `bis 09/2031 (${m} Monate)` : `${m} Monate`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={rechne} disabled={!eingabeOk || pruefen.isPending}>
              {pruefen.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Calculator className="w-4 h-4 mr-1" />}
              Prüfen
            </Button>
            <Button variant="outline" onClick={speichere} disabled={!eingabeOk || speichern.isPending}>
              <Save className="w-4 h-4 mr-1" />
              Marken merken
            </Button>
          </div>
          {pruefen.isPending && <p className="text-xs text-muted-foreground">Rechnet mit 10 Jahren Kursgeschichte, das dauert einige Sekunden …</p>}

          {r && pruefen.data && (
            <div className="space-y-3">
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Kurse: {pruefen.data.quelle.symbol}
                {pruefen.data.quelle.waehrung ? ` (${pruefen.data.quelle.waehrung})` : ''}, {r.datenTage} Handelstage.
                {pruefen.data.quelle.naeherung && ' Ersatz-Kürzel, weil das echte zu wenig Geschichte hat (nur eine Näherung).'}
                {' '}Die Marken sind Prozent vom Startkurs, die Währung spielt keine Rolle.
              </p>

              <table className="w-full">
                <thead>
                  <tr className="text-[11px] text-muted-foreground border-b border-border/60">
                    <th className="text-left font-normal pb-1">{mitGewinn ? 'Wer wurde zuerst erreicht?' : 'Verlust-Marke erreicht?'}</th>
                    {mitGewinn && <th className="text-right font-normal pb-1 px-2">Gewinn</th>}
                    <th className="text-right font-normal pb-1 px-2">Verlust</th>
                    <th className="text-right font-normal pb-1 pl-2">keins</th>
                  </tr>
                </thead>
                <tbody>
                  <ZaehlZeile name="Simulation ohne Trend" z={r.simOhneTrend} mitGewinn={mitGewinn} />
                  <ZaehlZeile name="Simulation mit Trend" z={r.simMitTrend} mitGewinn={mitGewinn} />
                  {r.ruecklauf && <ZaehlZeile name="Echte Geschichte" z={r.ruecklauf.zaehlung} mitGewinn={mitGewinn} />}
                </tbody>
              </table>

              <p className="text-xs sm:text-sm">{r.einordnung.simOhneTrend}</p>

              {r.hinweise.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {r.hinweise.map((h) => <li key={h}>{h}</li>)}
                </ul>
              )}

              <button type="button" className="text-xs text-primary underline" onClick={() => setDetails(!details)}>
                {details ? 'Details ausblenden' : 'Details anzeigen'}
              </button>
              {details && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Mit Trend: {r.einordnung.simMitTrend}</p>
                  {r.einordnung.ruecklauf && <p>Echte Geschichte: {r.einordnung.ruecklauf} ({r.ruecklauf?.starts} Starttage, sie überlappen sich und sind nicht unabhängig.)</p>}
                  <p>
                    Trend der Vergangenheit in den Daten: {r.trendProJahrPct >= 0 ? '+' : ''}{pct(r.trendProJahrPct, 1)} pro Jahr. "Ohne Trend" setzt den Mittelwert der Rendite auf 0.
                  </p>
                  {startKurs && (
                    <p>
                      Kurs am Ende des Zeitraums (5 % / Median / 95 %), ohne Trend: {eur(startKurs * r.endeOhneTrend.p05)} / {eur(startKurs * r.endeOhneTrend.p50)} / {eur(startKurs * r.endeOhneTrend.p95)};
                      mit Trend: {eur(startKurs * r.endeMitTrend.p05)} / {eur(startKurs * r.endeMitTrend.p50)} / {eur(startKurs * r.endeMitTrend.p95)}.
                    </p>
                  )}
                  <p>
                    Methode: 10.000 Verläufe aus zusammenhängenden 10-Tage-Blöcken echter Tagesrenditen, geprüft wird nur der Tagesschluss. Gewinn-Meldungen und Kurslücken über deine Marke
                    hinweg sieht die Rechnung nicht voraus.
                  </p>
                </div>
              )}
            </div>
          )}

          {marken.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Gemerkte Marken</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/60">
                      <th className="text-left font-normal pb-1">Position</th>
                      <th className="text-right font-normal pb-1 px-2">Verlust-Marke</th>
                      <th className="text-right font-normal pb-1 px-2 hidden sm:table-cell">Gewinn-Marke</th>
                      <th className="text-right font-normal pb-1 px-2">Abstand</th>
                      <th className="pb-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {marken.map((m) => {
                      const p = nameVon(m.positionId);
                      if (!p) return null;
                      const a = p.currentPrice ? abstandZurMarke(p.currentPrice, m.basisKurs, m.verlustPct) : null;
                      return (
                        <tr key={m.id} className="border-b border-border/30">
                          <td className="py-1.5 pr-2">{p.name}</td>
                          <td className="py-1.5 px-2 text-right font-mono">
                            {pct(m.verlustPct)} {a && <span className="text-muted-foreground">({eur(a.markeKurs)})</span>}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono hidden sm:table-cell">
                            {m.gewinnPct === null ? 'keine' : `+${pct(m.gewinnPct)} (${eur(m.basisKurs * (1 + m.gewinnPct / 100))})`}
                          </td>
                          <td className={`py-1.5 px-2 text-right font-mono ${a && a.abstandPct <= 0 ? 'text-red-400' : ''}`}>
                            {a ? `${a.abstandPct >= 0 ? '+' : ''}${pct(a.abstandPct, 1)}` : '–'}
                          </td>
                          <td className="py-1.5 pl-2 text-right whitespace-nowrap">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => waehle(String(m.positionId))}>Laden</Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-muted-foreground hover:text-red-400"
                              title="Marken löschen"
                              onClick={() => {
                                if (window.confirm(`Marken für ${p.name} wirklich löschen?`)) loeschen.mutate({ positionId: m.positionId });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fällt der Tagesschlusskurs unter die Verlust-Marke, ist das nur dein Anlass für den ruhigen Prüfgang (24 Stunden warten), kein Verkaufsbefehl.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
