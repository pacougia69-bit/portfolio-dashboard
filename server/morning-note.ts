/**
 * Morning Note — On-Demand Zusammenfassung übernacht/heute relevanter News
 * zu den eigenen Portfolio-Positionen (OpenAI + web_search).
 *
 * Kein Cron, keine Automatik — nur per Knopfdruck. Kein Trade-/Kauf-Verkauf-
 * Advice: die Ampel-Einstufung existiert an anderer Stelle im Dashboard
 * bereits (Aktien-Ampel, Tech-Frühwarnsystem, Einstiegsanalyse). Hier geht
 * es nur um eine sachliche News-Zusammenfassung.
 *
 * Teilt sich den globalen OpenAI-Rate-Limiter (20/Stunde) mit tech-warning.ts
 * und einstiegsanalyse.ts — unkritisch bei Single-User.
 */

import OpenAI from "openai";
import { desc, eq } from "drizzle-orm";
import { getDb, getPortfolioPositions } from "./db";
import { morningNotes } from "../drizzle/schema";
import { checkOpenAIRateLimit } from "./_core/rate-limiter";

// ============================================================================
// TYPES
// ============================================================================

export type MorningNotePosition = { ticker: string; name: string; hasNews: boolean };

export type MorningNoteSnapshot = {
  id: number;
  createdAt: Date;
  headline: string;
  bodyMarkdown: string;
  positionsCovered: MorningNotePosition[];
  errorMessage: string | null;
};

// OpenAI-Modell für Web-Recherche
const OPENAI_MODEL = "gpt-4o";

// ============================================================================
// OPENAI CLIENT (separat vom globalen llm.ts — wir brauchen die Responses API)
// ============================================================================

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

function buildSystemPrompt(): string {
  return `Du bist ein persönlicher Recherche-Assistent für einen Privatanleger (keine institutionelle Analyse, keine Handelsempfehlungen). Du fasst zusammen, was über Nacht und heute früh an Nachrichten zu seinen tatsächlichen Positionen passiert ist — sachlich, kompakt, ohne Kauf-/Verkaufs- oder Long/Short-Aussagen. Eine Ampel-/Kauf-Verkauf-Einstufung gibt es an anderer Stelle im Dashboard bereits (Portfolio-Status, Tech-Frühwarnsystem, Einstiegsanalyse) — hier geht es nur um Fakten und neutrale Einordnung.`;
}

function buildUserPrompt(positions: Array<{ ticker: string; name: string; type: string }>): string {
  const list = positions.map((p) => `- ${p.name} (${p.ticker}, ${p.type})`).join("\n");
  return `Der Anleger hält aktuell folgende Positionen:
${list}

Recherchiere aktuelle Nachrichten der letzten 12-16 Stunden (über Nacht / heute früh) zu JEDER dieser Positionen.

1. Für jede Position mit MATERIELL relevanten News: ein kurzer Abschnitt (2-4 Sätze) — was ist passiert, warum könnte es für einen Halter dieser Position relevant sein. Neutral formuliert, keine Kauf/Verkauf-Aussage.
2. Positionen OHNE nennenswerte News: einfach weglassen, nichts erfinden.
3. Eine "Top-Meldung" — die wichtigste Einzelmeldung über alle Positionen hinweg, als kurze Schlagzeile (max. 15 Wörter).
4. Optional ein kurzer Abschnitt "Heute im Blick" — Termine/Earnings/Events heute mit Relevanz fürs Portfolio, nur falls recherchierbar.`;
}

const JSON_FORMAT_INSTRUCTION = `WICHTIG: Antworte am Ende mit einem JSON-Block in genau diesem Format (zwischen \`\`\`json und \`\`\`):
\`\`\`json
{
  "headline": "Top-Meldung als kurze Schlagzeile",
  "bodyMarkdown": "## Top-Meldung\\n...\\n\\n## Positionen\\n...\\n\\n## Heute im Blick\\n...",
  "positionsCovered": [{"ticker": "...", "name": "...", "hasNews": true}]
}
\`\`\``;

async function callOpenAIForMorningNote(
  positions: Array<{ ticker: string; name: string; type: string }>,
): Promise<{ headline: string; bodyMarkdown: string; positionsCovered: MorningNotePosition[] }> {
  if (!openai) {
    throw new Error("OpenAI-Client nicht initialisiert — OPENAI_API_KEY fehlt.");
  }

  checkOpenAIRateLimit();

  const fullPrompt = `${buildSystemPrompt()}\n\n${buildUserPrompt(positions)}\n\n${JSON_FORMAT_INSTRUCTION}`;

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: fullPrompt,
    tools: [{ type: "web_search_preview" }],
  });

  const raw = response.output_text || "";

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    throw new Error(`Keine JSON-Antwort gefunden. Erste 300 Zeichen: ${raw.slice(0, 300)}`);
  }

  const parsed = JSON.parse(jsonMatch[1]);
  if (!parsed.headline || typeof parsed.headline !== "string") {
    throw new Error("Ungültige Antwort: headline fehlt.");
  }
  if (!parsed.bodyMarkdown || typeof parsed.bodyMarkdown !== "string") {
    throw new Error("Ungültige Antwort: bodyMarkdown fehlt.");
  }

  return {
    headline: String(parsed.headline),
    bodyMarkdown: String(parsed.bodyMarkdown),
    positionsCovered: Array.isArray(parsed.positionsCovered) ? parsed.positionsCovered : [],
  };
}

