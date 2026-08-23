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
import { fetchLivePricesTwelveData, TWELVE_DATA_MAX_TICKERS_PER_CALL } from "./services";
import { getLatestTechWarningSnapshot } from "./tech-warning";

// ============================================================================
// TYPES
// ============================================================================

export type SelectedPosition = { ticker: string; name: string; type: string };

export type MorningNotePosition = {
  ticker: string;
  name: string;
  hasNews: boolean;
  // Optionaler Preiskontext (Twelve Data), nur gesetzt wenn ein Kurs abrufbar war.
  price?: number;
  changePercent?: number;
  currency?: string;
};

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
  return `Du bist ein persönlicher Recherche-Assistent für einen Privatanleger (keine institutionelle Analyse, keine Handelsempfehlungen, kein Finanz-Fachwissen vorausgesetzt). Du fasst zusammen, was über Nacht und heute früh an Nachrichten zu seinen tatsächlichen Positionen passiert ist — sachlich, kompakt, ohne Kauf-/Verkaufs- oder Long/Short-Aussagen. Neue Kauf/Verkauf-Einstufungen erfindest du nicht, die gibt es an anderer Stelle im Dashboard bereits (Portfolio-Status, Aktien-Ampel, Einstiegsanalyse). Falls dir ein bestehendes Tech-Frühwarnsystem-Signal als Kontext mitgegeben wird, darfst und sollst du DIESES bestehende Signal in einfache, verständliche Alltagssprache übersetzen — das ist keine neue Einschätzung, sondern nur eine Erklärung dessen, was schon feststeht. Schreibe generell so, dass auch jemand ohne Börsen-Vorwissen alles versteht: Fachbegriffe (z.B. "SMA200", "Circular Financing") kurz miterklären statt vorauszusetzen.

WICHTIG — Einordnung ist PFLICHT, nicht optional: Eine reine Nachrichtenmeldung ohne Einordnung ist NUTZLOS für den Leser, das ist explizites Feedback. "Kein Kauf-/Verkaufs-Aussage" bedeutet NICHT "keine Einordnung" — es bedeutet nur, dass du nicht wörtlich "kaufen"/"verkaufen"/"halten" sagst oder eine konkrete Handlung empfiehlst. Erlaubt und ausdrücklich erwünscht ist die Erklärung, was eine Meldung allgemein bedeutet und wie Marktteilnehmer sie typischerweise lesen.
Beispiel NICHT ausreichend (reine Meldung ohne Einordnung): "Morgan Stanley hat ihren Anteil an Bilfinger auf 6,31% erhöht."
Beispiel GUT (Meldung + Einordnung, trotzdem keine Handlungsempfehlung): "Morgan Stanley hat ihren Anteil an Bilfinger auf 6,31% erhöht. Institutionelle Investoren, die ihre Beteiligung aufstocken, gilt am Markt oft als Vertrauenssignal in die mittelfristige Entwicklung des Unternehmens — kein Kaufsignal an sich, aber ein Datenpunkt, der für Positionshalter relevant ist." Halte dich bei jedem Abschnitt an dieses zweite Muster.`;
}

function buildMarketContext(
  snapshot: { overallSignal: string; summary: string | null; indicators: unknown } | null,
): string {
  if (!snapshot) return "";
  let indicatorLines = "";
  try {
    indicatorLines = Object.values(snapshot.indicators as Record<string, any>)
      .map((ind: any) => `- ${ind.label}: ${String(ind.signal).toUpperCase()} — ${ind.value}`)
      .join("\n");
  } catch {
    indicatorLines = "";
  }
  return `\n\nZusätzlicher Kontext — aktueller Stand des Tech-Frühwarnsystems (Gesamt-Ampel: ${snapshot.overallSignal.toUpperCase()}):
${indicatorLines || snapshot.summary || ""}

Schreibe daraus als ERSTEN Abschnitt "## Marktlage einfach erklärt" — 2-4 Sätze in einfacher Alltagssprache, was dieser Stand ganz konkret bedeutet, ohne unerklärte Fachbegriffe. Das ist eine Übersetzung des bestehenden Signals, keine neue Kauf/Verkauf-Einschätzung.`;
}

