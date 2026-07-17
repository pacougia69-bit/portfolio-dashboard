import { invokeLLM } from "./_core/llm";
import { updatePriceCache, saveAiAnalysis } from "./db";
import { getEurUsdRate } from "./currency";

// Known ticker mappings from German/European to Twelve Data symbols
// Format: 'source ticker' → 'SYMBOL' (US) or 'SYMBOL:EXCHANGE' (non-US)
const TICKER_MAPPINGS: Record<string, string> = {
  // === US-Aktien (Frankfurt .F → US) ===
  'AMZ.F': 'AMZN',
  'ABEA.F': 'GOOGL',
  'AMD.F': 'AMD',
  'NVDA.F': 'NVDA',
  'MSFT.F': 'MSFT',
  'AAPL.F': 'AAPL',
  'META.F': 'META',
  'TSLA.F': 'TSLA',
  'NFLX.F': 'NFLX',

  // === Biotech (Frankfurt .F → US) ===
  '0OT.F': 'OCUL',
  'A83.F': 'APGE',
  '7CY.F': 'CTMX',
  'IFX.F': 'IFRX',
  '1SP1.F': 'SPRO',
  'O8V.F': 'OVID',
  'N9C.F': 'NXTC',
  '49B.F': 'MYNZ',
  '78A.F': 'ATHA',
  'C1M.F': 'CRDF',

  // === Sonstige US (Frankfurt .F → US) ===
  'P2S.F': 'PSN',
  'MIG.F': 'MSTR',
  'V7B.F': 'ASMB',

  // === Berlin .BE → US (Rafaels Bestand laeuft teils ueber Berlin) ===
  'V7B.BE': 'ASMB',
  '0OT.BE': 'OCUL',
  '59P.BE': 'PSN',
  'IF0.BE': 'IFRX',
  'O8V.BE': 'OVID',
  'BY6.BE': 'BYDDY',

  // === Ampel-Eintraege 08.07.2026 (Xetra-Schreibweisen → US-Zwilling, Free-Plan kann nur US-Boersen) ===
  'GBF:XETR': 'BFLBY',
  'GBF.DE': 'BFLBY',
  '59P:XETR': 'PSN',
  '59P.DE': 'PSN',
  'BY6:DE': 'BYDDY',
  'BY6.DE': 'BYDDY',

  // === US-Aktien (Xetra .DE → US, direkter als XETR-Umweg) ===
  'AMZ.DE': 'AMZN',
  'ABEA.DE': 'GOOGL',
  'AMD.DE': 'AMD',

  // === US-Aktien (bereits US-Ticker) ===
  'ASMB': 'ASMB',
  'ORKA': 'ORKA',
  'CTMX': 'CTMX',
  'SPRO': 'SPRO',
  'OCUL': 'OCUL',
  'IFRX': 'IFRX',
  'MSTR': 'MSTR',
  'PSN': 'PSN',
  'GOOGL': 'GOOGL',
  'AMZN': 'AMZN',
  'AMD': 'AMD',
  'AAPL': 'AAPL',
  'MSFT': 'MSFT',
  'NVDA': 'NVDA',
  'META': 'META',
  'TSLA': 'TSLA',
  'NFLX': 'NFLX',

  // === Deutsche Aktien (Xetra → XETR oder US-ADR) ===
  'SAP.DE': 'SAP',
  'DTE.DE': 'DTE:XETR',
  'DPW.DE': 'DPW:XETR',
  'ALV.DE': 'ALV:XETR',
  'DBK.DE': 'DB',
  'BMW.DE': 'BMW:XETR',
  'DAI.DE': 'MBG:XETR',
  'VOW3.DE': 'VOW3:XETR',

  // === Hongkong (Free-Plan hat kein HKEX → US-ADR) ===
  '1211.HK': 'BYDDY',

  // === Kanada ===
  'TAU.V': 'TAU:TSXV',

  // === Amsterdam ===
  'GLPG.AS': 'GLPG',
  'IWDA.AS': 'URTH',

  // === Crypto ETPs (Swiss → Crypto-Paare) ===
  'CBTC.SW': 'BTC/USD',
  'ETHC.SW': 'ETH/USD',
  'AXRP.SW': 'XRP/USD',
  'SOLW.SW': 'SOL/USD',
  'HBAR-USD': 'HBAR/USD',

  // === ETFs (Deutsche Xetra → US-Äquivalente) ===
  'EUNL.DE': 'URTH',
  'VWCE.DE': 'VT',
  'IUSN.DE': 'SCHA',
  'IS3N.DE': 'EEM',
  'VFEM.DE': 'VWO',
  'EXXT.DE': 'QQQ',
  // XAIX = AI & Big Data Mega-Caps (Nvidia/Meta/Alphabet) → AIQ ist der passende Zwilling.
  // BOTZ (Robotik) war ein schlechter Proxy und hat am 08.07.2026 ein falsches ROT ausgeloest.
  'XAIX.DE': 'AIQ',
  'XDWH.DE': 'IXJ',
  'CBUX.DE': 'IGF',
  // AIFS = AI Infrastructure → AIQ wie XAIX (SMH waere praeziser, ist aber erst ab
  // Twelve-Data-Grow-Plan verfuegbar; AIQ funktioniert nachweislich im Free-Plan).
  // Beide KI-ETFs teilen damit denselben Zwilling = identisches Ampel-Signal — passt,
  // weil die Kill-Regel ohnehin beide gemeinsam halbiert (eine Wette, zwei Verpackungen).
  'AIFS.DE': 'AIQ',
  'IQQH.DE': 'ICLN',
  'NUCL.DE': 'URA',
  'NATO.DE': 'ITA',
  'ASWC.DE': 'ITA',
  'FWRG.DE': 'VT',
  'AGGH.DE': 'BNDW',
  '30IA.DE': 'LQD',
  '4GLD.DE': 'GLD',
  'EUWAX.DE': 'GLD',
  'IQQ6.DE': 'REET',
  'IUSM.DE': 'IEF',
  'IBCI.DE': 'TIP',
  'IUSU.DE': 'SHY',
  'IUST.DE': 'IEI',
};

