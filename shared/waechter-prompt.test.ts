import { describe, it, expect } from 'vitest';
import { buildWaechterPrompt, type WaechterPromptInput } from './waechter-prompt';

const base: WaechterPromptInput = {
  name: 'Xtrackers AI & Big Data', ticker: 'XAIX.DE', wkn: 'A2N6LC',
  signal: 'ROT', signalDetail: 'Abwärtstrend (Death Cross)', prevSignal: 'GELB',
  price: 123.456, sma50: 130, sma200: 140, isProxy: true,
};

describe('buildWaechterPrompt', () => {
  it('enthält Position, Kennzahlen und Signalwechsel', () => {
    const t = buildWaechterPrompt(base);
    expect(t).toContain('Xtrackers AI & Big Data (Ticker: XAIX.DE, WKN: A2N6LC)');
    expect(t).toContain('ROT – Abwärtstrend (Death Cross) (beim letzten Lauf: GELB)');
    expect(t).toContain('Kurs: 123.46');
    expect(t).toContain('SMA 50 (Durchschnitt 50 Tage): 130.00');
  });
  it('nennt die Strategie-Rolle aus shared/strategy.ts', () => {
    expect(buildWaechterPrompt(base)).toContain('Rolle in meiner Strategie: KI-Wette, Ziel-Anteil 19 % am ETF-Depot.');
  });
  it('KI-Wetten bekommen die vier Kill-Kriterien, andere ETFs nicht', () => {
    expect(buildWaechterPrompt(base)).toContain('Kill-Kriterien (Ausstiegs-Kriterien)');
    const kern = buildWaechterPrompt({ ...base, name: 'Invesco FTSE All-World', ticker: 'FWRG.DE', wkn: 'A3D7QX' });
    expect(kern).not.toContain('Kill-Kriterien');
    expect(kern).toContain('Rolle in meiner Strategie: Kern');
  });
  it('kennzeichnet Näherungswerte', () => {
    expect(buildWaechterPrompt(base)).toContain('als Näherung berechnet');
    expect(buildWaechterPrompt({ ...base, isProxy: false })).not.toContain('als Näherung berechnet');
  });
  it('enthält die Leitplanken und keine Handlungsanweisung', () => {
    const t = buildWaechterPrompt(base);
    expect(t).toContain('Gib keine Kauf-, Verkaufs- oder Halteanweisung');
    expect(t).toContain('Nenne Quellen mit Datum');
    expect(t).toContain('Kennzeichne unsichere');
    expect(t).toContain('keine Anlageberatung');
  });
  it('kommt mit fehlenden Werten und ohne WKN klar', () => {
    const t = buildWaechterPrompt({ ...base, wkn: null, price: null, sma50: null, sma200: null, prevSignal: null, isProxy: false });
    expect(t).toContain('Kurs: unbekannt');
    expect(t).not.toContain('WKN:');
    expect(t).not.toContain('beim letzten Lauf');
  });
});
