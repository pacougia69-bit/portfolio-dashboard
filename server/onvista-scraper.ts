/**
 * Scraper fuer einzelne onvista-Knock-Out-/Optionsschein-Produktseiten (per WKN).
 *
 * Es gibt keine offizielle API fuer diese Kurse. Portiert 1:1 die Logik aus
 * `parse_snapshot_detail`/`fetch_product_detail` im Hebel-Screener-Projekt
 * (PROJEKTE/hebel-screener/src/onvista_scraper.py) nach TypeScript, weil das
 * Musterdepot Hebelprodukte per WKN statt per Ticker preisen muss (Twelve
 * Data/Yahoo liefern dafuer keine Kurse). Bricht bei Struktur-Aenderungen der
 * Seite kontrolliert ab (null), statt zu crashen.
 */

const NEXT_DATA_PATTERN = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export interface OnvistaProductDetail {
  wkn: string;
  isin: string;
  name: string;
  issuer: string;
  direction: "CALL" | "PUT";
  gearing: number | null;
  koPufferPct: number | null;
  koThreshold: number | null;
  spreadPct: number | null;
  bid: number | null;
  ask: number | null;
  openEnded: boolean | null;
  url: string | null;
}

export function parseSnapshotDetail(html: string): OnvistaProductDetail | null {
  const match = NEXT_DATA_PATTERN.exec(html);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const snap = data.props.pageProps.data.snapshot;
    const instrument = snap.instrument;
    const issuer = snap.derivativesIssuer;
    const details = snap.derivativesDetails;
    const figure = snap.derivativesFigure;
    const direction = details.nameExerciseRight as "CALL" | "PUT";

    const priceUnderlying = figure.priceUnderlyingCalculation ?? null;
    const diffKnockout = figure.differenceKnockout ?? null;
    let koThreshold: number | null = null;
    if (priceUnderlying !== null && diffKnockout !== null) {
      koThreshold =
        direction === "CALL" ? priceUnderlying - diffKnockout : priceUnderlying + diffKnockout;
    }

    return {
      wkn: instrument.wkn,
      isin: instrument.isin,
      name: instrument.name,
      issuer: issuer.name,
      direction,
      gearing: figure.gearingAsk ?? null,
      koPufferPct: figure.differenceKnockoutPct ?? null,
      koThreshold,
      spreadPct: figure.spreadAskPct ?? null,
      bid: figure.bidPriceCalculation ?? null,
      ask: figure.askPriceCalculation ?? null,
      openEnded: details.openEnded ?? null,
      url: instrument.urls?.WEBSITE ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchOnvistaProductDetail(wkn: string): Promise<OnvistaProductDetail | null> {
  const url = `https://www.onvista.de/suche/?searchValue=${encodeURIComponent(wkn)}`;
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return null;
    const html = await response.text();
    return parseSnapshotDetail(html);
  } catch (error) {
    console.warn(`[onvista-scraper] Fehler beim Abruf von WKN ${wkn}:`, error);
    return null;
  }
}
