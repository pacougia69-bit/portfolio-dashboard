import { invokeLLM } from "./_core/llm";
import { updatePriceCache, saveAiAnalysis } from "./db";

// EUR/USD exchange rate cache
let eurUsdRate: number | null = null;
let eurUsdLastFetch: number = 0;
const RATE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Fetch EUR/USD exchange rate
async function getEurUsdRate(apiKey: string): Promise<number> {
  const now = Date.now();
  if (eurUsdRate && (now - eurUsdLastFetch) < RATE_CACHE_DURATION) {
    return eurUsdRate;
  }
  
  try {
    const response = await fetch(
      `https://api.twelvedata.com/exchange_rate?symbol=EUR/USD&apikey=${apiKey}`
    );
    const data = await response.json();
    if (data.rate) {
      eurUsdRate = parseFloat(data.rate);
      eurUsdLastFetch = now;
      return eurUsdRate;
    }
  } catch (error) {
    console.error("Error fetching EUR/USD rate:", error);
  }
  
  // Fallback rate
  return eurUsdRate || 1.08;
}

// Known ticker mappings from German/European to US/Twelve Data symbols
const TICKER_MAPPINGS: Record<string, string> = {
  // Tech stocks (Frankfurt .F to US)
  'AMZ.F': 'AMZN',        // Amazon
  'ABEA.F': 'GOOGL',      // Alphabet
  'AMD.F': 'AMD',         // AMD
  'NVDA.F': 'NVDA',       // NVIDIA
  'MSFT.F': 'MSFT',       // Microsoft
  'AAPL.F': 'AAPL',       // Apple
  'META.F': 'META',       // Meta
  'TSLA.F': 'TSLA',       // Tesla
  
  // Biotech stocks (Frankfurt .F to US)
  '0OT.F': 'OCUL',        // Ocular Therapeutix
  'A83.F': 'APGE',        // Apogee Therapeutics
  '7CY.F': 'CTMX',        // CytomX Therapeutics
  'IFX.F': 'IFRX',        // InflaRx N.V.
  '1SP1.F': 'SPRO',       // Spero Therapeutics
  'O8V.F': 'OVID',        // Ovid Therapeutics
  'N9C.F': 'NXTC',        // NextCure
  '49B.F': 'MYNZ',        // Mainz Biomed
  '78A.F': 'ATHA',        // Athira Pharma
  'C1M.F': 'CRDF',        // Cardiff Oncology
  
  // Other US stocks (Frankfurt .F to US)
  'P2S.F': 'PSN',         // Parsons Corporation
  'MIG.F': 'MSTR',        // MicroStrategy
  
  // German stocks (Xetra .DE)
  'GBF.DE': 'GBF.DE',     // Bilfinger SE - keep as is, not on US exchange
  
  // Hong Kong
  '1211.HK': '1211.HK',   // BYD - keep original format
  
  // Canadian (TSX Venture)
  'TAU.V': 'TAU.V',       // Thesis Gold - keep original
  
  // Amsterdam
  'GLPG.AS': 'GLPG',      // Galapagos NV (also on NASDAQ)
  
  // US stocks (already US symbols)
  'ASMB': 'ASMB',         // Assembly Biosciences
  'ORKA': 'ORKA',         // Oruka Therapeutics
  
  // Crypto ETPs (Swiss Exchange .SW to crypto pairs)
  'CBTC.SW': 'BTC/USD',   // 21Shares Bitcoin
  'ETHC.SW': 'ETH/USD',   // 21Shares Ethereum
  'AXRP.SW': 'XRP/USD',   // 21Shares XRP
  'SOLW.SW': 'SOL/USD',   // WisdomTree Solana
  'HBAR-USD': 'HBAR/USD', // Valour Hedera
  
  // ETFs (German to US equivalents or keep)
  'XAIX.DE': 'BOTZ',      // AI & Big Data -> Global X Robotics
  'EXXT.DE': 'QQQ',       // Nasdaq 100 ETF
  'NATO.DE': 'ITA',       // Defence ETF -> iShares US Aerospace
  'IS3N.DE': 'EEM',       // EM ETF -> iShares MSCI EM
  'IUSN.DE': 'SCHA',      // World Small Cap -> Schwab US Small Cap
  'EUNL.DE': 'VT',        // MSCI World -> Vanguard Total World
  'IQQH.DE': 'ICLN',      // Clean Energy -> iShares Global Clean Energy
  'NUCL.DE': 'URA',       // Uranium ETF -> Global X Uranium
};

