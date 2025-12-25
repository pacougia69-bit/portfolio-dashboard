import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

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
      return next(); // das sind Dateien, nicht index.html
    }
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);