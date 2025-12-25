import { describe, it, expect } from 'vitest';

describe('Twelve Data API', () => {
  it('should validate API key with a simple request', async () => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    
    // Check if API key is set
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
    
    // Make a simple API call to validate the key
    const response = await fetch(
      `https://api.twelvedata.com/api_usage?apikey=${apiKey}`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    
    // Check that we got a valid response (not an error)
    expect(data.status).not.toBe('error');
    
    // Log usage info for debugging
    if (data.current_usage !== undefined) {
      console.log(`API Usage: ${data.current_usage}/${data.plan_limit} calls today`);
    }
  });

  it('should fetch a sample stock quote', async () => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    
    // Fetch Apple stock as a test
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${apiKey}`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    
    // Check that we got valid stock data
    expect(data.symbol).toBe('AAPL');
    expect(data.name).toContain('Apple');
    expect(parseFloat(data.close)).toBeGreaterThan(0);
    
    console.log(`AAPL Price: $${data.close}`);
  });
});
