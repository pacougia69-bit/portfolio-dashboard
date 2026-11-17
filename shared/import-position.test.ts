import { describe, it, expect } from 'vitest';
import { waehleImportPosition } from './import-position';

// XAIX (A2N6LC): id 92 = Altbestand (50 Stück), id 122 = Neukäufe
const ALT = { id: 92, amount: '50.0000' };
const NEU = { id: 122, amount: '27.6106' };

describe('waehleImportPosition', () => {
  it('keine Position: null', () => {
    expect(waehleImportPosition([], 'Kauf', 1)).toBeNull();
  });

  it('eine Position: genau diese', () => {
    expect(waehleImportPosition([ALT], 'Kauf', 3)).toBe(ALT);
  });

  it('Kauf bei zwei Positionen: Neukäufe (höchste id), egal in welcher Reihenfolge', () => {
    expect(waehleImportPosition([ALT, NEU], 'Kauf', 1.4)).toBe(NEU);
    expect(waehleImportPosition([NEU, ALT], 'Kauf', 1.4)).toBe(NEU);
  });

  it('Sparplan wie Kauf: Neukäufe', () => {
    expect(waehleImportPosition([ALT, NEU], 'Sparplan', 1.4)).toBe(NEU);
  });

  it('Verkauf, der in die Neukäufe passt: Neukäufe zuerst', () => {
    expect(waehleImportPosition([ALT, NEU], 'Verkauf', 10)).toBe(NEU);
  });

  it('Verkauf größer als die Neukäufe: Altbestand, damit nichts verloren geht', () => {
    expect(waehleImportPosition([ALT, NEU], 'Verkauf', 40)).toBe(ALT);
  });

  it('Verkauf größer als alles: bleibt bei der neuesten', () => {
    expect(waehleImportPosition([ALT, NEU], 'Verkauf', 500)).toBe(NEU);
  });

  it('Verkauf genau in Höhe der Neukäufe: Neukäufe (Rundung)', () => {
    expect(waehleImportPosition([ALT, NEU], 'Verkauf', 27.6106)).toBe(NEU);
  });
});
