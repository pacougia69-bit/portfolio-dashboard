import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Swords, Info, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Lock, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type KiExperimentModel = "openai" | "claude";
type KiExperimentStatus = "offen" | "geschlossen";

type KiExperimentPick = {
  id: number;
  runId: string;
  model: KiExperimentModel;
  ticker: string | null;
  name: string | null;
  bodyMarkdown: string | null;
  virtualAmount: number;
  entryPrice: number | null;
  entryCurrency: string | null;
  entryDate: string | null;
  currentPrice: number | null;
  lastPriceCheckAt: Date | string | null;
  status: KiExperimentStatus;
  closedAt: Date | string | null;
  closePrice: number | null;
  closeReturnPercent: number | null;
  errorMessage: string | null;
  createdAt: Date | string;
};

type KiExperimentRun = {
  runId: string;
  createdAt: Date | string;
  picks: KiExperimentPick[];
};

type KiExperimentStats = {
  decidedRuns: number;
  openaiWins: number;
  claudeWins: number;
  ties: number;
  openaiAvgReturn: number | null;
  claudeAvgReturn: number | null;
};

const MODEL_LABEL: Record<KiExperimentModel, string> = {
  openai: "ChatGPT-Pick",
  claude: "Claude-Pick",
};

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Bei geschlossenen Picks zaehlt das eingefrorene Endergebnis, bei offenen der
// live nachgezogene Kurs — beide laufen ueber dieselbe Anzeige-Logik.
function returnPercent(pick: KiExperimentPick): number | null {
  if (pick.status === "geschlossen") return pick.closeReturnPercent;
  if (!pick.entryPrice || !pick.currentPrice) return null;
  return ((pick.currentPrice - pick.entryPrice) / pick.entryPrice) * 100;
}

function currentValue(pick: KiExperimentPick): number | null {
  const pct = returnPercent(pick);
  if (pct === null) return null;
  return pick.virtualAmount * (1 + pct / 100);
}

function daysHeld(pick: KiExperimentPick): number | null {
  if (!pick.entryDate) return null;
  const entry = new Date(pick.entryDate).getTime();
  if (Number.isNaN(entry)) return null;
  return Math.floor((Date.now() - entry) / (24 * 60 * 60 * 1000));
}

// ============================================================================
// Eine Pick-Karte (ChatGPT ODER Claude)
// ============================================================================