function buildUserPrompt(
  positions: Array<{ ticker: string; name: string; type: string }>,
  priceMap: Map<string, { price: number; changePercent: number; currency: string }>,
  marketContext: string,
): string {
  const list = positions
    .map((p) => {
      const px = priceMap.get(p.ticker);
      const priceInfo = px
        ? ` — aktueller Kurs: ${px.price.toFixed(2)} ${px.currency}, Tagesveränderung: ${px.changePercent >= 0 ? "+" : ""}${px.changePercent.toFixed(2)}%`
        : "";
      return `- ${p.name} (${p.ticker}, ${p.type})${priceInfo}`;
    })
    .join("\n");
  return `Der Anleger hält aktuell folgende Positionen:
${list}

Recherchiere aktuelle Nachrichten der letzten 12-16 Stunden (über Nacht / heute früh) zu JEDER dieser Positionen.

1. Für jede Position mit MATERIELL relevanten News: ein kurzer Abschnitt (2-4 Sätze) — was ist passiert UND was bedeutet das typischerweise (Einordnung ist Pflicht, siehe Systemprompt-Beispiel). Neutral formuliert, keine Kauf/Verkauf-Aussage, aber die reine Meldung ohne Einordnung reicht NICHT.
2. Positionen OHNE nennenswerte News: einfach weglassen, nichts erfinden. Falls eine Kursangabe vorhanden ist, darfst du sie zur Einordnung nutzen (z.B. "SAP -2%, kein erkennbarer Auslöser gefunden" ist eine erlaubte, hilfreiche Aussage) — aber erfinde KEINE Kursbewegung für eine Position ohne Kursangabe.
3. Eine "Top-Meldung" — die wichtigste Einzelmeldung über alle Positionen hinweg, als kurze Schlagzeile (max. 15 Wörter).
4. Optional ein kurzer Abschnitt "Heute im Blick" — Termine/Earnings/Events heute mit Relevanz fürs Portfolio, nur falls recherchierbar.${marketContext}`;
}

/**
 * Holt Kurs/Tagesveränderung für die ersten min(Ticker, 7) Positionen (Twelve-Data-
 * Limit pro Anfrage). Bewusst KEIN Mehrfach-Batching mit Wartezeit: Rafael wählt
 * selbst per Positions-Picker aus, welche Positionen einen Kurs bekommen sollen —
 * Kurse sind für ihn ohnehin nur grobe Orientierung, keine Pause nötig.
 * Nice-to-have: schlägt der Abruf fehl, läuft die Morning Note trotzdem weiter,
 * nur ohne Kurskontext.
 */
async function fetchPriceContext(
  tickers: string[],
): Promise<Map<string, { price: number; changePercent: number; currency: string }>> {
  const priceMap = new Map<string, { price: number; changePercent: number; currency: string }>();
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey || tickers.length === 0) return priceMap;

  const batch = Array.from(new Set(tickers)).slice(0, TWELVE_DATA_MAX_TICKERS_PER_CALL);
  try {
    const { results } = await fetchLivePricesTwelveData(batch, apiKey);
    for (const r of results) {
      priceMap.set(r.ticker, { price: r.price, changePercent: r.changePercent, currency: r.currency });
    }
  } catch (err: any) {
    console.warn("[morning-note] Preiskontext fehlgeschlagen:", err?.message || err);
  }
  return priceMap;
}

// Rafael-Fund 23.08.2026 (Live-Test): Modell schrieb bei mehreren aehnlichen
// Biotech-Positionen zweimal dieselbe Ueberschrift "Spero Therapeutics Inc.
// (SPRO)" - der zweite Abschnitt-Text war tatsaechlich ueber Oruka. Die
// Ueberschrift kam bisher aus dem freien bodyMarkdown-Text des Modells, war
// also nie gegen die echten Positionsdaten geprueft. Fix: das Modell liefert
// pro Position nur noch den reinen Fliesstext (bodyText), die Ueberschrift
// (Name + Ticker) baut der Server danach deterministisch aus der echten
// `positions`-Liste zusammen - das Modell kann eine Ueberschrift dadurch gar
// nicht mehr falsch zuordnen.
const JSON_FORMAT_INSTRUCTION = `WICHTIG: Antworte am Ende mit einem JSON-Block in genau diesem Format (zwischen \`\`\`json und \`\`\`):
\`\`\`json
{
  "headline": "Top-Meldung als kurze Schlagzeile",
  "marketContextMarkdown": "2-4 Sätze Marktlage-Erklärung (nur falls dir dafür Kontext mitgegeben wurde, sonst leerer String)",
  "heuteImBlickText": "Termine/Earnings/Events heute mit Portfolio-Relevanz, sonst leerer String",
  "positions": [
    {"ticker": "TICKER GENAU WIE IN DER POSITIONSLISTE OBEN", "hasNews": true, "bodyText": "2-4 Sätze: was ist passiert UND was es typischerweise bedeutet (Einordnung ist Pflicht, siehe Systemprompt-Beispiel)"}
  ]
}
\`\`\`
Für JEDE Position aus der Liste oben ein Objekt in "positions", auch wenn hasNews:false (dann bodyText weglassen oder leer lassen). Der Ticker muss exakt aus der Positionsliste übernommen werden — schreibe KEINEN eigenen Namen/Überschrift dazu, das übernimmt eine andere Stelle.`;

