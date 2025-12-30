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
}

/**
 * Extract text from PDF using pdfjs-dist
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid loading pdfjs-dist during server startup
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0, // Suppress pdfjs warnings
    });
    
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    
    // Extract text from all pages
    let fullText = '';
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`PDF konnte nicht gelesen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
}

/**
 * Parse DKB PDF to extract transaction information
 */
export async function parseDKBPDF(pdfBuffer: Buffer): Promise<DKBTransaction> {
  // Extract text from PDF using pdfjs-dist
  let text: string;
  try {
    text = await extractTextFromPDF(pdfBuffer);
  } catch (error) {
    throw new Error('PDF konnte nicht analysiert werden. Bitte stellen Sie sicher, dass es sich um eine gültige DKB-PDF handelt.');
  }
  
  // Wrap all parsing logic in try-catch to prevent server crashes
  try {
    // Extract order number
    const orderNumberMatch = text.match(/Auftragsnummer\s*(\d+\/[\d.]+)/);
    if (!orderNumberMatch) {
      throw new Error('Auftragsnummer nicht gefunden');
    }
    const orderNumber = orderNumberMatch[1];
    
    // Extract invoice number
    const invoiceNumberMatch = text.match(/Rechnungsnummer\s*(W\d+-\d+\/\d+)/);
    if (!invoiceNumberMatch) {
      throw new Error('Rechnungsnummer nicht gefunden');
    }
    const invoiceNumber = invoiceNumberMatch[1];
    
    // Extract date and time
    const dateMatch = text.match(/Schlusstag\/-Zeit\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (!dateMatch) {
      throw new Error('Datum nicht gefunden');
    }
    const [, dateStr, timeStr] = dateMatch;
    const [day, month, year] = dateStr.split('.').map(Number);
    const [hour, minute, second] = timeStr.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute, second);
    
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
    
    // Extract ISIN and WKN - they appear together as IE00B1XNHC34(A0MW0M)
    const isinWknMatch = text.match(/([A-Z]{2}[A-Z0-9]{10})\s*\(([A-Z0-9]{6})\)/);
    if (!isinWknMatch) {
      throw new Error('ISIN nicht gefunden');
    }
    const isin = isinWknMatch[1];
    const wkn = isinWknMatch[2];
    
    // Extract security name
    const nameMatch = text.match(/St[üu]ck\s+[\d,]+\s*([^\n]+(?:\n[^\n]+)?)\s*IE00/);
    let name = '';
    if (nameMatch) {
      name = nameMatch[1].replace(/\s+/g, ' ').trim();
    } else {
      // Fallback: extract text between quantity and ISIN
      const nameMatch2 = text.match(/St[üu]ck\s+[\d,]+\s*([A-Z][^\n]+(?:\n[A-Z][^\n]+)?)\s*IE00/);
      if (nameMatch2) {
        name = nameMatch2[1].replace(/\s+/g, ' ').trim();
      }
    }
    
    // Extract quantity (Nominale/Stück)
    const quantityMatch = text.match(/St[üu]ck\s+([\d,]+)/);
    if (!quantityMatch) {
      throw new Error('Stückzahl nicht gefunden');
    }
    const quantity = parseFloat(quantityMatch[1].replace(',', '.'));
    
    // Extract execution price (Ausführungskurs)
    const priceMatch = text.match(/Ausf[üu]hrungskurs\s*([\d,]+)\s+EUR/);
    if (!priceMatch) {
      throw new Error('Ausführungskurs nicht gefunden');
    }
    const price = parseFloat(priceMatch[1].replace(',', '.'));
    
    // Extract fees (Provision)
    const feesMatch = text.match(/Provision\s*([\d,]+)-?\s*EUR/);
    const fees = feesMatch ? parseFloat(feesMatch[1].replace(',', '.')) : 0;
    
    // Extract total amount (Ausmachender Betrag)
    const totalMatch = text.match(/Ausmachender Betrag\s*([\d,]+)-?\s*EUR/);
    if (!totalMatch) {
      throw new Error('Gesamtbetrag nicht gefunden');
    }
    const totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    
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
    };
  } catch (error) {
    // Log detailed error for debugging
    console.error('DKB PDF parsing error:', error);
    
    // Return user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    throw new Error(`PDF konnte nicht analysiert werden: ${errorMessage}. Bitte stellen Sie sicher, dass es sich um eine gültige DKB-Wertpapierabrechnung handelt.`);
  }
}