// Diese Tickers sind bei Twelve Data nur ueber einen ANDEREN Fonds/Titel als
// Naeherung abgebildet (siehe TICKER_MAPPINGS oben) - fuer den Ampel-Trend
// (steigt/faellt) reicht das, aber der absolute Kurs gehoert NICHT als
// Depot-Kurs gespeichert (anderer Anbieter/andere ADR-Quote = anderer NAV).
// fetchLivePricesTwelveData ueberspringt diese Ticker bewusst; die Depot-Kurse
// dafuer kommen stattdessen ueber Yahoo Finance mit dem echten Ticker (siehe
// prices.fetchTwelveData in routers.ts).
const PROXY_ONLY_TICKERS = new Set<string>([
  // ADRs mit unklarem/vermutlich abweichendem Umtauschverhaeltnis zur Stammaktie
  'GBF.DE', 'GBF:XETR', 'BY6.BE', 'BY6:DE', 'BY6.DE', '1211.HK', 'SAP.DE', 'DBK.DE', 'GLPG.AS',
  // ETFs/Fonds - anderer Anbieter, andere Kursbasis, nur als Ampel-Trend-Naeherung gedacht
  'EUNL.DE', 'VWCE.DE', 'IUSN.DE', 'IS3N.DE', 'VFEM.DE', 'EXXT.DE', 'XAIX.DE', 'XDWH.DE', 'CBUX.DE',
  'AIFS.DE', 'IQQH.DE', 'NUCL.DE', 'NATO.DE', 'ASWC.DE', 'FWRG.DE', 'AGGH.DE', '30IA.DE', '4GLD.DE',
  'EUWAX.DE', 'IQQ6.DE', 'IUSM.DE', 'IBCI.DE', 'IUSU.DE', 'IUST.DE', 'IWDA.AS',
  // Krypto-ETPs - Kurs des Wertpapiers ist NICHT der rohe Kryptowaehrungspreis
  'CBTC.SW', 'ETHC.SW', 'AXRP.SW', 'SOLW.SW', 'HBAR-USD',
]);

// Convert ticker to Twelve Data format
export function convertTickerForTwelveData(ticker: string): { symbol: string; exchange?: string; isCrypto?: boolean } {
  const mapped = TICKER_MAPPINGS[ticker];
  if (mapped) {
    if (mapped.includes('/USD')) {
      return { symbol: mapped, isCrypto: true };
    }
    if (mapped.includes(':')) {
      const [symbol, exchange] = mapped.split(':');
      return { symbol, exchange };
    }
    return { symbol: mapped };
  }

  if (ticker.endsWith('.F')) {
    return { symbol: ticker.replace('.F', '') };
  }
  if (ticker.endsWith('.DE')) {
    return { symbol: ticker.replace('.DE', ''), exchange: 'XETR' };
  }
  if (ticker.endsWith('.HK')) {
    return { symbol: ticker.replace('.HK', ''), exchange: 'HKEX' };
  }
  if (ticker.endsWith('.V')) {
    return { symbol: ticker.replace('.V', ''), exchange: 'TSXV' };
  }

  return { symbol: ticker };
}

// Free-Plan-Limit: 8 API-Credits/Minute. Der Aufrufer (Client) schickt hoechstens
// so viele Ticker pro Aufruf und pausiert selbst zwischen mehreren Haeppchen -
// dadurch bleibt JEDE einzelne Server-Anfrage kurz (keine Minuten-langen
// Wartezeiten mehr innerhalb einer HTTP-Anfrage, die sonst in einen Browser-
// oder Railway-Timeout laufen koennten).
export const TWELVE_DATA_MAX_TICKERS_PER_CALL = 7;

