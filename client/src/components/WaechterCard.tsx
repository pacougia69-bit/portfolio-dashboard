/**
 * Waechter-Karte: Trend-Pruefung aller Positionen auf Knopfdruck.
 * Nur lesen - bewegt kein Geld. "Genauer ansehen" erzeugt einen Text zum Kopieren
 * fuer eine KI nach Wahl (die App ruft selbst keine KI auf).
 */
import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Copy, SearchCheck, X } from 'lucide-react';
import {
  WAECHTER_CHUNK_SIZE,
  WAECHTER_CHUNK_DELAY_MS,
  WAECHTER_MAX_RETRY_ROUNDS,
  chunkArray,
  type TrendSignal,
  type WaechterResultRow,
} from '@shared/waechter';
import { buildWaechterPrompt } from '@shared/waechter-prompt';

const DOT: Record<TrendSignal, string> = {
  GRUEN: 'bg-green-500',
  GELB: 'bg-yellow-500',
  ROT: 'bg-red-500',
  KEINE_DATEN: 'bg-muted-foreground/40',
};
const LABEL: Record<TrendSignal, string> = { GRUEN: 'Grün', GELB: 'Gelb', ROT: 'Rot', KEINE_DATEN: 'Ohne Daten' };
const SORT_RANK: Record<TrendSignal, number> = { ROT: 0, GELB: 1, GRUEN: 2, KEINE_DATEN: 3 };

const changeText = (r: WaechterResultRow) => {
  switch (r.change) {
    case 'verschlechtert':
      return `verschlechtert (${LABEL[r.prevSignal!]} → ${LABEL[r.signal]})`;
    case 'verbessert':
      return `verbessert (${LABEL[r.prevSignal!]} → ${LABEL[r.signal]})`;
    case 'neu':
      return 'erste Prüfung';
    default:
      return 'unverändert';
  }
};

