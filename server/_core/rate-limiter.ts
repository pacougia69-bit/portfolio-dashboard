const WINDOW_MS = 60 * 60 * 1000; // 1 Stunde
const MAX_REQUESTS = 20;

const timestamps: number[] = [];

export function checkOpenAIRateLimit(): void {
  const now = Date.now();
  while (timestamps.length > 0 && timestamps[0] < now - WINDOW_MS) {
    timestamps.shift();
  }

  if (timestamps.length >= MAX_REQUESTS) {
    const resetInMinutes = Math.ceil((timestamps[0] + WINDOW_MS - now) / 60000);
    console.warn(`[rate-limit] Limit erreicht: ${timestamps.length}/${MAX_REQUESTS} in der letzten Stunde`);
    throw new Error(
      `KI-Anfragen-Limit erreicht (${MAX_REQUESTS} pro Stunde). ` +
      `Bitte warte ${resetInMinutes} Minute(n) und versuche es dann erneut.`
    );
  }

  timestamps.push(now);
  console.log(`[rate-limit] OpenAI-Aufruf ${timestamps.length}/${MAX_REQUESTS} in dieser Stunde`);
}
