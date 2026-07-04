/**
 * Tech-Frühwarnsystem — 5 Indikatoren-Snapshot
 *
 * Holt parallel:
 *   1. Capex/Umsatz-Schere bei MSFT/GOOGL/AMZN/NVDA (OpenAI + web_search)
 *   2. Circular Financing News-Scan (OpenAI + web_search)
 *   3. Effizienz-Sprünge / DeepSeek-Effekt (OpenAI + web_search)
 *   4. Fed Funds Rate + Core CPI YoY (FRED API)
 *   5. S&P 500 + Nasdaq vs. SMA200 (Twelve Data API)
 *
 * Gesamt-Ampel = Worst-Case. Bei Einzelfehlern läuft der Rest trotzdem durch.
 *
 * Schwellen (Default, abgestimmt mit Rafael 2026-05-28):
 *   - Indikator 4: Fed Funds > 5% ODER Core CPI YoY > 3.5% = gelb;
 *                  beide gleichzeitig = rot.
 *   - Indikator 5: GD200-Toleranz ±3%.
 *                  Beide Indizes > +3% über GD200 = grün.
 *                  Mindestens einer im Band ±3% = gelb.
 *                  Beide < -3% unter GD200 = rot.
 */

import OpenAI from "openai";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { techWarningSignals } from "../drizzle/schema";
import { checkOpenAIRateLimit } from "./_core/rate-limiter";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type Signal = "gruen" | "gelb" | "rot";

export type IndicatorResult = {
  label: string;
  signal: Signal;
  value: string;
  reasoning: string;
  sources: string[];
  error?: string;
};

export type TechWarningIndicators = {
  capex_revenue: IndicatorResult;
  circular_financing: IndicatorResult;
  efficiency_jump: IndicatorResult;
  rates_inflation: IndicatorResult;
  market_breadth: IndicatorResult;
};

export type TechWarningSnapshot = {
  id: number;
  createdAt: Date;
  overallSignal: Signal;
  indicators: TechWarningIndicators;
  summary: string | null;
  errorMessage: string | null;
};

// Schwellen — siehe Header-Kommentar
const RATES_FED_FUNDS_THRESHOLD = 5.0;       // %
const RATES_CORE_CPI_THRESHOLD = 3.5;        // % YoY
const BREADTH_TOLERANCE = 3.0;               // % über/unter SMA200

// Tickers für Indikator 5 (Twelve Data Symbol-Konvention)
// Wir nutzen ETFs statt Indizes, weil Indizes (SPX, IXIC) im Free Tier nicht verfügbar sind.
// SPY trackt S&P 500, QQQ trackt Nasdaq 100 — Korrelation jeweils ~99.9% mit dem Index.
const SP500_SYMBOL = "SPY";
const NASDAQ_SYMBOL = "QQQ";
const SP500_LABEL = "S&P 500 (SPY)";
const NASDAQ_LABEL = "Nasdaq 100 (QQQ)";

// FRED Series für Indikator 4
const FRED_FED_FUNDS_SERIES = "DFF";          // Effective Fed Funds Rate (daily)
const FRED_CORE_CPI_SERIES = "CPILFESL";      // Core CPI (monthly, SA)

// OpenAI-Modell für Web-Recherche
const OPENAI_MODEL = "gpt-4o";

// ============================================================================
// OPENAI CLIENT (separat vom globalen llm.ts — wir brauchen die Responses API)
// ============================================================================

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

/**
 * Wrapper: Ruft die Responses API mit web_search_preview-Tool auf.
 * Erwartet einen Prompt, der das Modell auffordert, am Ende einen JSON-Block
 * zwischen ```json ... ``` zurückzugeben. Parst diesen Block.
 */
