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

// Reihenfolge der Anzeige im Grid
const INDICATOR_KEYS: (keyof Indicators)[] = [
  "capex_revenue",
  "circular_financing",
  "efficiency_jump",
  "rates_inflation",
  "market_breadth",
];

// ============================================================================
// Helper: Farbgebung pro Signal
// ============================================================================

function getSignalStyles(signal: Signal) {
  switch (signal) {
    case "gruen":
      return {
        bg: "bg-green-500/10",
        border: "border-green-500/40",
        text: "text-green-600 dark:text-green-400",
        Icon: CheckCircle2,
        label: "GRÜN",
      };
    case "gelb":
      return {
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/40",
        text: "text-yellow-600 dark:text-yellow-400",
        Icon: AlertTriangle,
        label: "GELB",
      };
    case "rot":
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/40",
        text: "text-red-600 dark:text-red-400",
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

// ============================================================================
// Komponente: Einzelne Indikator-Karte
// ============================================================================

function IndicatorCard({ indicator }: { indicator: IndicatorResult }) {
  const styles = getSignalStyles(indicator.signal);
  const Icon = styles.Icon;

  return (
    <Card className={`${styles.bg} ${styles.border} border-2`}>
      <CardHeader className="p-4 sm:p-5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm sm:text-base leading-tight">
            {indicator.label}
          </CardTitle>
          <div className={`flex items-center gap-1 ${styles.text} font-bold text-xs sm:text-sm whitespace-nowrap`}>
            <Icon className="h-4 w-4" />
            {styles.label}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
        <div className="text-sm font-medium">{indicator.value}</div>
        {indicator.reasoning && (
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {indicator.reasoning}
          </div>
        )}
        {indicator.sources.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
            {indicator.sources.map((src, idx) => {
              const isUrl = src.startsWith("http://") || src.startsWith("https://");
              if (isUrl) {
                return (
                  <a
                    key={idx}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Quelle {idx + 1}
                  </a>
                );
              }
              return (
                <span key={idx} className="text-xs text-muted-foreground font-mono">
                  {src}
                </span>
              );
            })}
          </div>
        )}
        {indicator.error && (
          <div className="text-xs text-red-600 dark:text-red-400 italic">
            Hinweis: {indicator.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Haupt-Seite
// ============================================================================

export default function TechFruehwarnsystemPage() {
  const utils = trpc.useUtils();
  const { data: snapshot, isLoading: isLoadingLatest } = trpc.techWarning.getLatest.useQuery();

  const fetchSnapshot = trpc.techWarning.fetchSnapshot.useMutation({
    onSuccess: () => {
      toast.success("Snapshot aktualisiert");
      utils.techWarning.getLatest.invalidate();
    },
    onError: (err) => {
      toast.error("Fehler beim Holen des Snapshots: " + err.message);
    },
  });

  const isFetching = fetchSnapshot.isPending;

  const overall = snapshot?.overallSignal as Signal | undefined;
  const overallStyles = overall ? getSignalStyles(overall) : null;
  const indicators = snapshot?.indicators as Indicators | undefined;

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
            <Activity className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
            Tech-Frühwarnsystem
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base mt-1">
            Fünf Indikatoren, die einen Tech-Crash früh erkennen sollen
          </p>
        </div>

        {/* Gesamt-Ampel + Aktion */}
        <Card
          className={overallStyles ? `${overallStyles.bg} ${overallStyles.border} border-2` : ""}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {overallStyles ? (
                  <>
                    <overallStyles.Icon className={`h-12 w-12 sm:h-16 sm:w-16 ${overallStyles.text}`} />
                    <div>
                      <div className={`text-3xl sm:text-4xl font-bold ${overallStyles.text}`}>
                        {overallStyles.label}
                      </div>
                      {snapshot && (
                        <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                          Letzter Snapshot: {formatRelativeTime(snapshot.createdAt)}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="text-xl sm:text-2xl font-semibold text-muted-foreground">
                      {isLoadingLatest ? "Lade letzten Snapshot…" : "Noch kein Snapshot vorhanden"}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {isLoadingLatest
                        ? ""
                        : "Klicke auf den Button, um zum ersten Mal Daten zu holen."}
                    </div>
                  </div>
                )}
              </div>

              <Button
                size="lg"
                onClick={() => fetchSnapshot.mutate()}
                disabled={isFetching}
                className="w-full sm:w-auto"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Hole Daten… (10-30 Sek.)
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    {snapshot ? "Neuer Snapshot" : "Snapshot holen"}
                  </>
                )}
              </Button>
            </div>

            {snapshot?.summary && (
              <div className="mt-4 pt-4 border-t border-border/40 text-sm text-muted-foreground">
                {snapshot.summary}
              </div>
            )}

            {snapshot?.errorMessage && (
              <div className="mt-4 pt-4 border-t border-border/40 text-xs text-yellow-600 dark:text-yellow-400">
                <strong>Hinweise zu einzelnen Indikatoren:</strong> {snapshot.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Indikator-Grid */}
        {indicators && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {INDICATOR_KEYS.map((key) => (
              <IndicatorCard key={key} indicator={indicators[key]} />
            ))}
          </div>
        )}

        {/* Erklär-Karte */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Wie funktioniert das Frühwarnsystem?</CardTitle>
            <CardDescription>
              Fünf Indikatoren, die zusammen ein Stimmungsbild geben
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <strong>1. Capex/Umsatz-Schere:</strong> Investieren MSFT, GOOGL, AMZN und NVDA stärker
              als ihr Umsatz wächst? Eine sich öffnende Schere ist ein Warnzeichen.
            </p>
            <p>
              <strong>2. Circular Financing:</strong> Finanzieren sich AI-Akteure gegenseitig im Kreis
              (Chipanbieter finanziert Kunden, der dann Chips kauft)? Klassisches Blasen-Muster.
            </p>
            <p>
              <strong>3. Effizienz-Sprünge:</strong> Gibt es disruptive Effizienz-Releases (à la
              DeepSeek), die GPU-Bedarf und Tech-Bewertungen unterhöhlen?
            </p>
            <p>
              <strong>4. Zinsen & Inflation:</strong> Fed Funds Rate und Core CPI (US). Hohe Werte
              drücken Tech-Bewertungen, persistente Inflation hält den Druck aufrecht.
            </p>
            <p>
              <strong>5. Marktbreite:</strong> Stehen S&P 500 und Nasdaq über ihrem 200-Tage-Schnitt?
              Fallen unter den GD200 ist klassisches Bärenmarkt-Signal.
            </p>
            <p className="pt-2 text-xs italic">
              Die Indikatoren sind ein Beobachtungs-Werkzeug, keine Handelsempfehlung. Letzte
              Entscheidung liegt immer bei dir.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