// Fetch live prices from Twelve Data API - verarbeitet GENAU EINEN Haeppchen
// (keine interne Schleife/Wartezeit mehr, siehe TWELVE_DATA_MAX_TICKERS_PER_CALL)
export async function fetchLivePricesTwelveData(
  tickers: string[],
  apiKey: string
): Promise<{
  results: { ticker: string; price: number; changePercent: number; currency: string; priceEur: number }[];
  skippedAsProxy: string[];
}> {
  const results: { ticker: string; price: number; changePercent: number; currency: string; priceEur: number }[] = [];

  // Ticker, bei denen Twelve Data nur einen ANDEREN Fonds/Titel als Naeherung
  // liefern kann, werden hier gar nicht erst angefragt - der echte Kurs kommt
  // stattdessen ueber Yahoo Finance (Aufrufer kuemmert sich darum).
  const skippedAsProxy = tickers.filter((t) => PROXY_ONLY_TICKERS.has(t));
  const safeTickers = tickers.filter((t) => !PROXY_ONLY_TICKERS.has(t)).slice(0, TWELVE_DATA_MAX_TICKERS_PER_CALL);

  if (!apiKey) {
    console.error("Twelve Data API key not provided");
    return { results, skippedAsProxy };
  }
  if (safeTickers.length === 0) {
    return { results, skippedAsProxy };
  }

  const eurUsdRate = await getEurUsdRate(apiKey);

  const symbolsForApi = safeTickers.map(t => {
    const converted = convertTickerForTwelveData(t);
    return converted.exchange ? `${converted.symbol}:${converted.exchange}` : converted.symbol;
  });

  try {
    console.log(`Fetching prices for: ${symbolsForApi.join(', ')}`);

    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbolsForApi.join(',')}&apikey=${apiKey}`
    );

    if (!response.ok) {
      console.warn(`Twelve Data API error: ${response.status}`);
      return { results, skippedAsProxy };
    }

    const data = await response.json();
    console.log('Twelve Data response:', JSON.stringify(data).substring(0, 500));

    // Handle single vs multiple results
    const quotes = symbolsForApi.length === 1 ? { [symbolsForApi[0]]: data } : data;

    for (let j = 0; j < safeTickers.length; j++) {
      const originalTicker = safeTickers[j];
      const apiSymbol = symbolsForApi[j];
      const quote = quotes[apiSymbol];

      if (quote && !quote.code && quote.close) {
        const price = parseFloat(quote.close);
        const previousClose = parseFloat(quote.previous_close) || price;
        const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
        const currency = quote.currency || 'USD';

        // Umrechnung nach EUR - nur USD ist unterstuetzt. Bei jeder anderen
        // Fremdwaehrung (z.B. CAD, GBP, CHF) den Kurs NICHT uebernehmen,
        // statt den Fremdwaehrungsbetrag faelschlich 1:1 als Euro zu speichern.
        let priceEur: number | null = price;
        if (currency === 'USD') {
          priceEur = price / eurUsdRate;
        } else if (currency !== 'EUR') {
          console.warn(`[Prices] ${originalTicker}: Waehrung ${currency} wird nicht unterstuetzt - Kurs wird NICHT uebernommen (bisheriger Wert bleibt stehen)`);
          priceEur = null;
        }

        if (priceEur === null) {
          continue;
        }

        results.push({
          ticker: originalTicker,
          price,
          changePercent,
          currency,
          priceEur,
        });

        // Update cache with EUR price
        await updatePriceCache(originalTicker, priceEur, changePercent);
      } else if (quote?.code) {
        console.warn(`Twelve Data error for ${originalTicker}: ${quote.message}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching prices from Twelve Data:`, error);
  }

  return { results, skippedAsProxy };
}

// Fallback: Fetch live prices from Yahoo Finance (free, no API key needed)
export async function fetchLivePrices(tickers: string[]): Promise<{ ticker: string; price: number; changePercent: number; currency: string }[]> {
  const results: { ticker: string; price: number; changePercent: number; currency: string }[] = [];
  
  for (const ticker of tickers) {
    try {
      // Use Yahoo Finance API (free)
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (!response.ok) {
        console.warn(`Failed to fetch price for ${ticker}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const quote = data.chart?.result?.[0];
      
      if (quote) {
        const meta = quote.meta;
        const price = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
        const currency = meta.currency || 'USD';
        
        results.push({
          ticker,
          price,
          changePercent,
          currency,
        });
        
        // Update cache
        await updatePriceCache(ticker, price, changePercent);
      }
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error);
    }
  }
  
  return results;
}

