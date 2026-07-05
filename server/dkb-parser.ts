export interface DKBTransaction {
  date: Date;
  type: 'Kauf' | 'Verkauf' | 'Sparplan';
  isin: string;
  wkn: string;
  name: string;
  quantity: number;
  price: number;
  priceCurrency: string;
  fees: number;
  totalAmount: number;
  totalAmountCurrency: string;
  orderNumber: string;
  invoiceNumber: string;
  category: string | null;
}

/**
 * WKN → Strategy category mapping (50/15/10/10/10/5 strategy)
 */
const WKN_STRATEGY_MAP: Record<string, string> = {
  // Aktive Kernpositionen
  'A0RPWH': 'Basis 50%',
  'A111X9': 'EM 15%',
  'A40L9T': 'Thema AI 10%',
  'A3D6N1': 'Infra 10%',
  'A113FD': 'Healthcare 10%',
  'A40KHS': 'Anleihen 5%',
  // Eingefroren (Halten, kein aktiver Kauf)
  'A2N6LC': 'Eingefroren',
  'A3EB9T': 'Eingefroren',
  // Sonstige Positionen
  'A0LGP4': 'Rest/Einzel',
  'A2DWBY': 'Rest/Einzel',
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
export async function parseDKBPDF(pdfBuffer: Buffer, fileName?: string): Promise<DKBTransaction> {
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
    // Also handle variations: extra spaces, line breaks, or slight format differences
    const orderNumberMatch = text.match(/Auftragsnummer\s*[:\s]*(\d[\d\s]*\/[\d.\s]+)/)
      || text.match(/Auftragsnummer\s*[:\s]*(\d+)/);
    const orderNumber = orderNumberMatch
      ? orderNumberMatch[1].replace(/[\s/.]/g, '')
      : 'UNKNOWN';
    if (orderNumber === 'UNKNOWN') {
      console.warn('[DKB Parser] Auftragsnummer nicht gefunden, verwende Fallback');
    }

    // Extract invoice number — this is the primary unique identifier per PDF
    const invoiceNumberMatch = text.match(/Rechnungsnummer\s*[:\s]*(W[\w]+-[\d]+\/[\d]+)/)
      || text.match(/Rechnungsnummer\s*[:\s]*([\w]+-[\d]+[\/\-][\d]+)/)
      || text.match(/Rechnungsnummer\s*[:\s]*(\S+)/);
    if (!invoiceNumberMatch) {
      throw new Error('Rechnungsnummer nicht gefunden — ist das eine gültige DKB-Wertpapierabrechnung?');
    }
    const invoiceNumber = invoiceNumberMatch[1];

    // Extract date with cascading fallbacks:
    // 1. "Schlusstag/-Zeit DD.MM.YYYY HH:MM:SS" (with time)
    // 2. "Schlusstag DD.MM.YYYY" (without time)
    // 3. "Datum DD.MM.YYYY" (header field)
    // 4. Date from filename (e.g. "vom_02.02.2026" or leading "2026-02-03_")
    let date: Date;
    const dateTimeMatch = text.match(/Schlusstag\/?-?Zeit\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (dateTimeMatch) {
      const [day, month, year] = dateTimeMatch[1].split('.').map(Number);
      const [hour, minute, second] = dateTimeMatch[2].split(':').map(Number);
      date = new Date(year, month - 1, day, hour, minute, second);
    } else {
      const dateOnlyMatch = text.match(/Schlusstag\s+(\d{2}\.\d{2}\.\d{4})/)
        || text.match(/Datum\s+(\d{2}\.\d{2}\.\d{4})/);
      if (dateOnlyMatch) {
        const [day, month, year] = dateOnlyMatch[1].split('.').map(Number);
        date = new Date(year, month - 1, day, 12, 0, 0);
      } else if (fileName) {
        // Last resort: extract date from filename
        const filenameDateDE = fileName.match(/vom_(\d{2})\.(\d{2})\.(\d{4})/);
        const filenameDateISO = fileName.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (filenameDateDE) {
          date = new Date(Number(filenameDateDE[3]), Number(filenameDateDE[2]) - 1, Number(filenameDateDE[1]), 12, 0, 0);
          console.log(`[DKB Parser] Datum aus Dateiname extrahiert: ${filenameDateDE[1]}.${filenameDateDE[2]}.${filenameDateDE[3]}`);
        } else if (filenameDateISO) {
          date = new Date(Number(filenameDateISO[1]), Number(filenameDateISO[2]) - 1, Number(filenameDateISO[3]), 12, 0, 0);
          console.log(`[DKB Parser] Datum aus Dateiname extrahiert: ${filenameDateISO[0]}`);
        } else {
          throw new Error(`Datum nicht gefunden. Debug: Erste 500 Zeichen des PDF-Textes:\n${text.substring(0, 500)}`);
        }
      } else {
        throw new Error(`Datum nicht gefunden. Debug: Erste 500 Zeichen des PDF-Textes:\n${text.substring(0, 500)}`);
      }
    }

    // Determine transaction type (flexible matching for whitespace/encoding variations)
    let type: 'Kauf' | 'Verkauf' | 'Sparplan' = 'Kauf';
    if (/Wertpapier\s+Abrechnung\s+Kauf/i.test(text)) {
      type = 'Kauf';
      if (/ETF.?Sparplan/i.test(text)) {
        type = 'Sparplan';
      }
    } else if (/Wertpapier\s+Abrechnung\s+Verkauf/i.test(text)) {
      type = 'Verkauf';
    } else if (/Sparplan/i.test(text)) {
      type = 'Sparplan';
    }

    // Extract ISIN and WKN - they appear together as IE00B1XNHC34(A0MW0M) or DE000A0F5UF5(A0F5UF)
    const isinWknMatch = text.match(/([A-Z]{2}[A-Z0-9]{10})\s*\(([A-Z0-9]{6})\)/);
    if (!isinWknMatch) {
      throw new Error('ISIN nicht gefunden');
    }
    const isin = isinWknMatch[1];
    const wkn = isinWknMatch[2];

    // Extract security name: text between "Stück [number]" and the known ISIN
    let name = '';
    const nameStartMatch = text.match(/St[üu]ck\s+[\d.,]+\s*/);
    if (nameStartMatch && nameStartMatch.index !== undefined) {
      const afterQuantity = text.substring(nameStartMatch.index + nameStartMatch[0].length);
      const isinPos = afterQuantity.indexOf(isin);
      if (isinPos > 0) {
        name = afterQuantity.substring(0, isinPos).replace(/\s+/g, ' ').trim();
      }
    }
    if (name.length > 200) {
      name = name.substring(0, 200).trim();
    }

    // Extract quantity (Nominale/Stück) - supports decimals like "3,8462"
    // pdf2json may encode ü as %C3%BC or leave it as ü, so match both
    const quantityMatch = text.match(/St[üuü]ck\s+([\d.,]+)/)
      || text.match(/Nominale\s+St[üuü]ck\s+([\d.,]+)/)
      || text.match(/Nominale\s+([\d.,]+)/);
    if (!quantityMatch) {
      throw new Error(`Stückzahl nicht gefunden. PDF-Text (erste 800 Zeichen):\n${text.substring(0, 800)}`);
    }
    const quantity = parseGermanNumber(quantityMatch[1]);

    // Extract execution price (Ausführungskurs) - supports EUR and USD
    const priceMatch = text.match(/Ausf[üuü]hrungskurs\s*([\d.,]+)\s*(EUR|USD)/)
      || text.match(/Kurs\s*([\d.,]+)\s*(EUR|USD)/);
    if (!priceMatch) {
      throw new Error(`Ausführungskurs nicht gefunden. PDF-Text (erste 800 Zeichen):\n${text.substring(0, 800)}`);
    }
    const price = parseGermanNumber(priceMatch[1]);
    const priceCurrency = priceMatch[2];

    // Extract fees (Provision) - supports German number format with thousands separator
    const feesMatch = text.match(/Provision\s*([\d.,]+)-?\s*EUR/)
      || text.match(/Transaktionsentgelt\s*([\d.,]+)-?\s*EUR/);
    const fees = feesMatch ? parseGermanNumber(feesMatch[1]) : 0;

    // Extract total amount (Ausmachender Betrag) - supports EUR and USD
    const totalMatch = text.match(/Ausmachender\s+Betrag\s*([\d.,]+)-?\s*(EUR|USD)/);
    if (!totalMatch) {
      throw new Error(`Gesamtbetrag nicht gefunden. PDF-Text (erste 800 Zeichen):\n${text.substring(0, 800)}`);
    }
    const totalAmount = parseGermanNumber(totalMatch[1]);
    const totalAmountCurrency = totalMatch[2];

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
      priceCurrency,
      fees,
      totalAmount,
      totalAmountCurrency,
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
