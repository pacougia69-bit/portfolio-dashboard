import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ListChecks, Plus } from "lucide-react";

export type SelectedPosition = { ticker: string; name: string; type: string };

type SourceKind = "portfolio" | "watchlist" | "adhoc";
type PickerEntry = { key: string; kind: SourceKind; ticker: string; name: string; type: string };

function makeKey(kind: SourceKind, ticker: string): string {
  return `${kind}:${ticker}`;
}

function PickerRow({
  entry,
  checked,
  onToggle,
}: {
  entry: PickerEntry;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 py-2 px-1 rounded hover:bg-muted/40 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={() => onToggle(entry.key)} />
      <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{entry.ticker}</span>
      <span className="text-sm flex-1 truncate">{entry.name}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5 shrink-0">
        {entry.type}
      </span>
    </label>
  );
}

/**
 * Positions-Auswahl vor dem Erstellen einer Morning Note — Portfolio (vorausgewählt)
 * + Watchlist (opt-in) + Ad-hoc-WKN-Eingabe (nie gespeichert, nur für diesen Lauf).
 * Meldet die aktuelle Auswahl über onSelectionChange nach oben.
 */
export default function MorningNotePositionPicker({
  onSelectionChange,
}: {
  onSelectionChange: (positions: SelectedPosition[]) => void;
}) {
  const { data: portfolio = [] } = trpc.portfolio.list.useQuery();
  const { data: watchlist = [] } = trpc.watchlist.list.useQuery();

  // Standardmäßig ist nichts ausgewählt — Rafael wählt aktiv aus, was geprüft
  // werden soll (bei ~25 Portfolio-Positionen wäre "alles vorausgewählt" ein
  // ständiges Abwählen statt Auswählen).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adhocEntries, setAdhocEntries] = useState<PickerEntry[]>([]);
  const [adhocInput, setAdhocInput] = useState("");

  const lookupWkn = trpc.lookup.byWKN.useMutation();
  const lookupTicker = trpc.lookup.byTicker.useMutation();
  const lookupName = trpc.lookup.byName.useMutation();
  const isLookingUp = lookupWkn.isPending || lookupTicker.isPending || lookupName.isPending;

  const portfolioEntries: PickerEntry[] = portfolio.map((p) => ({
    key: makeKey("portfolio", p.ticker),
    kind: "portfolio",
    ticker: p.ticker,
    name: p.name,
    type: p.type,
  }));
  // watchlist_items hat kein type-Feld in der DB — Platzhalter fuer den Prompt-Kontext.
  const watchlistEntries: PickerEntry[] = watchlist.map((w) => ({
    key: makeKey("watchlist", w.ticker),
    kind: "watchlist",
    ticker: w.ticker,
    name: w.name,
    type: "Watchlist",
  }));

  const allEntries = [...portfolioEntries, ...watchlistEntries, ...adhocEntries];

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      reportSelection(next, allEntries);
      return next;
    });
  }

  // Schnellumschalter pro Abschnitt: sind schon alle Einträge dieser Gruppe
  // ausgewählt, wählt der Klick alle ab — sonst wählt er alle an.
  function toggleAll(entries: PickerEntry[]) {
    setSelected((prev) => {
      const allSelected = entries.every((e) => prev.has(e.key));
      const next = new Set(prev);
      for (const e of entries) {
        if (allSelected) next.delete(e.key);
        else next.add(e.key);
      }
      reportSelection(next, allEntries);
      return next;
    });
  }

  function reportSelection(sel: Set<string>, entries: PickerEntry[]) {
    const positions = entries
      .filter((e) => sel.has(e.key))
      .map((e) => ({ ticker: e.ticker, name: e.name, type: e.type }));
    onSelectionChange(positions);
  }

  // Meldet die Auswahl auch nach oben, wenn sich die zugrundeliegenden Listen
  // aendern (z.B. Portfolio-Query laedt nach, oder ein Ad-hoc-Eintrag kommt dazu).
  useEffect(() => {
    reportSelection(selected, allEntries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio, watchlist, adhocEntries, selected]);

  async function handleAddAdhoc() {
    const q = adhocInput.trim();
    if (!q) return;

    // Kaskade wie bei EinstiegsanalysePage: sieht es wie eine WKN aus (kurz, kein
    // Leerzeichen) -> zuerst WKN versuchen, sonst als Name. Ticker als letzter
    // Fallback, falls beides scheitert.
    const looksLikeWkn = q.length <= 6 && !/\s/.test(q);
    let result = looksLikeWkn
      ? await lookupWkn.mutateAsync({ wkn: q })
      : await lookupName.mutateAsync({ name: q });

    if (!result.success || !result.data) {
      result = await lookupTicker.mutateAsync({ ticker: q });
    }
    if (!result.success || !result.data) {
      toast.error(result.error || `"${q}" nicht gefunden.`);
      return;
    }

    const d = result.data;
    const key = makeKey("adhoc", d.ticker);
    const entry: PickerEntry = { key, kind: "adhoc", ticker: d.ticker, name: d.name, type: d.type };
    setAdhocEntries((prev) => [...prev.filter((e) => e.key !== key), entry]);
    setSelected((prev) => new Set(prev).add(key));
    setAdhocInput("");
    toast.success(`${d.name} (${d.ticker}) hinzugefügt`);
  }

  return (
    <Card className="border-border/40">
      <CardHeader className="p-5 sm:p-6 pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          Positionen auswählen
        </CardTitle>
        <CardDescription className="text-sm">
          Weniger Positionen = fokussiertere Recherche. Wähle aus, was geprüft werden soll.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 sm:p-6 pt-0 space-y-5">
        {portfolioEntries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Portfolio
              </div>
              <button
                type="button"
                onClick={() => toggleAll(portfolioEntries)}
                className="text-xs text-primary hover:underline"
              >
                {portfolioEntries.every((e) => selected.has(e.key)) ? "Alle abwählen" : "Alle auswählen"}
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border/20">
              {portfolioEntries.map((entry) => (
                <PickerRow key={entry.key} entry={entry} checked={selected.has(entry.key)} onToggle={toggle} />
              ))}
            </div>
          </div>
        )}

        {watchlistEntries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Watchlist
              </div>
              <button
                type="button"
                onClick={() => toggleAll(watchlistEntries)}
                className="text-xs text-primary hover:underline"
              >
                {watchlistEntries.every((e) => selected.has(e.key)) ? "Alle abwählen" : "Alle auswählen"}
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border/20">
              {watchlistEntries.map((entry) => (
                <PickerRow key={entry.key} entry={entry} checked={selected.has(entry.key)} onToggle={toggle} />
              ))}
            </div>
          </div>
        )}

        {adhocEntries.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 font-medium">
              Zusätzlich (nur für diesen Lauf)
            </div>
            <div className="flex flex-col divide-y divide-border/20">
              {adhocEntries.map((entry) => (
                <PickerRow key={entry.key} entry={entry} checked={selected.has(entry.key)} onToggle={toggle} />
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border/30">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">
            Weitere Aktie prüfen (WKN, Name oder Ticker)
          </div>
          <div className="flex gap-2">
            <Input
              value={adhocInput}
              onChange={(e) => setAdhocInput(e.target.value)}
              placeholder="z.B. A0XYG7 oder SAP"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAdhoc();
                }
              }}
            />
            <Button variant="outline" onClick={handleAddAdhoc} disabled={isLookingUp || !adhocInput.trim()}>
              <Plus className="h-4 w-4 mr-1.5" />
              {isLookingUp ? "Suche…" : "Hinzufügen"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Wird nur für diese eine Morning Note verwendet, nicht gespeichert.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
