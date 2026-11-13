import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// SQL-Vergleichstest (ohne Datenbank, ohne Netz).
//
// Zweck: Bei einem Update von drizzle-orm sieht man hier, ob sich die SQL-Befehle ändern, die das Dashboard an MySQL
// schickt. Der Test ruft die Datenbankfunktionen mit festen Beispielwerten auf, fängt jeden SQL-Befehl samt Werten an einer
// Attrappe ab (statt MySQL) und vergleicht die Liste mit der gespeicherten Aufzeichnung `__sql__/sql-aufzeichnung.json`.
//
// Grenzen (bewusst ehrlich): Es läuft keine echte Datenbank. Die Attrappe liefert immer leere Ergebnisse, deshalb brechen
// Funktionen, die nach dem Schreiben eine Zeile zurücklesen, danach ab; ihre SQL-Befehle bis dahin sind aufgezeichnet.
// Geprüft wird also der erzeugte SQL-Text und die Werte, nicht das Verhalten von MySQL und nicht die Ergebnis-Zuordnung.
//
// Neue Aufzeichnung nach einer gewollten Änderung: `pnpm vitest run server/sql-vergleich.test.ts -u`

const protokoll = vi.hoisted(() => {
  process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
  return { eintraege: [] as { sql: string; params: unknown[] }[] };
});

vi.mock('drizzle-orm/mysql2', async (importOriginal) => {
  const echt = await importOriginal<typeof import('drizzle-orm/mysql2')>();
  const aufzeichnen = (q: any, params: unknown[] = []) => {
    const sql = typeof q === 'string' ? q : q.sql;
    protokoll.eintraege.push({ sql, params: JSON.parse(JSON.stringify(params ?? [])) });
    return /^\s*(insert|update|delete)\b/i.test(sql) ? [{ insertId: 1, affectedRows: 1 }, undefined] : [[], []];
  };
  const attrappe = {
    query: async (q: any, params?: unknown[]) => aufzeichnen(q, params),
    execute: async (q: any, params?: unknown[]) => aufzeichnen(q, params),
  };
  return { ...echt, drizzle: () => (echt as any).drizzle({ client: attrappe }) };
});

import * as db from './db';

type Aufruf = [string, () => Promise<unknown>];

