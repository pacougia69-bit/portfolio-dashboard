import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('🚀 STEP 1: Server starting...');

  console.log('📦 STEP 2: Initializing Express app...');
  const app = express();
  const server = createServer(app);
  console.log('✅ STEP 3: Express initialized');

  // dist/server -> dist/public
  const staticPath = path.resolve(__dirname, "..", "public");

  // 1) Statische Dateien (JS, CSS, Bilder) direkt ausliefern
  app.use(express.static(staticPath));

  // 2) Nur HTML‑Routen auf index.html umleiten
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/assets") ||
      req.path.match(/.(js|css|png|jpg|jpeg|svg|ico|webp|map)$/)
    ) {
      return next();
    }
    res.sendFile(path.join(staticPath, "index.html"));
  });

  console.log('🌐 STEP 4: Starting HTTP server...');
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

console.log('🔥 Starting server initialization...');
startServer().catch((error) => {
  console.error('❌❌❌ FATAL ERROR during server start:');
  console.error(error);
  process.exit(1);
});