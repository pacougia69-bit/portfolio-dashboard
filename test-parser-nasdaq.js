/**
 * Test script to verify DKB parser regex patterns
 */

// Simulated PDF text based on the uploaded document
const testText = `
DKB
Deutsche Kreditbank AG

10919 Berlin

Depotnummer 502934789
Kundennummer 7000959111
Raphael Maaben
Auftragsnummer 279676/84.00
Herrn Datum 05.01.2026
Raphael Maaben Rechnungsnummer W00883-0000264432/26
Obere Str. 18a Umsatzsteuer-ID DE137178746
32816 Schieder-Schwalenberg

Wertpapier Abrechnung Kauf

Nominale Wertpapierbezeichnung ISIN (WKN)
Stück 0,3077 ISHARE.NASDAQ-100 UCITS ETF DE DE000A0F5UF5 (A0F5UF)
INHABER-ANTEILE

Handels-/Ausführungsplatz Außerbörslich

Schlusstag/-Zeit 05.01.2026 12:07:11 Auftraggeber Raphael Maaben
Ausführungskurs 211,25 EUR Auftragserteilung/-ort sonstige

Girosammeldepot Sammelurkunde/-eintragung

Kurswert 65,00- EUR
Provision 1,50- EUR
Ausmachender Betrag 66,50- EUR

maximal möglicher Rücknahmeabschlag 1,00 %
Ausgabeaufschlag pro Anteil 0,00 %

Den Gegenwert buchen wir mit Valuta 07.01.2026 zu Lasten des Kontos 1064186594
(IBAN DE03 1203 0000 1064 1865 94), BLZ 12030000 (BIC BYLADEM1001).
Die Wertpapiere schreiben wir Ihrem Depotkonto gut.

Sofern keine Umsatzsteuer ausgewiesen ist, handelt es sich um eine umsatzsteuerbefreite Finanzdienstleistung.

Gegenpartei bei diesem Geschäft war Börse Tradegate
ABR_OHNE AUSGABEAUFSCHLAG
Ihr ETF-Sparplan Nr. 11
`;

console.log('🔍 Testing DKB Parser Regex Patterns');
console.log('=====================================\n');

// Test 1: ISIN/WKN extraction
console.log('Test 1: ISIN/WKN Extraction');
console.log('----------------------------');
const isinWknMatch = testText.match(/([A-Z]{2}[A-Z0-9]{10})\s*\(([A-Z0-9]{6})\)/);
if (isinWknMatch) {
  console.log('✅ MATCH FOUND');
  console.log(`   ISIN: ${isinWknMatch[1]}`);
  console.log(`   WKN: ${isinWknMatch[2]}`);
} else {
  console.log('❌ NO MATCH');

  // Try alternative patterns
  console.log('\nTrying alternative patterns:');

  // Pattern 1: With more flexible spacing
  const alt1 = testText.match(/([A-Z]{2}[A-Z0-9]{10})\s+\(([A-Z0-9]{6})\)/);
  console.log(`Pattern 1 (flexible spacing): ${alt1 ? '✅ MATCH' : '❌ NO MATCH'}`);
  if (alt1) console.log(`   ISIN: ${alt1[1]}, WKN: ${alt1[2]}`);

  // Pattern 2: Look for DE000A0F5UF5 specifically
  const alt2 = testText.match(/(DE000A0F5UF5)/);
  console.log(`Pattern 2 (DE000A0F5UF5): ${alt2 ? '✅ FOUND' : '❌ NOT FOUND'}`);

  // Pattern 3: Look for (A0F5UF)
  const alt3 = testText.match(/\(([A-Z0-9]{6})\)/);
  console.log(`Pattern 3 ((A0F5UF)): ${alt3 ? '✅ FOUND' : '❌ NOT FOUND'}`);
  if (alt3) console.log(`   WKN: ${alt3[1]}`);
}

// Test 2: Name extraction
console.log('\n\nTest 2: Security Name Extraction');
console.log('----------------------------------');
const nameMatch = testText.match(/St[üu]ck\s+[\d,]+\s*([^\n]+(?:\n[^\n]+)?)\s*[A-Z]{2}[A-Z0-9]{10}/);
if (nameMatch) {
  console.log('✅ MATCH FOUND');
  console.log(`   Name: ${nameMatch[1].replace(/\s+/g, ' ').trim()}`);
} else {
  console.log('❌ NO MATCH');

  // Try to find what's between Stück and ISIN
  const betweenMatch = testText.match(/St[üu]ck\s+[\d,]+\s*([^\n]+)/);
  if (betweenMatch) {
    console.log(`\nFound after Stück: "${betweenMatch[1]}"`);
  }
}

// Test 3: Quantity extraction
console.log('\n\nTest 3: Quantity Extraction');
console.log('----------------------------');
const quantityMatch = testText.match(/St[üu]ck\s+([\d,]+)/);
if (quantityMatch) {
  console.log('✅ MATCH FOUND');
  console.log(`   Quantity (raw): ${quantityMatch[1]}`);
  const quantity = parseFloat(quantityMatch[1].replace(',', '.'));
  console.log(`   Quantity (parsed): ${quantity}`);
  console.log(`   Is 0.3077? ${quantity === 0.3077 ? '✅ YES' : '❌ NO'}`);
} else {
  console.log('❌ NO MATCH');
}

// Test 4: Price extraction
console.log('\n\nTest 4: Price Extraction');
console.log('------------------------');
const priceMatch = testText.match(/Ausf[üu]hrungskurs\s*([\d,]+)\s+EUR/);
if (priceMatch) {
  console.log('✅ MATCH FOUND');
  console.log(`   Price (raw): ${priceMatch[1]}`);
  const price = parseFloat(priceMatch[1].replace(',', '.'));
  console.log(`   Price (parsed): ${price} EUR`);
} else {
  console.log('❌ NO MATCH');
}

// Test 5: Date extraction
console.log('\n\nTest 5: Date Extraction');
console.log('------------------------');
const dateMatch = testText.match(/Schlusstag\/-Zeit\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
if (dateMatch) {
  console.log('✅ MATCH FOUND');
  console.log(`   Date: ${dateMatch[1]}`);
  console.log(`   Time: ${dateMatch[2]}`);
} else {
  console.log('❌ NO MATCH');
}

// Test 6: Total amount
console.log('\n\nTest 6: Total Amount Extraction');
console.log('--------------------------------');
const totalMatch = testText.match(/Ausmachender Betrag\s*([\d,]+)-?\s*EUR/);
if (totalMatch) {
  console.log('✅ MATCH FOUND');
  console.log(`   Total (raw): ${totalMatch[1]}`);
  const total = parseFloat(totalMatch[1].replace(',', '.'));
  console.log(`   Total (parsed): ${total} EUR`);
} else {
  console.log('❌ NO MATCH');
}

console.log('\n=====================================');
console.log('🏁 Test Complete');