async function callOpenAIForMorningNote(
  positions: Array<{ ticker: string; name: string; type: string }>,
  priceMap: Map<string, { price: number; changePercent: number; currency: string }>,
  marketContext: string,
): Promise<{ headline: string; bodyMarkdown: string; positionsCovered: MorningNotePosition[] }> {
  if (!openai) {
    throw new Error("OpenAI-Client nicht initialisiert — OPENAI_API_KEY fehlt.");
  }

  checkOpenAIRateLimit();

  const fullPrompt = `${buildSystemPrompt()}\n\n${buildUserPrompt(positions, priceMap, marketContext)}\n\n${JSON_FORMAT_INSTRUCTION}`;

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
  const rawPositions: Array<{ ticker?: string; hasNews?: boolean; bodyText?: string }> =
    Array.isArray(parsed.positions) ? parsed.positions : [];

  // Ueberschriften + Reihenfolge kommen NUR aus der echten `positions`-Liste,
  // nie aus dem Modell-Output - das ist der eigentliche Fix.
  const byTicker = new Map(rawPositions.map((p) => [p.ticker, p]));
  const sections: string[] = [];
  const positionsCovered: MorningNotePosition[] = [];
  for (const p of positions) {
    const match = byTicker.get(p.ticker);
    const hasNews = !!match?.hasNews && !!match?.bodyText?.trim();
    positionsCovered.push({ ticker: p.ticker, name: p.name, hasNews });
    if (hasNews) {
      sections.push(`### ${p.name} (${p.ticker})\n${match!.bodyText!.trim()}`);
    }
  }

  const bodyParts: string[] = [];
  if (typeof parsed.marketContextMarkdown === "string" && parsed.marketContextMarkdown.trim()) {
    bodyParts.push(`## Marktlage einfach erklärt\n${parsed.marketContextMarkdown.trim()}`);
  }
  bodyParts.push(`## Top-Meldung\n${String(parsed.headline)}`);
  bodyParts.push(`## Positionen\n${sections.length > 0 ? sections.join("\n\n") : "Keine materiell relevanten News zu den ausgewählten Positionen gefunden."}`);
  bodyParts.push(`## Heute im Blick\n${typeof parsed.heuteImBlickText === "string" && parsed.heuteImBlickText.trim() ? parsed.heuteImBlickText.trim() : "Keine spezifischen Termine oder Ereignisse für heute bekannt."}`);

  return {
    headline: String(parsed.headline),
    bodyMarkdown: bodyParts.join("\n\n"),
    positionsCovered,
  };
}

// ============================================================================
// HAUPTFUNKTION & PERSISTENZ
// ============================================================================

/**
 * Holt eine neue Morning Note für die übergebene Auswahl an Positionen (oder,
 * falls keine Auswahl übergeben wurde, für das komplette Portfolio — Rückwärts-
 * kompatibilität). `undefined` = kein Picker-Aufruf, altes Verhalten. Ein leeres
 * Array `[]` bedeutet dagegen "bewusst nichts ausgewählt" und löst KEINEN
 * Fallback aufs Portfolio aus, sondern den Leer-Hinweis unten.
 */
export async function generateMorningNote(
  userId: number,
  selectedPositions?: SelectedPosition[],
): Promise<MorningNoteSnapshot> {
  let positions: SelectedPosition[];
  if (selectedPositions !== undefined) {
    positions = selectedPositions;
  } else {
    const portfolioPositions = await getPortfolioPositions(userId);
    positions = portfolioPositions.map((p) => ({ ticker: p.ticker, name: p.name, type: p.type }));
  }

  if (positions.length === 0) {
    return {
      id: -1,
      createdAt: new Date(),
      headline: selectedPositions !== undefined ? "Keine Positionen ausgewählt" : "Kein Portfolio hinterlegt",
      bodyMarkdown: selectedPositions !== undefined
        ? "Es wurden keine Positionen zur Recherche ausgewählt."
        : "Es sind noch keine Positionen im Portfolio hinterlegt, zu denen eine Morning Note erstellt werden könnte.",
      positionsCovered: [],
      errorMessage: null,
    };
  }

  const priceMap = await fetchPriceContext(positions.map((p) => p.ticker));

  // Best-effort: fehlt der Tech-Frühwarnsystem-Snapshot (noch keiner erstellt,
  // oder DB-Problem), läuft die Morning Note trotzdem ganz normal weiter —
  // nur ohne den "Marktlage einfach erklärt"-Abschnitt.
  let marketContext = "";
  try {
    const techSnapshot = await getLatestTechWarningSnapshot(userId);
    marketContext = buildMarketContext(techSnapshot);
  } catch (err: any) {
    console.warn("[morning-note] Tech-Frühwarnsystem-Kontext nicht verfügbar:", err?.message || err);
  }

  const { headline, bodyMarkdown, positionsCovered } = await callOpenAIForMorningNote(positions, priceMap, marketContext);

  // Kurse deterministisch nachtraeglich mergen — unabhaengig davon, was das Modell
  // in positionsCovered zurueckgab. Jede ausgewaehlte Position landet garantiert
  // im Ergebnis (mit hasNews:false ergaenzt, falls das Modell sie ausliess).
  const byTicker = new Map(positionsCovered.map((p) => [p.ticker, p]));
  for (const p of positions) {
    if (!byTicker.has(p.ticker)) {
      byTicker.set(p.ticker, { ticker: p.ticker, name: p.name, hasNews: false });
    }
  }
  const positionsCoveredWithPrices: MorningNotePosition[] = Array.from(byTicker.values()).map((p) => {
    const px = priceMap.get(p.ticker);
    return px ? { ...p, price: px.price, changePercent: px.changePercent, currency: px.currency } : p;
  });

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
      positionsCovered: positionsCoveredWithPrices as any, // json-Feld
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
    positionsCovered: positionsCoveredWithPrices,
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