// AI Portfolio Analysis
export async function analyzePortfolio(
  userId: number, 
  positions: any[], 
  customQuestion?: string,
  watchlist?: any[]
): Promise<{ analysis: string; type: string }> {
  
  const totalValue = positions.reduce((sum, p) => sum + (p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice), 0);
  const totalInvested = positions.reduce((sum, p) => sum + p.amount * p.buyPrice, 0);
  const totalGain = totalValue - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  
  // Group by type
  const byType: Record<string, number> = {};
  positions.forEach(p => {
    const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
    byType[p.type] = (byType[p.type] || 0) + value;
  });
  
  // Top performers
  const withGain = positions.map(p => ({
    ...p,
    gain: p.currentPrice ? ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0,
  })).sort((a, b) => b.gain - a.gain);
  
  const topPerformers = withGain.slice(0, 5);
  const worstPerformers = withGain.slice(-5).reverse();

  // Watchlist nur einblenden, wenn die konkrete Frage sie auch betrifft (allgemeine
  // Portfolio-Analyse ohne Frage zaehlt dazu) - sonst driftet sie unpassend in
  // themenfremde Antworten wie die Sparplan-Verteilung rein (Bug vom 09.07.2026).
  const includeWatchlist = !customQuestion || /watchlist/i.test(customQuestion);

  const portfolioSummary = `
Portfolio-Übersicht:
- Gesamtwert: ${totalValue.toFixed(2)} €
- Investiert: ${totalInvested.toFixed(2)} €
- Gewinn/Verlust: ${totalGain.toFixed(2)} € (${totalGainPercent.toFixed(2)}%)
- Anzahl Positionen: ${positions.length}

Allokation nach Typ:
${Object.entries(byType).map(([type, value]) => `- ${type}: ${value.toFixed(2)} € (${((value / totalValue) * 100).toFixed(1)}%)`).join('\n')}

Top 5 Performer:
${topPerformers.map(p => `- ${p.name}: ${p.gain.toFixed(2)}%`).join('\n')}

Schlechteste 5 Performer:
${worstPerformers.map(p => `- ${p.name}: ${p.gain.toFixed(2)}%`).join('\n')}

${includeWatchlist && watchlist && watchlist.length > 0 ? `
Watchlist (${watchlist.length} Positionen):
${watchlist.map(w => `- ${w.name} (${w.ticker}): Zielpreis ${w.targetPrice || 'nicht gesetzt'} €`).join('\n')}
` : ''}
`;

  const systemPrompt = `Du bist ein erfahrener Finanzberater und Portfolio-Analyst.
Du analysierst Portfolios und einzelne Assets (ETFs, Aktien) präzise und fokussiert.
Antworte immer auf Deutsch und sei konkret.

WICHTIG - Fokus auf die Frage:
- Beantworte NUR das, was der Nutzer konkret fragt
- Konzentriere dich auf das spezifische Asset in der Frage
- Gib keine ungefragt Watchlist-Bewertungen
- Erstelle KEINE automatische Sparplan-Verteilung
- Bleib beim Thema der konkreten Frage

Falls der Nutzer EXPLIZIT nach folgenden Dingen fragt, dann liefere sie:
- Watchlist-Bewertung: Nur wenn explizit gefragt
- Sparplan-Vorschlag: Nur wenn explizit gefragt
- Gesamtportfolio-Analyse: Nur wenn explizit gefragt

Formatiere deine Antwort übersichtlich mit Überschriften und Tabellen wo sinnvoll.
Antworte immer auf Deutsch.`;


  const userPrompt = customQuestion 
    ? `${portfolioSummary}\n\nFrage des Nutzers: ${customQuestion}`
    : `${portfolioSummary}\n\nBitte analysiere dieses Portfolio und gib mir:
1. Eine Einschätzung der aktuellen Diversifikation
2. Potenzielle Risiken
3. Konkrete Handlungsempfehlungen
4. Vorschläge für Rebalancing falls nötig`;

  try {
    const analysis = await invokeLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    
    // Save analysis to database
    await saveAiAnalysis(userId, "portfolio", analysis || "Analyse konnte nicht erstellt werden.");
    
    return { analysis: analysis || "Analyse konnte nicht erstellt werden.", type: "portfolio" };
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error("Error analyzing portfolio:", {
      message: errorMessage,
      error: error,
      stack: error?.stack,
    });
    
    // Return detailed error message for debugging
    const userMessage = errorMessage.includes("API key") 
      ? "OpenAI API-Schlüssel fehlt oder ist ungültig. Bitte überprüfen Sie die Konfiguration."
      : errorMessage.includes("quota") || errorMessage.includes("rate_limit")
      ? "OpenAI API-Limit erreicht. Bitte versuchen Sie es später erneut."
      : `Die KI-Analyse ist derzeit nicht verfügbar. Fehler: ${errorMessage}`;
    
    return { 
      analysis: userMessage, 
      type: "error" 
    };
  }
}

