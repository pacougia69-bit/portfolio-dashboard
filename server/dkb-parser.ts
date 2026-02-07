export interface DKBTransaction {
  date: Date;
  type: 'Kauf' | 'Verkauf' | 'Sparplan';
  isin: string;
  wkn: string;
  name: string;
  quantity: number;
  price: number;
  fees: number;
  totalAmount: number;
  orderNumber: string;
  invoiceNumber: string;
  category: string | null;
}

/**
 * WKN → Strategy category mapping (60/20/10/5/5 strategy)
 */
const WKN_STRATEGY_MAP: Record<string, string> = {
  'A0RPWH': 'Basis 60%',
  'A111X9': 'EM 20%',
  'A3D47K': 'Tech 10%',
  'A2N6LC': 'Thema 5%',
  'A3EB9T': 'Thema 5%',
  'A0LGP4': 'Rest/Einzel 5%',
  'A1KWPR': 'Rest/Einzel 5%',
  'A0MW0M': 'Rest/Einzel 5%',
  'A2DWBY': 'Rest/Einzel 5%',
};

function getStrategyCategory(wkn: string): string | null {
  return WKN_STRATEGY_MAP[wkn] || null;
}

/**
 * Parse German number format: dots as thousands separator, comma as decimal
 * e.g. "1.077,76" → 1077.76, "36,50" → 36.50, "112,4899" → 112.4899
 */
