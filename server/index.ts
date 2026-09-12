/**
 * API + static server. One process serves the built SPA (dist/) and /api/*.
 *
 *   npm run dev:server   → API only on :8787 (Vite dev server proxies /api here)
 *   npm start            → serves dist/ + API on $PORT (Render)
 *
 * Owned by the integration lead; feature modules live in server/jobs and server/ai.
 */
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiError, HealthResponse } from '../shared/types';
import { jobsRouter } from './routes/jobs';
import { listSourceConfig } from './jobs/index';
import { aiRouter } from './routes/ai';
import { getAiStatus } from './ai/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../dist');
const startedAt = Date.now();
const VERSION = process.env.npm_package_version ?? '0.1.0';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0 || process.env.NODE_ENV !== 'production') {
    app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : true }));
  }

  // Basic security headers (no external CSS/JS is loaded, so a strict-ish CSP is safe).
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      ok: true,
      version: VERSION,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      ai: getAiStatus(),
      sources: listSourceConfig(),
    };
    res.json(body);
  });

  app.use('/api/jobs', jobsRouter);
  app.use('/api/ai', aiRouter);

  app.use('/api', (_req, res) => {
    const body: ApiError = { error: 'Not found', code: 'not_found' };
    res.status(404).json(body);
  });

  // Static SPA (only when a build exists).
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (/\/assets\//.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api/')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .type('text/plain')
        .send('API server is running. Build the UI with `npm run build` to serve it from here, or use `npm run dev`.');
    });
  }

  // Error handler — never leak stack traces to clients.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: number; statusCode?: number; message?: string; type?: string };
    const status = e.status ?? e.statusCode ?? 500;
    const body: ApiError = {
      error: status === 500 ? 'Internal server error' : e.message || 'Request failed',
      code: e.type === 'entity.too.large' ? 'payload_too_large' : status === 500 ? 'internal' : 'bad_request',
    };
    if (status === 500) console.error('[server] unhandled error:', err);
    res.status(status).json(body);
  });

  return app;
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
