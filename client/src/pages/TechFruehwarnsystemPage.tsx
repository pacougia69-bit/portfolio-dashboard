import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Activity,
  ExternalLink,
  Info,
} from "lucide-react";
import { toast } from "sonner";

type Signal = "gruen" | "gelb" | "rot";

type IndicatorResult = {
  label: string;
  signal: Signal;
  value: string;
  reasoning: string;
  sources: string[];
  error?: string;
};

type Indicators = {
  capex_revenue: IndicatorResult;
  circular_financing: IndicatorResult;
  efficiency_jump: IndicatorResult;
  rates_inflation: IndicatorResult;
  market_breadth: IndicatorResult;
};

// Lokaler Snapshot-Typ — der State, den wir in der Seite halten,
// unabhängig davon, ob er aus der DB oder direkt aus der Mutation kommt.
type LocalSnapshot = {
  id?: number;
  createdAt: Date | string;
  overallSignal: Signal;
  indicators: Indicators;
  summary: string | null;
  errorMessage: string | null;
};

// Reihenfolge im Grid
const INDICATOR_KEYS: (keyof Indicators)[] = [
  "capex_revenue",
  "circular_financing",
  "efficiency_jump",
  "rates_inflation",
  "market_breadth",
];

const INDICATOR_LABELS: Record<keyof Indicators, string> = {
  capex_revenue: "Capex/Umsatz",
  circular_financing: "Circular Financing",
  efficiency_jump: "Effizienz-Spruenge",
  rates_inflation: "Zinsen & Inflation",
  market_breadth: "Marktbreite",
};

// ============================================================================
// Farb-/Styling-Helfer pro Signal
// ============================================================================

function getSignalStyles(signal: Signal) {
  switch (signal) {
    case "gruen":
      return {
        bg: "bg-green-500/10",
        border: "border-green-500/40",
        text: "text-green-600 dark:text-green-400",
        ring: "ring-green-500/30",
        Icon: CheckCircle2,
        label: "GRÜN",
      };
    case "gelb":
      return {
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/40",
        text: "text-yellow-600 dark:text-yellow-400",
        ring: "ring-yellow-500/30",
        Icon: AlertTriangle,
        label: "GELB",
      };
    case "rot":
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/40",
        text: "text-red-600 dark:text-red-400",
        ring: "ring-red-500/30",
        Icon: AlertOctagon,
        label: "ROT",
      };
  }
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return d.toLocaleDateString("de-DE");
}

function formatAbsoluteTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// Indikator-Karte (großzügig, lesbar)
// ============================================================================

