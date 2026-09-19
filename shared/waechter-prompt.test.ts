import { describe, it, expect } from 'vitest';
import { buildWaechterPrompt, type WaechterPromptInput } from './waechter-prompt';

// Ein ETF mit US-Vergleichswert (Näherung), wie beim Future-of-Defence-ETF im Live-Test
const etf: WaechterPromptInput = {
  name: 'Xtrackers AI & Big Data', ticker: 'XAIX.DE', wkn: 'A2N6LC', positionType: 'ETF',
  signal: 'ROT', signalDetail: 'Abwärtstrend (Death Cross)', prevSignal: 'GELB',
  price: 123.456, sma50: 130, sma200: 140, currency: 'USD',
  isProxy: true, proxySymbol: 'AIQ',
  runAt: '2026-09-19T10:00:00Z', prevRunAt: '2026-09-18T10:00:00Z', entryThesis: null,
};

// Eine Einzelaktie mit echtem Kurs, wie Broadcom im Live-Test
const aktie: WaechterPromptInput = {
  name: 'Broadcom Inc.', ticker: 'AVGO', wkn: 'US11135F1012', positionType: 'Aktie',
  signal: 'ROT', signalDetail: 'Unter SMA 50 & 200', prevSignal: 'ROT',
  price: 357.61, sma50: 379.76, sma200: 369.1, currency: 'USD',
  isProxy: false, proxySymbol: null,
  runAt: '2026-09-19T10:00:00Z', prevRunAt: null, entryThesis: null,
};

describe('buildWaechterPrompt: gemeinsame Teile', () => {
  it('enthält Position und Art der Position', () => {
    const t = buildWaechterPrompt(etf);
    expect(t).toContain('Xtrackers AI & Big Data (Ticker: XAIX.DE, WKN: A2N6LC)');
    expect(t).toContain('Art der Position: ETF/Fonds');
    expect(buildWaechterPrompt(aktie)).toContain('Art der Position: Einzelaktie');
  });
  it('unterscheidet WKN und ISIN', () => {
    expect(buildWaechterPrompt(aktie)).toContain('(Ticker: AVGO, ISIN: US11135F1012)');
    expect(buildWaechterPrompt(etf)).toContain('WKN: A2N6LC');
  });
  it('nennt Lauf-Datum und Datum des letzten Laufs', () => {
    const t = buildWaechterPrompt(etf);
    expect(t).toContain('Trend-Signal meines Wächters (Lauf vom 19.09.2026): ROT – Abwärtstrend (Death Cross) (beim letzten Lauf am 18.09.2026: GELB)');
  });
  it('lässt den internen Quellen-Zusatz im Signaltext weg', () => {
    const t = buildWaechterPrompt({ ...aktie, signalDetail: 'Aufwärtstrend (Golden Cross) · Quelle: Yahoo Finance' });
    expect(t).toContain('ROT – Aufwärtstrend (Golden Cross) (beim letzten Lauf: ROT)');
    expect(t).not.toContain('Quelle: Yahoo');
  });
  it('ohne Datum des letzten Laufs bleibt der alte Wortlaut', () => {
    const t = buildWaechterPrompt({ ...aktie, prevSignal: 'ROT', prevRunAt: null });
    expect(t).toContain('(beim letzten Lauf: ROT)');
  });
  it('enthält die Leitplanken', () => {
    const t = buildWaechterPrompt(aktie);
    expect(t).toContain('Gib keine Kauf-, Verkaufs- oder Halteanweisung');
    expect(t).toContain('Nenne Quellen mit Datum');
    expect(t).toContain('Kennzeichne unsichere');
    expect(t).toContain('keine Anlageberatung');
  });
  it('kommt mit fehlenden Werten klar', () => {
    const t = buildWaechterPrompt({ ...aktie, wkn: null, price: null, sma50: null, sma200: null, prevSignal: null, currency: null, runAt: null });
    expect(t).toContain('Kurs: unbekannt');
    expect(t).not.toContain('WKN:');
    expect(t).not.toContain('ISIN:');
    expect(t).not.toContain('beim letzten Lauf');
    expect(t).not.toContain('Lauf vom');
  });
});

describe('buildWaechterPrompt: Kurs und Vergleichswert', () => {
  it('echter Kurs mit Währung', () => {
    const t = buildWaechterPrompt(aktie);
    expect(t).toContain('Kurs: 357.61 USD, SMA 50 (Durchschnitt 50 Tage): 379.76, SMA 200 (Durchschnitt 200 Tage): 369.10');
    expect(t).not.toContain('Vergleichswert');
  });
  it('Näherung wird klar als Vergleichswert gekennzeichnet, mit Ticker', () => {
    const t = buildWaechterPrompt(etf);
    expect(t).toContain('NICHT zum ETF selbst, sondern zum US-Vergleichswert AIQ');
    expect(t).toContain('Kurs des Vergleichswerts: 123.46 USD');
    expect(t).not.toContain('\nKurs: 123.46');
  });
  it('Näherung ohne bekannten Ticker sagt trotzdem "US-Vergleichswert"', () => {
    expect(buildWaechterPrompt({ ...etf, proxySymbol: null })).toContain('zu einem US-Vergleichswert');
  });
});

