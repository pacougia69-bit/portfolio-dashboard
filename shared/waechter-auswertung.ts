/**
 * Auswertung der Waechter-Analysen: Beurteilungsblock (Format fuer die KI), Erkennung der KI-Antwort,
 * regelbasierte Einordnung, Sortierung, Veraltet-Regel. Reine Logik ohne Datenbank und Netzwerk.
 * KEINE Kauf-/Verkaufsempfehlung: die Einordnung sind Handlungsstufen wie im Waechter.
 */
import { isThemenwette, type TrendSignal, type WaechterResultRow } from './waechter';

export type Grundlage = 'intakt' | 'verschlechtert' | 'unklar';
export type Datenlage = 'gut' | 'widerspruechlich' | 'duenn';

export const GRUNDLAGEN: readonly Grundlage[] = ['intakt', 'verschlechtert', 'unklar'];
export const DATENLAGEN: readonly Datenlage[] = ['gut', 'widerspruechlich', 'duenn'];
export const DATENLAGE_TEXT: Record<Datenlage, string> = { gut: 'gut', widerspruechlich: 'widersprüchlich', duenn: 'dünn' };
export const TREND_LABEL: Record<TrendSignal, string> = { GRUEN: 'Grün', GELB: 'Gelb', ROT: 'Rot', KEINE_DATEN: 'ohne Daten' };

export const ANALYSE_STALE_DAYS = 30;
export const ANALYSE_RAW_MAX = 60000;

/** Textblock am Ende des KI-Prompts. Prompt und Erkennung nutzen dieselbe Quelle. */
export const BEURTEILUNGS_BLOCK_LINES = [
  'Schließe deine Antwort mit genau diesem Block ab (jede Zeile ein Feld, nur die angegebenen Wörter):',
  'BEURTEILUNG',
  'GRUNDLAGE: intakt | verschlechtert | unklar',
  'DATENLAGE: gut | widersprüchlich | dünn',
  'BEGRÜNDUNG: höchstens 3 Sätze',
  'OFFEN: was du nicht prüfen konntest (oder: nichts)',
  'Bedeutung: GRUNDLAGE = trägt die Anlagegrundlage (bei ETFs Aufbau, Kosten, Index, Thema; bei Aktien Geschäft und Zahlen)? ' +
    '"verschlechtert" nur bei belegten Tatsachen (z. B. Prognose gesenkt, Kosten erhöht, Fonds geschlossen), nicht wegen Kursverlusten. ' +
    'DATENLAGE = wie belastbar sind deine Quellen ("widersprüchlich", wenn sie nicht zusammenpassen)?',
] as const;

export interface Beurteilung {
  grundlage: Grundlage | null;
  datenlage: Datenlage | null;
  begruendung: string;
  offen: string;
}

type FieldKey = 'GRUNDLAGE' | 'DATENLAGE' | 'BEGRUENDUNG' | 'OFFEN';

