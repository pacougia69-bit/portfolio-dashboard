/**
 * KI-Pick-Experiment — zwei KIs (OpenAI + Claude) picken unabhängig voneinander
 * je eine Mid-Cap-Aktie mit dem aus ihrer Sicht höchsten Renditepotenzial für
 * die nächsten 30 Tage, mit vollständigem Investment-Case (Prompt-Vorlage von
 * einem TikTok-Experiment, siehe PROJEKTE/Reiseagent... nein: siehe Chat vom
 * 22.08.2026 — Mid-Cap-Screening-Prompt).
 *
 * REIN VIRTUELL: 5.000 € pro Pick, kein echtes Geld, keine Kauf-/Verkaufsaktion.
 * Bewusst getrennt von Ampel/Einstiegsanalyse/echtem Depot (wie schon
 * Einstiegsanalyse vs. Ampel gehandhabt).
 *
 * Kein Cron — nur per Knopfdruck. OpenAI teilt sich das globale 20/Std-Kontingent
 * mit tech-warning.ts/morning-note.ts/einstiegsanalyse.ts, Claude hat ein eigenes
 * separates 20/Std-Kontingent (checkAnthropicRateLimit).
 */

import OpenAI from "openai";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { kiExperimentPicks } from "../drizzle/schema";
import { checkOpenAIRateLimit, checkAnthropicRateLimit } from "./_core/rate-limiter";
import { fetchLivePricesTwelveData } from "./services";
import { lookupByTicker } from "./services";

// ============================================================================
// TYPES
// ============================================================================

export type KiExperimentModel = "openai" | "claude";
export type KiExperimentStatus = "offen" | "geschlossen";

