/**
 * Waechter: Trend-Pruefung auf Knopfdruck (nur lesen, bewegt kein Geld).
 * Der Client ruft startRun -> checkChunk (mehrfach, mit Pause) -> finishRun auf,
 * damit keine einzelne Server-Anfrage lange laeuft (Twelve-Data-Limit 8/Minute).
 *
 * Kursquellen:
 *  - ETFs/Werte mit US-Zwilling (isTrendProxyTicker): ZUERST Yahoo Finance mit dem echten Ticker
 *    (echter Kurs, kein Twelve-Data-Kontingent). Nur wenn Yahoo nichts hat, der US-Zwilling bei Twelve Data (Naeherung).
 *  - alle anderen: Twelve Data; kann es den Wert nicht liefern (Gratis-Plan, Tageslimit, unbekannt), Yahoo als Ausweichquelle.
 *  - Minuten-Limit von Twelve Data wird vom Browser nach einer Pause nachgeholt.
 */
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { portfolioPositions, waechterLaeufe, waechterErgebnisse, einstiegsanalysen } from "../drizzle/schema";
import { convertTickerForTwelveData, isTrendProxyTicker } from "./services";
import {
  WAECHTER_CHUNK_SIZE,
  classifyTwelveDataError,
  computeTrendSignal,
  decideCheckable,
  detectChange,
  getActionHint,
  parseYahooCloses,
  yahooTicker,
  type TrendResult,
  type TrendSignal,
  type WaechterResultRow,
} from "@shared/waechter";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  return db;
}

async function getOwnRun(db: Db, userId: number, runId: number) {
  const rows = await db
    .select()
    .from(waechterLaeufe)
    .where(and(eq(waechterLaeufe.id, runId), eq(waechterLaeufe.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Wächter-Lauf nicht gefunden");
  return rows[0];
}

type ErgebnisFelder = Pick<
  typeof waechterErgebnisse.$inferSelect,
  | "positionId" | "ticker" | "name" | "wkn" | "signal" | "signalDetail" | "price" | "sma50" | "sma200"
  | "prevSignal" | "isProxy" | "positionType" | "currency" | "promptCopiedAt" | "priceAsOf"
>;

/** Schluessel, unter dem Twelve Data den Kurs abruft (US-Zwilling bzw. Symbol:Boerse). */
function symbolKey(ticker: string): string {
  const c = convertTickerForTwelveData(ticker);
  return c.exchange ? `${c.symbol}:${c.exchange}` : c.symbol;
}

/**
 * Positionen mit gleichem Abruf bilden eine Gruppe (spart Aufrufe). Werte mit US-Zwilling
 * werden zuerst per ECHTEM Ticker bei Yahoo geholt - da duerfen zwei ETFs mit demselben
 * Zwilling (z. B. XAIX.DE und AIFS.DE -> AIQ) NICHT zusammenfallen.
 */
function groupKey(ticker: string): string {
  return isTrendProxyTicker(ticker) ? `Y:${ticker}` : symbolKey(ticker);
}

function toResultRow(r: ErgebnisFelder): WaechterResultRow {
  const signal = r.signal as TrendSignal;
  const prev = (r.prevSignal as TrendSignal | null) ?? null;
  const isProxy = Boolean(r.isProxy);
  return {
    positionId: r.positionId,
    ticker: r.ticker,
    name: r.name,
    wkn: r.wkn ?? null,
    signal,
    signalDetail: r.signalDetail ?? "",
    price: r.price !== null ? Number(r.price) : null,
    sma50: r.sma50 !== null ? Number(r.sma50) : null,
    sma200: r.sma200 !== null ? Number(r.sma200) : null,
    prevSignal: prev,
    change: detectChange(prev, signal),
    isProxy,
    actionHint: getActionHint(signal, r.wkn),
    positionType: r.positionType ?? null,
    currency: r.currency ?? null,
    proxySymbol: isProxy ? symbolKey(r.ticker) : null,
    entryThesis: null,
    promptCopiedAt: r.promptCopiedAt ? r.promptCopiedAt.toISOString() : null,
    priceAsOf: r.priceAsOf ? r.priceAsOf.toISOString() : null,
  };
}

/** Legt einen neuen Lauf an und sagt, welche Positionen geprueft werden. */
export async function startWaechterRun(userId: number) {
  const db = await requireDb();
  const positions = await db.select().from(portfolioPositions).where(eq(portfolioPositions.userId, userId));

  const toCheck: { id: number; ticker: string; name: string }[] = [];
  const groupMap = new Map<string, { key: string; ticker: string; positionIds: number[] }>();
  const skipped: { name: string; reason: string }[] = [];
  let mutedCount = 0;
  for (const p of positions) {
    const d = decideCheckable({ type: p.type, ticker: p.ticker, waechterMuted: p.waechterMuted });
    if (d.checkable) {
      toCheck.push({ id: p.id, ticker: p.ticker, name: p.name });
      const key = groupKey(p.ticker);
      const group = groupMap.get(key);
      if (group) group.positionIds.push(p.id);
      else groupMap.set(key, { key, ticker: p.ticker, positionIds: [p.id] });
    } else if (d.reason === "stumm") {
      mutedCount++;
    } else {
      skipped.push({
        name: p.name,
        reason: d.reason === "hebelprodukt" ? "Hebelprodukt (eigene K.O.-Logik)" : "Kein Ticker hinterlegt",
      });
    }
  }

  const result = await db.insert(waechterLaeufe).values({ userId });
  return {
    runId: Number(result[0].insertId),
    positions: toCheck,
    groups: Array.from(groupMap.values()),
    skipped,
    mutedCount,
  };
}

type FetchResult =
  | { closes: number[]; currency: string | null; asOf?: string }
  | { error: string; retryable: boolean };

async function fetchCloses(ticker: string, apiKey: string): Promise<FetchResult> {
  const symbol = symbolKey(ticker);
  const res = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=200&apikey=${apiKey}`,
  );
  const data: any = await res.json();
  if (data.code || data.status === "error" || !data.values?.length) {
    const e = classifyTwelveDataError(data.code, data.message, symbol);
    return { error: e.text, retryable: e.retryable };
  }
  const newest = typeof data.values[0]?.datetime === "string" ? data.values[0].datetime.slice(0, 10) : null;
  return {
    closes: data.values.map((v: any) => parseFloat(v.close)),
    currency: typeof data.meta?.currency === "string" ? data.meta.currency : null,
    // Tagesdatum des neuesten Kurses (Mittag UTC, damit die Zeitzone das Datum nicht verschiebt)
    asOf: newest ? `${newest}T12:00:00.000Z` : undefined,
  };
}

/** Yahoo Finance mit dem ECHTEN Ticker der Position (z. B. RHM.DE, ASWC.DE). Inoffizielle Schnittstelle. */
async function fetchYahooCloses(ticker: string): Promise<{ closes: number[]; currency: string | null; asOf?: string } | { error: string }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker(ticker))}?interval=1d&range=1y`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      },
    );
    return parseYahooCloses(await res.json());
  } catch (err: any) {
    return { error: `Yahoo: ${String(err?.message ?? err).slice(0, 100)}` };
  }
}

