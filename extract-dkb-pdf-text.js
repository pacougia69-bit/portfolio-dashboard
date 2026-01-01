// Script to extract text from DKB PDF for analysis
import { readFileSync, writeFileSync } from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractText(pdfPath) {
  try {
    console.log('Reading PDF file...');
    const pdfBuffer = readFileSync(pdfPath);
    
    console.log('Loading PDF document...');
    const loadingTask = getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0
    });
    
    const pdfDocument = await loadingTask.promise;
    console.log(`PDF has ${pdfDocument.numPages} pages`);
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      console.log(`Extracting page ${pageNum}...`);
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n\n========== PAGE ${pageNum} ==========\n\n${pageText}`;
    }
    
    // Save to file
    const outputPath = '/home/ubuntu/dkb-pdf-extracted-text.txt';
    writeFileSync(outputPath, fullText, 'utf8');
    console.log(`\nText extracted successfully to: ${outputPath}`);
    console.log(`\nTotal characters extracted: ${fullText.length}`);
    
    // Also print first 2000 characters for quick preview
    console.log('\n\n========== PREVIEW (first 2000 chars) ==========\n');
    console.log(fullText.substring(0, 2000));
    
  } catch (error) {
    console.error('Error extracting text:', error);
    process.exit(1);
  }
}

// Run extraction
const pdfPath = '/home/ubuntu/Uploads/05.12.2025-A0MW0M-ISHSII-GL.CLEAN-ENER.TRA.U.ETF.pdf';
extractText(pdfPath);