export type KiExperimentPickResult = {
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
  lastPriceCheckAt: Date | null;
  status: KiExperimentStatus;
  closedAt: Date | null;
  closePrice: number | null;
  closeReturnPercent: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type KiExperimentStats = {
  decidedRuns: number;
  openaiWins: number;
  claudeWins: number;
  ties: number;
  openaiAvgReturn: number | null;
  claudeAvgReturn: number | null;
};

export type KiExperimentRun = {
  runId: string;
  createdAt: Date;
  picks: KiExperimentPickResult[];
};

const OPENAI_MODEL = "gpt-4o";
const CLAUDE_MODEL = "claude-sonnet-5";
const VIRTUAL_AMOUNT = 5000;
const HOLD_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

// ============================================================================
// GEMEINSAMER PROMPT (Vorlage: TikTok-Mid-Cap-Screening-Prompt, 22.08.2026)
// ============================================================================

function buildSystemPrompt(): string {
  return "Agiere als erfahrener Investmentbanker und Aktienanalyst mit Fokus auf Mid-Cap-Werte. Du antwortest AUSSCHLIESSLICH mit einem einzigen validen JSON-Objekt — kein Text, keine Markdown-Überschriften, keine Einleitung, keine Erklärung davor oder danach. Der komplette Investment-Case gehört als Markdown-formatierter String in das Feld \"bodyMarkdown\" des JSON-Objekts, nirgendwo sonst.";
}

function buildUserPrompt(): string {
  return `Suche dir eigenständig eine Mid-Cap-Aktie aus (Marktkapitalisierung ca. 2-10 Mrd. USD/EUR), bei der du auf Basis aktueller Kennzahlen, Nachrichtenlage, Kursverlauf und Marktumfeld das höchste Renditepotenzial für die nächsten 30 Tage siehst. Nutze aktuelle, recherchierte Daten (keine erfundenen Schätzungen).

Antworte mit GENAU diesem JSON-Objekt, sonst nichts:
{
  "ticker": "Börsenticker, z.B. MGNI",
  "name": "Unternehmensname",
  "bodyMarkdown": "<hier der komplette Investment-Case als EIN Markdown-String mit ## Überschriften>"
}

Der "bodyMarkdown"-String muss folgenden Aufbau haben:
## Kurzfazit
Ticker, Unternehmen, aktueller Kurs, 30-Tage-Kursziel, erwartetes Renditepotenzial in %.
## Warum diese Aktie
Begründung der Auswahl (Katalysatoren, Quartalszahlen, Sektor-Momentum, technische Signale etc.).
## Fundamentale Kennzahlen
KGV, Umsatzwachstum, EBITDA-Marge, Verschuldungsgrad, Analystenkonsens (Kursziel & Rating).
## Technische Analyse
Kursverlauf der letzten 3-6 Monate, wichtige Unterstützungs-/Widerstandslinien, RSI/Momentum.
## Katalysatoren für die nächsten 30 Tage
Konkrete Termine/Ereignisse (Earnings, Produktlaunch, regulatorische Entscheidungen etc.).
## Pro und Kontra
Jeweils mind. 4 Punkte, klar und prägnant.
## Risikohinweise
Volatilität, Sektorrisiken, makroökonomische Einflüsse.
## Disclaimer
Dass dies KEINE Anlageberatung ist, sondern eine hypothetische/illustrative Analyse.

Halte dich strikt an das JSON-Format oben. Keine Code-Fence, kein zusätzlicher Text, keine Kommentare außerhalb des JSON-Objekts.`;
}

/**
 * Bevorzugt: sauberes JSON-Objekt (mit oder ohne \`\`\`json-Fence). Fallback,
 * falls die KI trotz Anweisung als reinen Markdown-Text antwortet (in der Praxis
 * beobachtet — beide Modelle rutschen bei einer so langen Antwort gelegentlich
 * zurück in Prosa): Ticker per Regex aus dem Text ziehen, den kompletten Text
 * als bodyMarkdown übernehmen. Besser ein nicht perfekt strukturierter Pick als
 * "Kein Pick zustande gekommen".
 */
function extractJsonBlock(raw: string): { ticker: string; name: string; bodyMarkdown: string } {
  const trimmed = raw.trim();

  // 1) ```json-Fence
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  // 2) Erstes { bis letztes } (falls die Antwort ohne Fence direkt JSON ist)
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  const bareJson = !fenced && braceStart !== -1 && braceEnd > braceStart ? trimmed.slice(braceStart, braceEnd + 1) : null;

  for (const candidate of [fenced?.[1], bareJson]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed.ticker && typeof parsed.ticker === "string" && parsed.bodyMarkdown && typeof parsed.bodyMarkdown === "string") {
        return {
          ticker: String(parsed.ticker).trim().toUpperCase(),
          name: String(parsed.name || parsed.ticker),
          bodyMarkdown: String(parsed.bodyMarkdown),
        };
      }
    } catch {
      // naechster Kandidat / Fallback unten
    }
  }

  // 3) Fallback: reiner Markdown-Text ohne JSON — Ticker per Regex raten
  const tickerMatch = raw.match(/\*\*?Ticker\*?\*?[:\s]+\(?([A-Z]{1,6})\)?/) || raw.match(/\(([A-Z]{1,6})[:)]/);
  if (tickerMatch && raw.length > 100) {
    return {
      ticker: tickerMatch[1].toUpperCase(),
      name: tickerMatch[1].toUpperCase(),
      bodyMarkdown: raw,
    };
  }

  throw new Error(`Kein Ticker in der Antwort gefunden. Erste 300 Zeichen: ${raw.slice(0, 300)}`);
}

// ============================================================================
// OPENAI-PICK (Responses API + web_search_preview — gleiches Muster wie
// tech-warning.ts / morning-note.ts / einstiegsanalyse.ts)
// ============================================================================

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

async function generateOpenAIPick(): Promise<{ ticker: string; name: string; bodyMarkdown: string }> {
  if (!openai) {
    throw new Error("OpenAI-Client nicht initialisiert — OPENAI_API_KEY fehlt.");
  }
  checkOpenAIRateLimit();

  const fullPrompt = `${buildSystemPrompt()}\n\n${buildUserPrompt()}`;
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: fullPrompt,
    tools: [{ type: "web_search_preview" }],
  });

  return extractJsonBlock(response.output_text || "");
}

