import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Sunrise, Info } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type MorningNotePosition = { ticker: string; name: string; hasNews: boolean };

// Lokaler Notiz-Typ — der State, den wir in der Seite halten,
// unabhängig davon, ob er aus der DB oder direkt aus der Mutation kommt.
type LocalNote = {
  id?: number;
  createdAt: Date | string;
  headline: string;
  bodyMarkdown: string;
  positionsCovered: MorningNotePosition[];
  errorMessage: string | null;
};

// ============================================================================
// Zeit-Helfer (identisch zu TechFruehwarnsystemPage.tsx)
// ============================================================================

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
// Positions-Badges — zeigt auf einen Blick, welche Positionen News hatten
// ============================================================================

function PositionBadges({ positions }: { positions: MorningNotePosition[] }) {
  if (!positions || positions.length === 0) return null;
  const withNews = positions.filter((p) => p.hasNews).length;

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-medium">
        {withNews} von {positions.length} Position{positions.length === 1 ? "" : "en"} mit Meldungen
      </div>
      <div className="flex flex-wrap gap-2">
        {positions.map((p) => (
          <span
            key={p.ticker}
            className={`inline-flex items-center text-xs font-mono px-2 py-1 rounded border ${
              p.hasNews
                ? "bg-primary/10 border-primary/30 text-foreground"
                : "bg-muted/40 border-border/40 text-muted-foreground"
            }`}
            title={p.name}
          >
            {p.ticker}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Verlaufs-Leiste — kompakte Reihe der letzten Notizen (ohne Ampel-Farben)
// ============================================================================

function HistoryStrip({
  history,
  activeId,
  onSelect,
}: {
  history: any[];
  activeId: number | undefined;
  onSelect: (note: LocalNote) => void;
}) {
  // Erst sinnvoll ab 2 Notizen
  if (!history || history.length <= 1) return null;

  // Älteste links, neueste rechts — Lese-Richtung
  const ordered = [...history].reverse();

  return (
    <Card className="border-border/40">
      <CardContent className="p-5 sm:p-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-4 font-medium">
          Verlauf · Klick auf einen Eintrag zeigt die damalige Notiz
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
          {ordered.map((note: any) => {
            const isActive = note.id === activeId;
            const d = new Date(note.createdAt);
            return (
              <button
                key={note.id}
                onClick={() => onSelect(note as LocalNote)}
                className={`flex flex-col items-center gap-1.5 transition-all ${
                  isActive ? "opacity-100 scale-110" : "opacity-60 hover:opacity-100"
                }`}
                title={`${d.toLocaleString("de-DE")} — ${note.headline}`}
              >
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center ${
                    isActive ? "ring-4 ring-primary/30" : ""
                  }`}
                >
                  <Sunrise className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
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

export default function MorningNotePage() {
  const utils = trpc.useUtils();

  // Aus DB geladene Notiz (initial null wenn kein Eintrag, oder als Fallback)
  const { data: dbNote, isLoading: isLoadingLatest } = trpc.morningNote.getLatest.useQuery();

  // Verlaufs-Liste der letzten 30 Notizen
  const { data: history = [] } = trpc.morningNote.getHistory.useQuery({ limit: 30 });

  // Lokaler State: das ist, was die Seite anzeigt. Wird mit DB-Daten initialisiert
  // und durch Mutation-Antworten aktualisiert. Bleibt sichtbar, auch wenn getLatest
  // zwischendurch null liefert.
  const [activeNote, setActiveNote] = useState<LocalNote | null>(null);

  // DB-Notiz in State übernehmen, sobald da
  useEffect(() => {
    if (dbNote && !activeNote) {
      setActiveNote(dbNote as unknown as LocalNote);
    }
  }, [dbNote, activeNote]);

  const generateNote = trpc.morningNote.generate.useMutation({
    onSuccess: (data) => {
      toast.success("Morning Note erstellt");
      // Direkt aus Mutation-Antwort übernehmen — kein Warten auf Refetch
      setActiveNote(data as unknown as LocalNote);
      // Cache trotzdem auffrischen, damit beim nächsten Seitenladen alles passt
      utils.morningNote.getLatest.invalidate();
      utils.morningNote.getHistory.invalidate();
    },
    onError: (err) => {
      toast.error("Fehler beim Erstellen der Morning Note: " + err.message);
    },
  });

  const isFetching = generateNote.isPending;
  const note = activeNote;

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 max-w-7xl">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Sunrise className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
            Morning Note
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg mt-2">
            Kompakte Zusammenfassung relevanter Nachrichten zu deinem Portfolio
          </p>
        </div>

        {/* Schlagzeile + Aktion (PROMINENT) */}
        <Card className={note ? "border-2 border-primary/30 shadow-lg" : "border-2 border-dashed border-border/60"}>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                {/* Linke Seite: Schlagzeile */}
                <div className="flex items-center gap-5 sm:gap-6">
                  {note ? (
                    <>
                      <Sunrise className="h-16 w-16 sm:h-20 sm:w-20 text-primary flex-shrink-0" />
                      <div>
                        <div className="text-xs sm:text-sm uppercase tracking-wider text-muted-foreground font-medium mb-1">
                          Top-Meldung
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold leading-tight">
                          {note.headline}
                        </div>
                        <div className="text-sm sm:text-base text-muted-foreground mt-3">
                          Erstellt: <strong>{formatRelativeTime(note.createdAt)}</strong>
                          <span className="hidden sm:inline"> · {formatAbsoluteTime(note.createdAt)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="text-xl sm:text-2xl font-semibold text-foreground">
                        {isLoadingLatest ? "Lade letzte Notiz…" : "Noch keine Morning Note vorhanden"}
                      </div>
                      <div className="text-sm sm:text-base text-muted-foreground mt-2">
                        {isLoadingLatest
                          ? "Einen Moment bitte."
                          : "Klicke auf den Button, um zum ersten Mal eine Zusammenfassung zu erstellen."}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rechte Seite: Button */}
                <Button
                  size="lg"
                  onClick={() => generateNote.mutate()}
                  disabled={isFetching}
                  className="w-full lg:w-auto text-base sm:text-lg py-6 sm:py-7 px-6 sm:px-8 shadow-md"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 animate-spin" />
                      Recherchiere… (10-30 Sek.)
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                      {note ? "Neue Morning Note" : "Morning Note erstellen"}
                    </>
                  )}
                </Button>
              </div>

              {/* Notiz-Text */}
              {note?.bodyMarkdown && (
                <div className="pt-4 border-t border-border/40">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{note.bodyMarkdown}</Streamdown>
                  </div>
                </div>
              )}

              {/* Positions-Badges */}
              {note?.positionsCovered && note.positionsCovered.length > 0 && (
                <div className="pt-4 border-t border-border/40">
                  <PositionBadges positions={note.positionsCovered} />
                </div>
              )}

              {/* Fehler-Hinweis */}
              {note?.errorMessage && (
                <div className="pt-4 border-t border-border/40 bg-yellow-500/5 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-3 sm:py-4 rounded-b text-sm text-yellow-700 dark:text-yellow-400">
                  <strong>Hinweis:</strong> {note.errorMessage}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Verlaufs-Leiste */}
        <HistoryStrip history={history} activeId={note?.id} onSelect={(n) => setActiveNote(n)} />

        {/* Erklär-Karte */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="p-5 sm:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              Wie funktioniert die Morning Note?
            </CardTitle>
            <CardDescription className="text-sm">
              Auf Abruf, keine Automatik
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0 text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Bei Klick durchsucht die KI aktuelle Nachrichten zu deinen tatsächlichen
              Portfolio-Positionen der letzten 12-16 Stunden und fasst zusammen, was
              wichtig sein könnte. Positionen ohne nennenswerte News werden einfach
              weggelassen, nichts wird erfunden.
            </p>
            <p>
              Läuft nur auf Knopfdruck — kein Zeitplan, keine automatische Erstellung.
              Nutzt dasselbe geteilte KI-Anfragen-Kontingent (max. 20/Stunde) wie das
              Tech-Frühwarnsystem und die Einstiegsanalyse.
            </p>
            <p className="pt-3 text-xs italic border-t border-border/30">
              Reine Nachrichten-Zusammenfassung, keine Kauf-/Verkaufsempfehlung. Letzte
              Entscheidung liegt immer bei dir.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
