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
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { kiExperimentPicks } from "../drizzle/schema";
import { checkOpenAIRateLimit, checkAnthropicRateLimit } from "./_core/rate-limiter";
import { fetchLivePricesTwelveData } from "./services";
import { lookupByTicker } from "./services";

// ============================================================================
// TYPES
// ============================================================================

export type KiExperimentModel = "openai" | "claude";

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
  errorMessage: string | null;
  createdAt: Date;
};

export type KiExperimentRun = {
  runId: string;
  createdAt: Date;
  picks: KiExperimentPickResult[];
};

const OPENAI_MODEL = "gpt-4o";
const CLAUDE_MODEL = "claude-sonnet-5";
const VIRTUAL_AMOUNT = 5000;

// ============================================================================
// GEMEINSAMER PROMPT (Vorlage: TikTok-Mid-Cap-Screening-Prompt, 22.08.2026)
// ============================================================================

function buildSystemPrompt(): string {
  return "Agiere als erfahrener Investmentbanker und Aktienanalyst mit Fokus auf Mid-Cap-Werte.";
}

function buildUserPrompt(): string {
  return `Suche dir eigenständig eine Mid-Cap-Aktie aus (Marktkapitalisierung ca. 2-10 Mrd. USD/EUR), bei der du auf Basis aktueller Kennzahlen, Nachrichtenlage, Kursverlauf und Marktumfeld das höchste Renditepotenzial für die nächsten 30 Tage siehst.

Erstelle dazu einen vollständigen Investment-Case mit folgendem Aufbau (als Markdown mit ## Überschriften):
1. Kurzfazit — Ticker, Unternehmen, aktueller Kurs, 30-Tage-Kursziel, erwartetes Renditepotenzial in %.
2. Warum diese Aktie — Begründung der Auswahl (Katalysatoren, Quartalszahlen, Sektor-Momentum, technische Signale etc.).
3. Fundamentale Kennzahlen — KGV, Umsatzwachstum, EBITDA-Marge, Verschuldungsgrad, Analystenkonsens (Kursziel & Rating).
4. Technische Analyse — Kursverlauf der letzten 3-6 Monate, wichtige Unterstützungs-/Widerstandslinien, RSI/Momentum.
5. Katalysatoren für die nächsten 30 Tage — konkrete Termine/Ereignisse (Earnings, Produktlaunch, regulatorische Entscheidungen etc.).
6. Pro- und Kontra-Liste — jeweils mind. 4 Punkte, klar und prägnant.
7. Risikohinweise — Volatilität, Sektorrisiken, makroökonomische Einflüsse.
8. Disclaimer — dass dies KEINE Anlageberatung ist, sondern eine hypothetische/illustrative Analyse.

Nutze aktuelle, recherchierte Daten (keine erfundenen Schätzungen).

WICHTIG: Beende deine Antwort mit einem JSON-Block in genau diesem Format (zwischen \`\`\`json und \`\`\`), als LETZTES Element deiner Antwort, ohne weiteren Text danach:
\`\`\`json
{
  "ticker": "Börsenticker, z.B. MGNI",
  "name": "Unternehmensname",
  "bodyMarkdown": "der komplette Investment-Case von oben, als ein Markdown-String"
}
\`\`\``;
}

function extractJsonBlock(raw: string): { ticker: string; name: string; bodyMarkdown: string } {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    throw new Error(`Keine JSON-Antwort gefunden. Erste 300 Zeichen: ${raw.slice(0, 300)}`);
  }
  const parsed = JSON.parse(jsonMatch[1]);
  if (!parsed.ticker || typeof parsed.ticker !== "string") {
    throw new Error("Ungültige Antwort: ticker fehlt.");
  }
  if (!parsed.bodyMarkdown || typeof parsed.bodyMarkdown !== "string") {
    throw new Error("Ungültige Antwort: bodyMarkdown fehlt.");
  }
  return {
    ticker: String(parsed.ticker).trim().toUpperCase(),
    name: String(parsed.name || parsed.ticker),
    bodyMarkdown: String(parsed.bodyMarkdown),
  };
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
      max_tokens: 4096,
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
  // ueberspringen) — die finale Modellantwort inkl. JSON-Block steckt in den
  // "text"-Bloecken, ggf. auf mehrere aufgeteilt durch Zitat-Referenzen dazwischen.
  const raw = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

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
 * Startet einen neuen Durchlauf: OpenAI und Claude picken unabhängig, beide
 * Ergebnisse (oder Fehler) landen unter derselben runId. Läuft parallel,
 * ein fehlschlagender Anbieter blockiert den anderen nicht.
 */
export async function generateKiExperimentRun(userId: number): Promise<KiExperimentRun> {
  const runId = randomUUID();
  await Promise.all([
    generateOnePick(userId, runId, "openai"),
    generateOnePick(userId, runId, "claude"),
  ]);
  return getRunById(userId, runId);
}

/**
 * Aktualisiert die aktuellen Kurse aller Picks einer runId (virtuelle
 * Wertentwicklung neu berechenbar). Picks ohne Ticker/Einstiegskurs werden
 * uebersprungen.
 */
export async function refreshKiExperimentPrices(userId: number, runId: string): Promise<KiExperimentRun> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const run = await getRunById(userId, runId);
  for (const pick of run.picks) {
    if (!pick.ticker) continue;
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
