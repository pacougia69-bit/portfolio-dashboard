/**
 * Auswertung: eine Seite mit Beurteilung je Position, sortiert nach Dringlichkeit.
 * Die Einordnung wird bei jedem Anzeigen mit dem AKTUELLEN Trend neu berechnet.
 * Handlungsstufen, keine Kauf-/Verkaufsempfehlung.
 */
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ClipboardCheck, SearchCheck, Trash2 } from 'lucide-react';
import { formatDateTimeDe, type WaechterResultRow } from '@shared/waechter';
import { DATENLAGE_TEXT, TREND_LABEL, buildAuswertung, summaryLine, type AnalyseRow } from '@shared/waechter-auswertung';

const STUFE_CLASS: Record<number, string> = {
  1: 'bg-red-500/20 text-red-300 border-red-500/40',
  2: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  3: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  4: 'bg-muted text-muted-foreground border-border',
  5: 'bg-green-500/15 text-green-300 border-green-500/30',
};
const DOT: Record<string, string> = {
  GRUEN: 'bg-green-500', GELB: 'bg-yellow-500', ROT: 'bg-red-500', KEINE_DATEN: 'bg-muted-foreground/40',
};

interface Props {
  results: WaechterResultRow[];
  analysen: AnalyseRow[];
  onOpenPrompt: (row: WaechterResultRow) => void;
  onDelete: (id: number) => void;
}

export default function WaechterAuswertung({ results, analysen, onOpenPrompt, onDelete }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const { rows, notAnalysed } = buildAuswertung(results, analysen);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Auswertung</h3>
      </div>
      <p className="text-xs text-muted-foreground">{summaryLine(rows, notAnalysed.length)}</p>

      {rows.length > 0 && (
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="w-6 p-2" />
                <th className="text-left p-2">Wert</th>
                <th className="text-left p-2">Trend</th>
                <th className="text-left p-2">Grundlage</th>
                <th className="text-left p-2">Datenlage</th>
                <th className="text-left p-2">Einordnung</th>
                <th className="text-left p-2">Stand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = r.analyse;
                const open = openId === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr className="cursor-pointer border-b border-border/50 align-top hover:bg-muted/20" onClick={() => setOpenId(open ? null : a.id)}>
                      <td className="p-2">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="p-2 font-medium">{r.result.name}</td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[r.result.signal]}`} />
                          {TREND_LABEL[r.result.signal]}
                        </span>
                      </td>
                      <td className="p-2">{a.grundlage}</td>
                      <td className="p-2">{DATENLAGE_TEXT[a.datenlage]}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={`text-xs ${STUFE_CLASS[r.einordnung.stufe]}`}>{r.einordnung.text}</Badge>
                        {r.einordnung.grund && <p className="mt-1 text-xs text-muted-foreground">{r.einordnung.grund}</p>}
                      </td>
                      <td className="p-2 text-xs">
                        <span>{r.age}</span>
                        {r.stale.stale && <p className="text-amber-400">veraltet: {r.stale.reasons.join(', ')}</p>}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border/50 bg-muted/10">
                        <td />
                        <td colSpan={6} className="p-3 space-y-2 text-xs">
                          {a.begruendung && <p><span className="font-medium">Begründung:</span> {a.begruendung}</p>}
                          {a.offen && <p><span className="font-medium">Offen:</span> {a.offen}</p>}
                          <p className="text-muted-foreground">
                            Gespeichert {formatDateTimeDe(a.createdAt)}
                            {a.kiName ? ` · ${a.kiName}` : ''} · Trend damals: {TREND_LABEL[a.trendAtAnalysis]}
                            {a.priceAtAnalysis !== null ? ` · Kurs damals: ${a.priceAtAnalysis.toFixed(2)}` : ''}
                          </p>
                          <details>
                            <summary className="cursor-pointer text-muted-foreground">KI-Antwort, von dir eingefügt (Rohtext)</summary>
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border p-2">{a.rawText}</pre>
                          </details>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => onOpenPrompt(r.result)}>
                              <SearchCheck className="w-4 h-4 mr-1" /> Neue Analyse
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => { if (confirm('Diese Analyse wirklich löschen?')) onDelete(a.id); }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Löschen
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {notAnalysed.length > 0 && (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-muted-foreground">Noch nicht ausgewertet (Gelb oder Rot ohne Analyse):</p>
          <div className="flex flex-wrap gap-2">
            {notAnalysed.map((r) => (
              <Button key={r.positionId} variant="outline" size="sm" onClick={() => onOpenPrompt(r)}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${DOT[r.signal]}`} /> {r.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