async function searchWithOpenAI(systemPrompt: string, userPrompt: string): Promise<{
  parsed: { signal: Signal; value: string; reasoning: string; sources: string[] };
  raw: string;
}> {
  if (!openai) {
    throw new Error("OpenAI-Client nicht initialisiert — OPENAI_API_KEY fehlt.");
  }

  checkOpenAIRateLimit();

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nWICHTIG: Antworte am Ende mit einem JSON-Block in genau diesem Format (zwischen \`\`\`json und \`\`\`):
\`\`\`json
{
  "signal": "gruen" | "gelb" | "rot",
  "value": "Kurze Faktenzeile (max. 1 Satz)",
  "reasoning": "1-3 Sätze Begründung",
  "sources": ["url1", "url2"]
}
\`\`\``;

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: fullPrompt,
    tools: [{ type: "web_search_preview" }],
  });

  const raw = response.output_text || "";

  // JSON-Block aus der Antwort extrahieren
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    throw new Error(`Keine JSON-Antwort gefunden. Erste 300 Zeichen: ${raw.slice(0, 300)}`);
  }

  const parsed = JSON.parse(jsonMatch[1]);
  if (!parsed.signal || !["gruen", "gelb", "rot"].includes(parsed.signal)) {
    throw new Error(`Ungültiges Signal: ${parsed.signal}`);
  }

  return {
    parsed: {
      signal: parsed.signal,
      value: String(parsed.value || "—"),
      reasoning: String(parsed.reasoning || ""),
      sources: Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
    },
    raw,
  };
}

// ============================================================================
// INDIKATOR 1 — Capex/Umsatz-Schere (Hyperscaler)
// ============================================================================

async function fetchCapexRevenue(): Promise<IndicatorResult> {
  try {
    const system = "Du bist ein Finanz-Analyst, der Tech-Investitionsblasen früh erkennt.";
    const user = `Recherchiere die JÜNGSTEN verfügbaren Quartalszahlen (Q1 oder Q2 2026, sonst letzte 2025er) für MICROSOFT (MSFT), ALPHABET (GOOGL), AMAZON (AMZN) und NVIDIA (NVDA).

Vergleiche pro Firma das YoY-Wachstum von CAPEX vs. UMSATZ. Bilde die Median-Differenz über alle 4.

Bewerte die Ampel so:
- GRÜN: Capex-Wachstum übersteigt Umsatz-Wachstum um WENIGER als 10 Prozentpunkte
- GELB: Capex-Wachstum übersteigt Umsatz um 10-25 Prozentpunkte
- ROT: Capex-Wachstum übersteigt Umsatz um MEHR als 25 Prozentpunkte (gefährliche Schere)

Liefere konkrete Zahlen pro Firma in "value", deine Schere-Einschätzung in "reasoning".`;

    const { parsed } = await searchWithOpenAI(system, user);
    return {
      label: "Capex/Umsatz-Schere (Hyperscaler)",
      ...parsed,
    };
  } catch (err: any) {
    return {
      label: "Capex/Umsatz-Schere (Hyperscaler)",
      signal: "gelb",
      value: "Daten nicht abrufbar",
      reasoning: "Fehler beim Abruf — Schwellen können nicht geprüft werden.",
      sources: [],
      error: String(err?.message || err),
    };
  }
}

// ============================================================================
// INDIKATOR 2 — Circular Financing
// ============================================================================

