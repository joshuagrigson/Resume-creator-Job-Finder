/**
 * Node entry. One process serves the built SPA (dist/) and /api/*.
 *
 *   npm run dev:server   → API only on :8787 (Vite dev server proxies /api here)
 *   npm start            → serves dist/ + API on $PORT (Render)
 *
 * The app itself lives in server/app.ts so the Cloudflare Worker (server/worker.ts) can share it.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp as buildApp, type AppOptions } from './app';
import { getAiStatus } from './ai/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../dist');

/** The Node app: API plus dist/ when a build exists. */
export function createApp(options: AppOptions = {}) {
  return buildApp({ distDir, ...options });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  const app = createApp();
  app.listen(port, () => {
    const ai = getAiStatus();
    console.log(`[server] listening on http://localhost:${port}  (static: ${fs.existsSync(distDir) ? 'dist/' : 'off'}, ai: ${ai.enabled ? ai.model : 'off'})`);
  });
}
