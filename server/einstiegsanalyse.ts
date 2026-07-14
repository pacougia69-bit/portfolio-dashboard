/**
 * Einstiegsanalyse — Kurs/RSI/SMA-Datenanbindung + KI-Recherche für die These.
 *
 * Portiert aus PROJEKTE/Aktien-Einstiegsanalyse/einstiegsanalyse.html (Phase 1,
 * Standalone-HTML-Tool, stabil nach zwei Testrunden 13.-14.07.2026). Die Formeln
 * (Kriterium-3-Score, Kurssprung-Filter-Matrix) sind dort bewusst kalibriert und
 * werden hier 1:1 übernommen, nicht neu erfunden.
 */

import OpenAI from "openai";
import { checkOpenAIRateLimit } from "./_core/rate-limiter";
import { getEurUsdRate } from "./currency";

export type Signal = "GRUEN" | "GELB" | "ROT";

export interface TechnicalData {
  currentPrice: number; // in EUR umgerechnet (falls currency USD), sonst identisch mit currentPriceOriginal
  currentPriceOriginal: number; // Original-Wert in der Notierungswaehrung (Feld "currency")
  currency: string; // Original-Notierungswaehrung laut Twelve Data, z.B. "USD", "EUR", "GBP"
  convertedToEur: boolean; // true nur wenn currency==="USD" und tatsaechlich umgerechnet wurde
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  wochenperf: number | null; // % Kursänderung über die letzten 5 Handelstage
  kriterium3Signal: Signal;
  kriterium3Detail: string;
  kurssprungAusgeloest: boolean;
}

/**
 * Standard-RSI(14), einfacher Durchschnitt (kein Wilder-Smoothing) — reicht für
 * die Ampel-Einordnung hier, keine Handelssignal-Präzision nötig.
 * closesNewestFirst[0] = aktuellster Schlusskurs (Twelve-Data-Reihenfolge).
 */
