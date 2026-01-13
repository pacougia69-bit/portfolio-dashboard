/**
 * Detailed DKB Parser Test with Error Detection
 */

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
`;

console.log('🧪 DKB Parser Detailed Test');
console.log('============================\n');

let allTestsPassed = true;

// Test Order Number
console.log('1️⃣  Auftragsnummer');
const orderMatch = testText.match(/Auftragsnummer\s*(\d+\/[\d.]+)/);
if (orderMatch) {
  console.log(`   ✅ FOUND: ${orderMatch[1]}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  console.log(`   Searching for: "Auftragsnummer"`);
  const search = testText.indexOf('Auftragsnummer');
  if (search >= 0) {
    const snippet = testText.substring(search, search + 50);
    console.log(`   Found text: "${snippet}"`);
  }
  allTestsPassed = false;
}

// Test Invoice Number
console.log('\n2️⃣  Rechnungsnummer');
const invoiceMatch = testText.match(/Rechnungsnummer\s*(W\d+-\d+\/\d+)/);
if (invoiceMatch) {
  console.log(`   ✅ FOUND: ${invoiceMatch[1]}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  console.log(`   Searching for: "Rechnungsnummer"`);
  const search = testText.indexOf('Rechnungsnummer');
  if (search >= 0) {
    const snippet = testText.substring(search, search + 60);
    console.log(`   Found text: "${snippet}"`);
  }
  allTestsPassed = false;
}

// Test Date
console.log('\n3️⃣  Schlusstag/-Zeit');
const dateMatch = testText.match(/Schlusstag\/-Zeit\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
if (dateMatch) {
  console.log(`   ✅ FOUND: ${dateMatch[1]} ${dateMatch[2]}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  const search = testText.indexOf('Schlusstag');
  if (search >= 0) {
    const snippet = testText.substring(search, search + 60);
    console.log(`   Found text: "${snippet}"`);
  }
  allTestsPassed = false;
}

// Test Transaction Type
console.log('\n4️⃣  Transaction Type');
if (testText.includes('Wertpapier Abrechnung Kauf')) {
  console.log(`   ✅ FOUND: Kauf`);
} else {
  console.log(`   ❌ NOT FOUND`);
  allTestsPassed = false;
}

// Test ISIN/WKN
console.log('\n5️⃣  ISIN/WKN');
const isinMatch = testText.match(/([A-Z]{2}[A-Z0-9]{10})\s*\(([A-Z0-9]{6})\)/);
if (isinMatch) {
  console.log(`   ✅ FOUND: ISIN=${isinMatch[1]}, WKN=${isinMatch[2]}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  allTestsPassed = false;
}

// Test Name
console.log('\n6️⃣  Security Name');
const nameMatch = testText.match(/St[üu]ck\s+[\d,]+\s*([^\n]+(?:\n[^\n]+)?)\s*[A-Z]{2}[A-Z0-9]{10}/);
if (nameMatch) {
  console.log(`   ✅ FOUND: ${nameMatch[1].replace(/\s+/g, ' ').trim()}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  allTestsPassed = false;
}

// Test Quantity
console.log('\n7️⃣  Quantity');
const quantityMatch = testText.match(/St[üu]ck\s+([\d,]+)/);
if (quantityMatch) {
  const qty = parseFloat(quantityMatch[1].replace(',', '.'));
  console.log(`   ✅ FOUND: ${quantityMatch[1]} → ${qty}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  allTestsPassed = false;
}

// Test Price
console.log('\n8️⃣  Ausführungskurs');
const priceMatch = testText.match(/Ausf[üu]hrungskurs\s*([\d,]+)\s+EUR/);
if (priceMatch) {
  const price = parseFloat(priceMatch[1].replace(',', '.'));
  console.log(`   ✅ FOUND: ${priceMatch[1]} EUR → ${price}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  allTestsPassed = false;
}

// Test Fees
console.log('\n9️⃣  Provision');
const feesMatch = testText.match(/Provision\s*([\d,]+)-?\s*EUR/);
if (feesMatch) {
  const fees = parseFloat(feesMatch[1].replace(',', '.'));
  console.log(`   ✅ FOUND: ${feesMatch[1]} EUR → ${fees}`);
} else {
  console.log(`   ⚠️  NOT FOUND (optional, will default to 0)`);
}

// Test Total
console.log('\n🔟 Ausmachender Betrag');
const totalMatch = testText.match(/Ausmachender Betrag\s*([\d,]+)-?\s*EUR/);
if (totalMatch) {
  const total = parseFloat(totalMatch[1].replace(',', '.'));
  console.log(`   ✅ FOUND: ${totalMatch[1]} EUR → ${total}`);
} else {
  console.log(`   ❌ NOT FOUND`);
  allTestsPassed = false;
}

console.log('\n============================');
if (allTestsPassed) {
  console.log('✅ ALL TESTS PASSED');
  console.log('\nThe parser should work correctly!');
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('\nThe parser will throw an error.');
}