// Convert ticker to Twelve Data format
function convertTickerForTwelveData(ticker: string): { symbol: string; exchange?: string; isCrypto?: boolean } {
  // Check known mappings first
  const mapped = TICKER_MAPPINGS[ticker];
  if (mapped) {
    // Check if it's a crypto pair
    if (mapped.includes('/USD')) {
      return { symbol: mapped, isCrypto: true };
    }
    return { symbol: mapped };
  }
  
  // German tickers ending with .F (Frankfurt)
  if (ticker.endsWith('.F')) {
    const base = ticker.replace('.F', '');
    // Try US symbol directly (many German tickers are just US symbols + .F)
    return { symbol: base };
  }
  
  // German tickers ending with .DE (Xetra)
  if (ticker.endsWith('.DE')) {
    const base = ticker.replace('.DE', '');
    return { symbol: base };
  }
  
  // Hong Kong
  if (ticker.endsWith('.HK')) {
    return { symbol: ticker.replace('.HK', ''), exchange: 'HKEX' };
  }
  
  // Canadian
  if (ticker.endsWith('.V')) {
    return { symbol: ticker.replace('.V', ''), exchange: 'TSXV' };
  }
  
  // US stocks (no suffix)
  return { symbol: ticker };
}

// Fetch live prices from Twelve Data API
export async function fetchLivePricesTwelveData(
  tickers: string[], 
  apiKey: string
): Promise<{ ticker: string; price: number; changePercent: number; currency: string; priceEur: number }[]> {
  const results: { ticker: string; price: number; changePercent: number; currency: string; priceEur: number }[] = [];
  
  if (!apiKey) {
    console.error("Twelve Data API key not provided");
    return results;
  }
  
  // Get EUR/USD rate for conversion
  const eurUsdRate = await getEurUsdRate(apiKey);
  
  // Process tickers in smaller batches to respect rate limits
  // Free tier: 8 API credits per minute, each symbol in a batch counts as 1 credit
  // Using batch size of 7 to leave room for EUR/USD rate fetch
  const batchSize = 7;
  const batchDelayMs = 62000; // Wait 62 seconds between batches to reset rate limit
  
  console.log(`Starting price update for ${tickers.length} tickers in ${Math.ceil(tickers.length / batchSize)} batches`);
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tickers.length / batchSize);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches}...`);
    
    // Build symbols string
    const symbolsForApi = batch.map(t => {
      const converted = convertTickerForTwelveData(t);
      return converted.exchange ? `${converted.symbol}:${converted.exchange}` : converted.symbol;
    });
    
    try {
      // Log what we're requesting
      console.log(`Fetching prices for: ${symbolsForApi.join(', ')}`);
      
      // Fetch quotes for batch
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbolsForApi.join(',')}&apikey=${apiKey}`
      );
      
      if (!response.ok) {
        console.warn(`Twelve Data API error: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log('Twelve Data response:', JSON.stringify(data).substring(0, 500));
      
      // Handle single vs multiple results
      const quotes = symbolsForApi.length === 1 ? { [symbolsForApi[0]]: data } : data;
      
      for (let j = 0; j < batch.length; j++) {
        const originalTicker = batch[j];
        const apiSymbol = symbolsForApi[j];
        const quote = quotes[apiSymbol];
        
        if (quote && !quote.code && quote.close) {
          const price = parseFloat(quote.close);
          const previousClose = parseFloat(quote.previous_close) || price;
          const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
          const currency = quote.currency || 'USD';
          
          // Convert to EUR if needed
          let priceEur = price;
          if (currency === 'USD') {
            priceEur = price / eurUsdRate;
          } else if (currency !== 'EUR') {
            // For other currencies, try to fetch rate or use price as-is
            priceEur = price; // Simplified - could add more currency conversions
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
      
      // Rate limiting - wait between batches (62 seconds to reset API credits)
      if (i + batchSize < tickers.length) {
        console.log(`Waiting 62 seconds for API rate limit reset before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    } catch (error) {
      console.error(`Error fetching prices from Twelve Data:`, error);
    }
  }
  
  return results;
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

${watchlist && watchlist.length > 0 ? `
Watchlist (${watchlist.length} Positionen):
${watchlist.map(w => `- ${w.name} (${w.ticker}): Zielpreis ${w.targetPrice || 'nicht gesetzt'} €`).join('\n')}
` : ''}
`;

  const systemPrompt = `Du bist ein erfahrener Finanzberater und Portfolio-Analyst. 
Du analysierst Portfolios und gibst fundierte, aber verständliche Empfehlungen auf Deutsch.
Sei konkret und gib praktische Handlungsempfehlungen.
Beachte Diversifikation, Risiko und langfristige Anlagestrategien.