describe('buildWaechterPrompt: Fragen je Art', () => {
  it('ETF-Fragen: Kosten, Zusammensetzung, Index', () => {
    const t = buildWaechterPrompt(etf);
    expect(t).toContain('Gesamtkostenquote (TER)');
    expect(t).toContain('Index: Wurde der Index');
    expect(t).not.toContain('Geschäftsmodell');
  });
  it('Einzelaktie: Geschäftsmodell, Zahlen, Bewertung, Überschneidung, keine ETF-Fragen', () => {
    const t = buildWaechterPrompt(aktie);
    expect(t).toContain('Geschäftsmodell');
    expect(t).toContain('Quartalszahlen');
    expect(t).toContain('Bewertung');
    expect(t).toContain('In welchen verbreiteten ETFs');
    expect(t).not.toContain('Gesamtkostenquote');
    expect(t).not.toContain('Fondsgröße');
    expect(t).not.toContain('Index: Wurde der Index');
  });
  it('Kryptowert: Produkt, Regulierung', () => {
    const t = buildWaechterPrompt({ ...aktie, name: 'Bitcoin ETP', ticker: 'CBTC.SW', wkn: 'A3GZ2Z', positionType: 'Krypto' });
    expect(t).toContain('Art der Position: Kryptowert');
    expect(t).toContain('Regulierung');
    expect(t).not.toContain('Geschäftsmodell');
  });
});

describe('buildWaechterPrompt: Strategie und These', () => {
  it('nennt die Strategie-Rolle aus shared/strategy.ts', () => {
    expect(buildWaechterPrompt(etf)).toContain('Rolle in meiner Strategie: KI-Wette, Ziel-Anteil 19 % am ETF-Depot.');
  });
  it('Einzelaktie hat keine Strategie-Rolle', () => {
    expect(buildWaechterPrompt(aktie)).not.toContain('Rolle in meiner Strategie');
  });
  it('KI-Wetten bekommen die vier Kill-Kriterien, andere ETFs nicht', () => {
    expect(buildWaechterPrompt(etf)).toContain('Kill-Kriterien (Ausstiegs-Kriterien)');
    const kern = buildWaechterPrompt({ ...etf, name: 'Invesco FTSE All-World', ticker: 'FWRG.DE', wkn: 'A3D7QX' });
    expect(kern).not.toContain('Kill-Kriterien');
    expect(kern).toContain('Rolle in meiner Strategie: Kern');
  });
  it('gespeicherte Einstiegs-These und Exit-These werden mitgegeben', () => {
    const t = buildWaechterPrompt({
      ...aktie,
      entryThesis: { these: 'KI-Software-Schicht', exitThese: 'Wenn Wachstum unter 10 % fällt', analysedAt: '2026-09-13T09:00:00Z' },
    });
    expect(t).toContain('Meine Einstiegs-These (Analyse vom 13.09.2026): KI-Software-Schicht');
    expect(t).toContain('Meine Exit-These (wann ich aussteigen würde): Wenn Wachstum unter 10 % fällt');
    expect(t).toContain('ob die These noch trägt');
  });
  it('ohne gespeicherte These kein These-Block', () => {
    expect(buildWaechterPrompt(aktie)).not.toContain('Einstiegs-These');
  });
});

describe('buildWaechterPrompt: übrige Positionen (nur auf Wunsch)', () => {
  it('ohne Angabe oder leer: keine Liste im Text', () => {
    expect(buildWaechterPrompt(aktie)).not.toContain('Meine übrigen Positionen');
    expect(buildWaechterPrompt({ ...aktie, otherPositions: [] })).not.toContain('Meine übrigen Positionen');
    expect(buildWaechterPrompt({ ...aktie, otherPositions: null })).not.toContain('Meine übrigen Positionen');
  });
  it('mit Liste: nur Namen, mit Hinweis "keine Beträge" und Arbeitsauftrag', () => {
    const t = buildWaechterPrompt({ ...aktie, otherPositions: ['Amazon', 'Rheinmetall AG'] });
    expect(t).toContain('Meine übrigen Positionen (nur Namen, keine Beträge): Amazon, Rheinmetall AG');
    expect(t).toContain('Überschneidungen konkret');
  });
});