async function fetchCircularFinancing(): Promise<IndicatorResult> {
  try {
    const system = "Du bist ein Finanz-Analyst, der Kreislauf-Finanzierungs-Muster in der AI-Branche erkennt.";
    const user = `Suche FINANZNEWS DER LETZTEN 14 TAGE zu folgenden Themen:
- "vendor financing" oder "circular financing" bei AI-Chip-Deals
- Nvidia/AMD finanzieren Kunden, die im Gegenzug ihre Chips kaufen
- CoreWeave, Lambda Labs, Anthropic, OpenAI: neue Debt/Equity-Deals mit gegenseitiger Abhängigkeit
- Anthropic-Amazon-Deal-Strukturen, Microsoft-OpenAI-Investments-Kreis

Bewerte:
- GRÜN: keine bedenklichen Muster, normale Marktaktivität
- GELB: einzelne grenzwertige Deals erkennbar, aber noch nicht systemisch
- ROT: deutliches Kreislauf-Muster, mehrere Akteure in Verflechtungen, Risiko sichtbar

In "value" 1-2 wichtigste konkrete Deals nennen, in "reasoning" Einschätzung.`;

    const { parsed } = await searchWithOpenAI(system, user);
    return {
      label: "Circular Financing",
      ...parsed,
    };
  } catch (err: any) {
    return {
      label: "Circular Financing",
      signal: "gelb",
      value: "Daten nicht abrufbar",
      reasoning: "Fehler beim Abruf.",
      sources: [],
      error: String(err?.message || err),
    };
  }
}

// ============================================================================
// INDIKATOR 3 — Effizienz-Sprünge / DeepSeek-Effekt
// ============================================================================

async function fetchEfficiencyJump(): Promise<IndicatorResult> {
  try {
    const system = "Du bist ein Tech-Analyst, der disruptive Effizienzsprünge bei AI-Modellen früh erkennt.";
    const user = `Suche NEWS DER LETZTEN 14 TAGE zu:
- Neue Open-Source-AI-Modelle, die kommerzielle Frontier-Modelle in Effizienz/Kosten massiv unterbieten (Stil DeepSeek-Schock)
- Drastische Inference-Cost-Senkungen (>50% innerhalb weniger Wochen)
- Hardware/Algorithmus-Durchbrüche, die GPU-Bedarf in Frage stellen
- Neue Chip-Architekturen (z.B. weiterer Cerebras-, Groq-Erfolg), die Nvidias Marge bedrohen

Bewerte:
- GRÜN: nichts Disruptives, status quo hält
- GELB: bemerkenswerte Effizienz-News, aber kein klarer Schock
- ROT: klar disruptives Event (Stil DeepSeek Jan 2025), Markt reagiert

In "value" das wichtigste Event 1 Satz, in "reasoning" Bewertung der Tragweite.`;

    const { parsed } = await searchWithOpenAI(system, user);
    return {
      label: "Effizienz-Sprünge (DeepSeek-Effekt)",
      ...parsed,
    };
  } catch (err: any) {
    return {
      label: "Effizienz-Sprünge (DeepSeek-Effekt)",
      signal: "gelb",
      value: "Daten nicht abrufbar",
      reasoning: "Fehler beim Abruf.",
      sources: [],
      error: String(err?.message || err),
    };
  }
}

// ============================================================================
// INDIKATOR 4 — Zinsen & Inflation (FRED)
// ============================================================================

