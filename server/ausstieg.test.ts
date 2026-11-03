import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Netzwerk- und datenbankfrei: getDb und fetch werden ersetzt.
const state = {
  positions: [] as any[],
  marken: [] as any[],
  calls: [] as string[],
};

vi.mock('./db', () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => (table?.positionId && table?.verlustPct ? state.marken.slice(0, 1) : state.positions.slice(0, 1)),
          then: (res: any) => res(state.marken),
        }),
      }),
    }),
    insert: () => ({ values: async (v: any) => state.calls.push('insert:' + JSON.stringify(v)) }),
    update: () => ({ set: (v: any) => ({ where: async () => state.calls.push('update:' + JSON.stringify(v)) }) }),
    delete: () => ({ where: async () => state.calls.push('delete') }),
  }),
}));

vi.mock('./services', () => ({
  convertTickerForTwelveData: (t: string) => (t === 'AMZ.F' ? { symbol: 'AMZN' } : { symbol: t }),
}));

vi.mock('../drizzle/schema', () => ({
  ausstiegsMarken: { id: 'id', positionId: 'positionId', verlustPct: 'verlustPct', userId: 'userId' },
  portfolioPositions: { id: 'id', userId: 'userId' },
}));

import { pruefePosition, speichereMarken } from './ausstieg';

const yahoo = (n: number) => ({
  chart: { result: [{ meta: { currency: 'USD' }, indicators: { quote: [{ close: Array.from({ length: n }, (_, i) => 100 * Math.pow(1.0004, i) * (i % 2 ? 1.01 : 0.99)) }] } }] },
});
const antwort = (body: unknown) => ({ json: async () => body }) as Response;

const marken = { verlustPct: -20, gewinnPct: 30, monate: 12 };

beforeEach(() => {
  state.positions = [{ id: 7, userId: 1, ticker: 'AMZ.F', name: 'Amazon', type: 'Aktie', currentPrice: '200.0000', buyPrice: '58.6100' }];
  state.marken = [];
  state.calls = [];
});
afterEach(() => vi.unstubAllGlobals());

describe('pruefePosition', () => {
  it('nimmt das echte Kürzel, wenn es genug Geschichte hat', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => antwort(yahoo(700))));
    const r = await pruefePosition(1, 7, marken);
    expect(r.quelle).toEqual({ symbol: 'AMZ.F', naeherung: false, waehrung: 'USD' });
    expect(r.ergebnis.datenTage).toBe(700);
  });

  it('fällt auf das US-Kürzel zurück, wenn das echte zu wenig Geschichte hat', async () => {
    const f = vi.fn(async (url: string) => antwort(url.includes('AMZN') ? yahoo(700) : yahoo(100)));
    vi.stubGlobal('fetch', f);
    const r = await pruefePosition(1, 7, marken);
    expect(r.quelle.symbol).toBe('AMZN');
    expect(r.quelle.naeherung).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('meldet verständlich, wenn nirgends genug Daten sind', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => antwort(yahoo(100))));
    await expect(pruefePosition(1, 7, marken)).rejects.toThrow(/Keine ausreichenden Kursdaten/);
  });

  it('lehnt Hebelprodukte ab, ohne Yahoo zu fragen', async () => {
    state.positions = [{ id: 9, userId: 1, ticker: 'MR2PMR', name: 'Turbo', type: 'Hebelprodukt' }];
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(pruefePosition(1, 9, marken)).rejects.toThrow(/K\.O\.-Logik/);
    expect(f).not.toHaveBeenCalled();
  });

  it('lehnt falsche Marken ab, bevor etwas geladen wird', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(pruefePosition(1, 7, { verlustPct: 10, gewinnPct: 30, monate: 12 })).rejects.toThrow(/Verlust/);
    expect(f).not.toHaveBeenCalled();
  });

  it('meldet Yahoo-Fehler und unbekannte Position', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(pruefePosition(1, 7, marken)).rejects.toThrow(/offline/);
    state.positions = [];
    await expect(pruefePosition(1, 7, marken)).rejects.toThrow(/nicht gefunden/);
  });
});

describe('speichereMarken', () => {
  it('legt neu an und nimmt den Depot-Kurs als Basis', async () => {
    await speichereMarken(1, { positionId: 7, verlustPct: -40, gewinnPct: null, monate: 58 });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toContain('insert:');
    expect(state.calls[0]).toContain('"basisKurs":"200.0000"');
    expect(state.calls[0]).toContain('"verlustPct":"-40.00"');
    expect(state.calls[0]).toContain('"gewinnPct":null');
  });

  it('ersetzt vorhandene Marken (update statt zweiter Zeile)', async () => {
    state.marken = [{ id: 3 }];
    await speichereMarken(1, { positionId: 7, verlustPct: -30, gewinnPct: 50, monate: 12 });
    expect(state.calls[0]).toContain('update:');
    expect(state.calls[0]).toContain('"gewinnPct":"50.00"');
  });

  it('prüft die Marken und die Position', async () => {
    await expect(speichereMarken(1, { positionId: 7, verlustPct: 5, gewinnPct: null, monate: 12 })).rejects.toThrow(/Verlust/);
    state.positions = [];
    await expect(speichereMarken(1, { positionId: 7, verlustPct: -40, gewinnPct: null, monate: 12 })).rejects.toThrow(/nicht gefunden/);
    expect(state.calls).toHaveLength(0);
  });
});
