import { describe, it, expect } from 'vitest';
import {
  parseBeurteilung, deriveEinordnung, analysisStale, describeAge, buildAuswertung, summaryLine,
  BEURTEILUNGS_BLOCK_LINES, ANALYSE_STALE_DAYS, STUFE_LABEL,
  type AnalyseRow, type Grundlage, type Datenlage,
} from './waechter-auswertung';
import type { TrendSignal, WaechterResultRow } from './waechter';

describe('parseBeurteilung', () => {
  it('liest einen sauberen Block', () => {
    const t = 'Lange Analyse ...\n\nBEURTEILUNG\nGRUNDLAGE: verschlechtert\nDATENLAGE: gut\nBEGRÜNDUNG: Prognose gesenkt am 17.09.2026.\nOFFEN: Dividende unklar.';
    expect(parseBeurteilung(t)).toEqual({
      grundlage: 'verschlechtert', datenlage: 'gut',
      begruendung: 'Prognose gesenkt am 17.09.2026.', offen: 'Dividende unklar.',
    });
  });
  it('toleriert Markdown mit fetten Feldnamen', () => {
    const t = '## BEURTEILUNG\n**GRUNDLAGE:** intakt\n**DATENLAGE:** widersprüchlich\n**BEGRÜNDUNG:** Zahlen passen nicht zusammen.\n**OFFEN:** nichts';
    const r = parseBeurteilung(t);
    expect(r.grundlage).toBe('intakt');
    expect(r.datenlage).toBe('widerspruechlich');
    expect(r.begruendung).toBe('Zahlen passen nicht zusammen.');
    expect(r.offen).toBe('nichts');
  });
  it('toleriert Aufzählungszeichen, fette Namen mit Doppelpunkt danach und kleine Buchstaben', () => {
    const t = 'BEURTEILUNG\n- **GRUNDLAGE**: intakt\n- datenlage: gut';
    const r = parseBeurteilung(t);
    expect(r.grundlage).toBe('intakt');
    expect(r.datenlage).toBe('gut');
  });
  it('versteht ue statt ü', () => {
    const r = parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: unklar\nDATENLAGE: DUENN\nBEGRUENDUNG: Wenig Quellen.\nOFFEN: vieles');
    expect(r.datenlage).toBe('duenn');
    expect(r.begruendung).toBe('Wenig Quellen.');
  });
  it('bildet Synonyme ab', () => {
    expect(parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: unverändert').grundlage).toBe('intakt');
    expect(parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: gefährdet').grundlage).toBe('verschlechtert');
    expect(parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: offen').grundlage).toBe('unklar');
    expect(parseBeurteilung('BEURTEILUNG\nDATENLAGE: lückenhaft').datenlage).toBe('duenn');
    expect(parseBeurteilung('BEURTEILUNG\nDATENLAGE: uneinheitlich').datenlage).toBe('widerspruechlich');
    expect(parseBeurteilung('BEURTEILUNG\nDATENLAGE: belastbar').datenlage).toBe('gut');
  });
  it('nimmt das erste passende Wort, nicht das letzte', () => {
    expect(parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: intakt (nicht verschlechtert)').grundlage).toBe('intakt');
  });
  it('abgeschriebene Optionszeile ergibt keinen Wert', () => {
    const r = parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: intakt | verschlechtert | unklar\nDATENLAGE: gut | widersprüchlich | dünn');
    expect(r.grundlage).toBeNull();
    expect(r.datenlage).toBeNull();
  });
  it('der LETZTE Block gewinnt, wenn die KI die Anweisung vorher zitiert', () => {
    const t =
      'BEURTEILUNG\nGRUNDLAGE: intakt | verschlechtert | unklar\nDATENLAGE: gut | widersprüchlich | dünn\n\n' +
      'Meine Analyse ...\n\nBEURTEILUNG\nGRUNDLAGE: verschlechtert\nDATENLAGE: gut\nBEGRÜNDUNG: Ziele gesenkt.\nOFFEN: nichts';
    const r = parseBeurteilung(t);
    expect(r.grundlage).toBe('verschlechtert');
    expect(r.datenlage).toBe('gut');
  });
  it('liest mehrzeilige Begründung bis zur Leerzeile', () => {
    const r = parseBeurteilung('BEURTEILUNG\nGRUNDLAGE: intakt\nDATENLAGE: gut\nBEGRÜNDUNG: Erster Satz.\nZweiter Satz.\n\nOFFEN: nichts');
    expect(r.begruendung).toBe('Erster Satz. Zweiter Satz.');
    expect(r.offen).toBe('nichts');
  });
  it('ohne Block: alles leer, kein Fehler', () => {
    expect(parseBeurteilung('Nur Text ohne Block.')).toEqual({ grundlage: null, datenlage: null, begruendung: '', offen: '' });
    expect(parseBeurteilung('')).toEqual({ grundlage: null, datenlage: null, begruendung: '', offen: '' });
  });
  it('der Block-Text für die KI enthält alle vier Felder', () => {
    const t = BEURTEILUNGS_BLOCK_LINES.join('\n');
    for (const f of ['BEURTEILUNG', 'GRUNDLAGE:', 'DATENLAGE:', 'BEGRÜNDUNG:', 'OFFEN:']) expect(t).toContain(f);
  });
});

describe('deriveEinordnung', () => {
  const base = { wkn: 'A2DWBY' as string | null };
  const trends: TrendSignal[] = ['GRUEN', 'GELB', 'ROT', 'KEINE_DATEN'];
  const grundlagen: Grundlage[] = ['intakt', 'verschlechtert', 'unklar'];
  const daten: Datenlage[] = ['gut', 'widerspruechlich', 'duenn'];

  it('Grundlage verschlechtert ist immer Stufe 1', () => {
    for (const trend of trends) {
      const e = deriveEinordnung({ ...base, trend, grundlage: 'verschlechtert', datenlage: 'gut' });
      expect(e.stufe).toBe(1);
      expect(e.text).toBe('Selbst prüfen – dringend');
    }
  });
  it('Stufe 1 nennt bei Themenwette und Rot zusätzlich Rafaels Regel', () => {
    const e = deriveEinordnung({ trend: 'ROT', grundlage: 'verschlechtert', datenlage: 'gut', wkn: 'A2N6LC' });
    expect(e.grund).toBe('Grundlage verschlechtert · Deine Regel: ROT → halbieren.');
  });
  it('unklare Grundlage, widersprüchliche oder dünne Daten, fehlender Trend: Stufe 2 mit Grund', () => {
    expect(deriveEinordnung({ ...base, trend: 'GRUEN', grundlage: 'unklar', datenlage: 'gut' })).toEqual({ stufe: 2, text: 'Selbst prüfen', grund: 'Grundlage unklar' });
    expect(deriveEinordnung({ ...base, trend: 'GELB', grundlage: 'intakt', datenlage: 'widerspruechlich' }).grund).toBe('Daten widersprüchlich');
    expect(deriveEinordnung({ ...base, trend: 'GELB', grundlage: 'intakt', datenlage: 'duenn' }).grund).toBe('Daten dünn');
    expect(deriveEinordnung({ ...base, trend: 'KEINE_DATEN', grundlage: 'intakt', datenlage: 'gut' }).grund).toBe('Trend fehlt');
  });
  it('mehrere Gründe werden mit Mittelpunkt verbunden', () => {
    expect(deriveEinordnung({ ...base, trend: 'GELB', grundlage: 'unklar', datenlage: 'duenn' }).grund).toBe('Grundlage unklar · Daten dünn');
  });
  it('Themenwette mit Rot und intakter Grundlage: Stufe 2 mit Regel', () => {
    const e = deriveEinordnung({ trend: 'ROT', grundlage: 'intakt', datenlage: 'gut', wkn: 'A3EB9T' });
    expect(e).toEqual({ stufe: 2, text: 'Selbst prüfen', grund: 'Deine Regel: ROT → halbieren.' });
  });
  it('normale Position mit Rot und intakter Grundlage: Stufe 3', () => {
    expect(deriveEinordnung({ ...base, trend: 'ROT', grundlage: 'intakt', datenlage: 'gut' })).toEqual({ stufe: 3, text: 'Kein neues Geld, beobachten', grund: null });
  });
  it('intakt und Gelb: Stufe 4, intakt und Grün: Stufe 5', () => {
    expect(deriveEinordnung({ ...base, trend: 'GELB', grundlage: 'intakt', datenlage: 'gut' })).toEqual({ stufe: 4, text: 'Beobachten', grund: null });
    expect(deriveEinordnung({ ...base, trend: 'GRUEN', grundlage: 'intakt', datenlage: 'gut' })).toEqual({ stufe: 5, text: 'Ruhig', grund: null });
  });
  it('kein Text enthält je "verkauf"', () => {
    for (const trend of trends) for (const grundlage of grundlagen) for (const datenlage of daten) for (const wkn of ['A2N6LC', 'A2DWBY', null]) {
      const e = deriveEinordnung({ trend, grundlage, datenlage, wkn });
      expect(`${e.text} ${e.grund ?? ''}`.toLowerCase()).not.toContain('verkauf');
    }
    for (const label of Object.values(STUFE_LABEL)) expect(label.toLowerCase()).not.toContain('verkauf');
  });
});

describe('analysisStale und describeAge', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  it('frische Analyse mit gleichem Trend ist nicht veraltet', () => {
    expect(analysisStale({ createdAt: '2026-10-25T12:00:00Z', trendAtAnalysis: 'GELB' }, 'GELB', now)).toEqual({ stale: false, reasons: [] });
  });
  it('genau 30 Tage sind noch nicht veraltet, 31 Tage schon', () => {
    expect(ANALYSE_STALE_DAYS).toBe(30);
    expect(analysisStale({ createdAt: '2026-09-30T12:00:00Z', trendAtAnalysis: 'GELB' }, 'GELB', now).stale).toBe(false);
    expect(analysisStale({ createdAt: '2026-09-29T11:00:00Z', trendAtAnalysis: 'GELB' }, 'GELB', now)).toEqual({ stale: true, reasons: ['älter als 30 Tage'] });
  });
  it('Farbwechsel macht die Analyse veraltet', () => {
    expect(analysisStale({ createdAt: '2026-10-29T12:00:00Z', trendAtAnalysis: 'GELB' }, 'ROT', now)).toEqual({ stale: true, reasons: ['Trend damals: Gelb, jetzt: Rot'] });
  });
  it('ohne Daten auf einer Seite zählt nicht als Wechsel', () => {
    expect(analysisStale({ createdAt: '2026-10-29T12:00:00Z', trendAtAnalysis: 'KEINE_DATEN' }, 'ROT', now).stale).toBe(false);
    expect(analysisStale({ createdAt: '2026-10-29T12:00:00Z', trendAtAnalysis: 'GELB' }, 'KEINE_DATEN', now).stale).toBe(false);
  });
  it('describeAge', () => {
    expect(describeAge('2026-10-30T08:00:00Z', now)).toBe('heute');
    expect(describeAge('2026-10-29T12:00:00Z', now)).toBe('gestern');
    expect(describeAge('2026-10-25T12:00:00Z', now)).toBe('vor 5 Tagen');
  });
});

const result = (over: Partial<WaechterResultRow>): WaechterResultRow => ({
  positionId: 1, ticker: 'X', name: 'X', wkn: null, signal: 'GELB', signalDetail: '', price: 1, sma50: 1, sma200: 1,
  prevSignal: null, change: 'neu', isProxy: false, actionHint: '', positionType: 'Aktie', currency: 'EUR',
  proxySymbol: null, entryThesis: null, promptCopiedAt: null, priceAsOf: null, ...over,
});
const analyse = (over: Partial<AnalyseRow>): AnalyseRow => ({
  id: 1, positionId: 1, kiName: null, grundlage: 'intakt', datenlage: 'gut', begruendung: '', offen: '', rawText: 'roh',
  trendAtAnalysis: 'GELB', priceAtAnalysis: 1, createdAt: '2026-10-29T12:00:00Z', ...over,
});

describe('buildAuswertung und summaryLine', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  const results = [
    result({ positionId: 1, name: 'Ruhig AG', signal: 'GRUEN' }),
    result({ positionId: 2, name: 'Bilfinger', signal: 'ROT' }),
    result({ positionId: 3, name: 'Broadcom', signal: 'ROT' }),
    result({ positionId: 4, name: 'Ohne Analyse Rot', signal: 'ROT' }),
    result({ positionId: 5, name: 'Ohne Analyse Gelb', signal: 'GELB' }),
    result({ positionId: 6, name: 'Ohne Analyse Grün', signal: 'GRUEN' }),
  ];
  const analysen = [
    analyse({ id: 10, positionId: 1, grundlage: 'intakt' }),
    analyse({ id: 11, positionId: 2, grundlage: 'verschlechtert', trendAtAnalysis: 'ROT' }),
    analyse({ id: 12, positionId: 3, grundlage: 'intakt', trendAtAnalysis: 'ROT' }),
  ];
  const out = buildAuswertung(results, analysen, now);

  it('sortiert nach Stufe, dann nach Name', () => {
    expect(out.rows.map((r) => r.result.name)).toEqual(['Bilfinger', 'Broadcom', 'Ruhig AG']);
    expect(out.rows.map((r) => r.einordnung.stufe)).toEqual([1, 3, 5]);
  });
  it('führt Alter und Veraltet-Status je Zeile', () => {
    expect(out.rows[0].age).toBe('gestern');
    expect(out.rows[0].stale.stale).toBe(false);
  });
  it('listet nur Gelb/Rot ohne Analyse als "noch nicht ausgewertet", Rot zuerst', () => {
    expect(out.notAnalysed.map((r) => r.name)).toEqual(['Ohne Analyse Rot', 'Ohne Analyse Gelb']);
  });
  it('Zusammenfassung mit Zählern', () => {
    expect(summaryLine(out.rows, out.notAnalysed.length)).toBe('1 dringend · 1 kein neues Geld · 1 ruhig · 2 noch nicht ausgewertet');
  });
  it('Zusammenfassung ohne Analysen', () => {
    expect(summaryLine([], 0)).toBe('Noch keine Analyse gespeichert');
  });
});
