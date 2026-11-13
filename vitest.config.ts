import { defineConfig } from 'vitest/config';
import path from 'path';

// Bewusst NUR die eigenen, netzwerkfreien Tests unter shared/.
// Hintergrund: vite.config.ts setzt root = client/, dadurch fand "vitest run" bisher keine
// Tests in server/. Die alten Tests dort (z. B. twelvedata.test.ts) brauchen echte
// API-Schluessel und Netz und sollen nicht versehentlich mitlaufen.
export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: { '@shared': path.resolve(import.meta.dirname, 'shared') },
  },
  test: {
    environment: 'node',
    // server/ausstieg.test.ts ersetzt Datenbank und Netz durch Attrappen, läuft also ohne beides.
    include: ['shared/**/*.test.ts', 'server/ausstieg.test.ts', 'server/sql-vergleich.test.ts'],
  },
});