const noData = (detail: string): TrendResult => ({ signal: "KEINE_DATEN", detail, price: null, sma50: null, sma200: null });
/** Zusatz im Signaltext; bei umgeleiteter Notierung (z. B. FWRG.DE -> FWRA.MI) mit Hinweis. */
const yahooSuffix = (ticker: string) => {
  const y = yahooTicker(ticker);
  return " · Quelle: Yahoo Finance" + (y !== ticker ? ` (Notierung ${y})` : "");
};

type Resolved = {
  trend: TrendResult; currency: string | null; asOf: string | null;
  retryable: boolean; usedYahoo: boolean; tdCalls: number;
};

/** Holt die Kurse einer Position aus der passenden Quelle (siehe Kopfkommentar). */
async function resolveTrend(ticker: string, apiKey: string): Promise<Resolved> {
  const hasTwin = isTrendProxyTicker(ticker);
  let yahooError: string | null = null;

  if (hasTwin) {
    const y = await fetchYahooCloses(ticker);
    if ("closes" in y) {
      const t = computeTrendSignal(y.closes);
      return { trend: { ...t, detail: t.detail + yahooSuffix(ticker) }, currency: y.currency, asOf: y.asOf ?? null, retryable: false, usedYahoo: true, tdCalls: 0 };
    }
    yahooError = y.error;
  }

  let fetched: FetchResult;
  try {
    fetched = await fetchCloses(ticker, apiKey);
  } catch (err: any) {
    return {
      trend: noData(`Abruf fehlgeschlagen: ${String(err?.message ?? err).slice(0, 140)}`),
      currency: null, asOf: null, retryable: true, usedYahoo: false, tdCalls: 1,
    };
  }
  if ("closes" in fetched) {
    return { trend: computeTrendSignal(fetched.closes), currency: fetched.currency, asOf: fetched.asOf ?? null, retryable: false, usedYahoo: false, tdCalls: 1 };
  }
  if (fetched.retryable) {
    // Minuten-Limit: nicht bei Yahoo suchen, der Browser holt es nach einer Pause nach
    return { trend: noData(fetched.error), currency: null, asOf: null, retryable: true, usedYahoo: false, tdCalls: 1 };
  }
  if (!hasTwin) {
    const y = await fetchYahooCloses(ticker);
    if ("closes" in y) {
      const t = computeTrendSignal(y.closes);
      return { trend: { ...t, detail: t.detail + yahooSuffix(ticker) }, currency: y.currency, asOf: y.asOf ?? null, retryable: false, usedYahoo: true, tdCalls: 1 };
    }
    yahooError = y.error;
  }
  return {
    trend: noData(yahooError ? `${fetched.error} · ${yahooError}` : fetched.error),
    currency: null, asOf: null, retryable: false, usedYahoo: false, tdCalls: 1,
  };
}