function PickCard({ pick }: { pick: KiExperimentPick }) {
  const [expanded, setExpanded] = useState(false);
  const value = currentValue(pick);
  const pct = returnPercent(pick);
  const isPositive = pct !== null && pct >= 0;
  const isClosed = pick.status === "geschlossen";
  const held = daysHeld(pick);
  const displayPrice = isClosed ? pick.closePrice : pick.currentPrice;

  return (
    <Card className={`border-2 ${pct !== null ? (isPositive ? "border-green-500/30" : "border-red-500/30") : "border-border/40"}`}>
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
              {MODEL_LABEL[pick.model]}
            </span>
            {isClosed ? (
              <span className="flex items-center gap-1 text-xs uppercase tracking-wide font-semibold text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                <Lock className="h-3 w-3" />
                Abgeschlossen
              </span>
            ) : held !== null ? (
              <span className="text-xs text-muted-foreground">Tag {held}/30</span>
            ) : null}
          </div>
          {pct !== null && (
            <span className={`flex items-center gap-1 text-lg font-bold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {isPositive ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          )}
        </div>

        {pick.ticker ? (
          <div>
            <div className="text-2xl font-bold">{pick.ticker}</div>
            <div className="text-sm text-muted-foreground truncate">{pick.name}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">Kein Pick zustande gekommen</div>
        )}

        {pick.entryPrice && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Einstieg ({formatDate(pick.entryDate)})</div>
              <div className="font-mono font-medium">
                {pick.entryPrice.toFixed(2)} {pick.entryCurrency}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                {isClosed ? `Schluss (${formatDate(pick.closedAt)})` : "Aktuell"}
              </div>
              <div className="font-mono font-medium">
                {displayPrice ? `${displayPrice.toFixed(2)} ${pick.entryCurrency}` : "—"}
              </div>
            </div>
          </div>
        )}

        {value !== null && (
          <div className="pt-3 border-t border-border/40">
            <div className="text-xs text-muted-foreground">Virtuell: {pick.virtualAmount.toLocaleString("de-DE")} € investiert</div>
            <div className="text-xl font-bold">
              {value.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €
              <span className={`text-sm font-normal ml-2 ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                ({isPositive ? "+" : ""}
                {(value - pick.virtualAmount).toLocaleString("de-DE", { maximumFractionDigits: 0 })} €)
              </span>
            </div>
          </div>
        )}

        {pick.bodyMarkdown && (
          <div className="pt-2">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Investment-Case {expanded ? "einklappen" : "anzeigen"}
            </button>
            {expanded && (
              <div className="prose prose-sm dark:prose-invert max-w-none mt-3 pt-3 border-t border-border/40">
                <Streamdown>{pick.bodyMarkdown}</Streamdown>
              </div>
            )}
          </div>
        )}

        {pick.errorMessage && (
          <div className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-500/5 p-2 rounded">
            <strong>Hinweis:</strong> {pick.errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Vorsprung-Banner — wer liegt vorn
// ============================================================================

function LeadBanner({ picks }: { picks: KiExperimentPick[] }) {
  const openai = picks.find((p) => p.model === "openai");
  const claude = picks.find((p) => p.model === "claude");
  const openaiValue = openai ? currentValue(openai) : null;
  const claudeValue = claude ? currentValue(claude) : null;
  if (openaiValue === null || claudeValue === null) return null;

  const bothClosed = openai?.status === "geschlossen" && claude?.status === "geschlossen";
  const diff = Math.abs(openaiValue - claudeValue);
  const leader = openaiValue >= claudeValue ? "openai" : "claude";
  const verb = bothClosed ? "hat gewonnen mit" : "liegt aktuell vorn mit";

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4 sm:p-5 text-center">
        <span className="font-semibold">{MODEL_LABEL[leader]}</span> {verb}{" "}
        <span className="font-bold">{diff.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €</span> Vorsprung.
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Bilanz-Kachel — Trefferquote über alle abgeschlossenen Duelle
// ============================================================================

function StatsCard({ stats }: { stats: KiExperimentStats }) {
  if (stats.decidedRuns === 0) return null;

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bilanz · {stats.decidedRuns} abgeschlossene{stats.decidedRuns === 1 ? "s" : ""} Duell{stats.decidedRuns === 1 ? "" : "e"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div>
            <div className="text-xs text-muted-foreground">ChatGPT</div>
            <div className="text-2xl font-bold">{stats.openaiWins} Siege</div>
            {stats.openaiAvgReturn !== null && (
              <div className={`text-sm ${stats.openaiAvgReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                Ø {stats.openaiAvgReturn >= 0 ? "+" : ""}
                {stats.openaiAvgReturn.toFixed(1)}%
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Claude</div>
            <div className="text-2xl font-bold">{stats.claudeWins} Siege</div>
            {stats.claudeAvgReturn !== null && (
              <div className={`text-sm ${stats.claudeAvgReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                Ø {stats.claudeAvgReturn >= 0 ? "+" : ""}
                {stats.claudeAvgReturn.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
        {stats.ties > 0 && (
          <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/40">
            {stats.ties} Unentschieden
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Verlaufs-Leiste
// ============================================================================

function HistoryStrip({
  history,
  activeRunId,
  onSelect,
}: {
  history: KiExperimentRun[];
  activeRunId: string | undefined;
  onSelect: (run: KiExperimentRun) => void;
}) {
  if (!history || history.length <= 1) return null;
  const ordered = [...history].reverse();

  return (
    <Card className="border-border/40">
      <CardContent className="p-5 sm:p-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-4 font-medium">
          Verlauf · Klick auf einen Eintrag zeigt den damaligen Durchlauf
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
          {ordered.map((run) => {
            const isActive = run.runId === activeRunId;
            const d = new Date(run.createdAt);
            return (
              <button
                key={run.runId}
                onClick={() => onSelect(run)}
                className={`flex flex-col items-center gap-1.5 transition-all ${
                  isActive ? "opacity-100 scale-110" : "opacity-60 hover:opacity-100"
                }`}
                title={d.toLocaleString("de-DE")}
              >
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center ${
                    isActive ? "ring-4 ring-primary/30" : ""
                  }`}
                >
                  <Swords className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
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

export default function KiExperimentPage() {
  const utils = trpc.useUtils();

  const { data: dbRun, isLoading: isLoadingLatest } = trpc.kiExperiment.getLatest.useQuery();
  const { data: history = [] } = trpc.kiExperiment.getHistory.useQuery({ limit: 30 });
  const { data: stats } = trpc.kiExperiment.getStats.useQuery();

  const [activeRun, setActiveRun] = useState<KiExperimentRun | null>(null);

  useEffect(() => {
    if (dbRun && !activeRun) {
      setActiveRun(dbRun as unknown as KiExperimentRun);
    }
  }, [dbRun, activeRun]);

  const generateRun = trpc.kiExperiment.generate.useMutation({
    onSuccess: (data) => {
      toast.success("Neuer Durchlauf gestartet");
      setActiveRun(data as unknown as KiExperimentRun);
      utils.kiExperiment.getLatest.invalidate();
      utils.kiExperiment.getHistory.invalidate();
      utils.kiExperiment.getStats.invalidate();
    },
    onError: (err) => {
      toast.error("Fehler beim Starten: " + err.message);
    },
  });

  const refreshPrices = trpc.kiExperiment.refreshPrices.useMutation({
    onSuccess: (data) => {
      toast.success("Kurse aktualisiert");
      setActiveRun(data as unknown as KiExperimentRun);
      utils.kiExperiment.getLatest.invalidate();
      utils.kiExperiment.getHistory.invalidate();
      utils.kiExperiment.getStats.invalidate();
    },
    onError: (err) => {
      toast.error("Fehler beim Aktualisieren: " + err.message);
    },
  });

  const isGenerating = generateRun.isPending;
  const isRefreshing = refreshPrices.isPending;
  const run = activeRun;

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 max-w-7xl">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Swords className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
            KI-Pick-Experiment
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg mt-2">
            ChatGPT vs. Claude — wer pickt die stärkere Mid-Cap-Aktie?
          </p>
        </div>

        {/* Fetter Disclaimer, immer sichtbar */}
        <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300 font-medium text-center">
          ⚠️ Rein virtuell (5.000 € pro Pick) — keine Anlageberatung, kein echtes Geld, kein Bezug zu deinem echten Depot.
        </div>

        {/* Bilanz ueber alle abgeschlossenen Duelle (30-Tage-Frist erreicht) */}
        {stats && <StatsCard stats={stats as unknown as KiExperimentStats} />}

        {/* Aktions-Card */}
        <Card className={run ? "border-2 border-primary/30 shadow-lg" : "border-2 border-dashed border-border/60"}>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                {run ? (
                  <div className="text-sm text-muted-foreground">
                    Letzter Durchlauf: <strong>{formatDate(run.createdAt)}</strong>
                  </div>
                ) : (
                  <div className="text-xl sm:text-2xl font-semibold text-foreground">
                    {isLoadingLatest ? "Lade letzten Durchlauf…" : "Noch kein Durchlauf gestartet"}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {run && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => refreshPrices.mutate({ runId: run.runId })}
                    disabled={isRefreshing || isGenerating}
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-5 w-5 mr-2" />
                    )}
                    Kurse aktualisieren
                  </Button>
                )}
                <Button
                  size="lg"
                  onClick={() => generateRun.mutate()}
                  disabled={isGenerating || isRefreshing}
                  className="shadow-md"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Beide KIs recherchieren… (15-40 Sek.)
                    </>
                  ) : (
                    <>
                      <Swords className="h-5 w-5 mr-2" />
                      {run ? "Neues Experiment starten" : "Erstes Experiment starten"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vergleichs-Karten */}
        {run && run.picks.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {(["openai", "claude"] as KiExperimentModel[]).map((model) => {
                const pick = run.picks.find((p) => p.model === model);
                return pick ? <PickCard key={model} pick={pick} /> : null;
              })}
            </div>
            <LeadBanner picks={run.picks} />
          </>
        )}

        {/* Verlaufs-Leiste */}
        <HistoryStrip history={history as unknown as KiExperimentRun[]} activeRunId={run?.runId} onSelect={(r) => setActiveRun(r)} />

        {/* Erklär-Karte */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="p-5 sm:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              Wie funktioniert das Experiment?
            </CardTitle>
            <CardDescription className="text-sm">Auf Abruf, keine Automatik</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Bei Klick auf "Experiment starten" recherchieren ChatGPT und Claude unabhängig
              voneinander eine Mid-Cap-Aktie (2-10 Mrd. Marktkapitalisierung), bei der sie das
              höchste Renditepotenzial für die nächsten 30 Tage sehen — inklusive vollständigem
              Investment-Case. Danach wird verfolgt, wie sich 5.000 € (virtuell) in diesem Pick
              entwickelt hätten.
            </p>
            <p>
              "Kurse aktualisieren" holt nur die aktuellen Kurse neu, ohne neue Picks zu erzeugen.
              ChatGPT und Claude haben je ein eigenes Kontingent von max. 20 Anfragen/Stunde.
            </p>
            <p>
              Nach 30 Tagen wird ein Pick automatisch geschlossen (Endergebnis eingefroren, "Tag
              X/30" zeigt den Fortschritt) — das passiert beim nächsten Klick auf "Experiment
              starten" oder "Kurse aktualisieren", nicht als fester Zeitplan im Hintergrund. Erst
              wenn beide Picks eines Durchlaufs geschlossen sind, fließt das Duell in die
              Bilanz-Kachel oben ein (Trefferquote, Ø-Rendite je KI).
            </p>
            <p className="pt-3 text-xs italic border-t border-border/30">
              Rein virtuell, keine Kauf-/Verkaufsempfehlung, kein Bezug zu deinem echten Depot.
              Nur zur Beobachtung, wie gut KI-Aktien-Picks tatsächlich abschneiden.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