// ============================================================================
// CLAUDE-PICK (Messages API + server-seitiges web_search-Tool, per fetch —
// kein SDK-Zusatzpaket nötig, gleicher Stil wie der rohe FRED-/Twelve-Data-fetch
// in tech-warning.ts)
// ============================================================================

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

async function generateClaudePick(): Promise<{ ticker: string; name: string; bodyMarkdown: string }> {
  if (!anthropicApiKey) {
    throw new Error("Claude-Client nicht initialisiert — ANTHROPIC_API_KEY fehlt (in Railway ergänzen).");
  }
  checkAnthropicRateLimit();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt() }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const blocks: any[] = Array.isArray(data.content) ? data.content : [];
  // Nur echte Text-Bloecke aneinanderhaengen (web_search_tool_result/server_tool_use
  // ueberspringen). Bei aktivem web_search-Tool zerlegt Claude die Antwort in
  // mehrere zusammenhaengende Text-Chunks (je eigene citations[]-Zuordnung) —
  // OHNE Trenner aneinanderhaengen, sonst reisst ein eingefuegtes "\n" mitten in
  // den JSON-String und JSON.parse schlaegt fehl (live beobachtet: Fallback griff
  // statt sauberem JSON, Ticker wurde per Regex geraten statt korrekt geparst).
  const raw = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!raw) {
    throw new Error("Claude-Antwort enthielt keinen Text-Block.");
  }

  return extractJsonBlock(raw);
}

// ============================================================================
// PREIS-ABRUF (Einstieg + Refresh) — bestehende Twelve-Data-Funktion,
// Yahoo-Fallback (lookupByTicker) falls Twelve Data den Ticker nicht kennt.
// ============================================================================

async function fetchPriceForTicker(
  ticker: string,
): Promise<{ price: number; currency: string } | null> {
  const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
  if (twelveDataKey) {
    try {
      const { results } = await fetchLivePricesTwelveData([ticker], twelveDataKey);
      const hit = results.find((r) => r.ticker === ticker);
      if (hit) return { price: hit.price, currency: hit.currency };
    } catch (err: any) {
      console.warn(`[ki-experiment] Twelve Data fehlgeschlagen fuer ${ticker}:`, err?.message || err);
    }
  }
  // Fallback: Yahoo (liefert bereits EUR-umgerechneten Preis — fuer den
  // Fallback-Fall in Ordnung, da Ein- und Ausstieg dann konsistent beide
  // ueber denselben Pfad laufen).
  try {
    const result = await lookupByTicker(ticker);
    if (result.success && result.data) {
      return { price: result.data.currentPrice, currency: result.data.currency };
    }
  } catch (err: any) {
    console.warn(`[ki-experiment] Yahoo-Fallback fehlgeschlagen fuer ${ticker}:`, err?.message || err);
  }
  return null;
}

// ============================================================================
// HAUPTFUNKTION & PERSISTENZ
// ============================================================================

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function generateOnePick(
  userId: number,
  runId: string,
  model: KiExperimentModel,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const pick = model === "openai" ? await generateOpenAIPick() : await generateClaudePick();
    const price = await fetchPriceForTicker(pick.ticker);

    await db.insert(kiExperimentPicks).values({
      userId,
      runId,
      model,
      ticker: pick.ticker,
      name: pick.name,
      bodyMarkdown: pick.bodyMarkdown,
      virtualAmount: String(VIRTUAL_AMOUNT),
      entryPrice: price ? String(price.price) : null,
      entryCurrency: price ? price.currency : null,
      entryDate: todayIso(),
      currentPrice: price ? String(price.price) : null,
      lastPriceCheckAt: price ? new Date() : null,
      errorMessage: price ? null : "Pick erstellt, aber kein Einstiegskurs abrufbar — Ticker prüfen.",
    });
  } catch (err: any) {
    console.error(`[ki-experiment] ${model}-Pick fehlgeschlagen:`, err?.message || err);
    await db.insert(kiExperimentPicks).values({
      userId,
      runId,
      model,
      virtualAmount: String(VIRTUAL_AMOUNT),
      errorMessage: String(err?.message || err),
    });
  }
}