async function fetchFredSeries(seriesId: string): Promise<Array<{ date: string; value: number }>> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error("FRED_API_KEY fehlt in den Umgebungsvariablen.");
  }
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=400`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`FRED HTTP ${resp.status} für ${seriesId}`);
  }
  const data: any = await resp.json();
  if (!data.observations || !Array.isArray(data.observations)) {
    throw new Error(`FRED: unerwartetes Antwortformat für ${seriesId}`);
  }
  return data.observations
    .map((o: any) => ({ date: o.date, value: Number(o.value) }))
    .filter((o: { date: string; value: number }) => Number.isFinite(o.value));
}

async function fetchRatesInflation(): Promise<IndicatorResult> {
  try {
    const [fedFundsObs, cpiObs] = await Promise.all([
      fetchFredSeries(FRED_FED_FUNDS_SERIES),
      fetchFredSeries(FRED_CORE_CPI_SERIES),
    ]);

    if (fedFundsObs.length === 0 || cpiObs.length === 0) {
      throw new Error("Keine FRED-Daten erhalten");
    }

    const latestFedFunds = fedFundsObs[0].value;
    const latestFedFundsDate = fedFundsObs[0].date;

    // Core CPI YoY: aktueller Wert vs. Wert von vor ~12 Monaten
    const latestCpi = cpiObs[0].value;
    const latestCpiDate = cpiObs[0].date;
    // Index 12 = 12 Monate zurück (CPI ist monatlich)
    const cpiYearAgo = cpiObs[12]?.value;
    if (!cpiYearAgo) {
      throw new Error("Nicht genug CPI-Historie für YoY-Berechnung");
    }
    const cpiYoY = ((latestCpi - cpiYearAgo) / cpiYearAgo) * 100;

    const fedOverThreshold = latestFedFunds > RATES_FED_FUNDS_THRESHOLD;
    const cpiOverThreshold = cpiYoY > RATES_CORE_CPI_THRESHOLD;

    let signal: Signal;
    let reasoning: string;

    if (fedOverThreshold && cpiOverThreshold) {
      signal = "rot";
      reasoning = `Beide Schwellen überschritten (Stagflation-Druck): Fed Funds ${latestFedFunds.toFixed(2)}% > ${RATES_FED_FUNDS_THRESHOLD}% UND Core CPI YoY ${cpiYoY.toFixed(2)}% > ${RATES_CORE_CPI_THRESHOLD}%.`;
    } else if (fedOverThreshold || cpiOverThreshold) {
      signal = "gelb";
      reasoning = `Eine Schwelle überschritten: Fed Funds ${latestFedFunds.toFixed(2)}% (Schwelle ${RATES_FED_FUNDS_THRESHOLD}%), Core CPI YoY ${cpiYoY.toFixed(2)}% (Schwelle ${RATES_CORE_CPI_THRESHOLD}%).`;
    } else {
      signal = "gruen";
      reasoning = `Beide Werte unter Schwelle: Fed Funds ${latestFedFunds.toFixed(2)}%, Core CPI YoY ${cpiYoY.toFixed(2)}%.`;
    }

    return {
      label: "Zinsen & Inflation (US)",
      signal,
      value: `Fed Funds ${latestFedFunds.toFixed(2)}% (${latestFedFundsDate}) · Core CPI YoY ${cpiYoY.toFixed(2)}% (${latestCpiDate})`,
      reasoning,
      sources: [
        `FRED:${FRED_FED_FUNDS_SERIES}`,
        `FRED:${FRED_CORE_CPI_SERIES}`,
      ],
    };
  } catch (err: any) {
    return {
      label: "Zinsen & Inflation (US)",
      signal: "gelb",
      value: "Daten nicht abrufbar",
      reasoning: "Fehler beim FRED-Abruf — Status unbekannt.",
      sources: [],
      error: String(err?.message || err),
    };
  }
}

// ============================================================================
// INDIKATOR 5 — Marktbreite (S&P + Nasdaq vs. SMA200)
// ============================================================================

async function fetchTwelveDataSMA(symbol: string): Promise<{ price: number; sma200: number; date: string }> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("TWELVE_DATA_API_KEY fehlt in den Umgebungsvariablen.");
  }
  // 210 Werte, damit wir sicher 200 für die SMA haben + aktuellen Kurs
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=210&apikey=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Twelve Data HTTP ${resp.status} für ${symbol}`);
  }
  const data: any = await resp.json();
  if (data.status === "error") {
    throw new Error(`Twelve Data: ${data.message || "Unbekannter Fehler"} für ${symbol}`);
  }
  if (!data.values || !Array.isArray(data.values) || data.values.length < 200) {
    throw new Error(`Twelve Data: zu wenig Daten (${data.values?.length || 0}) für ${symbol}`);
  }
  // Twelve Data liefert neueste zuerst
  const closes = data.values.map((v: any) => Number(v.close)).filter(Number.isFinite);
  const latestPrice = closes[0];
  const latestDate = String(data.values[0].datetime);
  const sma200 = closes.slice(0, 200).reduce((s: number, c: number) => s + c, 0) / 200;
  return { price: latestPrice, sma200, date: latestDate };
}

