/**
 * Ausstiegs-Prüfung: Realitätscheck für die Marken der Kaufkarte.
 * Frage: Wie oft wäre zuerst der Gewinn-Ausstieg, wie oft zuerst der Verlust-Ausstieg erreicht worden,
 * wie oft keins von beiden? Reine Rechnung auf Tagesschlusskursen, kein Kauf-/Verkaufssignal, keine Prognose.
 *
 * Zwei Rechnungen, je mit und ohne den Trend der Vergangenheit:
 *  A) Simulation: Block-Bootstrap aus echten Tagesrenditen.
 *  B) Echter Rücklauf: Einstieg an jedem früheren Tag, was trat zuerst ein? (Starttage überlappen sich.)
 * Die Marken sind Prozent vom Startkurs, deshalb spielt die Währung keine Rolle.
 * (Gleiche Methode wie `Anlage-Regeln/ausstiegs-pruefung/ausstieg.py`.)
 */

export type Ausgang = 'target' | 'stop' | 'none';
export type Zaehlung = Record<Ausgang, number>;

export const TAGE_PRO_MONAT = 21;
export const MIN_RENDITEN = 250;
export const PRUEF_REPLAYS = 10000;
export const PRUEF_BLOCK = 10;
export const PRUEF_SEED = 19;
export const MAX_MONATE = 84;

export interface Marken {
  /** Verlust-Ausstieg in Prozent vom Startkurs, negativ (z. B. -40). */
  verlustPct: number;
  /** Gewinn-Ausstieg in Prozent vom Startkurs, positiv (z. B. 50). null = kein fester Gewinn-Ausstieg. */
  gewinnPct: number | null;
  monate: number;
}

/** Gibt einen deutschen Fehlertext zurück, wenn die Marken nicht passen, sonst null. */
export function pruefeMarken(m: Marken): string | null {
  if (!Number.isFinite(m.verlustPct) || m.verlustPct >= 0 || m.verlustPct <= -95) {
    return 'Der Verlust-Ausstieg muss zwischen −1 % und −95 % liegen.';
  }
  if (m.gewinnPct !== null && (!Number.isFinite(m.gewinnPct) || m.gewinnPct <= 0 || m.gewinnPct > 1000)) {
    return 'Der Gewinn-Ausstieg muss größer als 0 % sein (oder leer bleiben).';
  }
  if (!Number.isInteger(m.monate) || m.monate < 1 || m.monate > MAX_MONATE) {
    return `Der Zeitraum muss zwischen 1 und ${MAX_MONATE} Monaten liegen.`;
  }
  return null;
}