// Generate recommendation for a specific stock
export async function generateRecommendation(
  userId: number,
  ticker: string,
  name: string,
  currentPositions: any[]
): Promise<{ recommendation: string; action: string }> {
  
  const existingPosition = currentPositions.find(p => p.ticker === ticker);
  const totalPortfolioValue = currentPositions.reduce((sum, p) => 
    sum + (p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice), 0
  );
  
  const positionInfo = existingPosition 
    ? `Du hast bereits ${existingPosition.amount} Anteile von ${name} (${ticker}) im Portfolio mit einem Kaufpreis von ${existingPosition.buyPrice} €.`
    : `Du hast ${name} (${ticker}) noch nicht im Portfolio.`;

  const systemPrompt = `Du bist ein erfahrener Aktienanalyst. 
Gib eine fundierte Einschätzung zu der angefragten Aktie.
Berücksichtige das bestehende Portfolio des Nutzers.
Antworte immer auf Deutsch und sei konkret.`;

  const userPrompt = `
Portfolio-Gesamtwert: ${totalPortfolioValue.toFixed(2)} €
${positionInfo}

Bitte gib mir eine Einschätzung zu ${name} (${ticker}):
1. Kurze Unternehmensanalyse
2. Chancen und Risiken
3. Empfehlung: Kaufen, Halten oder Verkaufen?
4. Falls Kaufen: Welcher Anteil am Portfolio wäre sinnvoll?`;

  try {
    const recommendation = await invokeLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    
    // Determine action from response
    let action = "Halten";
    const lowerRec = (recommendation || "").toLowerCase();
    if (lowerRec.includes("kaufen") && !lowerRec.includes("nicht kaufen")) {
      action = "Kaufen";
    } else if (lowerRec.includes("verkaufen")) {
      action = "Verkaufen";
    }
    
    // Save analysis
    await saveAiAnalysis(userId, "recommendation", recommendation || "Empfehlung konnte nicht erstellt werden.", ticker);
    
    return { recommendation: recommendation || "Empfehlung konnte nicht erstellt werden.", action };
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error("Error generating recommendation:", {
      message: errorMessage,
      error: error,
      stack: error?.stack,
    });
    
    // Return detailed error message for debugging
    const userMessage = errorMessage.includes("API key") 
      ? "OpenAI API-Schlüssel fehlt oder ist ungültig. Bitte überprüfen Sie die Konfiguration."
      : errorMessage.includes("quota") || errorMessage.includes("rate_limit")
      ? "OpenAI API-Limit erreicht. Bitte versuchen Sie es später erneut."
      : `Die KI-Empfehlung ist derzeit nicht verfügbar. Fehler: ${errorMessage}`;
    
    return { 
      recommendation: userMessage, 
      action: "Halten" 
    };
  }
}