/**
 * Schliesst alle offenen Picks eines Users, deren 30-Tage-Haltedauer abgelaufen
 * ist: holt einen letzten aktuellen Kurs, friert das Endergebnis ein
 * (closePrice/closeReturnPercent), setzt status="geschlossen". Kein Cron —
 * laeuft lazy bei jedem "Neues Experiment starten" und "Kurse aktualisieren".
 * Fehlt Ticker/Kurs, wird trotzdem geschlossen (sonst bliebe der Pick fuer
 * immer "offen" haengen), nur ohne Endergebnis.
 */
async function closeDuePicks(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const openPicks = await db
    .select()
    .from(kiExperimentPicks)
    .where(and(eq(kiExperimentPicks.userId, userId), eq(kiExperimentPicks.status, "offen")));

  const now = Date.now();
  for (const row of openPicks) {
    if (!row.entryDate) continue;
    const entryTime = new Date(row.entryDate).getTime();
    if (Number.isNaN(entryTime) || now - entryTime < HOLD_PERIOD_MS) continue;

    let closePrice: number | null = null;
    let closeReturnPercent: number | null = null;
    if (row.ticker && row.entryPrice) {
      const price = await fetchPriceForTicker(row.ticker);
      if (price) {
        closePrice = price.price;
        closeReturnPercent = ((price.price - Number(row.entryPrice)) / Number(row.entryPrice)) * 100;
      }
    }

    await db
      .update(kiExperimentPicks)
      .set({
        status: "geschlossen",
        closedAt: new Date(),
        closePrice: closePrice !== null ? String(closePrice) : null,
        closeReturnPercent: closeReturnPercent !== null ? String(closeReturnPercent) : null,
      })
      .where(eq(kiExperimentPicks.id, row.id));
  }
}

/**
 * Startet einen neuen Durchlauf: OpenAI und Claude picken unabhängig, beide
 * Ergebnisse (oder Fehler) landen unter derselben runId. Läuft parallel,
 * ein fehlschlagender Anbieter blockiert den anderen nicht. Faellige alte
 * Picks werden vorher automatisch geschlossen.
 */
export async function generateKiExperimentRun(userId: number): Promise<KiExperimentRun> {
  await closeDuePicks(userId);
  const runId = randomUUID();
  await Promise.all([
    generateOnePick(userId, runId, "openai"),
    generateOnePick(userId, runId, "claude"),
  ]);
  return getRunById(userId, runId);
}

/**
 * Aktualisiert die aktuellen Kurse aller NOCH OFFENEN Picks einer runId
 * (virtuelle Wertentwicklung neu berechenbar). Faellige Picks (>=30 Tage)
 * werden dabei automatisch geschlossen statt nur aktualisiert.
 */
export async function refreshKiExperimentPrices(userId: number, runId: string): Promise<KiExperimentRun> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await closeDuePicks(userId);

  const run = await getRunById(userId, runId);
  for (const pick of run.picks) {
    if (!pick.ticker || pick.status === "geschlossen") continue;
    const price = await fetchPriceForTicker(pick.ticker);
    if (!price) continue;
    await db
      .update(kiExperimentPicks)
      .set({ currentPrice: String(price.price), lastPriceCheckAt: new Date() })
      .where(eq(kiExperimentPicks.id, pick.id));
  }
  return getRunById(userId, runId);
}