function calculateRSI(closesNewestFirst: number[], period = 14): number | null {
  if (closesNewestFirst.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < period; i++) {
    const delta = closesNewestFirst[i] - closesNewestFirst[i + 1];
    if (delta > 0) gains += delta;
    else losses += -delta;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Kriterium-3-Formel 1:1 aus einstiegsanalyse.html (Zeile 791-799) portiert, damit
 * Standalone-Tool und Dashboard-Modul bei denselben Eingabedaten dasselbe Signal zeigen.
 */
function berechneKriterium3(kurs: number, sma50: number | null, sma200: number | null, rsi: number | null): { signal: Signal; detail: string } {
  if (sma50 === null || sma200 === null || rsi === null) {
    return { signal: "GELB", detail: "Nicht alle technischen Daten verfügbar (RSI/SMA50/SMA200)" };
  }
  let techScore = 0;
  techScore += kurs > sma50 ? 1 : -1;
  techScore += kurs > sma200 ? 1 : -1;
  techScore += rsi > 60 ? 1 : rsi < 40 ? -1 : 0;
  const signal: Signal = techScore <= -2 ? "ROT" : techScore >= 2 ? "GRUEN" : "GELB";
  const ueberSma = kurs > sma50 && kurs > sma200;
  const gesamtbild = signal === "GRUEN" ? "bullisch" : signal === "ROT" ? "bärisch" : "neutral/gemischt";
  const detail = `RSI ${rsi.toFixed(1)} · Kurs ${kurs.toFixed(2)} ${ueberSma ? "über" : "unter"} SMA50 (${sma50.toFixed(2)}) & SMA200 (${sma200.toFixed(2)}) — Gesamtbild: ${gesamtbild}`;
  return { signal, detail };
}

/**
 * Holt Kurs/SMA50/SMA200/RSI14/Wochenperformance in EINEM Twelve-Data-Aufruf
 * (time_series, 200 Tage) — gleiche Datenquelle wie die Aktien-Ampel (trafficLight.refresh
 * in routers.ts), damit keine zusätzlichen API-Credits für dieselbe Aktie verbraucht werden.
 */
export async function fetchTechnicalData(ticker: string): Promise<TechnicalData> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("Twelve Data API-Key nicht konfiguriert.");
  }

  const { convertTickerForTwelveData } = await import("./services");
  const converted = convertTickerForTwelveData(ticker);
  const symbol = converted.exchange ? `${converted.symbol}:${converted.exchange}` : converted.symbol;

  const tsRes = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=200&apikey=${apiKey}`
  );
  const tsData = await tsRes.json();

  if (tsData.code || tsData.status === "error" || !tsData.values?.length) {
    const msg = tsData.message || tsData.code || "Keine Daten";
    throw new Error(`Ticker "${symbol}": ${String(msg).slice(0, 200)}`);
  }

  const closes: number[] = tsData.values.map((v: any) => parseFloat(v.close));
  const currentPriceOriginal = closes[0];
  const sma50Original = closes.length >= 50 ? closes.slice(0, 50).reduce((a, b) => a + b, 0) / 50 : null;
  const sma200Original = closes.length >= 200 ? closes.slice(0, 200).reduce((a, b) => a + b, 0) / 200 : null;
  const rsi14 = calculateRSI(closes, 14);
  const wochenperf = closes.length > 5 ? ((closes[0] - closes[5]) / closes[5]) * 100 : null;
  const kurssprungAusgeloest = wochenperf !== null && Math.abs(wochenperf) >= 8;

  // Umrechnung nach EUR — nur USD wird automatisch umgerechnet (gleiches Prinzip wie
  // fetchLivePricesTwelveData in services.ts), andere Fremdwaehrungen bewusst nicht geraten.
  const currency: string = tsData.meta?.currency || "USD";
  let currentPrice = currentPriceOriginal;
  let sma50 = sma50Original;
  let sma200 = sma200Original;
  if (currency === "USD") {
    const eurUsdRate = await getEurUsdRate(apiKey);
    currentPrice = currentPriceOriginal / eurUsdRate;
    sma50 = sma50Original !== null ? sma50Original / eurUsdRate : null;
    sma200 = sma200Original !== null ? sma200Original / eurUsdRate : null;
  }

  const { signal, detail } = berechneKriterium3(currentPrice, sma50, sma200, rsi14);

  return {
    currentPrice,
    currentPriceOriginal,
    currency,
    convertedToEur: currency === "USD",
    sma50,
    sma200,
    rsi14,
    wochenperf,
    kriterium3Signal: signal,
    kriterium3Detail: detail,
    kurssprungAusgeloest,
  };
}

// === OpenAI-Recherche (Investment-/Exit-These) ===

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const OPENAI_MODEL = "gpt-4o";

export type Bewertung = "guenstig" | "neutral" | "teuer";
export type Wachstum = "beschleunigt" | "stabil" | "verlangsamt";

export interface ResearchResult {
  bewertung: Bewertung;
  bewertungBegruendung: string;
  wachstum: Wachstum;
  wachstumBegruendung: string;
  investmentThese: string;
  exitThese: string;
  raw: string;
}

/**
 * Recherchiert Kriterium 1 (Bewertung) + Kriterium 2 (Wachstum) + These/Exit-These für
 * eine Aktie via OpenAI Responses API + web_search_preview — gleiches Muster wie
 * searchWithOpenAI in tech-warning.ts, teilt sich denselben globalen Rate-Limiter
 * (20/Stunde), unkritisch bei Single-User. Beantwortet Rafaels Frage "woher soll ich
 * wissen, was ich bei Bewertung/Wachstum auswaehle" — die KI liefert einen Vorschlag
 * mit Begruendung, Rafael prueft/uebernimmt statt selbst von Null zu recherchieren.
 * Prompt-Text angelehnt an rechercheKopieren() aus einstiegsanalyse.html.
 */
export async function researchThese(ticker: string, name: string): Promise<ResearchResult> {
  if (!openai) {
    throw new Error("OpenAI-Client nicht initialisiert — OPENAI_API_KEY fehlt.");
  }
  checkOpenAIRateLimit();

  const prompt = `Du bist Recherche-Assistent für eine private Aktien-Einstiegsanalyse (keine Anlageberatung, private Nutzung).

Aktie: ${name} (${ticker})

Recherchiere aktuelle, belastbare Informationen (KGV/PEG vs. eigener Historie und Peers, Umsatz-/Gewinnentwicklung der letzten 4 Quartale, Guidance, Wachstumstreiber, Risiken, Wettbewerbsposition) und formuliere daraus:
1. BEWERTUNG: ist das KGV/PEG aktuell günstig, neutral oder teuer gegenüber eigener Historie und Peers?
2. WACHSTUM: hat sich das Umsatz-/Gewinnwachstum der letzten 4 Quartale beschleunigt, ist es stabil, oder hat es sich verlangsamt?
3. Eine INVESTMENT-THESE: ein Satz, warum diese Aktie jetzt interessant ist — was muss in 2 Jahren noch stimmen, damit sich der Kauf gelohnt hat.
4. Eine EXIT-THESE: ein Satz, unter welcher konkreten Bedingung die Position überdacht/verkauft werden sollte.

Antworte NUR mit genau diesen sechs Zeilen am Ende, sonst nichts:
BEWERTUNG: guenstig|neutral|teuer
BEWERTUNG-BEGRUENDUNG: <ein Satz>
WACHSTUM: beschleunigt|stabil|verlangsamt
WACHSTUM-BEGRUENDUNG: <ein Satz>
INVESTMENT-THESE: <ein Satz>
EXIT-THESE: <ein Satz>`;

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    tools: [{ type: "web_search_preview" }],
  });

  const raw = response.output_text || "";
  const bewertungMatch = raw.match(/BEWERTUNG:\s*(guenstig|neutral|teuer)/i);
  const bewertungBegrMatch = raw.match(/BEWERTUNG-BEGRUENDUNG:\s*(.+)/i);
  const wachstumMatch = raw.match(/WACHSTUM:\s*(beschleunigt|stabil|verlangsamt)/i);
  const wachstumBegrMatch = raw.match(/WACHSTUM-BEGRUENDUNG:\s*(.+)/i);
  const investmentMatch = raw.match(/INVESTMENT-THESE:\s*(.+)/i);
  const exitMatch = raw.match(/EXIT-THESE:\s*(.+)/i);

  if (!bewertungMatch || !wachstumMatch || !investmentMatch || !exitMatch) {
    throw new Error("Konnte keine vollständige Antwort (Bewertung/Wachstum/These/Exit-These) aus der Recherche extrahieren.");
  }

  return {
    bewertung: bewertungMatch[1].toLowerCase() as Bewertung,
    bewertungBegruendung: (bewertungBegrMatch?.[1] || "").trim(),
    wachstum: wachstumMatch[1].toLowerCase() as Wachstum,
    wachstumBegruendung: (wachstumBegrMatch?.[1] || "").trim(),
    investmentThese: investmentMatch[1].trim(),
    exitThese: exitMatch[1].trim(),
    raw,
  };
}