async function getPreviousSignals(db: Db, userId: number, positionIds: number[]): Promise<Map<number, TrendSignal>> {
  const last = await db
    .select({ id: waechterLaeufe.id })
    .from(waechterLaeufe)
    .where(and(eq(waechterLaeufe.userId, userId), isNotNull(waechterLaeufe.finishedAt)))
    .orderBy(desc(waechterLaeufe.finishedAt))
    .limit(1);
  if (last.length === 0) return new Map();
  const rows = await db
    .select({ positionId: waechterErgebnisse.positionId, signal: waechterErgebnisse.signal })
    .from(waechterErgebnisse)
    .where(and(eq(waechterErgebnisse.runId, last[0].id), inArray(waechterErgebnisse.positionId, positionIds)));
  return new Map(rows.map((r) => [r.positionId, r.signal as TrendSignal]));
}

/**
 * Prueft ein Haeppchen und speichert die Ergebnisse. Positionen mit gleichem Abruf (z. B. zwei
 * Positionen mit demselben ETF-Ticker) kosten nur EINEN Abruf. Ein bereits gespeichertes Ergebnis
 * derselben Position im selben Lauf wird ersetzt (Nachholen).
 * retryPositionIds = Positionen, die am Minuten-Limit scheiterten und sich lohnen, es erneut zu versuchen.
 * tdCalls = Anzahl Twelve-Data-Abrufe in diesem Haeppchen (0 = keine Wartezeit noetig).
 */
export async function checkWaechterChunk(
  userId: number,
  runId: number,
  positionIds: number[],
): Promise<{ results: WaechterResultRow[]; retryPositionIds: number[]; tdCalls: number }> {
  const db = await requireDb();
  const run = await getOwnRun(db, userId, runId);
  if (run.finishedAt) throw new Error("Dieser Lauf ist bereits abgeschlossen.");
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("Twelve Data API-Key nicht konfiguriert.");

  const positions = await db
    .select()
    .from(portfolioPositions)
    .where(and(eq(portfolioPositions.userId, userId), inArray(portfolioPositions.id, positionIds)));

  const byKey = new Map<string, typeof positions>();
  for (const p of positions) {
    if (!decideCheckable({ type: p.type, ticker: p.ticker, waechterMuted: p.waechterMuted }).checkable) continue;
    const key = groupKey(p.ticker);
    const list = byKey.get(key);
    if (list) list.push(p);
    else byKey.set(key, [p]);
  }
  if (byKey.size > WAECHTER_CHUNK_SIZE) {
    throw new Error(`Zu viele verschiedene Kursabrufe in einem Häppchen (${byKey.size}, erlaubt ${WAECHTER_CHUNK_SIZE}).`);
  }

  const prev = await getPreviousSignals(db, userId, positionIds);
  const rows: WaechterResultRow[] = [];
  const retryPositionIds: number[] = [];
  let tdCalls = 0;

  for (const group of Array.from(byKey.values())) {
    const r = await resolveTrend(group[0].ticker, apiKey);
    tdCalls += r.tdCalls;

    for (const p of group) {
      const values = {
        runId,
        userId,
        positionId: p.id,
        ticker: p.ticker,
        name: p.name,
        wkn: p.wkn ?? null,
        signal: r.trend.signal,
        signalDetail: r.trend.detail.slice(0, 255),
        price: r.trend.price !== null ? String(r.trend.price) : null,
        sma50: r.trend.sma50 !== null ? String(r.trend.sma50) : null,
        sma200: r.trend.sma200 !== null ? String(r.trend.sma200) : null,
        prevSignal: prev.get(p.id) ?? null,
        // Yahoo liefert den echten Kurs der Position, dann ist es keine Näherung
        isProxy: r.usedYahoo ? false : isTrendProxyTicker(p.ticker),
        positionType: p.type,
        currency: r.currency,
        promptCopiedAt: null,
        priceAsOf: r.asOf ? new Date(r.asOf) : null,
      };
      await db
        .delete(waechterErgebnisse)
        .where(and(eq(waechterErgebnisse.runId, runId), eq(waechterErgebnisse.positionId, p.id)));
      await db.insert(waechterErgebnisse).values(values);
      rows.push(toResultRow(values));
      if (r.retryable) retryPositionIds.push(p.id);
    }
  }
  return { results: rows, retryPositionIds, tdCalls };
}