function IndicatorCard({ indicator }: { indicator: IndicatorResult }) {
  const styles = getSignalStyles(indicator.signal);
  const Icon = styles.Icon;

  return (
    <Card className={`${styles.bg} ${styles.border} border-2 shadow-sm`}>
      <CardHeader className="p-5 sm:p-6 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base sm:text-lg leading-tight">
            {indicator.label}
          </CardTitle>
          <div className={`flex items-center gap-1.5 ${styles.text} font-bold text-sm sm:text-base whitespace-nowrap shrink-0`}>
            <Icon className="h-5 w-5" />
            {styles.label}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
        {/* Wert / Faktenzeile */}
        <div className="bg-background/60 rounded-lg p-3 sm:p-4 border border-border/40">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
            Wert
          </div>
          <div className="text-sm sm:text-base font-semibold leading-relaxed">
            {indicator.value}
          </div>
        </div>

        {/* Begründung */}
        {indicator.reasoning && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
              Begründung
            </div>
            <div className="text-sm sm:text-base text-foreground/90 leading-relaxed">
              {indicator.reasoning}
            </div>
          </div>
        )}

        {/* Quellen */}
        {indicator.sources.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">
              Quellen
            </div>
            <div className="flex flex-wrap gap-2">
              {indicator.sources.map((src, idx) => {
                const isUrl = src.startsWith("http://") || src.startsWith("https://");
                if (isUrl) {
                  return (
                    <a
                      key={idx}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm bg-background/60 hover:bg-background border border-border/50 px-3 py-1.5 rounded-md text-primary hover:underline transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Quelle {idx + 1}
                    </a>
                  );
                }
                return (
                  <span key={idx} className="inline-flex items-center text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-1 rounded">
                    {src}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Fehler-Hinweis */}
        {indicator.error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
            <strong>Hinweis:</strong> {indicator.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Trend-Chart — zeigt den Ampel-Verlauf pro Indikator ueber Zeit
// ============================================================================

function TrendChart({
  history,
  activeId,
  onSelect,
}: {
  history: any[];
  activeId: number | undefined;
  onSelect: (snap: LocalSnapshot) => void;
}) {
  if (!history || history.length < 2) return null;

  const ordered = [...history].reverse();

  const signalColor = (signal: Signal) => {
    switch (signal) {
      case "gruen": return "bg-green-500";
      case "gelb": return "bg-yellow-500";
      case "rot": return "bg-red-500";
    }
  };

  const signalRing = (signal: Signal) => {
    switch (signal) {
      case "gruen": return "ring-green-500/40";
      case "gelb": return "ring-yellow-500/40";
      case "rot": return "ring-red-500/40";
    }
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="p-5 sm:p-6 pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Trend-Verlauf
        </CardTitle>
        <CardDescription className="text-sm">
          Ampel-Entwicklung pro Indikator — aelteste links, neueste rechts
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 sm:p-6 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted-foreground font-medium pr-4 pb-3 whitespace-nowrap sticky left-0 bg-card z-10">
                  Indikator
                </th>
                {ordered.map((snap: any) => {
                  const d = new Date(snap.createdAt);
                  return (
                    <th key={snap.id} className="pb-3 px-1 min-w-[2.5rem]">
                      <div className="text-[10px] text-muted-foreground font-mono text-center leading-tight">
                        {d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Gesamt-Ampel */}
              <tr className="border-b border-border/30">
                <td className="text-xs font-semibold text-foreground pr-4 py-2.5 whitespace-nowrap sticky left-0 bg-card z-10">
                  Gesamt
                </td>
                {ordered.map((snap: any) => {
                  const isActive = snap.id === activeId;
                  return (
                    <td key={snap.id} className="py-2.5 px-1 text-center">
                      <button
                        onClick={() => onSelect(snap as LocalSnapshot)}
                        className="inline-block"
                        title={new Date(snap.createdAt).toLocaleString("de-DE")}
                      >
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full mx-auto ${signalColor(snap.overallSignal)} ${
                          isActive ? `ring-3 ${signalRing(snap.overallSignal)} scale-125` : "opacity-80 hover:opacity-100 hover:scale-110"
                        } transition-all`} />
                      </button>
                    </td>
                  );
                })}
              </tr>
              {/* Pro Indikator eine Zeile */}
              {INDICATOR_KEYS.map((key) => (
                <tr key={key} className="border-b border-border/20 last:border-0">
                  <td className="text-xs text-muted-foreground pr-4 py-2.5 whitespace-nowrap sticky left-0 bg-card z-10">
                    {INDICATOR_LABELS[key]}
                  </td>
                  {ordered.map((snap: any) => {
                    const indicators = snap.indicators as Indicators | undefined;
                    const signal = indicators?.[key]?.signal;
                    const isActive = snap.id === activeId;
                    if (!signal) {
                      return (
                        <td key={snap.id} className="py-2.5 px-1 text-center">
                          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full mx-auto bg-muted/40" />
                        </td>
                      );
                    }
                    return (
                      <td key={snap.id} className="py-2.5 px-1 text-center">
                        <button
                          onClick={() => onSelect(snap as LocalSnapshot)}
                          className="inline-block"
                          title={`${INDICATOR_LABELS[key]}: ${signal.toUpperCase()}`}
                        >
                          <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full mx-auto ${signalColor(signal)} ${
                            isActive ? `ring-2 ${signalRing(signal)} scale-125` : "opacity-70 hover:opacity-100 hover:scale-110"
                          } transition-all`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Verlaufs-Leiste — kompakte Reihe der letzten Snapshots
// ============================================================================

function HistoryStrip({
  history,
  activeId,
  onSelect,
}: {
  history: any[];
  activeId: number | undefined;
  onSelect: (snap: LocalSnapshot) => void;
}) {
  // Erst sinnvoll ab 2 Snapshots
  if (!history || history.length <= 1) return null;

  // Älteste links, neueste rechts — Lese-Richtung
  const ordered = [...history].reverse();

  return (
    <Card className="border-border/40">
      <CardContent className="p-5 sm:p-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-4 font-medium">
          Verlauf · Klick auf einen Punkt zeigt den damaligen Snapshot
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
          {ordered.map((snap: any) => {
            const styles = getSignalStyles(snap.overallSignal as Signal);
            const Icon = styles.Icon;
            const isActive = snap.id === activeId;
            const d = new Date(snap.createdAt);
            return (
              <button
                key={snap.id}
                onClick={() => onSelect(snap as LocalSnapshot)}
                className={`flex flex-col items-center gap-1.5 transition-all ${
                  isActive ? "opacity-100 scale-110" : "opacity-60 hover:opacity-100"
                }`}
                title={d.toLocaleString("de-DE")}
              >
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full ${styles.bg} border-2 ${styles.border} flex items-center justify-center ${
                    isActive ? `ring-4 ${styles.ring}` : ""
                  }`}
                >
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${styles.text}`} />
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                  {d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Haupt-Seite
// ============================================================================

export default function TechFruehwarnsystemPage() {
  const utils = trpc.useUtils();

  // Aus DB geladener Snapshot (initial null wenn kein Eintrag, oder als Fallback)
  const { data: dbSnapshot, isLoading: isLoadingLatest } =
    trpc.techWarning.getLatest.useQuery();

  // Verlaufs-Liste der letzten 30 Snapshots
  const { data: history = [] } = trpc.techWarning.getHistory.useQuery({ limit: 30 });

  // Lokaler State: das ist, was die Seite anzeigt. Wird mit DB-Daten initialisiert
  // und durch Mutation-Antworten aktualisiert. Bleibt sichtbar, auch wenn getLatest
  // zwischendurch null liefert (z.B. wegen Cache- oder DB-Sync-Problemen).
  const [activeSnapshot, setActiveSnapshot] = useState<LocalSnapshot | null>(null);

  // DB-Snapshot in State übernehmen, sobald da
  useEffect(() => {
    if (dbSnapshot && !activeSnapshot) {
      setActiveSnapshot(dbSnapshot as unknown as LocalSnapshot);
    }
  }, [dbSnapshot, activeSnapshot]);

  const fetchSnapshot = trpc.techWarning.fetchSnapshot.useMutation({
    onSuccess: (data) => {
      toast.success("Snapshot aktualisiert");
      // Direkt aus Mutation-Antwort übernehmen — kein Warten auf Refetch
      setActiveSnapshot(data as unknown as LocalSnapshot);
      // Cache trotzdem auffrischen, damit beim nächsten Seitenladen alles passt
      utils.techWarning.getLatest.invalidate();
      utils.techWarning.getHistory.invalidate();
    },
    onError: (err) => {
      toast.error("Fehler beim Holen des Snapshots: " + err.message);
    },
  });

  const isFetching = fetchSnapshot.isPending;

  const snapshot = activeSnapshot;
  const overall = snapshot?.overallSignal as Signal | undefined;
  const overallStyles = overall ? getSignalStyles(overall) : null;
  const indicators = snapshot?.indicators as Indicators | undefined;

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 max-w-7xl">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
            Tech-Frühwarnsystem
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg mt-2">
            Fünf Indikatoren, die einen Tech-Crash früh erkennen sollen
          </p>
        </div>

        {/* Gesamt-Ampel + Aktion (PROMINENT) */}
        <Card
          className={
            overallStyles
              ? `${overallStyles.bg} ${overallStyles.border} border-2 shadow-lg`
              : "border-2 border-dashed border-border/60"
          }
        >
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                {/* Linke Seite: Status */}
                <div className="flex items-center gap-5 sm:gap-6">
                  {overallStyles ? (
                    <>
                      <overallStyles.Icon className={`h-16 w-16 sm:h-24 sm:w-24 ${overallStyles.text} flex-shrink-0`} />
                      <div>
                        <div className="text-xs sm:text-sm uppercase tracking-wider text-muted-foreground font-medium mb-1">
                          Gesamt-Ampel
                        </div>
                        <div className={`text-5xl sm:text-7xl font-black ${overallStyles.text} leading-none`}>
                          {overallStyles.label}
                        </div>
                        {snapshot && (
                          <div className="text-sm sm:text-base text-muted-foreground mt-3">
                            Letzter Snapshot: <strong>{formatRelativeTime(snapshot.createdAt)}</strong>
                            <span className="hidden sm:inline"> · {formatAbsoluteTime(snapshot.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="text-xl sm:text-2xl font-semibold text-foreground">
                        {isLoadingLatest ? "Lade letzten Snapshot…" : "Noch kein Snapshot vorhanden"}
                      </div>
                      <div className="text-sm sm:text-base text-muted-foreground mt-2">
                        {isLoadingLatest
                          ? "Einen Moment bitte."
                          : "Klicke auf den Button, um zum ersten Mal Daten zu holen."}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rechte Seite: Button */}
                <Button
                  size="lg"
                  onClick={() => fetchSnapshot.mutate()}
                  disabled={isFetching}
                  className="w-full lg:w-auto text-base sm:text-lg py-6 sm:py-7 px-6 sm:px-8 shadow-md"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 animate-spin" />
                      Hole Daten… (10-30 Sek.)
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                      {snapshot ? "Neuer Snapshot" : "Snapshot holen"}
                    </>
                  )}
                </Button>
              </div>

              {/* Zusammenfassung */}
              {snapshot?.summary && (
                <div className="pt-4 border-t border-border/40 text-sm sm:text-base text-foreground/80 leading-relaxed">
                  {snapshot.summary}
                </div>
              )}

              {/* Fehler-Hinweise */}
              {snapshot?.errorMessage && (
                <div className="pt-4 border-t border-border/40 bg-yellow-500/5 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-3 sm:py-4 rounded-b text-sm text-yellow-700 dark:text-yellow-400">
                  <strong>Hinweise zu einzelnen Indikatoren:</strong> {snapshot.errorMessage}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trend-Chart */}
        <TrendChart
          history={history}
          activeId={snapshot?.id}
          onSelect={(snap) => setActiveSnapshot(snap)}
        />

        {/* Indikator-Grid — 2 Spalten auf Desktop, 1 Spalte sonst */}
        {indicators && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {INDICATOR_KEYS.map((key) => (
              <IndicatorCard key={key} indicator={indicators[key]} />
            ))}
          </div>
        )}

        {/* Erklär-Karte (kompakter, am Ende) */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="p-5 sm:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              Wie funktioniert das Frühwarnsystem?
            </CardTitle>
            <CardDescription className="text-sm">
              Fünf Indikatoren, die zusammen ein Stimmungsbild geben
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              <strong className="text-foreground">1. Capex/Umsatz-Schere:</strong> Investieren MSFT,
              GOOGL, AMZN und NVDA stärker als ihr Umsatz wächst? Eine sich öffnende Schere ist ein
              Warnzeichen.
            </p>
            <p>
              <strong className="text-foreground">2. Circular Financing:</strong> Finanzieren sich
              AI-Akteure gegenseitig im Kreis (Chipanbieter finanziert Kunden, der dann Chips kauft)?
              Klassisches Blasen-Muster.
            </p>
            <p>
              <strong className="text-foreground">3. Effizienz-Sprünge:</strong> Gibt es disruptive
              Effizienz-Releases (à la DeepSeek), die GPU-Bedarf und Tech-Bewertungen unterhöhlen?
            </p>
            <p>
              <strong className="text-foreground">4. Zinsen &amp; Inflation:</strong> Fed Funds Rate
              und Core CPI (US). Hohe Werte drücken Tech-Bewertungen, persistente Inflation hält den
              Druck aufrecht.
            </p>
            <p>
              <strong className="text-foreground">5. Marktbreite:</strong> Stehen S&amp;P 500 (SPY)
              und Nasdaq 100 (QQQ) über ihrem 200-Tage-Schnitt? Fallen unter den GD200 ist
              klassisches Bärenmarkt-Signal.
            </p>
            <p className="pt-3 text-xs italic border-t border-border/30">
              Die Indikatoren sind ein Beobachtungs-Werkzeug, keine Handelsempfehlung. Letzte
              Entscheidung liegt immer bei dir.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