// Pause in 1-Sekunden-Schritten, damit "Abbrechen" sofort greift.
const sleepUnlessCancelled = async (ms: number, cancelled: () => boolean) => {
  for (let waited = 0; waited < ms && !cancelled(); waited += 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

export default function WaechterCard() {
  const latest = trpc.waechter.getLatest.useQuery();
  const startRun = trpc.waechter.startRun.useMutation();
  const checkChunk = trpc.waechter.checkChunk.useMutation();
  const finishRun = trpc.waechter.finishRun.useMutation();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [startInfo, setStartInfo] = useState<{ skipped: { name: string; reason: string }[]; mutedCount: number } | null>(null);
  const [promptRow, setPromptRow] = useState<WaechterResultRow | null>(null);
  const cancelRef = useRef(false);

  const handleStart = async () => {
    cancelRef.current = false;
    setRunning(true);
    setProgress(null);
    try {
      const start = await startRun.mutateAsync();
      setStartInfo({ skipped: start.skipped, mutedCount: start.mutedCount });
      if (start.positions.length === 0) {
        toast.info('Keine Positionen zu prüfen (alle stummgeschaltet oder ohne Ticker).');
        return;
      }
      // Ein Häppchen = bis zu 8 verschiedene Kurs-Abrufe (Positionen mit gleichem Ticker teilen sich einen).
      // Gibt die Positionen zurück, die wegen des Minuten-Limits fehlschlugen und nachgeholt werden sollen.
      const processGroups = async (
        groupList: { positionIds: number[] }[],
        label: string,
      ): Promise<Set<number>> => {
        const retryIds = new Set<number>();
        const chunks = chunkArray(groupList, WAECHTER_CHUNK_SIZE);
        for (let i = 0; i < chunks.length; i++) {
          if (cancelRef.current) break;
          setProgress({ label, done: i, total: chunks.length });
          const ids = chunks[i].flatMap((g) => g.positionIds);
          try {
            const res = await checkChunk.mutateAsync({ runId: start.runId, positionIds: ids });
            res.retryPositionIds.forEach((id) => retryIds.add(id));
          } catch (e: any) {
            toast.error(`Häppchen ${i + 1} fehlgeschlagen: ${e?.message ?? 'Fehler'}`);
            ids.forEach((id) => retryIds.add(id));
          }
          if (i < chunks.length - 1) await sleepUnlessCancelled(WAECHTER_CHUNK_DELAY_MS, () => cancelRef.current);
        }
        return retryIds;
      };

      let pending = await processGroups(start.groups, 'Prüfung');
      for (let round = 1; round <= WAECHTER_MAX_RETRY_ROUNDS && pending.size > 0 && !cancelRef.current; round++) {
        const label = `Nachholen ${round}/${WAECHTER_MAX_RETRY_ROUNDS}`;
        setProgress({ label: `${label} (Pause)`, done: 0, total: 1 });
        await sleepUnlessCancelled(WAECHTER_CHUNK_DELAY_MS, () => cancelRef.current);
        if (cancelRef.current) break;
        const retryGroups = start.groups.filter((g) => g.positionIds.some((id) => pending.has(id)));
        pending = await processGroups(retryGroups, label);
      }

      if (cancelRef.current) {
        toast.warning('Prüfung abgebrochen – dieser Lauf zählt nicht als "zuletzt geprüft".');
        return;
      }
      if (pending.size > 0) {
        toast.warning(`${pending.size} Position(en) konnten nicht geprüft werden – siehe "Ohne Daten".`);
      }
      await finishRun.mutateAsync({ runId: start.runId });
      await latest.refetch();
      toast.success('Wächter-Prüfung abgeschlossen');
    } catch (e: any) {
      toast.error(e?.message ?? 'Wächter konnte nicht gestartet werden');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const results = [...(latest.data?.results ?? [])].sort(
    (a, b) => SORT_RANK[a.signal] - SORT_RANK[b.signal] || a.name.localeCompare(b.name, 'de'),
  );
  const withData = results.filter((r) => r.signal !== 'KEINE_DATEN');
  const noData = results.filter((r) => r.signal === 'KEINE_DATEN');

  const promptText = promptRow
    ? buildWaechterPrompt({
        name: promptRow.name,
        ticker: promptRow.ticker,
        wkn: promptRow.wkn,
        signal: promptRow.signal,
        signalDetail: promptRow.signalDetail,
        prevSignal: promptRow.prevSignal,
        price: promptRow.price,
        sma50: promptRow.sma50,
        sma200: promptRow.sma200,
        isProxy: promptRow.isProxy,
      })
    : '';

  const copyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    toast.success('Text kopiert — jetzt in Gemini, ChatGPT oder Claude einfügen');
  };

  const remainingMinutes = progress ? Math.ceil(((progress.total - progress.done - 1) * WAECHTER_CHUNK_DELAY_MS) / 60000) : 0;

  return (
    <Card className="glass-card mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Wächter (Trend-Prüfung auf Knopfdruck)
          </CardTitle>
          <div className="flex items-center gap-2">
            {running && (
              <Button variant="outline" size="sm" onClick={() => (cancelRef.current = true)}>
                <X className="w-4 h-4 mr-1" /> Abbrechen
              </Button>
            )}
            <Button size="sm" onClick={handleStart} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
              {progress ? `${progress.label}: Häppchen ${Math.min(progress.done + 1, progress.total)}/${progress.total} …` : 'Wächter starten'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Prüft den Trend aller Positionen (Kurs gegen SMA 50 und SMA 200, gleitende Durchschnitte). Er bewegt kein Geld und gibt
          keine Kauf- oder Verkaufsanweisung. Ein Volllauf dauert wegen des Kursabruf-Limits ca. 5 Minuten – Fenster offen lassen. Fehlgeschlagene Abrufe holt er nach einer Pause selbst nach.
          Positionen schaltest du mit dem Augen-Symbol in der Tabelle unten stumm.
        </p>
        {running && progress && (
          <p className="text-xs text-amber-400">Läuft: noch ca. {remainingMinutes} Min. Bitte diese Seite nicht schließen.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {startInfo && (startInfo.mutedCount > 0 || startInfo.skipped.length > 0) && (
          <p className="text-xs text-muted-foreground">
            Nicht geprüft: {startInfo.mutedCount > 0 ? `${startInfo.mutedCount} stummgeschaltet` : ''}
            {startInfo.mutedCount > 0 && startInfo.skipped.length > 0 ? ', ' : ''}
            {startInfo.skipped.length > 0 ? startInfo.skipped.map((s) => `${s.name} (${s.reason})`).join(', ') : ''}
          </p>
        )}

        {latest.isLoading ? (
          <p className="text-sm text-muted-foreground">Lade letzten Lauf …</p>
        ) : !latest.data ? (
          <p className="text-sm text-muted-foreground">Noch kein abgeschlossener Lauf. Klicke auf "Wächter starten".</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Letzter Lauf: {new Date(latest.data.run.finishedAt).toLocaleString('de-DE')} · {latest.data.run.positionenGeprueft} geprüft
              {latest.data.run.positionenOhneDaten > 0 ? ` · ${latest.data.run.positionenOhneDaten} ohne Daten` : ''}
            </p>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-2">Position</th>
                    <th className="text-left p-2">Signal</th>
                    <th className="text-left p-2">Seit letztem Lauf</th>
                    <th className="text-left p-2">Handlungsstufe</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {withData.map((r) => (
                    <tr key={r.positionId} className="border-b border-border/50 align-top">
                      <td className="p-2">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.ticker}
                          {r.isProxy && <span title="Trend über einen ähnlichen US-Wert berechnet, nicht der echte Kurs"> · Näherung</span>}
                        </p>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${DOT[r.signal]}`} />
                          <span>{LABEL[r.signal]}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.signalDetail}</p>
                      </td>
                      <td className="p-2">
                        <Badge variant={r.change === 'verschlechtert' ? 'destructive' : 'secondary'} className="text-xs">
                          {changeText(r)}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">{r.actionHint}</td>
                      <td className="p-2 text-right">
                        {(r.signal === 'GELB' || r.signal === 'ROT') && (
                          <Button variant="outline" size="sm" onClick={() => setPromptRow(r)}>
                            <SearchCheck className="w-4 h-4 mr-1" /> Genauer ansehen
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {noData.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Ohne Daten (nicht bewertet):</p>
                {noData.map((r) => (
                  <p key={r.positionId}>
                    {r.name} ({r.ticker}): {r.signalDetail}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={promptRow !== null} onOpenChange={(open) => !open && setPromptRow(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Genauer ansehen: {promptRow?.name}</DialogTitle>
            <DialogDescription>
              Diesen Text kopieren und in eine KI deiner Wahl einfügen (Gemini, ChatGPT, Claude). Die App ruft selbst keine KI auf.
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={promptText} rows={16} className="font-mono text-xs" />
          <Button onClick={copyPrompt}>
            <Copy className="w-4 h-4 mr-1" /> Text kopieren
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