// ============================================================================
// HAUPTFUNKTION & PERSISTENZ
// ============================================================================

/**
 * Holt eine neue Morning Note für die aktuellen Portfolio-Positionen des Users,
 * speichert sie und gibt sie zurück. Bei leerem Portfolio wird KEIN OpenAI-Call
 * ausgelöst (spart Rate-Limit-Budget).
 */
export async function generateMorningNote(userId: number): Promise<MorningNoteSnapshot> {
  const positions = await getPortfolioPositions(userId);

  if (positions.length === 0) {
    return {
      id: -1,
      createdAt: new Date(),
      headline: "Kein Portfolio hinterlegt",
      bodyMarkdown: "Es sind noch keine Positionen im Portfolio hinterlegt, zu denen eine Morning Note erstellt werden könnte.",
      positionsCovered: [],
      errorMessage: null,
    };
  }

  const { headline, bodyMarkdown, positionsCovered } = await callOpenAIForMorningNote(
    positions.map((p) => ({ ticker: p.ticker, name: p.name, type: p.type })),
  );

  const db = await getDb();
  if (!db) {
    console.error("[morning-note] FEHLER: Database not available beim Insert");
    throw new Error("Database not available");
  }

  console.log(`[morning-note] Speichere Notiz für userId=${userId}, headline="${headline}"`);

  let insertId = 0;
  const errorMessage: string | null = null;
  try {
    const result = await db.insert(morningNotes).values({
      userId,
      headline,
      bodyMarkdown,
      positionsCovered: positionsCovered as any, // json-Feld
      errorMessage,
    });
    insertId = Number(result[0].insertId);
    console.log(`[morning-note] INSERT erfolgreich, neue Notiz-ID: ${insertId}`);
  } catch (dbErr: any) {
    console.error(`[morning-note] DB-INSERT FEHLGESCHLAGEN:`, dbErr?.message || dbErr);
    console.error(`[morning-note] Stacktrace:`, dbErr?.stack);
    // Trotz DB-Fehler die Notiz zurückgeben, damit das Frontend
    // wenigstens das Ergebnis anzeigen kann.
    insertId = -1;
  }

  return {
    id: insertId,
    createdAt: new Date(),
    headline,
    bodyMarkdown,
    positionsCovered,
    errorMessage,
  };
}

/**
 * Liest die letzten N Notizen für diesen User, neueste zuerst.
 * Wird für die Verlaufs-Leiste auf der Frontend-Seite genutzt.
 */
export async function getMorningNoteHistory(
  userId: number,
  limit: number = 10,
): Promise<MorningNoteSnapshot[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[morning-note] getHistory: Database not available");
    return [];
  }
  try {
    const rows = await db
      .select()
      .from(morningNotes)
      .where(eq(morningNotes.userId, userId))
      .orderBy(desc(morningNotes.createdAt))
      .limit(limit);
    console.log(`[morning-note] getHistory: ${rows.length} Zeile(n) für userId=${userId} (Limit ${limit})`);
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      headline: row.headline,
      bodyMarkdown: row.bodyMarkdown,
      positionsCovered: row.positionsCovered as unknown as MorningNotePosition[],
      errorMessage: row.errorMessage,
    }));
  } catch (err: any) {
    console.error(`[morning-note] getHistory FEHLER:`, err?.message || err);
    console.error(`[morning-note] Stacktrace:`, err?.stack);
    return [];
  }
}

/**
 * Liest die zuletzt gespeicherte Notiz für diesen User. Null, wenn keine existiert.
 */
export async function getLatestMorningNote(userId: number): Promise<MorningNoteSnapshot | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[morning-note] getLatest: Database not available");
    return null;
  }
  try {
    const rows = await db
      .select()
      .from(morningNotes)
      .where(eq(morningNotes.userId, userId))
      .orderBy(desc(morningNotes.createdAt))
      .limit(1);
    console.log(`[morning-note] getLatest: ${rows.length} Zeile(n) für userId=${userId}`);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      createdAt: row.createdAt,
      headline: row.headline,
      bodyMarkdown: row.bodyMarkdown,
      positionsCovered: row.positionsCovered as unknown as MorningNotePosition[],
      errorMessage: row.errorMessage,
    };
  } catch (err: any) {
    console.error(`[morning-note] getLatest FEHLER:`, err?.message || err);
    console.error(`[morning-note] Stacktrace:`, err?.stack);
    return null;
  }
}
