/**
 * Ausstiegs-Prüfung (Kaufkarte 2a/2b): Realitätscheck für Verlust- und Gewinn-Marke einer Position
 * plus Speichern der Marken je Position. Nur lesen/rechnen, bewegt kein Geld, gibt kein Kauf-/Verkaufssignal.
 * Kurse: Yahoo Finance, Tagesschlusskurse der letzten 10 Jahre (inoffizielle Schnittstelle).
 * Hat der Ticker zu wenig Geschichte (z. B. .F-Notierungen), wird der US-Ticker aus der Ticker-Zuordnung versucht.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { ausstiegsMarken, portfolioPositions } from "../drizzle/schema";
import { convertTickerForTwelveData } from "./services";
import { yahooTicker } from "@shared/waechter";
import {
  MIN_RENDITEN,
  parseYahooSchlusskurse,
  pruefeAusstieg,
  pruefeMarken,
  type Marken,
  type PruefErgebnis,
} from "@shared/ausstieg";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  return db;
}

export async function ladeKurse(symbol: string): Promise<{ closes: number[]; currency: string | null } | { error: string }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10y`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(20000),
      },
    );
    return parseYahooSchlusskurse(await res.json());
  } catch (err: any) {
    return { error: `Yahoo: ${String(err?.message ?? err).slice(0, 100)}` };
  }
}

/** Kandidaten-Kürzel in der Reihenfolge, in der Yahoo gefragt wird (echtes Kürzel zuerst, dann US-Zuordnung). */
export function kandidaten(ticker: string): { symbol: string; naeherung: boolean }[] {
  const out = [{ symbol: yahooTicker(ticker), naeherung: false }];
  const conv = convertTickerForTwelveData(ticker);
  if (!conv.exchange && !conv.isCrypto && conv.symbol && conv.symbol !== ticker && !out.some((o) => o.symbol === conv.symbol)) {
    out.push({ symbol: conv.symbol, naeherung: true });
  }
  return out;
}

export interface PruefAntwort {
  positionId: number;
  name: string;
  ticker: string;
  /** Kürzel, dessen Kurse tatsächlich benutzt wurden; naeherung = Ersatz-Kürzel statt des echten. */
  quelle: { symbol: string; naeherung: boolean; waehrung: string | null };
  ergebnis: PruefErgebnis;
}

export async function pruefePosition(userId: number, positionId: number, marken: Marken): Promise<PruefAntwort> {
  const fehler = pruefeMarken(marken);
  if (fehler) throw new Error(fehler);
  const db = await requireDb();
  const [p] = await db
    .select()
    .from(portfolioPositions)
    .where(and(eq(portfolioPositions.id, positionId), eq(portfolioPositions.userId, userId)))
    .limit(1);
  if (!p) throw new Error("Position nicht gefunden");
  if (p.type === "Hebelprodukt") {
    throw new Error("Hebelprodukte haben ihre eigene K.O.-Logik. Für sie gibt es keine Ausstiegs-Prüfung.");
  }
  if (!p.ticker) throw new Error("Für diese Position ist kein Ticker hinterlegt.");

  const fehlerTexte: string[] = [];
  for (const k of kandidaten(p.ticker)) {
    const r = await ladeKurse(k.symbol);
    if ("error" in r) {
      fehlerTexte.push(`${k.symbol}: ${r.error}`);
      continue;
    }
    if (r.closes.length - 1 < MIN_RENDITEN) {
      fehlerTexte.push(`${k.symbol}: nur ${r.closes.length} Kurse (zu wenig Geschichte)`);
      continue;
    }
    return {
      positionId: p.id,
      name: p.name,
      ticker: p.ticker,
      quelle: { symbol: k.symbol, naeherung: k.naeherung, waehrung: r.currency },
      ergebnis: pruefeAusstieg(r.closes, marken),
    };
  }
  throw new Error(`Keine ausreichenden Kursdaten gefunden. ${fehlerTexte.join(" · ")}`);
}

export interface GespeicherteMarke {
  id: number;
  positionId: number;
  basisKurs: number;
  verlustPct: number;
  gewinnPct: number | null;
  monate: number;
  notiz: string | null;
  updatedAt: string;
}

export async function listMarken(userId: number): Promise<GespeicherteMarke[]> {
  const db = await requireDb();
  const rows = await db.select().from(ausstiegsMarken).where(eq(ausstiegsMarken.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    positionId: r.positionId,
    basisKurs: Number(r.basisKurs),
    verlustPct: Number(r.verlustPct),
    gewinnPct: r.gewinnPct !== null ? Number(r.gewinnPct) : null,
    monate: r.monate,
    notiz: r.notiz ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Speichert (oder ersetzt) die Marken einer Position. basisKurs = Depot-Kurs der Position beim Speichern. */
export async function speichereMarken(
  userId: number,
  input: { positionId: number; verlustPct: number; gewinnPct: number | null; monate: number; notiz?: string | null },
): Promise<{ success: true }> {
  const fehler = pruefeMarken({ verlustPct: input.verlustPct, gewinnPct: input.gewinnPct, monate: input.monate });
  if (fehler) throw new Error(fehler);
  const db = await requireDb();
  const [p] = await db
    .select()
    .from(portfolioPositions)
    .where(and(eq(portfolioPositions.id, input.positionId), eq(portfolioPositions.userId, userId)))
    .limit(1);
  if (!p) throw new Error("Position nicht gefunden");
  const basis = p.currentPrice !== null ? Number(p.currentPrice) : Number(p.buyPrice);
  if (!(basis > 0)) throw new Error("Für diese Position gibt es keinen Kurs als Basis.");

  const werte = {
    basisKurs: basis.toFixed(4),
    verlustPct: input.verlustPct.toFixed(2),
    gewinnPct: input.gewinnPct === null ? null : input.gewinnPct.toFixed(2),
    monate: input.monate,
    notiz: input.notiz ? input.notiz.slice(0, 255) : null,
  };
  const [vorhanden] = await db
    .select({ id: ausstiegsMarken.id })
    .from(ausstiegsMarken)
    .where(and(eq(ausstiegsMarken.userId, userId), eq(ausstiegsMarken.positionId, input.positionId)))
    .limit(1);
  if (vorhanden) {
    await db.update(ausstiegsMarken).set(werte).where(eq(ausstiegsMarken.id, vorhanden.id));
  } else {
    await db.insert(ausstiegsMarken).values({ userId, positionId: input.positionId, ...werte });
  }
  return { success: true };
}

export async function loescheMarken(userId: number, positionId: number): Promise<{ success: true }> {
  const db = await requireDb();
  await db.delete(ausstiegsMarken).where(and(eq(ausstiegsMarken.userId, userId), eq(ausstiegsMarken.positionId, positionId)));
  return { success: true };
}
