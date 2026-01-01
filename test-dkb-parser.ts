// Test script to debug DKB parser with real PDF
import { readFileSync } from 'fs';
import { parseDKBPDF } from './server/dkb-parser';

async function testParser() {
  try {
    console.log('Reading PDF file...');
    const pdfPath = '/home/ubuntu/Uploads/05.12.2025-A0MW0M-ISHSII-GL.CLEAN-ENER.TRA.U.ETF.pdf';
    const pdfBuffer = readFileSync(pdfPath);
    
    console.log('Parsing PDF...\n');
    const result = await parseDKBPDF(pdfBuffer);
    
    console.log('✅ SUCCESS! Transaction extracted:\n');
    console.log('Order Number:', result.orderNumber);
    console.log('Invoice Number:', result.invoiceNumber);
    console.log('Date:', result.date.toISOString());
    console.log('Type:', result.type);
    console.log('ISIN:', result.isin);
    console.log('WKN:', result.wkn);
    console.log('Name:', result.name);
    console.log('Quantity:', result.quantity);
    console.log('Price:', result.price);
    console.log('Fees:', result.fees);
    console.log('Total Amount:', result.totalAmount);
    
  } catch (error) {
    console.error('❌ PARSING FAILED:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    
    // Also show the full error for debugging
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

testParser();