const HEADER_RE = /^\s*(?:#+\s*)?[*_`]*\s*BEURTEILUNG\s*[*_`]*\s*:?\s*$/i;
const FIELD_RE = /^\s*(?:[-*•>]+\s*)?(?:#+\s*)?[*_`]*\s*(GRUNDLAGE|DATENLAGE|BEGR(?:Ü|UE|U)NDUNG|OFFEN)\s*[*_`]*\s*[:\-–—]\s*(.*)$/i;

const clean = (s: string) => s.replace(/^[\s*_`]+|[\s*_`]+$/g, '');

function normalizeKey(raw: string): FieldKey {
  const k = raw.toUpperCase();
  return k.startsWith('BEGR') ? 'BEGRUENDUNG' : (k as FieldKey);
}

/** Waehlt aus mehreren Kandidaten den, dessen Muster im Text am WEITESTEN VORNE steht. */
function pickFirst<T extends string>(value: string, candidates: [T, RegExp][]): T | null {
  const v = value.toLowerCase();
  let best: { key: T; index: number } | null = null;
  for (const [key, re] of candidates) {
    const m = re.exec(v);
    if (m && (best === null || m.index < best.index)) best = { key, index: m.index };
  }
  return best ? best.key : null;
}

function mapGrundlage(v: string): Grundlage | null {
  if (v.includes('|')) return null; // KI hat nur die Optionen abgeschrieben
  return pickFirst<Grundlage>(v, [
    ['verschlechtert', /verschlechter|schlechter|gef[äa]hrdet|beeintr[äa]chtigt/],
    ['intakt', /intakt|unver[äa]ndert|solide|stabil|tragf[äa]hig|\bok\b/],
    ['unklar', /unklar|unsicher|offen|nicht beurteilbar/],
  ]);
}

function mapDatenlage(v: string): Datenlage | null {
  if (v.includes('|')) return null;
  return pickFirst<Datenlage>(v, [
    ['widerspruechlich', /widerspr[üu]e?chlich|uneinheitlich|inkonsistent|abweichend/],
    ['gut', /\bgut\b|belastbar|verl[äa]sslich|solide/],
    ['duenn', /d[üu]e?nn|l[üu]ckenhaft|schwach|d[üu]rftig|begrenzt/],
  ]);
}

/**
 * Liest den Beurteilungsblock aus einer KI-Antwort. Wirft nie; nicht erkennbare Felder bleiben leer (null bzw. '').
 * Ab der LETZTEN Ueberschrift "BEURTEILUNG" wird gelesen (die KI kann die Anweisung vorher zitieren).
 */
export function parseBeurteilung(text: string): Beurteilung {
  const lines = text.replace(/\r/g, '').split('\n');
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (HEADER_RE.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  const found: Partial<Record<FieldKey, string[]>> = {};
  let current: FieldKey | null = null;
  for (const line of lines.slice(start)) {
    const m = FIELD_RE.exec(line);
    if (m) {
      current = normalizeKey(m[1]);
      found[current] = [clean(m[2])];
    } else if (line.trim() === '') {
      current = null;
    } else if (current === 'BEGRUENDUNG' || current === 'OFFEN') {
      found[current]!.push(clean(line));
    }
  }
  const text1 = (k: FieldKey, max: number) => (found[k] ?? []).filter(Boolean).join(' ').trim().slice(0, max);
  return {
    grundlage: mapGrundlage(found.GRUNDLAGE?.[0] ?? ''),
    datenlage: mapDatenlage(found.DATENLAGE?.[0] ?? ''),
    begruendung: text1('BEGRUENDUNG', 1000),
    offen: text1('OFFEN', 500),
  };
}

export type Stufe = 1 | 2 | 3 | 4 | 5;
export const STUFE_LABEL: Record<Stufe, string> = { 1: 'dringend', 2: 'selbst prüfen', 3: 'kein neues Geld', 4: 'beobachten', 5: 'ruhig' };

export interface Einordnung {
  stufe: Stufe;
  text: string;
  grund: string | null;
}

/** Regelbasierte Einordnung, die erste zutreffende Zeile gilt. Nie eine Kauf-/Verkaufsempfehlung. */
export function deriveEinordnung(i: { trend: TrendSignal; grundlage: Grundlage; datenlage: Datenlage; wkn: string | null }): Einordnung {
  const regel = i.trend === 'ROT' && isThemenwette(i.wkn) ? 'Deine Regel: ROT → halbieren.' : null;

  if (i.grundlage === 'verschlechtert') {
    return { stufe: 1, text: 'Selbst prüfen – dringend', grund: ['Grundlage verschlechtert', regel].filter(Boolean).join(' · ') };
  }
  const gruende: string[] = [];
  if (i.grundlage === 'unklar') gruende.push('Grundlage unklar');
  if (i.datenlage === 'widerspruechlich') gruende.push('Daten widersprüchlich');
  if (i.datenlage === 'duenn') gruende.push('Daten dünn');
  if (i.trend === 'KEINE_DATEN') gruende.push('Trend fehlt');
  if (regel) gruende.push(regel);
  if (gruende.length > 0) return { stufe: 2, text: 'Selbst prüfen', grund: gruende.join(' · ') };

  if (i.trend === 'ROT') return { stufe: 3, text: 'Kein neues Geld, beobachten', grund: null };
  if (i.trend === 'GELB') return { stufe: 4, text: 'Beobachten', grund: null };
  return { stufe: 5, text: 'Ruhig', grund: null };
}

/** Veraltet: aelter als ANALYSE_STALE_DAYS Tage oder Trendfarbe seit der Analyse gewechselt. */
export function analysisStale(
  a: { createdAt: string; trendAtAnalysis: TrendSignal },
  currentTrend: TrendSignal,
  now: Date = new Date(),
): { stale: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const days = Math.floor((now.getTime() - new Date(a.createdAt).getTime()) / 86_400_000);
  if (days > ANALYSE_STALE_DAYS) reasons.push(`älter als ${ANALYSE_STALE_DAYS} Tage`);
  if (a.trendAtAnalysis !== 'KEINE_DATEN' && currentTrend !== 'KEINE_DATEN' && a.trendAtAnalysis !== currentTrend) {
    reasons.push(`Trend damals: ${TREND_LABEL[a.trendAtAnalysis]}, jetzt: ${TREND_LABEL[currentTrend]}`);
  }
  return { stale: reasons.length > 0, reasons };
}

export function describeAge(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

export interface AnalyseRow {
  id: number;
  positionId: number;
  kiName: string | null;
  grundlage: Grundlage;
  datenlage: Datenlage;
  begruendung: string;
  offen: string;
  rawText: string;
  trendAtAnalysis: TrendSignal;
  priceAtAnalysis: number | null;
  createdAt: string; // ISO
}

export interface AuswertungRow {
  analyse: AnalyseRow;
  result: WaechterResultRow;
  einordnung: Einordnung;
  stale: { stale: boolean; reasons: string[] };
  age: string;
}

/** Verbindet die neueste Analyse je Position mit dem AKTUELLEN Wächter-Ergebnis und sortiert nach Dringlichkeit. */
export function buildAuswertung(
  results: WaechterResultRow[],
  analysen: AnalyseRow[],
  now: Date = new Date(),
): { rows: AuswertungRow[]; notAnalysed: WaechterResultRow[] } {
  const byPosition = new Map(analysen.map((a) => [a.positionId, a]));
  const rows: AuswertungRow[] = [];
  const notAnalysed: WaechterResultRow[] = [];
  for (const r of results) {
    const a = byPosition.get(r.positionId);
    if (a) {
      rows.push({
        analyse: a,
        result: r,
        einordnung: deriveEinordnung({ trend: r.signal, grundlage: a.grundlage, datenlage: a.datenlage, wkn: r.wkn }),
        stale: analysisStale(a, r.signal, now),
        age: describeAge(a.createdAt, now),
      });
    } else if (r.signal === 'GELB' || r.signal === 'ROT') {
      notAnalysed.push(r);
    }
  }
  rows.sort((x, y) => x.einordnung.stufe - y.einordnung.stufe || x.result.name.localeCompare(y.result.name, 'de'));
  notAnalysed.sort((x, y) => (x.signal === y.signal ? x.name.localeCompare(y.name, 'de') : x.signal === 'ROT' ? -1 : 1));
  return { rows, notAnalysed };
}

/** Kopfzeile der Auswertung, z. B. "1 dringend · 1 selbst prüfen · 3 noch nicht ausgewertet". */
export function summaryLine(rows: { einordnung: { stufe: Stufe } }[], notAnalysedCount: number): string {
  const parts: string[] = [];
  for (const s of [1, 2, 3, 4, 5] as Stufe[]) {
    const n = rows.filter((r) => r.einordnung.stufe === s).length;
    if (n > 0) parts.push(`${n} ${STUFE_LABEL[s]}`);
  }
  if (notAnalysedCount > 0) parts.push(`${notAnalysedCount} noch nicht ausgewertet`);
  return parts.length > 0 ? parts.join(' · ') : 'Noch keine Analyse gespeichert';
}