async function fetchMarketBreadth(): Promise<IndicatorResult> {
  try {
    const [sp500, nasdaq] = await Promise.all([
      fetchTwelveDataSMA(SP500_SYMBOL),
      fetchTwelveDataSMA(NASDAQ_SYMBOL),
    ]);

    const sp500Diff = ((sp500.price - sp500.sma200) / sp500.sma200) * 100;
    const nasdaqDiff = ((nasdaq.price - nasdaq.sma200) / nasdaq.sma200) * 100;

    const sp500Above = sp500Diff > BREADTH_TOLERANCE;
    const sp500Below = sp500Diff < -BREADTH_TOLERANCE;
    const nasdaqAbove = nasdaqDiff > BREADTH_TOLERANCE;
    const nasdaqBelow = nasdaqDiff < -BREADTH_TOLERANCE;

    let signal: Signal;
    let reasoning: string;

    if (sp500Above && nasdaqAbove) {
      signal = "gruen";
      reasoning = `Beide Indizes deutlich über GD200 — Aufwärtstrend intakt.`;
    } else if (sp500Below && nasdaqBelow) {
      signal = "rot";
      reasoning = `Beide Indizes deutlich unter GD200 — Bärensignal.`;
    } else {
      signal = "gelb";
      reasoning = `Mindestens ein Index im Toleranzband ±${BREADTH_TOLERANCE}% um GD200 — Trend unklar.`;
    }

    return {
      label: "Marktbreite (S&P 500 + Nasdaq vs. GD200)",
      signal,
      value: `${SP500_LABEL}: ${sp500Diff >= 0 ? "+" : ""}${sp500Diff.toFixed(2)}% zum GD200 · ${NASDAQ_LABEL}: ${nasdaqDiff >= 0 ? "+" : ""}${nasdaqDiff.toFixed(2)}% zum GD200`,
      reasoning,
      sources: [
        `TwelveData:${SP500_SYMBOL}`,
        `TwelveData:${NASDAQ_SYMBOL}`,
      ],
    };
  } catch (err: any) {
    return {
      label: "Marktbreite (S&P 500 + Nasdaq vs. GD200)",
      signal: "gelb",
      value: "Daten nicht abrufbar",
      reasoning: "Fehler beim Twelve-Data-Abruf.",
      sources: [],
      error: String(err?.message || err),
    };
  }
}

// ============================================================================
// AGGREGATION & PERSISTENZ
// ============================================================================

function combineToOverallSignal(indicators: TechWarningIndicators): Signal {
  const signals = Object.values(indicators).map((i) => i.signal);
  if (signals.includes("rot")) return "rot";
  if (signals.includes("gelb")) return "gelb";
  return "gruen";
}

function buildSummary(overall: Signal, indicators: TechWarningIndicators): string {
  const counts = {
    gruen: 0,
    gelb: 0,
    rot: 0,
  };
  for (const ind of Object.values(indicators)) {
    counts[ind.signal]++;
  }
  const overallLabel = overall === "gruen" ? "GRÜN" : overall === "gelb" ? "GELB" : "ROT";
  return `Gesamt-Ampel: ${overallLabel}. Verteilung: ${counts.gruen}× grün, ${counts.gelb}× gelb, ${counts.rot}× rot.`;
}

/**
 * Hauptfunktion: Holt parallel alle 5 Indikatoren, speichert Snapshot, gibt ihn zurück.
 */
