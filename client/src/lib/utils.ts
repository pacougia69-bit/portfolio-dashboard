import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Versteht deutsches ("1.265,2632") und englisches ("1265.2632") Zahlenformat.
// Fuer alle Zahlen-Eingabefelder verwenden, die per Hand (DKB-Fallback,
// Dividenden, Steuer) statt per Copy-Paste ausgefuellt werden.
export function parseGermanNumber(value: string): number {
  const v = String(value).trim();
  if (v.includes(",")) {
    return parseFloat(v.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(v);
}
