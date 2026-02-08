// EUR/USD exchange rate cache
let eurUsdRate: number | null = null;
let eurUsdLastFetch: number = 0;
const RATE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Known USD-denominated WKNs (US-listed stocks priced in USD)
export const USD_DENOMINATED_WKNS = new Set([
  'A14158',  // CTMX - CytomX Therapeutics
  'A402CB',  // ASMB - Assembly Biosciences
  'A2H7A5',  // IFRX - InflaRx N.V.
  'A1180P',  // OCUL - Ocular Therapeutix
  'A3DPH3',  // ORKA - Oruka Therapeutics
  'A3D69W',  // MSTR - MicroStrategy
  'A2PJFZ',  // PSN  - Parsons Corporation
]);

// Fetch EUR/USD exchange rate (cached for 1 hour)
export async function getEurUsdRate(apiKey?: string): Promise<number> {
  const now = Date.now();
  if (eurUsdRate && (now - eurUsdLastFetch) < RATE_CACHE_DURATION) {
    return eurUsdRate;
  }

  const key = apiKey || process.env.TWELVE_DATA_API_KEY;
  if (!key) {
    return eurUsdRate || 1.08;
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/exchange_rate?symbol=EUR/USD&apikey=${key}`
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
