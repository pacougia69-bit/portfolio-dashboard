/**
 * Einstiegsanalyse — 5-Kriterien-Checkliste + Kurssprung-Filter + Tranchenplan +
 * Innovationsbudget, als Dashboard-Modul (Phase 2 der Idee aus
 * PROJEKTE/Aktien-Einstiegsanalyse — Phase 1 war das Standalone-HTML-Tool).
 *
 * Formeln 1:1 aus einstiegsanalyse.html portiert (Kriterium-3-Score,
 * Kurssprung-Filter-Matrix, Abschlussregel, Tranchenplan) — hier nur die
 * Kurs/RSI/SMA-Datenanbindung und die Persistenz neu.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { parseGermanNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  SearchCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  PauseCircle,
  Bot,
  Clipboard,
  History,
  Plus,
  Trash2,
} from "lucide-react";

type Signal = "GRUEN" | "GELB" | "ROT";

function signalStyles(signal: Signal) {
  switch (signal) {
    case "GRUEN":
      return { bg: "bg-green-500/10", border: "border-green-500/40", text: "text-green-600 dark:text-green-400", Icon: CheckCircle2, label: "GRÜN" };
    case "GELB":
      return { bg: "bg-yellow-500/10", border: "border-yellow-500/40", text: "text-yellow-600 dark:text-yellow-400", Icon: AlertTriangle, label: "GELB" };
    case "ROT":
      return { bg: "bg-red-500/10", border: "border-red-500/40", text: "text-red-600 dark:text-red-400", Icon: AlertOctagon, label: "ROT" };
  }
}

function AmpelBadge({ signal, detail }: { signal: Signal; detail?: string }) {
  const s = signalStyles(signal);
  return (
    <div className={`rounded-lg border-2 ${s.bg} ${s.border} p-3 flex items-start gap-2`}>
      <s.Icon className={`h-5 w-5 shrink-0 ${s.text}`} />
      <div className="min-w-0">
        <div className={`font-bold text-sm ${s.text}`}>{s.label}</div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5 break-words">{detail}</div>}
      </div>
    </div>
  );
}

const CURRENT_YEAR = new Date().getFullYear();

export default function EinstiegsanalysePage() {
  const search = useSearch();
  const utils = trpc.useUtils();

  // === Ticker/Stammdaten ===
  const [ticker, setTicker] = useState("");
  const [wkn, setWkn] = useState("");
  const [name, setName] = useState("");
  const [prefillDone, setPrefillDone] = useState(false);

  useEffect(() => {
    if (prefillDone) return;
    const params = new URLSearchParams(search);
    const t = params.get("ticker");
    const w = params.get("wkn");
    const n = params.get("name");
    if (t) setTicker(t);
    if (w) setWkn(w);
    if (n) setName(n);
    setPrefillDone(true);
  }, [search, prefillDone]);

  // === Technische Daten ===
  const fetchTechnicalData = trpc.einstiegsanalyse.fetchTechnicalData.useMutation();
  const technicalData = fetchTechnicalData.data?.success ? fetchTechnicalData.data.data : null;

  const handleLoadData = () => {
    if (!ticker.trim()) {
      toast.error("Bitte zuerst einen Ticker eingeben.");
      return;
    }
    fetchTechnicalData.mutate({ ticker: ticker.trim() });
  };

  // === Kurssprung-Filter ===
  const [grund, setGrund] = useState<"ja" | "nein" | "">("");
  const [spezifisch, setSpezifisch] = useState<"firmenspezifisch" | "sektor" | "">("");
  const [vorlauf, setVorlauf] = useState<"einklang" | "vorlauf" | "">("");

  const kurssprung = useMemo(() => {
    const wochenperf = technicalData?.wochenperf ?? null;
    const ausgeloest = wochenperf !== null && Math.abs(wochenperf) >= 8;
    if (!ausgeloest) {
      return { ausgeloest: false, amp: "GRUEN" as Signal, konsequenz: wochenperf !== null ? `Wochenbewegung ${wochenperf.toFixed(1)}% liegt unter der 8%-Schwelle — Filter greift nicht.` : "Noch keine Kursdaten geladen.", coolDown: false };
    }
    let amp: Signal = "GRUEN";
    let konsequenz = "";
    let coolDown = false;
    if (grund === "nein") {
      konsequenz = "Kein erkennbarer Grund für den Sprung → Cool-down 3-4 Wochen, keine erste Tranche, nur beobachten.";
      amp = "ROT"; coolDown = true;
    } else if (grund === "") {
      konsequenz = "Kurssprung ausgelöst — bitte die 3 Fragen unten beantworten.";
      amp = "GELB";
    } else if (spezifisch === "sektor") {
      konsequenz = "Grund vorhanden, aber Sektor/Markt-weit → kein aktienspezifisches Signal, normaler Prozess läuft weiter.";
      amp = "GRUEN";
    } else if (spezifisch === "") {
      konsequenz = "Grund vorhanden — bitte weitere Fragen beantworten.";
      amp = "GELB";
    } else if (vorlauf === "vorlauf") {
      konsequenz = "Grund vorhanden und firmenspezifisch, aber Kurs ist der Bewertung vorausgelaufen → Cool-down 2-3 Wochen, auf Rücksetzer warten.";
      amp = "GELB"; coolDown = true;
    } else if (vorlauf === "") {
      konsequenz = "Firmenspezifischer Grund — bitte letzte Frage beantworten.";
      amp = "GELB";
    } else {
      konsequenz = "Grund vorhanden, firmenspezifisch, Kurs im Einklang mit Fundamentaldaten → normaler Prozess läuft weiter, Tranche 1 möglich.";
      amp = "GRUEN";
    }
    return { ausgeloest: true, amp, konsequenz, coolDown };
  }, [technicalData, grund, spezifisch, vorlauf]);

  // === Kriterium 1: Bewertung ===
  const [bewertung, setBewertung] = useState<"guenstig" | "neutral" | "teuer" | "">("");
  const [kgv, setKgv] = useState("");
  const [bewertungNotiz, setBewertungNotiz] = useState("");
  const k1Signal: Signal = bewertung === "guenstig" ? "GRUEN" : bewertung === "teuer" ? "ROT" : "GELB";
  const k1Detail = `KGV ${kgv || "–"}${bewertungNotiz ? " · " + bewertungNotiz : ""}`;

  // === Kriterium 2: Wachstum ===
  const [wachstum, setWachstum] = useState<"beschleunigt" | "stabil" | "verlangsamt" | "">("");
  const [wachstumNotiz, setWachstumNotiz] = useState("");
  const k2Signal: Signal = wachstum === "beschleunigt" ? "GRUEN" : wachstum === "verlangsamt" ? "ROT" : "GELB";

  // === Kriterium 3: Technik (automatisch) ===
  const k3Signal: Signal = technicalData?.kriterium3Signal ?? "GELB";
  const k3Detail = technicalData?.kriterium3Detail ?? "Noch keine technischen Daten geladen.";

  // === Kriterium 4: Depot-Fit + Doppelung ===
  const [doppelung, setDoppelung] = useState<"keine" | "teilweise" | "relevant" | "">("");
  const [doppelungNotiz, setDoppelungNotiz] = useState("");
  const [positionsgroesse, setPositionsgroesse] = useState("");
  const [gesamtvermoegen, setGesamtvermoegen] = useState("");

  const depotanteilPct = useMemo(() => {
    const pos = parseGermanNumber(positionsgroesse) || 0;
    const gv = parseGermanNumber(gesamtvermoegen) || 0;
    return gv > 0 ? (pos / gv) * 100 : 0;
  }, [positionsgroesse, gesamtvermoegen]);

  const k4Signal: Signal = doppelung === "relevant" || depotanteilPct > 20 ? "ROT" : doppelung === "teilweise" || depotanteilPct > 10 ? "GELB" : "GRUEN";
  const k4Detail = `${depotanteilPct.toFixed(1)}% vom Gesamtvermögen · Doppelung: ${doppelung || "–"}${doppelungNotiz ? " — " + doppelungNotiz : ""}`;

  // === Kriterium 5: These + Exit-These ===
  const [these, setThese] = useState("");
  const [exitThese, setExitThese] = useState("");
  const k5Signal: Signal = these.trim() && exitThese.trim() ? "GRUEN" : "ROT";

  // === Recherche ===
  const researchThese = trpc.einstiegsanalyse.researchThese.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        setThese(result.investmentThese);
        setExitThese(result.exitThese);
        toast.success("Recherche-Vorschlag übernommen — bitte prüfen vor dem Speichern.");
      } else {
        toast.error(result.message || "Recherche fehlgeschlagen.");
      }
    },
    onError: (err) => toast.error("Recherche fehlgeschlagen: " + err.message),
  });

  const handleResearch = () => {
    if (!ticker.trim() || !name.trim()) {
      toast.error("Ticker und Name werden für die Recherche benötigt.");
      return;
    }
    researchThese.mutate({ ticker: ticker.trim(), name: name.trim() });
  };

  const handleCopyPrompt = async () => {
    const prompt = `Recherchiere für die Aktie ${name || ticker} (${ticker}) aktuelle, belastbare Informationen (Quartalszahlen, Guidance, Wachstumstreiber, Risiken, Wettbewerbsposition) und formuliere daraus:

1. Eine INVESTMENT-THESE: ein Satz, warum diese Aktie jetzt interessant ist — was muss in 2 Jahren noch stimmen, damit sich der Kauf gelohnt hat.
2. Eine EXIT-THESE: ein Satz, unter welcher konkreten Bedingung die Position überdacht/verkauft werden sollte.

Antworte am Ende genau mit:
INVESTMENT-THESE: <ein Satz>
EXIT-THESE: <ein Satz>`;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Recherche-Prompt kopiert — in eine KI-App mit Internetzugriff einfügen.");
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  };

  // === Fazit / Abschlussregel ===
  const counts = useMemo(() => {
    const signals = [k1Signal, k2Signal, k3Signal, k4Signal, k5Signal];
    return {
      gruen: signals.filter((s) => s === "GRUEN").length,
      gelb: signals.filter((s) => s === "GELB").length,
      rot: signals.filter((s) => s === "ROT").length,
    };
  }, [k1Signal, k2Signal, k3Signal, k4Signal, k5Signal]);

  const ergebnis: "KAUF_MOEGLICH" | "ABGELEHNT" | "COOLDOWN" = kurssprung.coolDown
    ? "COOLDOWN"
    : counts.rot > 0 || counts.gruen + counts.gelb < 4
    ? "ABGELEHNT"
    : "KAUF_MOEGLICH";

  const fazitStyles = {
    KAUF_MOEGLICH: { bg: "bg-green-500/10", border: "border-green-500/40", text: "text-green-600 dark:text-green-400", title: "✓ Tranche 1 möglich", Icon: CheckCircle2 },
    ABGELEHNT: { bg: "bg-red-500/10", border: "border-red-500/40", text: "text-red-600 dark:text-red-400", title: "✕ Abschlussregel nicht erfüllt", Icon: AlertOctagon },
    COOLDOWN: { bg: "bg-yellow-500/10", border: "border-yellow-500/40", text: "text-yellow-600 dark:text-yellow-400", title: "⏸ Cool-down — noch nicht kaufen", Icon: PauseCircle },
  }[ergebnis];

  // === Tranchenplan ===
  const posGroesse = parseGermanNumber(positionsgroesse) || 0;
  const tranche1 = posGroesse * 0.34;
  const tranche2 = posGroesse * 0.33;
  const tranche3 = posGroesse * 0.33;

  // === Speichern ===
  const saveAnalyse = trpc.einstiegsanalyse.save.useMutation({
    onSuccess: () => {
      toast.success("Analyse gespeichert.");
      utils.einstiegsanalyse.list.invalidate();
    },
    onError: (err) => toast.error("Speichern fehlgeschlagen: " + err.message),
  });

  const handleSave = () => {
    if (!ticker.trim() || !name.trim()) {
      toast.error("Ticker und Name sind Pflicht.");
      return;
    }
    if (!these.trim() || !exitThese.trim()) {
      toast.error("These und Exit-These sind Pflichtfelder vor dem Speichern.");
      return;
    }
    saveAnalyse.mutate({
      ticker: ticker.trim(),
      wkn: wkn.trim() || undefined,
      name: name.trim(),
      preisBeiAnalyse: technicalData?.currentPrice ?? undefined,
      kurssprungAusgeloest: kurssprung.ausgeloest,
      kurssprungWochenperf: technicalData?.wochenperf ?? undefined,
      kurssprungGrund: grund || undefined,
      kurssprungSpezifisch: spezifisch || undefined,
      kurssprungVorlauf: vorlauf || undefined,
      kurssprungKonsequenz: kurssprung.konsequenz,
      coolDown: kurssprung.coolDown,
      kriterium1Signal: k1Signal,
      kriterium1Detail: k1Detail,
      kriterium2Signal: k2Signal,
      kriterium2Detail: wachstumNotiz || wachstum,
      kriterium3Signal: k3Signal,
      kriterium3Detail: k3Detail,
      kriterium4Signal: k4Signal,
      kriterium4Detail: k4Detail,
      these: these.trim(),
      exitThese: exitThese.trim(),
      ergebnis,
      gruenCount: counts.gruen,
      gelbCount: counts.gelb,
      rotCount: counts.rot,
    });
  };

  // === Innovationsbudget ===
  const [budgetJahr] = useState(CURRENT_YEAR);
  const { data: budgetData } = trpc.einstiegsanalyse.budget.getYear.useQuery({ jahr: budgetJahr });
  const [zielInput, setZielInput] = useState("");
  useEffect(() => {
    if (budgetData?.zielbetrag !== null && budgetData?.zielbetrag !== undefined) {
      setZielInput(String(budgetData.zielbetrag));
    }
  }, [budgetData?.zielbetrag]);

  const setZiel = trpc.einstiegsanalyse.budget.setZiel.useMutation({
    onSuccess: () => {
      toast.success("Jahresziel gespeichert.");
      utils.einstiegsanalyse.budget.getYear.invalidate({ jahr: budgetJahr });
    },
  });

  const addNutzung = trpc.einstiegsanalyse.budget.addNutzung.useMutation({
    onSuccess: () => {
      toast.success("Als Nutzung eingetragen.");
      utils.einstiegsanalyse.budget.getYear.invalidate({ jahr: budgetJahr });
    },
  });

  const removeNutzung = trpc.einstiegsanalyse.budget.removeNutzung.useMutation({
    onSuccess: () => {
      utils.einstiegsanalyse.budget.getYear.invalidate({ jahr: budgetJahr });
    },
  });

  const budgetGenutzt = (budgetData?.nutzungen ?? []).reduce((sum, n) => sum + n.betrag, 0);
  const budgetZiel = budgetData?.zielbetrag ?? 0;
  const budgetPct = budgetZiel > 0 ? Math.min(100, (budgetGenutzt / budgetZiel) * 100) : 0;

  const handleNutzungEintragen = () => {
    if (posGroesse <= 0) {
      toast.error("Positionsgröße eintragen, bevor die Nutzung erfasst wird.");
      return;
    }
    addNutzung.mutate({
      jahr: budgetJahr,
      ticker: ticker.trim() || undefined,
      name: name.trim() || undefined,
      betrag: posGroesse,
      beschreibung: these.trim() || undefined,
      datum: new Date().toISOString().split("T")[0],
    });
  };

  // === Historie ===
  const { data: historie = [] } = trpc.einstiegsanalyse.list.useQuery();
  const [detailAnalyse, setDetailAnalyse] = useState<any | null>(null);
  const removeAnalyse = trpc.einstiegsanalyse.remove.useMutation({
    onSuccess: () => {
      toast.success("Eintrag gelöscht.");
      utils.einstiegsanalyse.list.invalidate();
    },
  });

  const ergebnisLabel = { KAUF_MOEGLICH: "Kauf möglich", ABGELEHNT: "Abgelehnt", COOLDOWN: "Cool-down" };

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 max-w-5xl">
        <div className="pt-12 sm:pt-0">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
            <SearchCheck className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
            Einstiegsanalyse
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg mt-2">
            Fester Ablauf für Kauf-Entscheidungen: Checkliste, Kurssprung-Filter, Tranchenplan, Innovationsbudget.
          </p>
        </div>

        <Tabs defaultValue="neu" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="neu">Neue Analyse</TabsTrigger>
            <TabsTrigger value="historie">
              <History className="h-4 w-4 mr-1.5" /> Historie ({historie.length})
            </TabsTrigger>
          </TabsList>

          {/* ===== Neue Analyse ===== */}
          <TabsContent value="neu" className="space-y-6">
            {/* Stammdaten */}
            <Card>
              <CardHeader>
                <CardTitle>Aktie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Ticker</Label>
                    <Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="z.B. AMZN" />
                  </div>
                  <div>
                    <Label>WKN (optional)</Label>
                    <Input value={wkn} onChange={(e) => setWkn(e.target.value)} placeholder="z.B. 906866" />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Amazon" />
                  </div>
                </div>
                <Button onClick={handleLoadData} disabled={fetchTechnicalData.isPending}>
                  {fetchTechnicalData.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Technische Daten laden
                </Button>
                {fetchTechnicalData.data && !fetchTechnicalData.data.success && (
                  <p className="text-sm text-red-500">{fetchTechnicalData.data.message}</p>
                )}
                {technicalData && (
                  <div className="text-sm text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div>Kurs: <strong className="text-foreground">{technicalData.currentPrice.toFixed(2)}</strong></div>
                    <div>RSI14: <strong className="text-foreground">{technicalData.rsi14?.toFixed(1) ?? "–"}</strong></div>
                    <div>SMA50: <strong className="text-foreground">{technicalData.sma50?.toFixed(2) ?? "–"}</strong></div>
                    <div>SMA200: <strong className="text-foreground">{technicalData.sma200?.toFixed(2) ?? "–"}</strong></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Kurssprung-Filter */}
            <Card>
              <CardHeader>
                <CardTitle>Vorfilter: Kurssprung</CardTitle>
                <CardDescription>Läuft vor der Checkliste — Auslöser: ±8% in 5 Handelstagen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AmpelBadge signal={kurssprung.amp} detail={kurssprung.konsequenz} />
                {kurssprung.ausgeloest && (
                  <div className="space-y-4 pt-2 border-t border-border/40">
                    <div>
                      <Label className="mb-2 block">1. Gibt es einen konkret benennbaren Grund?</Label>
                      <RadioGroup value={grund} onValueChange={(v) => setGrund(v as any)} className="flex gap-4">
                        <div className="flex items-center gap-2"><RadioGroupItem value="ja" id="grund-ja" /><Label htmlFor="grund-ja">Ja</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="nein" id="grund-nein" /><Label htmlFor="grund-nein">Nein</Label></div>
                      </RadioGroup>
                    </div>
                    {grund === "ja" && (
                      <div>
                        <Label className="mb-2 block">2. Firmenspezifisch oder Sektor/Markt-weit?</Label>
                        <RadioGroup value={spezifisch} onValueChange={(v) => setSpezifisch(v as any)} className="flex gap-4">
                          <div className="flex items-center gap-2"><RadioGroupItem value="firmenspezifisch" id="spez-fs" /><Label htmlFor="spez-fs">Firmenspezifisch</Label></div>
                          <div className="flex items-center gap-2"><RadioGroupItem value="sektor" id="spez-sek" /><Label htmlFor="spez-sek">Sektor-weit</Label></div>
                        </RadioGroup>
                      </div>
                    )}
                    {grund === "ja" && spezifisch === "firmenspezifisch" && (
                      <div>
                        <Label className="mb-2 block">3. Kurs vs. Fair Value?</Label>
                        <RadioGroup value={vorlauf} onValueChange={(v) => setVorlauf(v as any)} className="flex gap-4">
                          <div className="flex items-center gap-2"><RadioGroupItem value="einklang" id="vor-ein" /><Label htmlFor="vor-ein">Im Einklang</Label></div>
                          <div className="flex items-center gap-2"><RadioGroupItem value="vorlauf" id="vor-vor" /><Label htmlFor="vor-vor">Kurs läuft vor</Label></div>
                        </RadioGroup>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Checkliste */}
            <Card>
              <CardHeader>
                <CardTitle>Grund-Checkliste</CardTitle>
                <CardDescription>Kauf nur, wenn ≥4/5 grün oder gelb und kein rot.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* K1 */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                  <div className="space-y-2">
                    <Label>1. Bewertung — KGV/PEG vs. Historie & Peers</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select value={bewertung} onValueChange={(v) => setBewertung(v as any)}>
                        <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="Einschätzung" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="guenstig">Günstig</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="teuer">Teuer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input value={kgv} onChange={(e) => setKgv(e.target.value)} placeholder="KGV (optional)" className="sm:w-[140px]" />
                    </div>
                    <Textarea value={bewertungNotiz} onChange={(e) => setBewertungNotiz(e.target.value)} placeholder="Notiz (optional)" rows={2} />
                  </div>
                  <AmpelBadge signal={k1Signal} />
                </div>

                {/* K2 */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                  <div className="space-y-2">
                    <Label>2. Wachstumstrend — letzte 4 Quartale</Label>
                    <Select value={wachstum} onValueChange={(v) => setWachstum(v as any)}>
                      <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="Richtung" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beschleunigt">Beschleunigt</SelectItem>
                        <SelectItem value="stabil">Stabil</SelectItem>
                        <SelectItem value="verlangsamt">Verlangsamt</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea value={wachstumNotiz} onChange={(e) => setWachstumNotiz(e.target.value)} placeholder="Begründung (optional)" rows={2} />
                  </div>
                  <AmpelBadge signal={k2Signal} />
                </div>

                {/* K3 */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                  <div className="space-y-1">
                    <Label>3. Technische Lage — automatisch aus RSI + SMA50/200</Label>
                    <p className="text-sm text-muted-foreground">{k3Detail}</p>
                  </div>
                  <AmpelBadge signal={k3Signal} />
                </div>

                {/* K4 */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                  <div className="space-y-2">
                    <Label>4. Depot-Fit + Doppelungs-Check</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={positionsgroesse} onChange={(e) => setPositionsgroesse(e.target.value)} placeholder="Positionsgröße €" inputMode="decimal" />
                      <Input value={gesamtvermoegen} onChange={(e) => setGesamtvermoegen(e.target.value)} placeholder="Gesamtvermögen €" inputMode="decimal" />
                    </div>
                    <Select value={doppelung} onValueChange={(v) => setDoppelung(v as any)}>
                      <SelectTrigger className="sm:w-[220px]"><SelectValue placeholder="Doppelung mit ETFs/Aktien?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keine">Keine Doppelung</SelectItem>
                        <SelectItem value="teilweise">Teilweise Überschneidung</SelectItem>
                        <SelectItem value="relevant">Relevante Top-Holdings bereits im Bestand</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea value={doppelungNotiz} onChange={(e) => setDoppelungNotiz(e.target.value)} placeholder="Notiz (optional)" rows={2} />
                  </div>
                  <AmpelBadge signal={k4Signal} detail={`${depotanteilPct.toFixed(1)}% Depotanteil`} />
                </div>

                {/* K5 */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label>5. These + Exit-These — Pflichtfelder</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleResearch} disabled={researchThese.isPending}>
                      {researchThese.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Bot className="h-4 w-4 mr-1.5" />}
                      Direkt recherchieren
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleCopyPrompt}>
                      <Clipboard className="h-4 w-4 mr-1.5" /> Prompt kopieren
                    </Button>
                  </div>
                  <Textarea value={these} onChange={(e) => setThese(e.target.value)} placeholder="Investment-These: warum diese Aktie, was muss in 2 Jahren noch stimmen?" rows={2} />
                  <Textarea value={exitThese} onChange={(e) => setExitThese(e.target.value)} placeholder="Exit-These: wann überdenke/verkaufe ich?" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Fazit */}
            <Card className={`${fazitStyles.bg} ${fazitStyles.border} border-2`}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <fazitStyles.Icon className={`h-8 w-8 ${fazitStyles.text}`} />
                  <div>
                    <div className={`text-xl font-bold ${fazitStyles.text}`}>{fazitStyles.title}</div>
                    <div className="text-sm text-muted-foreground">{counts.gruen} grün, {counts.gelb} gelb, {counts.rot} rot — Endgültige Entscheidung bleibt bei dir.</div>
                  </div>
                </div>

                {ergebnis === "KAUF_MOEGLICH" && posGroesse > 0 && (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/40 text-center">
                    <div><div className="text-xs text-muted-foreground">Tranche 1 (34%)</div><div className="font-bold">{tranche1.toFixed(0)} €</div></div>
                    <div><div className="text-xs text-muted-foreground">Tranche 2 (33%)</div><div className="font-bold">{tranche2.toFixed(0)} €</div></div>
                    <div><div className="text-xs text-muted-foreground">Tranche 3 (33%)</div><div className="font-bold">{tranche3.toFixed(0)} €</div></div>
                  </div>
                )}

                <Button onClick={handleSave} disabled={saveAnalyse.isPending} className="w-full sm:w-auto">
                  {saveAnalyse.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Analyse speichern
                </Button>
              </CardContent>
            </Card>

            {/* Innovationsbudget */}
            <Card>
              <CardHeader>
                <CardTitle>Innovationsbudget {budgetJahr}</CardTitle>
                <CardDescription>Manuell gepflegtes Jahresziel — nicht automatisch aus dem Depotwert berechnet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label>Jahresziel €</Label>
                    <Input value={zielInput} onChange={(e) => setZielInput(e.target.value)} inputMode="decimal" className="w-[160px]" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setZiel.mutate({ jahr: budgetJahr, zielbetrag: parseGermanNumber(zielInput) || 0 })}>
                    Ziel speichern
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNutzungEintragen} disabled={addNutzung.isPending}>
                    <Plus className="h-4 w-4 mr-1.5" /> Diese Position als Nutzung eintragen
                  </Button>
                </div>

                {budgetZiel > 0 && (
                  <div className="space-y-1.5">
                    <Progress value={budgetPct} />
                    <div className="text-sm text-muted-foreground flex justify-between">
                      <span>{budgetGenutzt.toFixed(0)} € genutzt</span>
                      <span>{Math.max(0, budgetZiel - budgetGenutzt).toFixed(0)} € Rest von {budgetZiel.toFixed(0)} €</span>
                    </div>
                  </div>
                )}

                {(budgetData?.nutzungen ?? []).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    {budgetData!.nutzungen.map((n) => (
                      <div key={n.id} className="flex items-center justify-between text-sm">
                        <span>{n.datum} · {n.name || n.ticker || "–"} · {n.betrag.toFixed(0)} €</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeNutzung.mutate({ id: n.id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Historie ===== */}
          <TabsContent value="historie">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Ergebnis</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historie.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Noch keine gespeicherten Analysen.</TableCell></TableRow>
                    )}
                    {historie.map((a: any) => (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetailAnalyse(a)}>
                        <TableCell className="whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString("de-DE")}</TableCell>
                        <TableCell>{a.name} ({a.ticker})</TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold ${signalStyles(a.ergebnis === "KAUF_MOEGLICH" ? "GRUEN" : a.ergebnis === "COOLDOWN" ? "GELB" : "ROT").text}`}>
                            {ergebnisLabel[a.ergebnis as keyof typeof ergebnisLabel]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); removeAnalyse.mutate({ id: a.id }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail-Dialog */}
        <Dialog open={!!detailAnalyse} onOpenChange={(open) => !open && setDetailAnalyse(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {detailAnalyse && (
              <>
                <DialogHeader>
                  <DialogTitle>{detailAnalyse.name} ({detailAnalyse.ticker})</DialogTitle>
                  <DialogDescription>{new Date(detailAnalyse.createdAt).toLocaleString("de-DE")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <AmpelBadge signal={detailAnalyse.kriterium1Signal} detail={"1. Bewertung — " + (detailAnalyse.kriterium1Detail || "")} />
                  <AmpelBadge signal={detailAnalyse.kriterium2Signal} detail={"2. Wachstum — " + (detailAnalyse.kriterium2Detail || "")} />
                  <AmpelBadge signal={detailAnalyse.kriterium3Signal} detail={"3. Technik — " + (detailAnalyse.kriterium3Detail || "")} />
                  <AmpelBadge signal={detailAnalyse.kriterium4Signal} detail={"4. Depot-Fit — " + (detailAnalyse.kriterium4Detail || "")} />
                  <div className="pt-2 border-t border-border/40">
                    <div className="font-medium">These</div>
                    <p className="text-muted-foreground">{detailAnalyse.these}</p>
                  </div>
                  <div>
                    <div className="font-medium">Exit-These</div>
                    <p className="text-muted-foreground">{detailAnalyse.exitThese}</p>
                  </div>
                  {detailAnalyse.kurssprungAusgeloest && (
                    <div className="pt-2 border-t border-border/40">
                      <div className="font-medium">Kurssprung-Filter</div>
                      <p className="text-muted-foreground">{detailAnalyse.kurssprungKonsequenz}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-border/40 font-semibold">
                    Ergebnis: {ergebnisLabel[detailAnalyse.ergebnis as keyof typeof ergebnisLabel]}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