function parseGermanNumber(str: string): number {
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

/**
 * Extract text from PDF using pdf2json (Node.js-native library, no browser dependencies)
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid loading pdf2json during server startup
    const PDFParser = (await import('pdf2json')).default;

    return new Promise<string>((resolve, reject) => {
      const pdfParser = new (PDFParser as any)(null, true);

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          let text = '';
          for (const page of pdfData.Pages || []) {
            for (const textElement of page.Texts || []) {
              // Each text element can have multiple runs (R array)
              for (const run of textElement.R || []) {
                // Decode URI-encoded text and add space
                const decodedText = decodeURIComponent(run.T);
                text += decodedText + ' ';
              }
            }
            text += '\n'; // Add newline after each page
          }
          resolve(text);
        } catch (error) {
          reject(error);
        }
      });

      pdfParser.on('pdfParser_dataError', (error: any) => {
        reject(new Error(error.parserError || 'PDF parsing failed'));
      });

      // Parse the buffer
      pdfParser.parseBuffer(pdfBuffer);
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`PDF konnte nicht gelesen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
}

/**
 * Parse DKB PDF to extract transaction information
 */
export async function parseDKBPDF(pdfBuffer: Buffer): Promise<DKBTransaction> {
  // Extract text from PDF using pdf2json
  let text: string;
  try {
    text = await extractTextFromPDF(pdfBuffer);
    console.log('[DKB Parser] Successfully extracted text, length:', text.length);
    console.log('[DKB Parser] Text preview:', text.substring(0, 300));
  } catch (error) {
    console.error('[DKB Parser] PDF extraction failed:', error);
    throw new Error('PDF konnte nicht analysiert werden. Bitte stellen Sie sicher, dass es sich um eine gültige DKB-PDF handelt.');
  }

  // Wrap all parsing logic in try-catch to prevent server crashes
  try {
    // Extract order number - match raw format like "339299/21.00" then normalize to pure digits "3392992100"
    const orderNumberMatch = text.match(/Auftragsnummer\s*(\d+\/[\d.]+)/);
    if (!orderNumberMatch) {
      throw new Error('Auftragsnummer nicht gefunden');
    }
    const orderNumber = orderNumberMatch[1].replace(/[/.]/g, '');

    // Extract invoice number
    const invoiceNumberMatch = text.match(/Rechnungsnummer\s*(W\d+-\d+\/\d+)/);
    if (!invoiceNumberMatch) {
      throw new Error('Rechnungsnummer nicht gefunden');
    }
    const invoiceNumber = invoiceNumberMatch[1];

    // Extract date: try "Schlusstag/-Zeit DD.MM.YYYY HH:MM:SS" first, then "Schlusstag DD.MM.YYYY", then "Datum DD.MM.YYYY"
    let date: Date;
    const dateTimeMatch = text.match(/Schlusstag\/?-?Zeit\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (dateTimeMatch) {
      const [day, month, year] = dateTimeMatch[1].split('.').map(Number);
      const [hour, minute, second] = dateTimeMatch[2].split(':').map(Number);
      date = new Date(year, month - 1, day, hour, minute, second);
    } else {
      const dateOnlyMatch = text.match(/Schlusstag\s+(\d{2}\.\d{2}\.\d{4})/)
        || text.match(/Datum\s+(\d{2}\.\d{2}\.\d{4})/);
      if (!dateOnlyMatch) {
        throw new Error('Datum nicht gefunden');
      }
      const [day, month, year] = dateOnlyMatch[1].split('.').map(Number);
      date = new Date(year, month - 1, day, 12, 0, 0);
    }

    // Determine transaction type
    let type: 'Kauf' | 'Verkauf' | 'Sparplan' = 'Kauf';
    if (text.includes('Wertpapier Abrechnung Kauf')) {
      type = 'Kauf';
      if (text.includes('Ihr ETF-Sparplan Nr.')) {
        type = 'Sparplan';
      }
    } else if (text.includes('Wertpapier Abrechnung Verkauf')) {
      type = 'Verkauf';
    }

    // Extract ISIN and WKN - they appear together as IE00B1XNHC34(A0MW0M) or DE000A0F5UF5(A0F5UF)
    const isinWknMatch = text.match(/([A-Z]{2}[A-Z0-9]{10})\s*\(([A-Z0-9]{6})\)/);
    if (!isinWknMatch) {
      throw new Error('ISIN nicht gefunden');
    }
    const isin = isinWknMatch[1];
    const wkn = isinWknMatch[2];

    // Extract security name (between quantity and ISIN which starts with 2 letters)
    const nameMatch = text.match(/St[üu]ck\s+[\d.,]+\s*([^\n]+(?:\n[^\n]+)?)\s*[A-Z]{2}[A-Z0-9]{10}/);
    let name = '';
    if (nameMatch) {
      name = nameMatch[1].replace(/\s+/g, ' ').trim();
    } else {
      // Fallback: extract text between quantity and ISIN
      const nameMatch2 = text.match(/St[üu]ck\s+[\d.,]+\s*([A-Z][^\n]+(?:\n[A-Z][^\n]+)?)\s*[A-Z]{2}[A-Z0-9]{10}/);
      if (nameMatch2) {
        name = nameMatch2[1].replace(/\s+/g, ' ').trim();
      }
    }

    // Extract quantity (Nominale/Stück) - supports decimals like "3,8462"
    const quantityMatch = text.match(/St[üu]ck\s+([\d.,]+)/);
    if (!quantityMatch) {
      throw new Error('Stückzahl nicht gefunden');
    }
    const quantity = parseGermanNumber(quantityMatch[1]);

    // Extract execution price (Ausführungskurs) - supports German number format
    const priceMatch = text.match(/Ausf[üu]hrungskurs\s*([\d.,]+)\s+EUR/);
    if (!priceMatch) {
      throw new Error('Ausführungskurs nicht gefunden');
    }
    const price = parseGermanNumber(priceMatch[1]);

    // Extract fees (Provision) - supports German number format with thousands separator
    const feesMatch = text.match(/Provision\s*([\d.,]+)-?\s*EUR/);
    const fees = feesMatch ? parseGermanNumber(feesMatch[1]) : 0;

    // Extract total amount (Ausmachender Betrag) - supports German number format with thousands separator
    const totalMatch = text.match(/Ausmachender Betrag\s*([\d.,]+)-?\s*EUR/);
    if (!totalMatch) {
      throw new Error('Gesamtbetrag nicht gefunden');
    }
    const totalAmount = parseGermanNumber(totalMatch[1]);

    // Map WKN to strategy category
    const category = getStrategyCategory(wkn);

    return {
      date,
      type,
      isin,
      wkn,
      name,
      quantity,
      price,
      fees,
      totalAmount,
      orderNumber,
      invoiceNumber,
      category,
    };
  } catch (error) {
    // Log detailed error for debugging
    console.error('[DKB Parser] Parsing error:', error);
    console.error('[DKB Parser] Extracted text length:', text?.length || 0);
    console.error('[DKB Parser] Text preview:', text?.substring(0, 500) || 'No text extracted');

    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    throw new Error(`PDF konnte nicht analysiert werden: ${errorMessage}. Bitte stellen Sie sicher, dass es sich um eine gültige DKB-Wertpapierabrechnung handelt.`);
  }
}