// WKN to Ticker/ISIN mapping database for common German securities
const WKN_DATABASE: Record<string, { ticker: string; name: string; type: string }> = {
  // Tech stocks
  '865985': { ticker: 'AAPL', name: 'Apple Inc.', type: 'Aktie' },
  '906866': { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'Aktie' },
  'A14Y6F': { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'Aktie' },
  'A14Y6H': { ticker: 'GOOG', name: 'Alphabet Inc. Class C', type: 'Aktie' },
  '870747': { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'Aktie' },
  'A1CX3T': { ticker: 'TSLA', name: 'Tesla Inc.', type: 'Aktie' },
  '918422': { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'Aktie' },
  'A1JWVX': { ticker: 'META', name: 'Meta Platforms Inc.', type: 'Aktie' },
  '863186': { ticker: 'AMD', name: 'Advanced Micro Devices Inc.', type: 'Aktie' },
  'A2N4PB': { ticker: 'NFLX', name: 'Netflix Inc.', type: 'Aktie' },
  
  // ETFs - World
  'A3D7QX': { ticker: 'FWRG.DE', name: 'Invesco FTSE All-World UCITS ETF', type: 'ETF' },
  'A0RPWH': { ticker: 'EUNL.DE', name: 'iShares Core MSCI World UCITS ETF', type: 'ETF' },
  'A2PKXG': { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', type: 'ETF' },
  'A1JMDF': { ticker: 'IWDA.AS', name: 'iShares Core MSCI World UCITS ETF', type: 'ETF' },
  'A2DWBY': { ticker: 'IUSN.DE', name: 'iShares MSCI World Small Cap UCITS ETF', type: 'ETF' },
  
  // ETFs - Emerging Markets
  'A111X9': { ticker: 'IS3N.DE', name: 'iShares Core MSCI EM IMI UCITS ETF', type: 'ETF' },
  'A12GVR': { ticker: 'VFEM.DE', name: 'Vanguard FTSE Emerging Markets UCITS ETF', type: 'ETF' },
  
  // ETFs - Tech/Nasdaq
  'A0F5UF': { ticker: 'EXXT.DE', name: 'iShares Nasdaq 100 UCITS ETF', type: 'ETF' },
  'A2N6LC': { ticker: 'XAIX.DE', name: 'Xtrackers AI & Big Data UCITS ETF', type: 'ETF' },
  
  // ETFs - Themen (aktiv)
  'A113FD': { ticker: 'XDWH.DE', name: 'Xtrackers MSCI World Health Care UCITS ETF', type: 'ETF' },
  'A3D6N1': { ticker: 'CBUX.DE', name: 'iShares Global Infrastructure UCITS ETF', type: 'ETF' },
  'A40L9T': { ticker: 'AIFS.DE', name: 'iShares AI Infrastructure UCITS ETF', type: 'ETF' },

  // ETFs - Themen (eingefroren / nicht mehr aktiv besparen)
  'A0MW0M': { ticker: 'IQQH.DE', name: 'iShares Global Clean Energy UCITS ETF', type: 'ETF' },
  'A3D47K': { ticker: 'NUCL.DE', name: 'VanEck Uranium and Nuclear Technologies UCITS ETF', type: 'ETF' },
  'A3EB9T': { ticker: 'NATO.DE', name: 'HANetf Future of Defence UCITS ETF', type: 'ETF' },

  // Anleihen-ETFs
  'A2H6ZT': { ticker: 'AGGH.DE', name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged', type: 'ETF' },
  'A40KHS': { ticker: '30IA.DE', name: 'iShares iBonds Dec 2030 Term EUR Corp UCITS ETF', type: 'ETF' },
  
  // Gold/Commodities
  'A0S9GB': { ticker: '4GLD.DE', name: 'Xetra-Gold', type: 'ETF' },
  'A0N62G': { ticker: 'EUWAX.DE', name: 'EUWAX Gold II', type: 'ETF' },
  
  // ETFs - Immobilien
  'A0HGV5': { ticker: 'IQQ6.DE', name: 'iShares European Property Yield UCITS ETF', type: 'ETF' },
  
  // ETFs - Anleihen
  'A0LGP4': { ticker: 'IUSM.DE', name: 'iShares $ Treasury Bond 7-10yr UCITS ETF', type: 'ETF' },
  'A0NECU': { ticker: 'IBCI.DE', name: 'iShares Euro Inflation Linked Govt Bond UCITS ETF', type: 'ETF' },
  'A0LGQH': { ticker: 'IUSU.DE', name: 'iShares $ Treasury Bond 1-3yr UCITS ETF', type: 'ETF' },
  'A0LGQL': { ticker: 'IUST.DE', name: 'iShares $ Treasury Bond 3-7yr UCITS ETF', type: 'ETF' },
  
  // German stocks
  '590900': { ticker: 'GBF.DE', name: 'Bilfinger SE', type: 'Aktie' },
  '716460': { ticker: 'SAP.DE', name: 'SAP SE', type: 'Aktie' },
  '823212': { ticker: 'DTE.DE', name: 'Deutsche Telekom AG', type: 'Aktie' },
  '555750': { ticker: 'DPW.DE', name: 'Deutsche Post AG', type: 'Aktie' },
  '840400': { ticker: 'ALV.DE', name: 'Allianz SE', type: 'Aktie' },
  '514000': { ticker: 'DBK.DE', name: 'Deutsche Bank AG', type: 'Aktie' },
  '519000': { ticker: 'BMW.DE', name: 'BMW AG', type: 'Aktie' },
  '710000': { ticker: 'DAI.DE', name: 'Mercedes-Benz Group AG', type: 'Aktie' },
  '766403': { ticker: 'VOW3.DE', name: 'Volkswagen AG', type: 'Aktie' },
  
  // Biotech
  'A402CB': { ticker: 'ASMB', name: 'Assembly Biosciences Inc.', type: 'Aktie' },
  'A2H7A5': { ticker: 'IFRX', name: 'InflaRx N.V.', type: 'Aktie' },
  'A0EAT9': { ticker: 'GLPG.AS', name: 'Galapagos NV', type: 'Aktie' },
  'A14158': { ticker: 'CTMX', name: 'CytomX Therapeutics Inc.', type: 'Aktie' },
  'A1180P': { ticker: 'OCUL', name: 'Ocular Therapeutix Inc.', type: 'Aktie' },
  'A3DPH3': { ticker: 'ORKA', name: 'Oruka Therapeutics Inc.', type: 'Aktie' },
  
  // Other
  'A0M4W9': { ticker: '1211.HK', name: 'BYD Company Limited', type: 'Aktie' },
  'A3D69W': { ticker: 'MSTR', name: 'MicroStrategy Inc.', type: 'Aktie' },
  'A2PJFZ': { ticker: 'PSN', name: 'Parsons Corporation', type: 'Aktie' },
  
  // Crypto ETPs
  'A3GZ2Z': { ticker: 'CBTC.SW', name: '21Shares Bitcoin Core ETP', type: 'Krypto' },
  'A3G04G': { ticker: 'ETHC.SW', name: '21Shares Ethereum Core Staking ETP', type: 'Krypto' },
  'A2UBKC': { ticker: 'AXRP.SW', name: '21Shares XRP ETP', type: 'Krypto' },
  'A3GX35': { ticker: 'SOLW.SW', name: 'WisdomTree Physical Solana', type: 'Krypto' },
};

// Berechnet die Pruefziffer einer ISIN (Luhn-Algorithmus auf den in Ziffern
// umgewandelten Zeichen, A=10 ... Z=35) -- fuer den deutschen ISIN-Aufbau
// "DE" + "000" + WKN + Pruefziffer (verifiziert an SAP: WKN 716460 -> DE0007164600).
function computeIsinCheckDigit(isin11: string): string {
  let digits = "";
  for (const ch of isin11.toUpperCase()) {
    digits += ch >= "0" && ch <= "9" ? ch : (ch.charCodeAt(0) - 55).toString();
  }
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return ((10 - (sum % 10)) % 10).toString();
}

function wknToIsin(wkn: string): string | null {
  const cleaned = wkn.trim().toUpperCase();
  if (cleaned.length !== 6) return null;
  const base11 = `DE000${cleaned}`;
  return `${base11}${computeIsinCheckDigit(base11)}`;
}

// Fragt die Yahoo-Finance-Suche ab und gibt die Rohtreffer zurueck (leeres Array bei Fehler).
async function searchYahooQuotes(query: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.quotes || [];
  } catch {
    return [];
  }
}

// Bester Treffer aus einer Trefferliste -- bevorzugt deutsche Boersen (.DE, .F).
function pickBestMatch(quotes: any[]): any | null {
  return quotes.find((q: any) => q.symbol?.endsWith('.DE') || q.symbol?.endsWith('.F')) || quotes[0] || null;
}

// Holt zu einem Yahoo-Suchtreffer die Kursdetails (Chart-Endpunkt) und baut das
// einheitliche Rueckgabeformat -- gemeinsam genutzt von WKN- und Namenssuche.
async function fetchYahooQuoteDetails(bestMatch: any): Promise<{
  success: true;
  data: { name: string; ticker: string; currentPrice: number; currency: string; type: string; exchange: string };
} | { success: false; error: string }> {
  const ticker = bestMatch.symbol;
  let type = 'Aktie';
  if (bestMatch.quoteType === 'ETF') type = 'ETF';
  else if (bestMatch.quoteType === 'CRYPTOCURRENCY') type = 'Krypto';
  else if (bestMatch.quoteType === 'MUTUALFUND') type = 'Fonds';

  const quoteResponse = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
  );

  if (!quoteResponse.ok) {
    return {
      success: true,
      data: {
        name: bestMatch.longname || bestMatch.shortname || ticker,
        ticker,
        currentPrice: 0,
        currency: 'EUR',
        type,
        exchange: bestMatch.exchange || 'Unknown',
      }
    };
  }

  const quoteData = await quoteResponse.json();
  const meta = quoteData.chart?.result?.[0]?.meta;
  if (!meta) {
    return { success: false, error: 'Kursdaten nicht verfügbar' };
  }

  let price = meta.regularMarketPrice || meta.previousClose || 0;
  const currency = meta.currency || 'EUR';
  if (currency === 'USD') price = price / 1.08; // Approximate EUR/USD rate

  return {
    success: true,
    data: {
      name: meta.longName || bestMatch.longname || bestMatch.shortname || ticker,
      ticker,
      currentPrice: price,
      currency: 'EUR',
      type,
      exchange: meta.exchangeName || bestMatch.exchange || 'Unknown',
    }
  };
}

