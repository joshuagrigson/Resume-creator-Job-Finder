/**
 * The Express app: /api/* plus, on Node, the built SPA. Shared by both entry points —
 *
 *   server/index.ts   Node (npm start, Render): serves dist/ and the API on $PORT
 *   server/worker.ts  Cloudflare Workers: the API only; Workers static assets serve dist/
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import type { ApiError, HealthResponse } from '../shared/types';
import { jobsRouter } from './routes/jobs';
import { listSourceConfig } from './jobs/index';
import { aiRouter } from './routes/ai';
import { getAiStatus } from './ai/index';

// Workers freeze the clock at 0 during startup, so uptime starts at the first request instead.
let startedAt: number | null = null;
const VERSION = process.env.npm_package_version ?? '0.1.0';

export interface AppOptions {
  /** Built SPA to serve alongside the API. Omit where something else serves it (Cloudflare assets). */
  distDir?: string;
  /** gzip responses here. Off on Cloudflare, which compresses at the edge. */
  compress?: boolean;
}

export function createApp({ distDir, compress = true }: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Only trust a forwarding header when something in front of us actually sets one.
  // Trusting it unconditionally lets a direct client put any address in
  // X-Forwarded-For, which becomes req.ip and defeats the AI rate limit.
  // Render (and most PaaS) set a platform variable we can key off; TRUST_PROXY=1
  // covers everything else.
  const behindProxy = process.env.TRUST_PROXY === '1' || Boolean(process.env.RENDER);
  if (behindProxy) app.set('trust proxy', 1);
  if (compress) app.use(compression());
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
      uptimeSeconds: Math.round((Date.now() - (startedAt ??= Date.now())) / 1000),
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
  if (distDir && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(
      express.static(distDir, {
        index: false,
        // /privacy and /terms resolve to the .html pages, the same clean URLs Cloudflare serves.
        extensions: ['html'],
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
