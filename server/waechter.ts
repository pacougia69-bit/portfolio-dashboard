/**
 * Waechter: Trend-Pruefung auf Knopfdruck (nur lesen, bewegt kein Geld).
 * Der Client ruft startRun -> checkChunk (mehrfach, mit Pause) -> finishRun auf,
 * damit keine einzelne Server-Anfrage lange laeuft (Twelve-Data-Limit 8/Minute).
 */
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { portfolioPositions, waechterLaeufe, waechterErgebnisse } from "../drizzle/schema";
import { convertTickerForTwelveData, isTrendProxyTicker } from "./services";
import {
  computeTrendSignal,
  decideCheckable,
  detectChange,
  getActionHint,
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
  "positionId" | "ticker" | "name" | "wkn" | "signal" | "signalDetail" | "price" | "sma50" | "sma200" | "prevSignal" | "isProxy"
>;

function toResultRow(r: ErgebnisFelder): WaechterResultRow {
  const signal = r.signal as TrendSignal;
  const prev = (r.prevSignal as TrendSignal | null) ?? null;
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
    isProxy: Boolean(r.isProxy),
    actionHint: getActionHint(signal, r.wkn),
  };
}

/** Legt einen neuen Lauf an und sagt, welche Positionen geprueft werden. */
export async function startWaechterRun(userId: number) {
  const db = await requireDb();
  const positions = await db.select().from(portfolioPositions).where(eq(portfolioPositions.userId, userId));

  const toCheck: { id: number; ticker: string; name: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let mutedCount = 0;
  for (const p of positions) {
    const d = decideCheckable({ type: p.type, ticker: p.ticker, waechterMuted: p.waechterMuted });
    if (d.checkable) {
      toCheck.push({ id: p.id, ticker: p.ticker, name: p.name });
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
  return { runId: Number(result[0].insertId), positions: toCheck, skipped, mutedCount };
}

async function fetchCloses(ticker: string, apiKey: string): Promise<{ closes: number[] } | { error: string }> {
  const converted = convertTickerForTwelveData(ticker);
  const symbol = converted.exchange ? `${converted.symbol}:${converted.exchange}` : converted.symbol;
  const res = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=200&apikey=${apiKey}`,
  );
  const data: any = await res.json();
  if (data.code || data.status === "error" || !data.values?.length) {
    return { error: `Ticker "${symbol}": ${String(data.message || data.code || "Keine Daten").slice(0, 140)}` };
  }
  return { closes: data.values.map((v: any) => parseFloat(v.close)) };
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

/** Prueft ein Haeppchen (max. 8 Positionen) und speichert die Ergebnisse. */
export async function checkWaechterChunk(userId: number, runId: number, positionIds: number[]): Promise<WaechterResultRow[]> {
  const db = await requireDb();
  const run = await getOwnRun(db, userId, runId);
  if (run.finishedAt) throw new Error("Dieser Lauf ist bereits abgeschlossen.");
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("Twelve Data API-Key nicht konfiguriert.");

  const positions = await db
    .select()
    .from(portfolioPositions)
    .where(and(eq(portfolioPositions.userId, userId), inArray(portfolioPositions.id, positionIds)));
  const prev = await getPreviousSignals(db, userId, positionIds);

  const rows: WaechterResultRow[] = [];
  for (const p of positions) {
    if (!decideCheckable({ type: p.type, ticker: p.ticker, waechterMuted: p.waechterMuted }).checkable) continue;
    let trend;
    try {
      const fetched = await fetchCloses(p.ticker, apiKey);
      trend =
        "closes" in fetched
          ? computeTrendSignal(fetched.closes)
          : { signal: "KEINE_DATEN" as const, detail: fetched.error, price: null, sma50: null, sma200: null };
    } catch (err: any) {
      trend = {
        signal: "KEINE_DATEN" as const,
        detail: `Abruf fehlgeschlagen: ${String(err?.message ?? err).slice(0, 140)}`,
        price: null,
        sma50: null,
        sma200: null,
      };
    }
    const values = {
      runId,
      userId,
      positionId: p.id,
      ticker: p.ticker,
      name: p.name,
      wkn: p.wkn ?? null,
      signal: trend.signal,
      signalDetail: trend.detail.slice(0, 255),
      price: trend.price !== null ? String(trend.price) : null,
      sma50: trend.sma50 !== null ? String(trend.sma50) : null,
      sma200: trend.sma200 !== null ? String(trend.sma200) : null,
      prevSignal: prev.get(p.id) ?? null,
      isProxy: isTrendProxyTicker(p.ticker),
    };
    await db.insert(waechterErgebnisse).values(values);
    rows.push(toResultRow(values));
  }
  return rows;
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

async function getLatestFinishedRun(db: Db, userId: number) {
  const runs = await db
    .select()
    .from(waechterLaeufe)
    .where(and(eq(waechterLaeufe.userId, userId), isNotNull(waechterLaeufe.finishedAt)))
    .orderBy(desc(waechterLaeufe.finishedAt))
    .limit(1);
  return runs[0] ?? null;
}

/** Letzter abgeschlossener Lauf mit allen Ergebnissen (oder null). */
export async function getLatestWaechterRun(userId: number) {
  const db = await requireDb();
  const run = await getLatestFinishedRun(db, userId);
  if (!run || !run.finishedAt) return null;
  const rows = await db.select().from(waechterErgebnisse).where(eq(waechterErgebnisse.runId, run.id));
  return {
    run: {
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt.toISOString(),
      positionenGeprueft: run.positionenGeprueft,
      positionenOhneDaten: run.positionenOhneDaten,
    },
    results: rows.map(toResultRow),
  };
}

export async function getWaechterLastChecked(userId: number): Promise<{ finishedAt: string | null }> {
  const db = await requireDb();
  const run = await getLatestFinishedRun(db, userId);
  return { finishedAt: run?.finishedAt ? run.finishedAt.toISOString() : null };
}

export async function setPositionMuted(userId: number, positionId: number, muted: boolean) {
  const db = await requireDb();
  await db
    .update(portfolioPositions)
    .set({ waechterMuted: muted })
    .where(and(eq(portfolioPositions.id, positionId), eq(portfolioPositions.userId, userId)));
}