async function laden(name: string, pfad: () => Promise<any>): Promise<any | null> {
  try {
    return await pfad();
  } catch (e: any) {
    protokoll.eintraege.push({ sql: `-- Modul ${name} konnte nicht geladen werden: ${String(e?.message).slice(0, 80)}`, params: [] });
    return null;
  }
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  vi.stubGlobal('fetch', async () => {
    throw new Error('kein Netz im Test');
  });
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SQL-Vergleich der Datenbankfunktionen', () => {
  it('erzeugt dieselben SQL-Befehle wie die gespeicherte Aufzeichnung', async () => {
    const U = 1;
    const pos = { ticker: 'AAA', wkn: 'A1', isin: 'DE0000000001', name: 'Alpha', type: 'Aktie', quantity: '10', buyPrice: '5.5', currentPrice: '6', currency: 'EUR' } as any;
    const aufrufe: Aufruf[] = [
      ['upsertUser', () => db.upsertUser({ openId: 'open-1', name: 'Test', email: 't@example.com', loginMethod: 'pin', lastSignedIn: new Date('2026-01-15T12:00:00Z') } as any)],
      ['getUserByOpenId', () => db.getUserByOpenId('open-1')],
      ['getPortfolioPositions', () => db.getPortfolioPositions(U)],
      ['createPortfolioPosition', () => db.createPortfolioPosition(U, pos)],
      ['updatePortfolioPosition', () => db.updatePortfolioPosition(U, 7, { currentPrice: '7.25', quantity: '12' } as any)],
      ['deletePortfolioPosition', () => db.deletePortfolioPosition(U, 7)],
      ['getWatchlistItems', () => db.getWatchlistItems(U)],
      ['createWatchlistItem', () => db.createWatchlistItem(U, { ticker: 'BBB', name: 'Beta' } as any)],
      ['updateWatchlistItem', () => db.updateWatchlistItem(U, 3, { name: 'Beta2' } as any)],
      ['deleteWatchlistItem', () => db.deleteWatchlistItem(U, 3)],
      ['removeFromWatchlistByISINOrWKN', () => db.removeFromWatchlistByISINOrWKN(U, 'DE0000000001', 'A1')],
      ['getDividends', () => db.getDividends(U)],
      ['getDividends(Jahr)', () => db.getDividends(U, 2026)],
      ['createDividend', () => db.createDividend(U, { ticker: 'AAA', name: 'Alpha', amount: 12.5, taxAmount: 3.3, paymentDate: '2026-03-01', positionId: 7 })],
      ['deleteDividend', () => db.deleteDividend(U, 4)],
      ['getNotes', () => db.getNotes(U)],
      ['createNote', () => db.createNote(U, { title: 'T', content: 'C', category: 'x' })],
      ['updateNote', () => db.updateNote(U, 2, { title: 'T2' })],
      ['deleteNote', () => db.deleteNote(U, 2)],
      ['getSavingsPlans', () => db.getSavingsPlans(U)],
      ['createSavingsPlan', () => db.createSavingsPlan(U, { ticker: 'XAIX', name: 'AI', monthlyAmount: 125, executionDay: 1, isActive: true })],
      ['updateSavingsPlan', () => db.updateSavingsPlan(U, 5, { monthlyAmount: 250 })],
      ['deleteSavingsPlan', () => db.deleteSavingsPlan(U, 5)],
      ['getPriceCacheForTickers', () => db.getPriceCacheForTickers(['AAA', 'BBB'])],
      ['updatePriceCache', () => db.updatePriceCache('AAA', 6.5, 1.2)],
      ['importPortfolioData', () => db.importPortfolioData(U, [{ ticker: 'AAA', name: 'Alpha', type: 'Aktie', quantity: '1', buyPrice: '1' }], [{ ticker: 'BBB', name: 'Beta' }])],
      ['exportPortfolioData', () => db.exportPortfolioData(U)],
      ['saveAiAnalysis', () => db.saveAiAnalysis(U, 'portfolio', 'Text', 'AAA')],
      ['getUserSettings', () => db.getUserSettings(U)],
      ['saveUserSettings', () => db.saveUserSettings(U, { monthlyBudget: 1350, retirementTargetSum: 400000 })],
      ['setUserPin', () => db.setUserPin(U, '1234', true, 10)],
      ['verifyUserPin', () => db.verifyUserPin(U, '1234')],
      ['removeUserPin', () => db.removeUserPin(U)],
      ['getUserPinStatus', () => db.getUserPinStatus(U)],
      ['createTransaction', () => db.createTransaction(U, { isin: 'DE0000000001', wkn: 'A1', name: 'Alpha', type: 'Kauf', quantity: 1, price: 2, fees: 0, totalAmount: 2, date: new Date('2026-01-02T00:00:00Z') } as any)],
      ['getTransactions', () => db.getTransactions(U)],
      ['getTransactionsByISIN', () => db.getTransactionsByISIN(U, 'DE0000000001')],
      ['updatePortfolioFromTransaction', () => db.updatePortfolioFromTransaction(U, 'DE0000000001', 'A1', 'Alpha', 'Kauf', 1, 2, 'ETF', 'EUR')],
      ['getTaxSources', () => db.getTaxSources(U)],
      ['createTaxSource', () => db.createTaxSource(U, { name: 'Bank', exemptionOrder: 100, notes: 'n' })],
      ['updateTaxSource', () => db.updateTaxSource(U, 2, { name: 'Bank2' })],
      ['deleteTaxSource', () => db.deleteTaxSource(U, 2)],
      ['getTaxSettings', () => db.getTaxSettings(U)],
      ['saveTaxSettings', () => db.saveTaxSettings(U, { stockLossPot: 5 })],
      ['getTotalExemptionOrders', () => db.getTotalExemptionOrders(U)],
      ['getAllowances', () => db.getAllowances(U)],
      ['createAllowance', () => db.createAllowance(U, { year: 2026, amount: 1000, used: 0, broker: 'DKB' })],
      ['updateAllowance', () => db.updateAllowance(U, 3, { used: 10 })],
      ['deleteAllowance', () => db.deleteAllowance(U, 3)],
      ['getLossCarryforwards', () => db.getLossCarryforwards(U)],
      ['createLossCarryforward', () => db.createLossCarryforward(U, { year: 2025, category: 'stocks', amount: 100 })],
      ['updateLossCarryforward', () => db.updateLossCarryforward(U, 6, { amount: 50 })],
      ['deleteLossCarryforward', () => db.deleteLossCarryforward(U, 6)],
      ['clearAllTransactions', () => db.clearAllTransactions(U)],
      ['getTrafficLightEntries', () => db.getTrafficLightEntries(U)],
      ['addTrafficLightEntry', () => db.addTrafficLightEntry(U, { ticker: 'AAA', wkn: 'A1', name: 'Alpha' })],
      ['updateTrafficLightData', () => db.updateTrafficLightData(8, U, { currentPrice: 1, sma50: 1, sma200: 1, signal: 'GRUEN', signalDetail: 'ok' })],
      ['deleteTrafficLightEntry', () => db.deleteTrafficLightEntry(U, 8)],
      ['recordSnapshotIfNeeded', () => db.recordSnapshotIfNeeded(U, 1000, 900)],
      ['getPortfolioSnapshots', () => db.getPortfolioSnapshots(U, 30)],
      ['saveEinstiegsanalyse', () => db.saveEinstiegsanalyse(U, { ticker: 'AAA', name: 'Alpha' })],
      ['getEinstiegsanalysen', () => db.getEinstiegsanalysen(U)],
      ['getEinstiegsanalyse', () => db.getEinstiegsanalyse(U, 9)],
      ['deleteEinstiegsanalyse', () => db.deleteEinstiegsanalyse(U, 9)],
      ['getInnovationsbudgetJahr', () => db.getInnovationsbudgetJahr(U, 2026)],
      ['setInnovationsbudgetZiel', () => db.setInnovationsbudgetZiel(U, 2026, 1000)],
      ['addInnovationsbudgetNutzung', () => db.addInnovationsbudgetNutzung(U, { jahr: 2026, ticker: 'AAA', name: 'Alpha', betrag: 100, datum: '2026-02-01' })],
      ['removeInnovationsbudgetNutzung', () => db.removeInnovationsbudgetNutzung(U, 10)],
      ['getMusterdepotSettings', () => db.getMusterdepotSettings(U)],
      ['setMusterdepotCashBalance', () => db.setMusterdepotCashBalance(U, 5000)],
      ['resetMusterdepot', () => db.resetMusterdepot(U, 10000)],
      ['getMusterdepotPositions', () => db.getMusterdepotPositions(U)],
      ['getMusterdepotTransactions', () => db.getMusterdepotTransactions(U)],
      ['buyMusterdepotPosition', () => db.buyMusterdepotPosition(U, { ticker: 'AAA', name: 'Alpha', type: 'Aktie', amount: 100, price: 5 })],
      ['sellMusterdepotPosition', () => db.sellMusterdepotPosition(U, 11, 1, 5)],
      ['updateMusterdepotPosition', () => db.updateMusterdepotPosition(U, 11, { name: 'Alpha2' })],
      ['updateMusterdepotPositionPrice', () => db.updateMusterdepotPositionPrice(U, 11, { currentPrice: 6 })],
    ];

    // Weitere Module, die selbst mit der Datenbank sprechen (nur die Funktionen ohne Netz und KI)
    const ausstieg = await laden('ausstieg', () => import('./ausstieg'));
    if (ausstieg) {
      aufrufe.push(
        ['ausstieg.listMarken', () => ausstieg.listMarken(U)],
        ['ausstieg.speichereMarken', () => ausstieg.speichereMarken(U, { positionId: 7, verlustPct: -20, gewinnPct: 30, monate: 12, notiz: 'n' })],
        ['ausstieg.loescheMarken', () => ausstieg.loescheMarken(U, 7)],
      );
    }
    const wAnalysen = await laden('waechter-analysen', () => import('./waechter-analysen'));
    if (wAnalysen) {
      aufrufe.push(
        ['waechterAnalysen.save', () => wAnalysen.saveWaechterAnalysen(U, { positionIds: [7], rawText: 'Text', grundlage: 'Positionen' } as any)],
        ['waechterAnalysen.list', () => wAnalysen.listWaechterAnalysen(U)],
        ['waechterAnalysen.delete', () => wAnalysen.deleteWaechterAnalyse(U, 3)],
      );
    }
    const waechter = await laden('waechter', () => import('./waechter'));
    if (waechter) {
      aufrufe.push(
        ['waechter.getLatestRun', () => waechter.getLatestWaechterRun(U)],
        ['waechter.getLastChecked', () => waechter.getWaechterLastChecked(U)],
        ['waechter.setPositionMuted', () => waechter.setPositionMuted(U, 7, true)],
        ['waechter.markPromptCopied', () => waechter.markWaechterPromptCopied(U, 7)],
        ['waechter.finishRun', () => waechter.finishWaechterRun(U, 3)],
        ['waechter.startRun', () => waechter.startWaechterRun(U)],
      );
    }
    const morning = await laden('morning-note', () => import('./morning-note'));
    if (morning) {
      aufrufe.push(
        ['morningNote.history', () => morning.getMorningNoteHistory(U, 5)],
        ['morningNote.latest', () => morning.getLatestMorningNote(U)],
      );
    }
    const ki = await laden('ki-experiment', () => import('./ki-experiment'));
    if (ki) {
      aufrufe.push(
        ['kiExperiment.latest', () => ki.getLatestKiExperimentRun(U)],
        ['kiExperiment.history', () => ki.getKiExperimentHistory(U, 5)],
        ['kiExperiment.stats', () => ki.getKiExperimentStats(U)],
      );
    }
    const tech = await laden('tech-warning', () => import('./tech-warning'));
    if (tech) {
      aufrufe.push(
        ['techWarning.history', () => tech.getTechWarningHistory(U, 5)],
        ['techWarning.latest', () => tech.getLatestTechWarningSnapshot(U)],
      );
    }

    const ergebnis: Record<string, { sql: { sql: string; params: unknown[] }[]; fehler?: string }> = {};
    for (const [name, aufruf] of aufrufe) {
      protokoll.eintraege.length = 0;
      let fehler: string | undefined;
      try {
        await aufruf();
      } catch (e: any) {
        fehler = String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 100);
      }
      ergebnis[name] = { sql: protokoll.eintraege.map((x) => ({ ...x })), ...(fehler ? { fehler } : {}) };
    }

    const mitSql = Object.values(ergebnis).filter((x) => x.sql.length > 0).length;
    // Schutz: Fällt die Zahl stark, läuft die Attrappe nicht mehr richtig und der Vergleich wäre wertlos.
    expect(mitSql).toBeGreaterThanOrEqual(Math.floor(aufrufe.length * 0.7));

    const text = JSON.stringify({ funktionen: aufrufe.length, mitSql, ergebnis }, null, 2) + '\n';
    await expect(text).toMatchFileSnapshot('./__sql__/sql-aufzeichnung.json');
  }, 60000);
});
