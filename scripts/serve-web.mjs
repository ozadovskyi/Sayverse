// Minimal static file server for the exported Expo web build (`dist/`).
// Used by Playwright's `webServer` — a plain static serve is more
// deterministic in CI than the Expo dev server. Zero dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8765;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const requested = join(DIST, normalize(urlPath));

  let filePath = requested;
  let body;
  try {
    if (urlPath === '/' || !requested.startsWith(DIST)) throw new Error('index');
    body = await readFile(requested);
  } catch {
    // Single-page-app fallback — unknown routes serve index.html.
    filePath = join(DIST, 'index.html');
    body = await readFile(filePath);
  }

  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
  });
  res.end(body);
}).listen(PORT, () => {
  console.log(`Serving dist/ on http://localhost:${PORT}`);
});