export async function fetchTechWarningSnapshot(userId: number): Promise<TechWarningSnapshot> {
  const [capex, circular, efficiency, rates, breadth] = await Promise.all([
    fetchCapexRevenue(),
    fetchCircularFinancing(),
    fetchEfficiencyJump(),
    fetchRatesInflation(),
    fetchMarketBreadth(),
  ]);

  const indicators: TechWarningIndicators = {
    capex_revenue: capex,
    circular_financing: circular,
    efficiency_jump: efficiency,
    rates_inflation: rates,
    market_breadth: breadth,
  };

  const overallSignal = combineToOverallSignal(indicators);
  const summary = buildSummary(overallSignal, indicators);

  // Errors zusammensammeln (falls einzelne Indikatoren scheiterten)
  const errors = Object.values(indicators)
    .filter((i) => i.error)
    .map((i) => `${i.label}: ${i.error}`);
  const errorMessage = errors.length > 0 ? errors.join(" | ") : null;

  // In DB speichern
  const db = await getDb();
  if (!db) {
    console.error("[tech-warning] FEHLER: Database not available beim Insert");
    throw new Error("Database not available");
  }

  console.log(`[tech-warning] Speichere Snapshot für userId=${userId}, overallSignal=${overallSignal}, errorMessage=${errorMessage ? "ja" : "nein"}`);

  let insertId = 0;
  try {
    const result = await db.insert(techWarningSignals).values({
      userId,
      overallSignal,
      indicators: indicators as any, // json-Feld
      summary,
      errorMessage,
    });
    insertId = Number(result[0].insertId);
    console.log(`[tech-warning] INSERT erfolgreich, neue Snapshot-ID: ${insertId}`);
  } catch (dbErr: any) {
    console.error(`[tech-warning] DB-INSERT FEHLGESCHLAGEN:`, dbErr?.message || dbErr);
    console.error(`[tech-warning] Stacktrace:`, dbErr?.stack);
    // Trotz DB-Fehler den Snapshot zurückgeben, damit das Frontend
    // wenigstens das Ergebnis anzeigen kann.
    insertId = -1;
  }

  return {
    id: insertId,
    createdAt: new Date(),
    overallSignal,
    indicators,
    summary,
    errorMessage,
  };
}

/**
 * Liest die letzten N Snapshots für diesen User, neueste zuerst.
 * Wird für die Verlaufs-Leiste auf der Frontend-Seite genutzt.
 */
export async function getTechWarningHistory(
  userId: number,
  limit: number = 10,
): Promise<TechWarningSnapshot[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[tech-warning] getHistory: Database not available");
    return [];
  }
  try {
    const rows = await db
      .select()
      .from(techWarningSignals)
      .where(eq(techWarningSignals.userId, userId))
      .orderBy(desc(techWarningSignals.createdAt))
      .limit(limit);
    console.log(`[tech-warning] getHistory: ${rows.length} Zeile(n) für userId=${userId} (Limit ${limit})`);
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      overallSignal: row.overallSignal as Signal,
      indicators: row.indicators as unknown as TechWarningIndicators,
      summary: row.summary,
      errorMessage: row.errorMessage,
    }));
  } catch (err: any) {
    console.error(`[tech-warning] getHistory FEHLER:`, err?.message || err);
    console.error(`[tech-warning] Stacktrace:`, err?.stack);
    return [];
  }
}

/**
 * Liest den zuletzt gespeicherten Snapshot für diesen User. Null, wenn keiner existiert.
 */
export async function getLatestTechWarningSnapshot(userId: number): Promise<TechWarningSnapshot | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[tech-warning] getLatest: Database not available");
    return null;
  }
  try {
    const rows = await db
      .select()
      .from(techWarningSignals)
      .where(eq(techWarningSignals.userId, userId))
      .orderBy(desc(techWarningSignals.createdAt))
      .limit(1);
    console.log(`[tech-warning] getLatest: ${rows.length} Zeile(n) für userId=${userId}`);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      createdAt: row.createdAt,
      overallSignal: row.overallSignal as Signal,
      indicators: row.indicators as unknown as TechWarningIndicators,
      summary: row.summary,
      errorMessage: row.errorMessage,
    };
  } catch (err: any) {
    console.error(`[tech-warning] getLatest FEHLER:`, err?.message || err);
    console.error(`[tech-warning] Stacktrace:`, err?.stack);
    return null;
  }
}