/** Schliesst den Lauf ab. Erst danach zaehlt er als "zuletzt geprueft". */
export async function finishWaechterRun(userId: number, runId: number) {
  const db = await requireDb();
  const run = await getOwnRun(db, userId, runId);
  if (run.finishedAt) throw new Error("Dieser Lauf ist bereits abgeschlossen.");
  const rows = await db.select({ signal: waechterErgebnisse.signal }).from(waechterErgebnisse).where(eq(waechterErgebnisse.runId, runId));
  if (rows.length === 0) throw new Error("Keine Ergebnisse vorhanden – Lauf nicht abgeschlossen.");
  const ohneDaten = rows.filter((r) => r.signal === "KEINE_DATEN").length;
  const geprueft = rows.length - ohneDaten;
  const finishedAt = new Date();
  await db
    .update(waechterLaeufe)
    .set({ finishedAt, positionenGeprueft: geprueft, positionenOhneDaten: ohneDaten })
    .where(eq(waechterLaeufe.id, runId));
  return { finishedAt: finishedAt.toISOString(), geprueft, ohneDaten };
}

async function getFinishedRuns(db: Db, userId: number, limit: number) {
  return db
    .select()
    .from(waechterLaeufe)
    .where(and(eq(waechterLaeufe.userId, userId), isNotNull(waechterLaeufe.finishedAt)))
    .orderBy(desc(waechterLaeufe.finishedAt))
    .limit(limit);
}

/** Zuletzt gespeicherte Einstiegs-These/Exit-These je Ticker (aus der Einstiegsanalyse), falls vorhanden. */
async function getEntryTheses(db: Db, userId: number, tickers: string[]) {
  const map = new Map<string, { these: string; exitThese: string; analysedAt: string }>();
  if (tickers.length === 0) return map;
  const rows = await db
    .select({
      ticker: einstiegsanalysen.ticker,
      these: einstiegsanalysen.these,
      exitThese: einstiegsanalysen.exitThese,
      createdAt: einstiegsanalysen.createdAt,
    })
    .from(einstiegsanalysen)
    .where(and(eq(einstiegsanalysen.userId, userId), inArray(einstiegsanalysen.ticker, tickers)))
    .orderBy(desc(einstiegsanalysen.createdAt));
  for (const r of rows) {
    if (!map.has(r.ticker)) map.set(r.ticker, { these: r.these, exitThese: r.exitThese, analysedAt: r.createdAt.toISOString() });
  }
  return map;
}

/** Letzter abgeschlossener Lauf mit allen Ergebnissen (oder null), inkl. Datum des Laufs davor. */
export async function getLatestWaechterRun(userId: number) {
  const db = await requireDb();
  const [run, previous] = await getFinishedRuns(db, userId, 2);
  if (!run || !run.finishedAt) return null;
  const rows = await db.select().from(waechterErgebnisse).where(eq(waechterErgebnisse.runId, run.id));
  const theses = await getEntryTheses(db, userId, Array.from(new Set(rows.map((r) => r.ticker))));
  return {
    run: {
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt.toISOString(),
      previousFinishedAt: previous?.finishedAt ? previous.finishedAt.toISOString() : null,
      positionenGeprueft: run.positionenGeprueft,
      positionenOhneDaten: run.positionenOhneDaten,
    },
    results: rows.map((r) => ({ ...toResultRow(r), entryThesis: theses.get(r.ticker) ?? null })),
  };
}

export async function getWaechterLastChecked(userId: number): Promise<{ finishedAt: string | null }> {
  const db = await requireDb();
  const [run] = await getFinishedRuns(db, userId, 1);
  return { finishedAt: run?.finishedAt ? run.finishedAt.toISOString() : null };
}

export async function setPositionMuted(userId: number, positionId: number, muted: boolean) {
  const db = await requireDb();
  await db
    .update(portfolioPositions)
    .set({ waechterMuted: muted })
    .where(and(eq(portfolioPositions.id, positionId), eq(portfolioPositions.userId, userId)));
}

/** Merkt sich, dass Rafael den KI-Text zu dieser Position (im letzten abgeschlossenen Lauf) kopiert hat. */
export async function markWaechterPromptCopied(userId: number, positionId: number): Promise<{ promptCopiedAt: string }> {
  const db = await requireDb();
  const [run] = await getFinishedRuns(db, userId, 1);
  if (!run) throw new Error("Kein abgeschlossener Wächter-Lauf vorhanden");
  const now = new Date();
  await db
    .update(waechterErgebnisse)
    .set({ promptCopiedAt: now })
    .where(
      and(
        eq(waechterErgebnisse.runId, run.id),
        eq(waechterErgebnisse.userId, userId),
        eq(waechterErgebnisse.positionId, positionId),
      ),
    );
  return { promptCopiedAt: now.toISOString() };
}