/** Kleiner, seed-fähiger Zufallsgenerator (gleiche Zahlen bei gleichem Startwert). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tägliche Log-Renditen aus Schlusskursen (älteste zuerst). */
export function logRenditen(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

/**
 * Block-Bootstrap: zieht zusammenhängende Blöcke echter Tagesrenditen, bis der Zeitraum voll ist.
 * Prüft nur den Tagesschluss. Gibt die Zählung und die Endkurse (als Vielfaches des Startkurses) zurück.
 */
export function simuliere(
  rend: number[],
  horizont: number,
  verlustLog: number,
  gewinnLog: number,
  replays: number,
  block: number,
  rand: () => number,
): { zaehlung: Zaehlung; enden: number[] } {
  const n = rend.length;
  const zaehlung: Zaehlung = { target: 0, stop: 0, none: 0 };
  const enden: number[] = new Array(replays);
  for (let p = 0; p < replays; p++) {
    let summe = 0;
    let treffer: Ausgang = 'none';
    let hit = false;
    let k = 0;
    while (k < horizont) {
      const start = Math.floor(rand() * (n - block + 1));
      for (let j = 0; j < block && k < horizont; j++) {
        summe += rend[start + j];
        k++;
        if (!hit) {
          if (summe <= verlustLog) {
            treffer = 'stop';
            hit = true;
          } else if (summe >= gewinnLog) {
            treffer = 'target';
            hit = true;
          }
        }
      }
    }
    zaehlung[treffer]++;
    enden[p] = Math.exp(summe);
  }
  return { zaehlung, enden };
}

/** Echter Rücklauf auf den Schlusskursen (älteste zuerst). null, wenn zu wenig Geschichte. */
export function ruecklauf(
  closes: number[],
  horizont: number,
  verlustRatio: number,
  gewinnRatio: number,
): { zaehlung: Zaehlung; starts: number } | null {
  const starts = closes.length - 1 - horizont;
  if (starts < 20) return null;
  const zaehlung: Zaehlung = { target: 0, stop: 0, none: 0 };
  for (let i = 0; i <= starts; i++) {
    const basis = closes[i];
    let treffer: Ausgang = 'none';
    for (let k = 1; k <= horizont; k++) {
      const rel = closes[i + k] / basis;
      if (rel <= verlustRatio) {
        treffer = 'stop';
        break;
      }
      if (rel >= gewinnRatio) {
        treffer = 'target';
        break;
      }
    }
    zaehlung[treffer]++;
  }
  return { zaehlung, starts: starts + 1 };
}

/** Index-basiertes Perzentil, q zwischen 0 und 1. */
export function perzentil(sortiert: number[], q: number): number {
  return sortiert[Math.min(sortiert.length - 1, Math.floor(q * sortiert.length))];
}

export const prozentVon = (teil: number, summe: number) => (summe > 0 ? (100 * teil) / summe : 0);
export const summeZaehlung = (z: Zaehlung) => z.target + z.stop + z.none;

/** Neutraler Text: Anteil "Gewinn zuerst" unter den eindeutigen Treffern gegen den Break-even. Kein Signal. */
export function einordnungText(z: Zaehlung, breakEvenPct: number | null): string {
  const t = z.target;
  const s = z.stop;
  if (breakEvenPct === null) {
    const n = summeZaehlung(z);
    return `Verlust-Marke wurde in ${prozentVon(s, n).toFixed(0)} % der Fälle erreicht (Gewinn-Marke nicht gesetzt).`;
  }
  if (t + s === 0) return 'Weder Gewinn- noch Verlust-Ausstieg wurde je erreicht.';
  const anteil = (100 * t) / (t + s);
  const diff = anteil - breakEvenPct;
  let wort: string;
  if (Math.abs(diff) < 5) wort = 'nahe am Break-even (Münzwurf-Bereich)';
  else if (diff > 0) wort = 'über dem Break-even' + (diff >= 15 ? ' (deutlich)' : ' (leicht)');
  else wort = 'unter dem Break-even' + (diff <= -15 ? ' (deutlich)' : ' (leicht)');
  return `Von den eindeutigen Treffern war der Gewinn-Ausstieg ${anteil.toFixed(0)} % zuerst; Break-even bei diesem Verhältnis ${breakEvenPct.toFixed(0)} %. Ergebnis: ${wort}.`;
}

export interface Perzentile {
  p05: number;
  p50: number;
  p95: number;
}

export interface PruefErgebnis {
  horizontTage: number;
  datenTage: number;
  trendProJahrPct: number;
  /** Gewinn-Marke zu Verlust-Marke, z. B. 1,5 = Gewinn-Spanne ist 1,5-mal die Verlust-Spanne. null ohne Gewinn-Marke. */
  verhaeltnis: number | null;
  breakEvenPct: number | null;
  simMitTrend: Zaehlung;
  simOhneTrend: Zaehlung;
  /** Endkurse als Vielfaches des Startkurses. */
  endeMitTrend: Perzentile;
  endeOhneTrend: Perzentile;
  ruecklauf: { zaehlung: Zaehlung; starts: number } | null;
  einordnung: { simMitTrend: string; simOhneTrend: string; ruecklauf: string | null };
  hinweise: string[];
}

function perzentile(enden: number[]): Perzentile {
  const s = [...enden].sort((a, b) => a - b);
  return { p05: perzentil(s, 0.05), p50: perzentil(s, 0.5), p95: perzentil(s, 0.95) };
}

/**
 * Komplette Auswertung. closes = Tagesschlusskurse, älteste zuerst.
 * Wirft einen Error mit deutschem Text bei ungültigen Marken oder zu wenig Geschichte.
 */
export function pruefeAusstieg(
  closes: number[],
  marken: Marken,
  opt: { replays?: number; block?: number; seed?: number } = {},
): PruefErgebnis {
  const fehler = pruefeMarken(marken);
  if (fehler) throw new Error(fehler);
  const gueltig = closes.filter((c) => Number.isFinite(c) && c > 0);
  if (gueltig.length - 1 < MIN_RENDITEN) {
    throw new Error(`Zu wenig Geschichte (${gueltig.length} Kurse). Mindestens ${MIN_RENDITEN + 1} Handelstage nötig.`);
  }
  const replays = opt.replays ?? PRUEF_REPLAYS;
  const block = opt.block ?? PRUEF_BLOCK;
  const seed = opt.seed ?? PRUEF_SEED;

  const horizont = marken.monate * TAGE_PRO_MONAT;
  const verlustRatio = 1 + marken.verlustPct / 100;
  const gewinnRatio = marken.gewinnPct === null ? Infinity : 1 + marken.gewinnPct / 100;
  const verlustLog = Math.log(verlustRatio);
  const gewinnLog = marken.gewinnPct === null ? Infinity : Math.log(gewinnRatio);

  const rend = logRenditen(gueltig);
  const mittel = rend.reduce((a, b) => a + b, 0) / rend.length;
  const ohneTrend = rend.map((r) => r - mittel);
  const rand = mulberry32(seed);
  const mit = simuliere(rend, horizont, verlustLog, gewinnLog, replays, block, rand);
  const ohne = simuliere(ohneTrend, horizont, verlustLog, gewinnLog, replays, block, rand);
  const rl = ruecklauf(gueltig, horizont, verlustRatio, gewinnRatio);

  const verhaeltnis = marken.gewinnPct === null ? null : marken.gewinnPct / -marken.verlustPct;
  const breakEvenPct = verhaeltnis === null ? null : 100 / (1 + verhaeltnis);

  const hinweise: string[] = [];
  const nMit = summeZaehlung(mit.zaehlung);
  const nichts = prozentVon(mit.zaehlung.none, nMit);
  if (marken.gewinnPct !== null && nichts > 40) {
    hinweise.push(`In ${nichts.toFixed(0)} % der Verläufe wird keine Marke erreicht: die Marken liegen weit auseinander oder der Zeitraum ist kurz.`);
  }
  if (rl) {
    const abw = Math.abs(prozentVon(mit.zaehlung.target, nMit) - prozentVon(rl.zaehlung.target, summeZaehlung(rl.zaehlung)));
    if (abw > 15) {
      hinweise.push(`Simulation und echte Geschichte weichen beim Gewinn-zuerst-Anteil um ${abw.toFixed(0)} Prozentpunkte ab.`);
    }
  } else {
    hinweise.push('Für diesen Zeitraum gibt es zu wenig echte Geschichte für den Rücklauf (weniger als 20 Starttage).');
  }
  if (gueltig.length < 3 * 252) {
    hinweise.push(`Nur ${gueltig.length} Handelstage Geschichte (unter 3 Jahren): geringe Aussagekraft.`);
  }
  const trendProJahrPct = (Math.exp(mittel * 252) - 1) * 100;
  if (trendProJahrPct > 15) {
    hinweise.push(
      `Die Daten enthalten einen starken Aufwärtstrend (${trendProJahrPct.toFixed(0)} % pro Jahr). Die Zahlen "ohne Trend" sind die nüchterne Variante.`,
    );
  }

  return {
    horizontTage: horizont,
    datenTage: gueltig.length,
    trendProJahrPct,
    verhaeltnis,
    breakEvenPct,
    simMitTrend: mit.zaehlung,
    simOhneTrend: ohne.zaehlung,
    endeMitTrend: perzentile(mit.enden),
    endeOhneTrend: perzentile(ohne.enden),
    ruecklauf: rl,
    einordnung: {
      simMitTrend: einordnungText(mit.zaehlung, breakEvenPct),
      simOhneTrend: einordnungText(ohne.zaehlung, breakEvenPct),
      ruecklauf: rl ? einordnungText(rl.zaehlung, breakEvenPct) : null,
    },
    hinweise,
  };
}

/** Yahoo-Antwort (chart, interval=1d) -> Tagesschlusskurse, ÄLTESTE ZUERST. Lücken (null) und Kurse <= 0 fallen weg. */
export function parseYahooSchlusskurse(data: any): { closes: number[]; currency: string | null } | { error: string } {
  const result = data?.chart?.result?.[0];
  if (!result) {
    const desc = data?.chart?.error?.description;
    return { error: `Yahoo: ${desc ? String(desc).slice(0, 140) : 'Keine Daten'}` };
  }
  const raw: unknown = result?.indicators?.quote?.[0]?.close;
  const arr: unknown[] = Array.isArray(raw) ? raw : [];
  const closes = arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (closes.length === 0) return { error: 'Yahoo: keine Kursdaten' };
  const currency = typeof result?.meta?.currency === 'string' ? result.meta.currency : null;
  return { closes, currency };
}

/** Abstand eines aktuellen Kurses zur gespeicherten Verlust-Marke in Prozent (negativ = unter der Marke). */
export function abstandZurMarke(aktuell: number, basisKurs: number, verlustPct: number): { markeKurs: number; abstandPct: number } | null {
  if (!(aktuell > 0) || !(basisKurs > 0) || !Number.isFinite(verlustPct)) return null;
  const markeKurs = basisKurs * (1 + verlustPct / 100);
  return { markeKurs, abstandPct: (aktuell / markeKurs - 1) * 100 };
}
