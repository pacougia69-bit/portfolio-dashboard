/**
 * Wächter-Auswertung: gespeicherte KI-Analysen (Rohtext + erkannte Felder) je Position.
 * Nur lesen/schreiben in waechter_analysen; bewegt kein Geld.
 */
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { portfolioPositions, waechterAnalysen, waechterErgebnisse, waechterLaeufe } from "../drizzle/schema";
import type { AnalyseRow, Datenlage, Grundlage } from "@shared/waechter-auswertung";
import type { TrendSignal } from "@shared/waechter";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function requireDb(): Promise<Db> {
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  return db;
}

export async function saveWaechterAnalysen(
  userId: number,
  input: {
    positionIds: number[];
    rawText: string;
    grundlage: Grundlage;
    datenlage: Datenlage;
    begruendung: string;
    offen: string;
    kiName?: string;
  },
): Promise<{ ids: number[] }> {
  const db = await requireDb();
  const ids = Array.from(new Set(input.positionIds));

  const positions = await db
    .select()
    .from(portfolioPositions)
    .where(and(eq(portfolioPositions.userId, userId), inArray(portfolioPositions.id, ids)));
  if (positions.length !== ids.length) throw new Error("Position nicht gefunden");

  // Trend und Kurs des letzten abgeschlossenen Wächter-Laufs festhalten (für "Trend damals")
  const [run] = await db
    .select({ id: waechterLaeufe.id })
    .from(waechterLaeufe)
    .where(and(eq(waechterLaeufe.userId, userId), isNotNull(waechterLaeufe.finishedAt)))
    .orderBy(desc(waechterLaeufe.finishedAt))
    .limit(1);
  const results = run
    ? await db
        .select({ positionId: waechterErgebnisse.positionId, signal: waechterErgebnisse.signal, price: waechterErgebnisse.price })
        .from(waechterErgebnisse)
        .where(and(eq(waechterErgebnisse.runId, run.id), inArray(waechterErgebnisse.positionId, ids)))
    : [];
  const resultByPosition = new Map(results.map((r) => [r.positionId, r]));

  const created: number[] = [];
  for (const p of positions) {
    const r = resultByPosition.get(p.id);
    const inserted = await db.insert(waechterAnalysen).values({
      userId,
      positionId: p.id,
      ticker: p.ticker,
      name: p.name,
      runId: run?.id ?? null,
      trendAtAnalysis: (r?.signal ?? "KEINE_DATEN") as TrendSignal,
      priceAtAnalysis: r?.price ?? null,
      grundlage: input.grundlage,
      datenlage: input.datenlage,
      begruendung: input.begruendung,
      offen: input.offen,
      rawText: input.rawText,
      kiName: input.kiName ?? null,
    });
    created.push(Number(inserted[0].insertId));
  }
  return { ids: created };
}

/** Neueste Analyse je Position. */
export async function listWaechterAnalysen(userId: number): Promise<AnalyseRow[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(waechterAnalysen)
    .where(eq(waechterAnalysen.userId, userId))
    .orderBy(desc(waechterAnalysen.createdAt), desc(waechterAnalysen.id));
  const latest = new Map<number, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.positionId)) latest.set(r.positionId, r);
  return Array.from(latest.values()).map((r) => ({
    id: r.id,
    positionId: r.positionId,
    kiName: r.kiName ?? null,
    grundlage: r.grundlage as Grundlage,
    datenlage: r.datenlage as Datenlage,
    begruendung: r.begruendung ?? "",
    offen: r.offen ?? "",
    rawText: r.rawText,
    trendAtAnalysis: r.trendAtAnalysis as TrendSignal,
    priceAtAnalysis: r.priceAtAnalysis !== null ? Number(r.priceAtAnalysis) : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteWaechterAnalyse(userId: number, id: number): Promise<{ success: true }> {
  const db = await requireDb();
  await db.delete(waechterAnalysen).where(and(eq(waechterAnalysen.id, id), eq(waechterAnalysen.userId, userId)));
  return { success: true };
}