// Lookup by Security Name using Yahoo Finance API (Direktsuche per Firmenname,
// da das Name-Feld bisher nirgends als Suchbegriff verwendet wurde).
export async function lookupByName(name: string): Promise<{
  success: boolean;
  data?: { name: string; ticker: string; currentPrice: number; currency: string; type: string; exchange: string };
  error?: string;
}> {
  const query = name.trim();
  if (!query) {
    return { success: false, error: 'Bitte einen Namen eingeben.' };
  }
  const bestMatch = pickBestMatch(await searchYahooQuotes(query));
  if (!bestMatch) {
    return { success: false, error: `Keine Daten für "${name}" gefunden` };
  }
  try {
    return await fetchYahooQuoteDetails(bestMatch);
  } catch (error) {
    console.error('Error looking up name:', error);
    return { success: false, error: 'Fehler beim Abrufen der Daten' };
  }
}

// WKN to Security Data Lookup using Yahoo Finance API
export async function lookupByWKN(wkn: string): Promise<{
  success: boolean;
  data?: {
    name: string;
    ticker: string;
    wkn: string;
    currentPrice: number;
    currency: string;
    type: string;
    exchange: string;
  };
  error?: string;
}> {
  try {
    const searchQuery = wkn.toUpperCase();
    
    // First check our local WKN database
    const knownSecurity = WKN_DATABASE[searchQuery];
    if (knownSecurity) {
      // Get current price from Yahoo Finance using the known ticker
      try {
        const quoteResponse = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${knownSecurity.ticker}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          const meta = quoteData.chart?.result?.[0]?.meta;
          
          if (meta) {
            let price = meta.regularMarketPrice || meta.previousClose || 0;
            const currency = meta.currency || 'EUR';
            
            // Convert USD to EUR
            if (currency === 'USD') {
              price = price / 1.08;
            }
            
            return {
              success: true,
              data: {
                name: knownSecurity.name,
                ticker: knownSecurity.ticker,
                wkn: searchQuery,
                currentPrice: price,
                currency: 'EUR',
                type: knownSecurity.type,
                exchange: meta.exchangeName || 'Unknown',
              }
            };
          }
        }
      } catch (priceError) {
        console.error('Error fetching price for known WKN:', priceError);
      }
      
      // Return known data without price if price fetch failed
      return {
        success: true,
        data: {
          name: knownSecurity.name,
          ticker: knownSecurity.ticker,
          wkn: searchQuery,
          currentPrice: 0,
          currency: 'EUR',
          type: knownSecurity.type,
          exchange: 'Unknown',
        }
      };
    }
    
    // If not in our database, try Yahoo Finance search -- erst die rohe WKN direkt,
    // dann mit .DE-Suffix, dann (neu) ueber die daraus berechnete ISIN, da Yahoo
    // WKNs als Suchbegriff generell nicht zuverlaessig kennt, ISINs aber oft schon.
    let bestMatch = pickBestMatch(await searchYahooQuotes(searchQuery));

    if (!bestMatch) {
      bestMatch = pickBestMatch(await searchYahooQuotes(`${searchQuery}.DE`));
    }

    const isin = wknToIsin(searchQuery);
    if (!bestMatch && isin) {
      bestMatch = pickBestMatch(await searchYahooQuotes(isin));
    }

    if (!bestMatch) {
      return {
        success: false,
        error: isin
          ? `Keine Daten für WKN ${wkn} gefunden (auch nicht über ISIN ${isin})`
          : `Keine Daten für WKN ${wkn} gefunden`,
      };
    }

    const result = await fetchYahooQuoteDetails(bestMatch);
    if (!result.success) return result;
    return { success: true, data: { ...result.data, wkn: wkn.toUpperCase() } };
  } catch (error) {
    console.error('Error looking up WKN:', error);
    return { success: false, error: 'Fehler beim Abrufen der Daten' };
  }
}

