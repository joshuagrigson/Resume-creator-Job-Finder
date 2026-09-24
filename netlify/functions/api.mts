/**
 * Netlify entry. Netlify's CDN serves the built SPA (dist/); only /api/* reaches this function.
 *
 * Express runs unchanged: the first request starts it on a loopback port inside the function
 * and every request is passed through to it, so this host behaves exactly like `npm start`.
 * A warm function reuses the running server; a cold one pays ~1 s to start it and load the
 * Census ZIP tables (shipped via netlify.toml → included_files).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { setGeoSource, warmGeo, type GeoFile } from '../../server/geo/index';
import { createApp } from '../../server/app';

let origin: Promise<string> | null = null;

function geoPath(file: GeoFile): string {
  const candidates = [
    path.join(process.cwd(), 'server/geo/data', file),
    path.join('/var/task/server/geo/data', file),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

function start(): Promise<string> {
  // Netlify stops a function at 10 s, so each job board gets 6 s instead of the default 8.
  process.env.JOB_SOURCE_TIMEOUT_MS ??= '6000';
  setGeoSource((file) => readFileSync(geoPath(file), 'utf8'));
  warmGeo();
  const server = createApp({ compress: false }).listen(0, '127.0.0.1');
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
    server.once('error', reject);
  });
}

export default async (req: Request) => {
  origin ??= start();
  const url = new URL(req.url);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const res = await fetch((await origin) + url.pathname + url.search, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
  });
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  headers.delete('connection');
  return new Response(res.body, { status: res.status, headers });
};

export const config = { path: '/api/*' };