Wenn der Nutzer ETFs aus der Watchlist erwähnt, bewerte jeden einzeln:
- Analysiere ob der ETF zur bestehenden Strategie passt
- Prüfe Diversifikationseffekte und Risiko
- Gib eine klare Empfehlung: EMPFOHLEN oder NICHT EMPFOHLEN mit Begründung
- Falls empfohlen: Schlage einen konkreten monatlichen Sparbetrag vor
- Erstelle am Ende eine neue Gesamt-Sparplan-Verteilung

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
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    
    const content = response.choices[0]?.message?.content;
    const analysis = typeof content === 'string' ? content : "Analyse konnte nicht erstellt werden.";
    
    // Save analysis to database
    await saveAiAnalysis(userId, "portfolio", analysis);
    
    return { analysis, type: "portfolio" };
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    return { 
      analysis: "Die KI-Analyse ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.", 
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
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    
    const recContent = response.choices[0]?.message?.content;
    const recommendation = typeof recContent === 'string' ? recContent : "Empfehlung konnte nicht erstellt werden.";
    
    // Determine action from response
    let action = "Halten";
    const lowerRec = recommendation.toLowerCase();
    if (lowerRec.includes("kaufen") && !lowerRec.includes("nicht kaufen")) {
      action = "Kaufen";
    } else if (lowerRec.includes("verkaufen")) {
      action = "Verkaufen";
    }
    
    // Save analysis
    await saveAiAnalysis(userId, "recommendation", recommendation, ticker);
    
    return { recommendation, action };
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return { 
      recommendation: "Die KI-Empfehlung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.", 
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
  
  // ETFs - Themen
  'A0MW0M': { ticker: 'IQQH.DE', name: 'iShares Global Clean Energy UCITS ETF', type: 'ETF' },
  'A3D47K': { ticker: 'NUCL.DE', name: 'VanEck Uranium and Nuclear Technologies UCITS ETF', type: 'ETF' },
  'A3EB9T': { ticker: 'NATO.DE', name: 'HANetf Future of Defence UCITS ETF', type: 'ETF' },
  
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
    
    // If not in our database, try Yahoo Finance search
    // First try direct search with WKN
    const searchResponse = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${searchQuery}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!searchResponse.ok) {
      return { success: false, error: 'Yahoo Finance API nicht erreichbar' };
    }
    
    const searchData = await searchResponse.json();
    const quotes = searchData.quotes || [];
    
    // Find the best match - prefer German exchanges (.DE, .F)
    let bestMatch = quotes.find((q: any) => 
      q.symbol?.endsWith('.DE') || q.symbol?.endsWith('.F')
    ) || quotes[0];
    
    if (!bestMatch) {
      // Try searching with .DE suffix
      const searchResponseDE = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${searchQuery}.DE&quotesCount=5&newsCount=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (searchResponseDE.ok) {
        const searchDataDE = await searchResponseDE.json();
        bestMatch = searchDataDE.quotes?.[0];
      }
    }
    
    if (!bestMatch) {
      return { success: false, error: `Keine Daten für WKN ${wkn} gefunden` };
    }
    
    // Get detailed quote data
    const ticker = bestMatch.symbol;
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!quoteResponse.ok) {
      return { 
        success: true, 
        data: {
          name: bestMatch.longname || bestMatch.shortname || ticker,
          ticker: ticker,
          wkn: wkn.toUpperCase(),
          currentPrice: 0,
          currency: 'EUR',
          type: bestMatch.quoteType === 'ETF' ? 'ETF' : 'Aktie',
          exchange: bestMatch.exchange || 'Unknown',
        }
      };
    }
    
    const quoteData = await quoteResponse.json();
    const meta = quoteData.chart?.result?.[0]?.meta;
    
    if (!meta) {
      return { success: false, error: 'Kursdaten nicht verfügbar' };
    }
    
    // Determine type based on quote type
    let type = 'Aktie';
    if (bestMatch.quoteType === 'ETF') type = 'ETF';
    else if (bestMatch.quoteType === 'CRYPTOCURRENCY') type = 'Krypto';
    else if (bestMatch.quoteType === 'MUTUALFUND') type = 'Fonds';
    
    // Convert price to EUR if needed
    let price = meta.regularMarketPrice || meta.previousClose || 0;
    const currency = meta.currency || 'EUR';
    
    if (currency === 'USD') {
      price = price / 1.08; // Approximate EUR/USD rate
    }
    
    return {
      success: true,
      data: {
        name: meta.longName || bestMatch.longname || bestMatch.shortname || ticker,
        ticker: ticker,
        wkn: wkn.toUpperCase(),
        currentPrice: price,
        currency: 'EUR',
        type: type,
        exchange: meta.exchangeName || bestMatch.exchange || 'Unknown',
      }
    };
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