function rowToResult(row: typeof kiExperimentPicks.$inferSelect): KiExperimentPickResult {
  return {
    id: row.id,
    runId: row.runId,
    model: row.model as KiExperimentModel,
    ticker: row.ticker,
    name: row.name,
    bodyMarkdown: row.bodyMarkdown,
    virtualAmount: Number(row.virtualAmount),
    entryPrice: row.entryPrice !== null ? Number(row.entryPrice) : null,
    entryCurrency: row.entryCurrency,
    entryDate: row.entryDate,
    currentPrice: row.currentPrice !== null ? Number(row.currentPrice) : null,
    lastPriceCheckAt: row.lastPriceCheckAt,
    status: row.status as KiExperimentStatus,
    closedAt: row.closedAt,
    closePrice: row.closePrice !== null ? Number(row.closePrice) : null,
    closeReturnPercent: row.closeReturnPercent !== null ? Number(row.closeReturnPercent) : null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

async function getRunById(userId: number, runId: string): Promise<KiExperimentRun> {
  const db = await getDb();
  if (!db) return { runId, createdAt: new Date(), picks: [] };
  const rows = await db
    .select()
    .from(kiExperimentPicks)
    .where(eq(kiExperimentPicks.runId, runId));
  const picks = rows.filter((r) => r.userId === userId).map(rowToResult);
  return {
    runId,
    createdAt: picks[0]?.createdAt || new Date(),
    picks,
  };
}

/**
 * Liest den zuletzt gestarteten Durchlauf (neueste runId) für diesen User.
 * Null, wenn noch keiner existiert.
 */
export async function getLatestKiExperimentRun(userId: number): Promise<KiExperimentRun | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(kiExperimentPicks)
    .where(eq(kiExperimentPicks.userId, userId))
    .orderBy(desc(kiExperimentPicks.createdAt))
    .limit(1);
  if (rows.length === 0) return null;
  return getRunById(userId, rows[0].runId);
}

/**
 * Liest die letzten N Durchläufe (Default 10), neuester zuerst, gruppiert nach runId.
 */
export async function getKiExperimentHistory(userId: number, limit: number = 10): Promise<KiExperimentRun[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(kiExperimentPicks)
    .where(eq(kiExperimentPicks.userId, userId))
    .orderBy(desc(kiExperimentPicks.createdAt));

  const byRun = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byRun.get(row.runId) || [];
    list.push(row);
    byRun.set(row.runId, list);
  }

  const runs: KiExperimentRun[] = Array.from(byRun.entries())
    .map(([runId, runRows]) => ({
      runId,
      createdAt: runRows[0].createdAt,
      picks: runRows.map(rowToResult),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  return runs;
}

/**
 * Bilanz ueber alle ABGESCHLOSSENEN Duelle (beide Picks eines Runs geschlossen
 * mit gueltigem Endergebnis) — wer hat wie oft gewonnen, Durchschnittsrendite
 * je Anbieter. Runs mit fehlendem/unentschiedenem Ergebnis zaehlen nicht mit.
 */
export async function getKiExperimentStats(userId: number): Promise<KiExperimentStats> {
  const empty: KiExperimentStats = {
    decidedRuns: 0,
    openaiWins: 0,
    claudeWins: 0,
    ties: 0,
    openaiAvgReturn: null,
    claudeAvgReturn: null,
  };

  const db = await getDb();
  if (!db) return empty;

  const rows = await db
    .select()
    .from(kiExperimentPicks)
    .where(and(eq(kiExperimentPicks.userId, userId), eq(kiExperimentPicks.status, "geschlossen")));

  const byRun = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.closeReturnPercent === null) continue;
    const list = byRun.get(row.runId) || [];
    list.push(row);
    byRun.set(row.runId, list);
  }

  let openaiWins = 0;
  let claudeWins = 0;
  let ties = 0;
  const openaiReturns: number[] = [];
  const claudeReturns: number[] = [];

  for (const runRows of Array.from(byRun.values())) {
    const openaiPick = runRows.find((r) => r.model === "openai");
    const claudePick = runRows.find((r) => r.model === "claude");
    if (!openaiPick || !claudePick || openaiPick.closeReturnPercent === null || claudePick.closeReturnPercent === null) continue;

    const openaiReturn = Number(openaiPick.closeReturnPercent);
    const claudeReturn = Number(claudePick.closeReturnPercent);
    openaiReturns.push(openaiReturn);
    claudeReturns.push(claudeReturn);

    if (openaiReturn > claudeReturn) openaiWins++;
    else if (claudeReturn > openaiReturn) claudeWins++;
    else ties++;
  }

  const avg = (values: number[]) => (values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

  return {
    decidedRuns: openaiReturns.length,
    openaiWins,
    claudeWins,
    ties,
    openaiAvgReturn: avg(openaiReturns),
    claudeAvgReturn: avg(claudeReturns),
  };
}