// Lookup by Ticker symbol
export async function lookupByTicker(ticker: string): Promise<{
  success: boolean;
  data?: {
    name: string;
    ticker: string;
    currentPrice: number;
    currency: string;
    type: string;
    exchange: string;
  };
  error?: string;
}> {
  try {
    // Get quote data directly
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!quoteResponse.ok) {
      return { success: false, error: `Ticker ${ticker} nicht gefunden` };
    }
    
    const quoteData = await quoteResponse.json();
    const meta = quoteData.chart?.result?.[0]?.meta;
    
    if (!meta) {
      return { success: false, error: 'Kursdaten nicht verfügbar' };
    }
    
    // Determine type
    let type = 'Aktie';
    const instrumentType = meta.instrumentType?.toLowerCase() || '';
    if (instrumentType.includes('etf')) type = 'ETF';
    else if (instrumentType.includes('crypto')) type = 'Krypto';
    else if (instrumentType.includes('fund')) type = 'Fonds';
    
    // Convert price to EUR if needed
    let price = meta.regularMarketPrice || meta.previousClose || 0;
    const currency = meta.currency || 'EUR';
    
    if (currency === 'USD') {
      price = price / 1.08;
    }
    
    return {
      success: true,
      data: {
        name: meta.longName || meta.shortName || ticker,
        ticker: ticker,
        currentPrice: price,
        currency: 'EUR',
        type: type,
        exchange: meta.exchangeName || 'Unknown',
      }
    };
  } catch (error) {
    console.error('Error looking up ticker:', error);
    return { success: false, error: 'Fehler beim Abrufen der Daten' };
  }
}
